import type { PasswordEntry } from '../types';

/**
 * All IPC channel names used between renderer and main process.
 * Both sides import from here to keep channel strings in sync.
 *
 * NOTE: this file is the source of truth for the preload allow-list
 * (electron/preload.ts). A channel that isn't listed there is not callable
 * from any renderer, no matter what main registers. All app data sync goes
 * through Supabase — IPC is only for the local password vault, clipboard,
 * window management, and cross-window coordination.
 */
export const IpcChannels = {
  // Multi-window coordination
  DataChanged: 'data-changed',
  RequestAppState: 'request-app-state',
  AppStateResponse: 'app-state-response',
  OpenFullApp: 'open-full-app',

  // Auto-Launch
  SetAutoLaunch: 'set-auto-launch',
  GetAutoLaunch: 'get-auto-launch',

  // Idle Detection
  IdleTimerPaused: 'idle:timer-paused',
  IdleReturnPrompt: 'idle:return-prompt',
  IdleReturnResponse: 'idle:return-response',

  // Notifications
  SetNotificationPrefs: 'set-notification-prefs',
  GetNotificationPrefs: 'get-notification-prefs',

  // Passwords (Electron only — local encrypted storage)
  GetPasswords: 'get-passwords',
  CreatePassword: 'create-password',
  UpdatePassword: 'update-password',
  DeletePassword: 'delete-password',
  RevealPassword: 'reveal-password',
  TouchPassword: 'touch-password',
  TogglePinPassword: 'toggle-pin-password',

  // Vault lock (master passphrase layered over OS keychain)
  VaultStatus: 'vault-status',
  VaultSetup: 'vault-setup',
  VaultUnlock: 'vault-unlock',
  VaultLock: 'vault-lock',
  VaultChangePassphrase: 'vault-change-passphrase',
  VaultExport: 'vault-export',
  VaultImport: 'vault-import',
  VaultStateChanged: 'vault-state-changed',

  // Clipboard (Electron only — uses native clipboard module)
  ClipboardWrite: 'clipboard-write',
  ClipboardClearIfMatch: 'clipboard-clear-if-match',

  // Screen/audio capture arming (renderer must arm right before getDisplayMedia)
  ArmAudioCapture: 'arm-audio-capture',
} as const;

/** Union of all IPC channel name strings */
export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels];

// ── Vault payloads ──────────────────────────────────────────────────

export type VaultStatusResult = {
  /** OS-level encryption (DPAPI/keychain) is usable on this machine */
  encryptionAvailable: boolean;
  /** A master passphrase has been set up */
  configured: boolean;
  /** Vault is currently locked (only meaningful when configured) */
  locked: boolean;
};

export type VaultUnlockResult = {
  ok: boolean;
  /** When rate-limited, how long until the next attempt is allowed */
  retryInMs?: number;
  error?: string;
};

export type VaultExportArgs = { passphrase: string };
export type VaultExportResult = { ok: boolean; canceled?: boolean; path?: string; count?: number; error?: string };
export type VaultImportArgs = { passphrase: string };
export type VaultImportResult = { ok: boolean; canceled?: boolean; imported?: number; error?: string };
export type VaultChangePassphraseArgs = { current: string; next: string };

// ── Per-channel handler signatures ──────────────────────────────────

/**
 * Maps every invoke-style IPC channel to its (args → return) signature.
 * `args` is what the renderer sends; the return type is what the
 * handler resolves with.
 */
export interface IpcHandlerMap {
  // Passwords
  [IpcChannels.GetPasswords]: () => PasswordEntry[];
  [IpcChannels.CreatePassword]: (args: { entry: Omit<PasswordEntry, 'id'>; plaintext: string }) => number;
  [IpcChannels.UpdatePassword]: (args: { entry: PasswordEntry; plaintext?: string }) => unknown;
  [IpcChannels.DeletePassword]: (id: number) => unknown;
  [IpcChannels.RevealPassword]: (id: number) => string;
  [IpcChannels.TouchPassword]: (id: number) => unknown;
  [IpcChannels.TogglePinPassword]: (args: { id: number; isPinned: number }) => unknown;

  // Vault lock
  [IpcChannels.VaultStatus]: () => VaultStatusResult;
  [IpcChannels.VaultSetup]: (passphrase: string) => VaultUnlockResult;
  [IpcChannels.VaultUnlock]: (passphrase: string) => VaultUnlockResult;
  [IpcChannels.VaultLock]: () => void;
  [IpcChannels.VaultChangePassphrase]: (args: VaultChangePassphraseArgs) => VaultUnlockResult;
  [IpcChannels.VaultExport]: (args: VaultExportArgs) => VaultExportResult;
  [IpcChannels.VaultImport]: (args: VaultImportArgs) => VaultImportResult;

  // Clipboard
  [IpcChannels.ClipboardWrite]: (text: string) => boolean;
  [IpcChannels.ClipboardClearIfMatch]: (text: string) => boolean;

  // Auto-launch / notification prefs
  [IpcChannels.SetAutoLaunch]: (enabled: boolean) => void;
  [IpcChannels.GetAutoLaunch]: () => boolean;
  [IpcChannels.SetNotificationPrefs]: (prefs: unknown) => void;
  [IpcChannels.GetNotificationPrefs]: () => unknown;
}

// ── Preload allow-lists ─────────────────────────────────────────────
// Channels each window type may use, by direction. The preload reads its
// window type from a --mos-window= process argument and refuses anything
// not listed for it. Keep these tight: every entry is renderer-reachable
// attack surface.

type ChannelLists = {
  invoke: readonly string[];
  send: readonly string[];
  listen: readonly string[];
};

const MAIN_WINDOW_CHANNELS: ChannelLists = {
  invoke: [
    IpcChannels.GetAutoLaunch,
    IpcChannels.SetAutoLaunch,
    IpcChannels.GetNotificationPrefs,
    IpcChannels.SetNotificationPrefs,
    IpcChannels.AppStateResponse,
    IpcChannels.GetPasswords,
    IpcChannels.CreatePassword,
    IpcChannels.UpdatePassword,
    IpcChannels.DeletePassword,
    IpcChannels.RevealPassword,
    IpcChannels.TouchPassword,
    IpcChannels.TogglePinPassword,
    IpcChannels.VaultStatus,
    IpcChannels.VaultSetup,
    IpcChannels.VaultUnlock,
    IpcChannels.VaultLock,
    IpcChannels.VaultChangePassphrase,
    IpcChannels.VaultExport,
    IpcChannels.VaultImport,
    IpcChannels.ClipboardWrite,
    IpcChannels.ClipboardClearIfMatch,
  ],
  send: [
    'minimize-window',
    'maximize-window',
    'close-window',
    'set-window-size',
    'toggle-pin',
    'set-ignore-mouse-events',
    'set-overlay-mode',
    IpcChannels.DataChanged,
    IpcChannels.OpenFullApp,
    IpcChannels.IdleReturnResponse,
    IpcChannels.ArmAudioCapture,
  ],
  listen: [
    'main-process-message',
    'window-maximized',
    'window-focus-state',
    'window-size-state',
    'toggle-notes-mode',
    'toggle-year-mode',
    'toggle-budget-mode',
    'toggle-fitness-mode',
    'toggle-passwords-mode',
    'tray-toggle-timer',
    IpcChannels.RequestAppState,
    IpcChannels.DataChanged,
    IpcChannels.IdleTimerPaused,
    IpcChannels.IdleReturnPrompt,
    IpcChannels.VaultStateChanged,
  ],
};

const PALETTE_WINDOW_CHANNELS: ChannelLists = {
  invoke: [],
  send: [IpcChannels.DataChanged, 'hide-palette'],
  listen: [],
};

const WIDGET_WINDOW_CHANNELS: ChannelLists = {
  invoke: [],
  send: [IpcChannels.OpenFullApp, 'widget-drag'],
  listen: [IpcChannels.DataChanged],
};

export const WINDOW_CHANNEL_LISTS: Record<string, ChannelLists> = {
  main: MAIN_WINDOW_CHANNELS,
  palette: PALETTE_WINDOW_CHANNELS,
  widget: WIDGET_WINDOW_CHANNELS,
};

/** CLI flag used to tell the preload which window it is serving */
export const WINDOW_KIND_ARG = '--mos-window=';
