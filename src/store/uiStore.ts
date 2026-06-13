import { StateCreator } from 'zustand';
import { DevItem } from '@/types';
import { api } from '@/api';
import { showErrorToast } from '@/components/ui/toast';
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

    isBudgetMode: boolean;
    toggleBudgetMode: () => void;

    isFitnessMode: boolean;
    toggleFitnessMode: () => void;

    isPasswordsMode: boolean;
    togglePasswordsMode: () => void;

    isTransitioning: boolean;
    triggerTransition: (action: () => void) => Promise<void>;

    osPrefix: string;
    setOsPrefix: (prefix: string) => void;

    // ── User preferences (persisted per device — see store/index.ts partialize) ──
    /** Currency symbol shown across the budget suite (display only — amounts are unitless). */
    currencySymbol: string;
    setCurrencySymbol: (symbol: string) => void;
    /** Unit new lift logs are tagged with and labels render in. Historical
     *  values are not converted — it's a label, not a conversion. */
    weightUnit: 'lb' | 'kg';
    setWeightUnit: (unit: 'lb' | 'kg') => void;
    /** Lifetime bests shown as reference lines on progress charts; unset = no lines. */
    personalPeaks: { bench?: number; squat?: number; deadlift?: number; weight?: number };
    setPersonalPeaks: (peaks: { bench?: number; squat?: number; deadlift?: number; weight?: number }) => void;

    devItems: DevItem[];
    fetchDevItems: () => Promise<void>;
    addDevItem: (text: string) => Promise<void>;
    toggleDevItem: (id: number) => Promise<void>;
    deleteDevItem: (id: number) => Promise<void>;
}

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set, get) => ({
    isTransitioning: false,
    triggerTransition: async (action) => {
        if (get().isTransitioning) return; // Prevent stacking transitions
        set({ isTransitioning: true });
        await new Promise(r => setTimeout(r, 300));
        action();
        await new Promise(r => setTimeout(r, 200));
        set({ isTransitioning: false });
    },

    isFocusMode: false,
    setIsFocusMode: (isFocusMode) => {
        get().triggerTransition(() => set({ isFocusMode, isNotesMode: false, isYearMode: false, isBudgetMode: false, isFitnessMode: false, isPasswordsMode: false }));
    },

    isMurtazaMode: true,
    setIsMurtazaMode: (isMurtazaMode) => {
        // Skip transition for overlay mode — instant switch, no black screen
        set({ isMurtazaMode });
    },

    isHardcoreMode: false,
    setIsHardcoreMode: (isHardcoreMode) => set({ isHardcoreMode }),

    isNotesMode: false,
    toggleNotesMode: () => {
        get().triggerTransition(() => set(state => ({ isNotesMode: !state.isNotesMode, isYearMode: false, isBudgetMode: false, isFitnessMode: false, isPasswordsMode: false })));
    },

    isYearMode: false,
    toggleYearMode: () => {
        get().triggerTransition(() => set((state) => ({ isYearMode: !state.isYearMode, isNotesMode: false, isBudgetMode: false, isFitnessMode: false, isPasswordsMode: false })));
    },

    isBudgetMode: false,
    toggleBudgetMode: () => {
        get().triggerTransition(() => set((state) => ({ isBudgetMode: !state.isBudgetMode, isNotesMode: false, isYearMode: false, isFitnessMode: false, isPasswordsMode: false })));
    },

    isFitnessMode: false,
    toggleFitnessMode: () => {
        get().triggerTransition(() => set((state) => ({ isFitnessMode: !state.isFitnessMode, isNotesMode: false, isYearMode: false, isBudgetMode: false, isPasswordsMode: false })));
    },

    isPasswordsMode: false,
    togglePasswordsMode: () => {
        get().triggerTransition(() => set((state) => ({ isPasswordsMode: !state.isPasswordsMode, isNotesMode: false, isYearMode: false, isBudgetMode: false, isFitnessMode: false })));
    },

    osPrefix: 'm',
    setOsPrefix: (prefix) => set({ osPrefix: prefix }),

    currencySymbol: '$',
    setCurrencySymbol: (symbol) => set({ currencySymbol: symbol.slice(0, 4) || '$' }),
    weightUnit: 'lb',
    setWeightUnit: (weightUnit) => set({ weightUnit }),
    personalPeaks: {},
    setPersonalPeaks: (personalPeaks) => set({ personalPeaks }),

    devItems: [],
    fetchDevItems: async () => {
        try {
            const devItems = await api.getDevItems();
            set({ devItems });
        } catch (error) {
            console.error('Failed to fetch dev items:', error);
        }
    },
    addDevItem: async (text) => {
        try {
            await api.addDevItem(text);
        } catch (error) {
            console.error('Failed to add dev item:', error);
            showErrorToast('Could not add the item.');
            return;
        }
        get().fetchDevItems();
    },
    toggleDevItem: async (id) => {
        const state = get();
        const item = state.devItems.find(i => i.id === id);
        if (item) {
            try {
                await api.toggleDevItem(id, item.isComplete ? 0 : 1);
            } catch (error) {
                console.error('Failed to toggle dev item:', error);
                showErrorToast('Could not update the item.');
                return;
            }
            get().fetchDevItems();
        }
    },
    deleteDevItem: async (id) => {
        try {
            await api.deleteDevItem(id);
        } catch (error) {
            console.error('Failed to delete dev item:', error);
            showErrorToast('Could not delete the item.');
            return;
        }
        get().fetchDevItems();
    },
});
