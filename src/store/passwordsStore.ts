import { StateCreator } from 'zustand';
import { PasswordEntry } from '@/types';
import {
    IpcChannels,
    type VaultStatusResult,
    type VaultUnlockResult,
    type VaultExportResult,
    type VaultImportResult,
} from '@/shared/ipc-types';
import { isElectron } from '@/lib/platform';
import type { AppState } from './index';

// Passwords mode is Electron-only by design (local vault encrypted via OS keychain).
// Throwing — instead of silently no-oping — surfaces accidental web invocations as
// loud errors. The UI gate in App.tsx prevents reaching this in normal flow.
const requireIpc = () => {
    if (!isElectron || !window.ipcRenderer) {
        throw new Error('Passwords mode is desktop-only and not available on the web.');
    }
    return window.ipcRenderer;
};

/** Electron prefixes invoke rejections; match on the original message. */
export const isVaultLockedError = (err: unknown): boolean =>
    err instanceof Error && err.message.includes('vault-locked');

export interface PasswordsSlice {
    passwords: PasswordEntry[];
    vaultStatus: VaultStatusResult | null;

    fetchVaultStatus: () => Promise<VaultStatusResult | null>;
    /** Applies a status pushed from the main process (auto-lock, other windows). */
    applyVaultState: (status: VaultStatusResult) => void;
    setupVault: (passphrase: string) => Promise<VaultUnlockResult>;
    unlockVault: (passphrase: string) => Promise<VaultUnlockResult>;
    lockVault: () => Promise<void>;
    changeVaultPassphrase: (current: string, next: string) => Promise<VaultUnlockResult>;
    exportVaultBackup: (passphrase: string) => Promise<VaultExportResult>;
    importVaultBackup: (passphrase: string) => Promise<VaultImportResult>;

    fetchPasswords: () => Promise<void>;
    createPassword: (entry: Omit<PasswordEntry, 'id'>, plaintext: string) => Promise<void>;
    updatePassword: (entry: PasswordEntry, plaintext?: string) => Promise<void>;
    deletePassword: (id: number) => Promise<void>;
    revealPassword: (id: number) => Promise<string>;
    touchPassword: (id: number) => Promise<void>;
    togglePinPassword: (id: number, isPinned: number) => Promise<void>;
}

export const createPasswordsSlice: StateCreator<AppState, [], [], PasswordsSlice> = (set, get) => ({
    passwords: [],
    vaultStatus: null,

    fetchVaultStatus: async () => {
        if (!isElectron) return null;
        const r = requireIpc();
        const status = (await r.invoke(IpcChannels.VaultStatus)) as VaultStatusResult;
        get().applyVaultState(status);
        return status;
    },

    applyVaultState: (status) => {
        set({ vaultStatus: status });
        // Never keep vault contents (even metadata) in renderer memory while locked.
        if (status.locked) set({ passwords: [] });
    },

    setupVault: async (passphrase) => {
        const r = requireIpc();
        const result = (await r.invoke(IpcChannels.VaultSetup, passphrase)) as VaultUnlockResult;
        await get().fetchVaultStatus();
        return result;
    },

    unlockVault: async (passphrase) => {
        const r = requireIpc();
        const result = (await r.invoke(IpcChannels.VaultUnlock, passphrase)) as VaultUnlockResult;
        await get().fetchVaultStatus();
        if (result.ok) await get().fetchPasswords();
        return result;
    },

    lockVault: async () => {
        const r = requireIpc();
        await r.invoke(IpcChannels.VaultLock);
        await get().fetchVaultStatus();
    },

    changeVaultPassphrase: async (current, next) => {
        const r = requireIpc();
        return (await r.invoke(IpcChannels.VaultChangePassphrase, { current, next })) as VaultUnlockResult;
    },

    exportVaultBackup: async (passphrase) => {
        const r = requireIpc();
        return (await r.invoke(IpcChannels.VaultExport, { passphrase })) as VaultExportResult;
    },

    importVaultBackup: async (passphrase) => {
        const r = requireIpc();
        const result = (await r.invoke(IpcChannels.VaultImport, { passphrase })) as VaultImportResult;
        if (result.ok) await get().fetchPasswords();
        return result;
    },

    fetchPasswords: async () => {
        if (!isElectron) return; // No-op on web — mode is hidden, but fetch can still be called from store init.
        const r = requireIpc();
        try {
            const rows = (await r.invoke(IpcChannels.GetPasswords)) as PasswordEntry[];
            set({ passwords: rows ?? [] });
        } catch (err) {
            if (isVaultLockedError(err)) {
                await get().fetchVaultStatus();
                return;
            }
            throw err;
        }
    },

    createPassword: async (entry, plaintext) => {
        const r = requireIpc();
        await r.invoke(IpcChannels.CreatePassword, { entry, plaintext });
        const rows = (await r.invoke(IpcChannels.GetPasswords)) as PasswordEntry[];
        set({ passwords: rows ?? [] });
    },

    updatePassword: async (entry, plaintext) => {
        const r = requireIpc();
        await r.invoke(IpcChannels.UpdatePassword, { entry, plaintext });
        const rows = (await r.invoke(IpcChannels.GetPasswords)) as PasswordEntry[];
        set({ passwords: rows ?? [] });
    },

    deletePassword: async (id) => {
        const r = requireIpc();
        await r.invoke(IpcChannels.DeletePassword, id);
        const rows = (await r.invoke(IpcChannels.GetPasswords)) as PasswordEntry[];
        set({ passwords: rows ?? [] });
    },

    revealPassword: async (id) => {
        const r = requireIpc();
        const pt = (await r.invoke(IpcChannels.RevealPassword, id)) as string;
        return pt || '';
    },

    touchPassword: async (id) => {
        const r = requireIpc();
        await r.invoke(IpcChannels.TouchPassword, id);
        const rows = (await r.invoke(IpcChannels.GetPasswords)) as PasswordEntry[];
        set({ passwords: rows ?? [] });
    },

    togglePinPassword: async (id, isPinned) => {
        const r = requireIpc();
        await r.invoke(IpcChannels.TogglePinPassword, { id, isPinned });
        const rows = (await r.invoke(IpcChannels.GetPasswords)) as PasswordEntry[];
        set({ passwords: rows ?? [] });
    },
});
