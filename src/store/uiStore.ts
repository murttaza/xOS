import { StateCreator } from 'zustand';
import { DevItem } from '@/types';
import { api } from '@/api';
import type { AppState } from './index';

export interface UiSlice {
    isFocusMode: boolean;
    setIsFocusMode: (isFocusMode: boolean) => void;

    isMurtazaMode: boolean;
    setIsMurtazaMode: (isMurtazaMode: boolean) => void;

    isHardcoreMode: boolean;
    setIsHardcoreMode: (isHardcoreMode: boolean) => void;

    isNotesMode: boolean;
    toggleNotesMode: () => void;

    isYearMode: boolean;
    toggleYearMode: () => void;

    isTransitioning: boolean;
    triggerTransition: (action: () => void) => Promise<void>;

    osPrefix: string;
    setOsPrefix: (prefix: string) => void;

    devItems: DevItem[];
    fetchDevItems: () => Promise<void>;
    addDevItem: (text: string) => Promise<void>;
    toggleDevItem: (id: number) => Promise<void>;
    deleteDevItem: (id: number) => Promise<void>;
}

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set, get) => ({
    isTransitioning: false,
    triggerTransition: async (action) => {
        set({ isTransitioning: true });
        await new Promise(r => setTimeout(r, 300));
        action();
        await new Promise(r => setTimeout(r, 200));
        set({ isTransitioning: false });
    },

    isFocusMode: false,
    setIsFocusMode: (isFocusMode) => {
        get().triggerTransition(() => set({ isFocusMode, isNotesMode: false, isYearMode: false }));
    },

    isMurtazaMode: true,
    setIsMurtazaMode: (isMurtazaMode) => {
        get().triggerTransition(() => set({ isMurtazaMode }));
    },

    isHardcoreMode: false,
    setIsHardcoreMode: (isHardcoreMode) => set({ isHardcoreMode }),

    isNotesMode: false,
    toggleNotesMode: () => {
        get().triggerTransition(() => set(state => ({ isNotesMode: !state.isNotesMode, isYearMode: false })));
    },

    isYearMode: false,
    toggleYearMode: () => {
        get().triggerTransition(() => set((state) => ({ isYearMode: !state.isYearMode, isNotesMode: false })));
    },

    osPrefix: 'm',
    setOsPrefix: (prefix) => set({ osPrefix: prefix }),

    devItems: [],
    fetchDevItems: async () => {
        const devItems = await api.getDevItems();
        set({ devItems });
    },
    addDevItem: async (text) => {
        await api.addDevItem(text);
        get().fetchDevItems();
    },
    toggleDevItem: async (id) => {
        const state = get();
        const item = state.devItems.find(i => i.id === id);
        if (item) {
            await api.toggleDevItem(id, item.isComplete ? 0 : 1);
            get().fetchDevItems();
        }
    },
    deleteDevItem: async (id) => {
        await api.deleteDevItem(id);
        get().fetchDevItems();
    },
});
