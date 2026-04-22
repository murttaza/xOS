import { StateCreator } from 'zustand';
import { PasswordEntry } from '@/types';
import { IpcChannels } from '@/shared/ipc-types';
import { isElectron } from '@/lib/platform';
import type { AppState } from './index';

const ipc = () => (isElectron ? window.ipcRenderer! : null);

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
        const r = ipc();
        if (!r) return;
        const rows = (await r.invoke(IpcChannels.GetPasswords)) as PasswordEntry[];
        set({ passwords: rows ?? [] });
    },

    createPassword: async (entry, plaintext) => {
        const r = ipc();
        if (!r) return;
        await r.invoke(IpcChannels.CreatePassword, { entry, plaintext });
        const rows = (await r.invoke(IpcChannels.GetPasswords)) as PasswordEntry[];
        set({ passwords: rows ?? [] });
    },

    updatePassword: async (entry, plaintext) => {
        const r = ipc();
        if (!r) return;
        await r.invoke(IpcChannels.UpdatePassword, { entry, plaintext });
        const rows = (await r.invoke(IpcChannels.GetPasswords)) as PasswordEntry[];
        set({ passwords: rows ?? [] });
    },

    deletePassword: async (id) => {
        const r = ipc();
        if (!r) return;
        await r.invoke(IpcChannels.DeletePassword, id);
        const rows = (await r.invoke(IpcChannels.GetPasswords)) as PasswordEntry[];
        set({ passwords: rows ?? [] });
    },

    revealPassword: async (id) => {
        const r = ipc();
        if (!r) return '';
        const pt = (await r.invoke(IpcChannels.RevealPassword, id)) as string;
        return pt || '';
    },

    touchPassword: async (id) => {
        const r = ipc();
        if (!r) return;
        await r.invoke(IpcChannels.TouchPassword, id);
        const rows = (await r.invoke(IpcChannels.GetPasswords)) as PasswordEntry[];
        set({ passwords: rows ?? [] });
    },

    togglePinPassword: async (id, isPinned) => {
        const r = ipc();
        if (!r) return;
        await r.invoke(IpcChannels.TogglePinPassword, { id, isPinned });
        const rows = (await r.invoke(IpcChannels.GetPasswords)) as PasswordEntry[];
        set({ passwords: rows ?? [] });
    },
});
