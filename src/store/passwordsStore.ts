import { StateCreator } from 'zustand';
import { PasswordEntry } from '@/types';
import { IpcChannels } from '@/shared/ipc-types';
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

export interface PasswordsSlice {
    passwords: PasswordEntry[];
    fetchPasswords: () => Promise<void>;
    createPassword: (entry: Omit<PasswordEntry, 'id'>, plaintext: string) => Promise<void>;
    updatePassword: (entry: PasswordEntry, plaintext?: string) => Promise<void>;
    deletePassword: (id: number) => Promise<void>;
    revealPassword: (id: number) => Promise<string>;
    touchPassword: (id: number) => Promise<void>;
    togglePinPassword: (id: number, isPinned: number) => Promise<void>;
}

export const createPasswordsSlice: StateCreator<AppState, [], [], PasswordsSlice> = (set) => ({
    passwords: [],

    fetchPasswords: async () => {
        if (!isElectron) return; // No-op on web — mode is hidden, but fetch can still be called from store init.
        const r = requireIpc();
        const rows = (await r.invoke(IpcChannels.GetPasswords)) as PasswordEntry[];
        set({ passwords: rows ?? [] });
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
