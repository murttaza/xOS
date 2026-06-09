import { safeStorage, dialog, powerMonitor, type BrowserWindow } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import db from './db'
import type { VaultStatusResult, VaultUnlockResult, VaultExportResult, VaultImportResult } from '../src/shared/ipc-types'

// ── Vault lock ──────────────────────────────────────────────────────
// Layered encryption for password secrets:
//
//   at rest = base64( DPAPI( AES-256-GCM( plaintext, scrypt(passphrase) ) ) )
//
// safeStorage (DPAPI/keychain) alone only binds secrets to the OS user
// account — anyone at an unlocked desktop could reveal everything. The
// master passphrase adds a second factor the OS can't hand out. Rows
// written before a passphrase exists use the legacy format (DPAPI only,
// no prefix) and are migrated in bulk during setup.
//
// Key material lives only in main-process memory while unlocked, and is
// zeroed on lock, idle timeout, screen lock, and suspend.

const V2_PREFIX = 'v2:'
const VERIFIER_PLAINTEXT = 'mos-vault-verifier-v2'
const MIN_PASSPHRASE_LENGTH = 10
const AUTO_LOCK_MS = 5 * 60 * 1000 // 5 minutes without vault activity
const KDF_PARAMS = { N: 32768, r: 8, p: 1 } // ~100ms, 32MB — interactive unlock
const MAX_FREE_ATTEMPTS = 5

let vaultKey: Buffer | null = null
let lastActivity = 0
let autoLockTimer: ReturnType<typeof setInterval> | null = null
let failedAttempts = 0
let lockedOutUntil = 0
let onStateChanged: (() => void) | null = null

const metaGet = db.prepare('SELECT value FROM vault_meta WHERE key = ?')
const metaSet = db.prepare('INSERT OR REPLACE INTO vault_meta (key, value) VALUES (?, ?)')

function getMeta(key: string): string | null {
  const row = metaGet.get(key) as { value: string } | undefined
  return row?.value ?? null
}

// ── Crypto primitives ───────────────────────────────────────────────

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase.normalize('NFKC'), salt, 32, {
    ...KDF_PARAMS,
    maxmem: 128 * 1024 * 1024,
  })
}

/** iv(12) || authTag(16) || ciphertext */
function gcmEncrypt(plaintext: Buffer, key: Buffer): Buffer {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ct])
}

function gcmDecrypt(blob: Buffer, key: Buffer): Buffer {
  const iv = blob.subarray(0, 12)
  const tag = blob.subarray(12, 28)
  const ct = blob.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()])
}

function dpapiWrap(data: Buffer): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption is not available on this system')
  }
  return safeStorage.encryptString(data.toString('base64')).toString('base64')
}

function dpapiUnwrap(stored: string): Buffer {
  return Buffer.from(safeStorage.decryptString(Buffer.from(stored, 'base64')), 'base64')
}

// ── State helpers ───────────────────────────────────────────────────

export function isConfigured(): boolean {
  return getMeta('verifier') !== null
}

export function isLocked(): boolean {
  return isConfigured() && vaultKey === null
}

export function getStatus(): VaultStatusResult {
  return {
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    configured: isConfigured(),
    locked: isLocked(),
  }
}

export function setOnStateChanged(cb: () => void) {
  onStateChanged = cb
}

function notifyStateChanged() {
  onStateChanged?.()
}

export function touchActivity() {
  lastActivity = Date.now()
}

function requireUnlockedKey(): Buffer {
  if (!isConfigured()) throw new Error('vault-not-configured')
  if (!vaultKey) throw new Error('vault-locked')
  touchActivity()
  return vaultKey
}

function setKey(key: Buffer | null) {
  if (vaultKey) vaultKey.fill(0)
  vaultKey = key
  if (key) touchActivity()
}

export function lock() {
  if (vaultKey === null) return
  setKey(null)
  notifyStateChanged()
}

// ── Secret encrypt/decrypt (used by the password IPC handlers) ─────

export function encryptSecret(plaintext: string): string {
  if (!isConfigured()) {
    // Legacy single-layer format (DPAPI only) until a passphrase is set up.
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS encryption is not available on this system')
    }
    return safeStorage.encryptString(plaintext).toString('base64')
  }
  const key = requireUnlockedKey()
  return V2_PREFIX + dpapiWrap(gcmEncrypt(Buffer.from(plaintext, 'utf8'), key))
}

export function decryptSecret(stored: string): string {
  if (!stored) return ''
  if (stored.startsWith(V2_PREFIX)) {
    const key = requireUnlockedKey()
    return gcmDecrypt(dpapiUnwrap(stored.slice(V2_PREFIX.length)), key).toString('utf8')
  }
  // Legacy DPAPI-only row
  return safeStorage.decryptString(Buffer.from(stored, 'base64'))
}

// ── Brute-force backoff ─────────────────────────────────────────────

function checkBackoff(): VaultUnlockResult | null {
  const now = Date.now()
  if (now < lockedOutUntil) {
    return { ok: false, retryInMs: lockedOutUntil - now, error: 'Too many attempts — try again shortly' }
  }
  return null
}

function recordFailure() {
  failedAttempts++
  if (failedAttempts >= MAX_FREE_ATTEMPTS) {
    const factor = Math.min(failedAttempts - MAX_FREE_ATTEMPTS, 4) // cap at 30s * 2^4 = 8 min
    lockedOutUntil = Date.now() + 30_000 * Math.pow(2, factor)
  }
}

function recordSuccess() {
  failedAttempts = 0
  lockedOutUntil = 0
}

// ── Setup / unlock / change ─────────────────────────────────────────

const allCipherRows = db.prepare('SELECT id, passwordEnc FROM passwords')
const updateCipher = db.prepare('UPDATE passwords SET passwordEnc = ? WHERE id = ?')

export function setup(passphrase: string): VaultUnlockResult {
  if (isConfigured()) return { ok: false, error: 'Vault is already configured' }
  if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return { ok: false, error: `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters` }
  }

  const salt = crypto.randomBytes(16)
  const key = deriveKey(passphrase, salt)

  // Migrate every legacy row to the layered format inside one transaction.
  const migrate = db.transaction(() => {
    const rows = allCipherRows.all() as { id: number; passwordEnc: string }[]
    for (const row of rows) {
      if (!row.passwordEnc || row.passwordEnc.startsWith(V2_PREFIX)) continue
      const plaintext = safeStorage.decryptString(Buffer.from(row.passwordEnc, 'base64'))
      updateCipher.run(V2_PREFIX + dpapiWrap(gcmEncrypt(Buffer.from(plaintext, 'utf8'), key)), row.id)
    }
    metaSet.run('kdf_salt', salt.toString('base64'))
    metaSet.run('kdf_params', JSON.stringify(KDF_PARAMS))
    metaSet.run('verifier', dpapiWrap(gcmEncrypt(Buffer.from(VERIFIER_PLAINTEXT, 'utf8'), key)))
    metaSet.run('version', '2')
  })
  migrate()

  setKey(key)
  recordSuccess()
  notifyStateChanged()
  return { ok: true }
}

export function unlock(passphrase: string): VaultUnlockResult {
  if (!isConfigured()) return { ok: false, error: 'Vault is not configured' }
  const backoff = checkBackoff()
  if (backoff) return backoff

  const salt = Buffer.from(getMeta('kdf_salt')!, 'base64')
  const key = deriveKey(passphrase, salt)
  try {
    const verifier = gcmDecrypt(dpapiUnwrap(getMeta('verifier')!), key).toString('utf8')
    if (verifier !== VERIFIER_PLAINTEXT) throw new Error('bad verifier')
  } catch {
    key.fill(0)
    recordFailure()
    const after = checkBackoff()
    return { ok: false, error: 'Incorrect passphrase', retryInMs: after?.retryInMs }
  }

  setKey(key)
  recordSuccess()
  notifyStateChanged()
  return { ok: true }
}

export function changePassphrase(current: string, next: string): VaultUnlockResult {
  if (!isConfigured()) return { ok: false, error: 'Vault is not configured' }
  if (typeof next !== 'string' || next.length < MIN_PASSPHRASE_LENGTH) {
    return { ok: false, error: `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters` }
  }
  const verify = unlock(current)
  if (!verify.ok) return verify

  const oldKey = vaultKey!
  const newSalt = crypto.randomBytes(16)
  const newKey = deriveKey(next, newSalt)

  const reencrypt = db.transaction(() => {
    const rows = allCipherRows.all() as { id: number; passwordEnc: string }[]
    for (const row of rows) {
      if (!row.passwordEnc) continue
      const plaintext = row.passwordEnc.startsWith(V2_PREFIX)
        ? gcmDecrypt(dpapiUnwrap(row.passwordEnc.slice(V2_PREFIX.length)), oldKey)
        : Buffer.from(safeStorage.decryptString(Buffer.from(row.passwordEnc, 'base64')), 'utf8')
      updateCipher.run(V2_PREFIX + dpapiWrap(gcmEncrypt(plaintext, newKey)), row.id)
    }
    metaSet.run('kdf_salt', newSalt.toString('base64'))
    metaSet.run('verifier', dpapiWrap(gcmEncrypt(Buffer.from(VERIFIER_PLAINTEXT, 'utf8'), newKey)))
  })
  reencrypt()

  setKey(newKey)
  notifyStateChanged()
  return { ok: true }
}

// ── Encrypted backup (portable — passphrase only, no DPAPI) ─────────

const allEntryRows = db.prepare(
  'SELECT id, name, username, passwordEnc, url, notes, category, isPinned, orderIndex, createdAt, updatedAt, lastUsed FROM passwords'
)
const insertEntry = db.prepare(
  'INSERT INTO passwords (name, username, passwordEnc, url, notes, category, isPinned, orderIndex, createdAt, updatedAt, lastUsed) VALUES (@name, @username, @passwordEnc, @url, @notes, @category, @isPinned, @orderIndex, @createdAt, @updatedAt, @lastUsed)'
)

type ExportEntry = {
  name: string; username: string; password: string; url: string; notes: string;
  category: string; isPinned: number; orderIndex: number;
  createdAt: string | null; updatedAt: string | null; lastUsed: string | null;
}

export async function exportVault(parent: BrowserWindow | null, passphrase: string): Promise<VaultExportResult> {
  if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return { ok: false, error: `Backup passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters` }
  }
  if (isLocked()) return { ok: false, error: 'vault-locked' }

  const rows = allEntryRows.all() as Array<Record<string, unknown> & { passwordEnc: string }>
  const entries: ExportEntry[] = rows.map((r) => ({
    name: String(r.name ?? ''),
    username: String(r.username ?? ''),
    password: decryptSecret(r.passwordEnc),
    url: String(r.url ?? ''),
    notes: String(r.notes ?? ''),
    category: String(r.category ?? ''),
    isPinned: Number(r.isPinned ?? 0),
    orderIndex: Number(r.orderIndex ?? 0),
    createdAt: (r.createdAt as string) ?? null,
    updatedAt: (r.updatedAt as string) ?? null,
    lastUsed: (r.lastUsed as string) ?? null,
  }))

  const salt = crypto.randomBytes(16)
  const key = deriveKey(passphrase, salt)
  const blob = gcmEncrypt(Buffer.from(JSON.stringify(entries), 'utf8'), key)
  key.fill(0)

  const payload = {
    format: 'mos-vault-backup',
    version: 2,
    kdf: { algo: 'scrypt', ...KDF_PARAMS, salt: salt.toString('base64') },
    data: blob.toString('base64'),
    exportedAt: new Date().toISOString(),
    count: entries.length,
  }

  // Electron's dialog distinguishes (window, options) from (options) by the
  // first argument's type — never pass undefined as the window.
  const saveOptions: Electron.SaveDialogOptions = {
    title: 'Export encrypted vault backup',
    defaultPath: `mOS_vault_backup_${new Date().toISOString().slice(0, 10)}.mosvault`,
    filters: [{ name: 'mOS Vault Backup', extensions: ['mosvault'] }],
  }
  const { canceled, filePath } = parent
    ? await dialog.showSaveDialog(parent, saveOptions)
    : await dialog.showSaveDialog(saveOptions)
  if (canceled || !filePath) return { ok: false, canceled: true }

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
  return { ok: true, path: filePath, count: entries.length }
}

export async function importVault(parent: BrowserWindow | null, passphrase: string): Promise<VaultImportResult> {
  if (isLocked()) return { ok: false, error: 'vault-locked' }

  const openOptions: Electron.OpenDialogOptions = {
    title: 'Import vault backup',
    filters: [{ name: 'mOS Vault Backup', extensions: ['mosvault', 'json'] }],
    properties: ['openFile'],
  }
  const { canceled, filePaths } = parent
    ? await dialog.showOpenDialog(parent, openOptions)
    : await dialog.showOpenDialog(openOptions)
  if (canceled || filePaths.length === 0) return { ok: false, canceled: true }

  let payload: { format?: string; version?: number; kdf?: { salt?: string; N?: number; r?: number; p?: number }; data?: string }
  try {
    payload = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'))
  } catch {
    return { ok: false, error: 'File is not a valid vault backup' }
  }
  if (payload.format !== 'mos-vault-backup' || !payload.kdf?.salt || !payload.data) {
    return { ok: false, error: 'File is not a valid vault backup' }
  }

  let entries: ExportEntry[]
  try {
    const salt = Buffer.from(payload.kdf.salt, 'base64')
    const key = crypto.scryptSync(passphrase.normalize('NFKC'), salt, 32, {
      N: payload.kdf.N ?? KDF_PARAMS.N,
      r: payload.kdf.r ?? KDF_PARAMS.r,
      p: payload.kdf.p ?? KDF_PARAMS.p,
      maxmem: 128 * 1024 * 1024,
    })
    entries = JSON.parse(gcmDecrypt(Buffer.from(payload.data, 'base64'), key).toString('utf8'))
    key.fill(0)
  } catch {
    return { ok: false, error: 'Incorrect passphrase or corrupted backup' }
  }
  if (!Array.isArray(entries)) return { ok: false, error: 'File is not a valid vault backup' }

  const now = new Date().toISOString()
  const insertAll = db.transaction(() => {
    for (const e of entries) {
      insertEntry.run({
        name: String(e.name ?? ''),
        username: String(e.username ?? ''),
        passwordEnc: encryptSecret(String(e.password ?? '')),
        url: String(e.url ?? ''),
        notes: String(e.notes ?? ''),
        category: String(e.category ?? ''),
        isPinned: e.isPinned ? 1 : 0,
        orderIndex: Number(e.orderIndex ?? 0),
        createdAt: e.createdAt ?? now,
        updatedAt: e.updatedAt ?? now,
        lastUsed: e.lastUsed ?? null,
      })
    }
  })
  insertAll()

  return { ok: true, imported: entries.length }
}

// ── Auto-lock ───────────────────────────────────────────────────────

export function startAutoLock() {
  if (autoLockTimer) return
  autoLockTimer = setInterval(() => {
    if (vaultKey && Date.now() - lastActivity > AUTO_LOCK_MS) {
      lock()
    }
  }, 30_000)

  // Lock immediately when the OS session locks or the machine sleeps.
  powerMonitor.on('lock-screen', lock)
  powerMonitor.on('suspend', lock)
}

export function stopAutoLock() {
  if (autoLockTimer) {
    clearInterval(autoLockTimer)
    autoLockTimer = null
  }
  powerMonitor.removeListener('lock-screen', lock)
  powerMonitor.removeListener('suspend', lock)
  lock()
}
