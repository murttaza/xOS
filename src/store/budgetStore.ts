import { StateCreator } from 'zustand';
import { BudgetCategory, Transaction, BudgetTarget } from '@/types';
import { api } from '@/api';
import { calculateBudgetXP, calculateLevelFromXP, getLocalDateString, getLocalMonthString } from '@/lib/utils';
import type { AppState } from './index';

export interface BudgetSlice {
    budgetCategories: BudgetCategory[];
    transactions: Transaction[];
    budgetTargets: BudgetTarget[];
    selectedMonth: string; // YYYY-MM
    budgetFilter: { type: 'all' | 'income' | 'expense'; categoryId?: number };

    fetchBudgetCategories: () => Promise<void>;
    createBudgetCategory: (category: Omit<BudgetCategory, 'id'>) => Promise<void>;
    updateBudgetCategory: (category: BudgetCategory) => Promise<void>;
    deleteBudgetCategory: (id: number) => Promise<void>;

    fetchTransactions: (month?: string) => Promise<void>;
    addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>;
    updateTransaction: (tx: Transaction) => Promise<void>;
    deleteTransaction: (id: number) => Promise<void>;

    fetchBudgetTargets: (month?: string) => Promise<void>;
    setBudgetTarget: (target: Omit<BudgetTarget, 'id'>) => Promise<void>;
    deleteBudgetTarget: (id: number) => Promise<void>;

    setSelectedMonth: (month: string) => void;
    setBudgetFilter: (filter: { type: 'all' | 'income' | 'expense'; categoryId?: number }) => void;
}

export const createBudgetSlice: StateCreator<AppState, [], [], BudgetSlice> = (set, get) => ({
    budgetCategories: [],
    transactions: [],
    budgetTargets: [],
    selectedMonth: getLocalMonthString(),
    budgetFilter: { type: 'all' },

    fetchBudgetCategories: async () => {
        const budgetCategories = await api.getBudgetCategories();
        set({ budgetCategories });
    },

    createBudgetCategory: async (category) => {
        await api.createBudgetCategory(category);
        get().fetchBudgetCategories();
    },

    updateBudgetCategory: async (category) => {
        await api.updateBudgetCategory(category);
        get().fetchBudgetCategories();
    },

    deleteBudgetCategory: async (id) => {
        await api.deleteBudgetCategory(id);
        get().fetchBudgetCategories();
        // Refresh transactions in case any were deleted
        get().fetchTransactions();
    },

    fetchTransactions: async (month?) => {
        const m = month || get().selectedMonth;
        const transactions = await api.getTransactions(m);
        set({ transactions });
    },

    addTransaction: async (tx) => {
        await api.addTransaction(tx);

        // Award Finance XP
        try {
            await get().fetchStats();
            const state = get();
            const financeStat = state.stats.find(s => s.statName === 'Finance');

            if (financeStat) {
                const today = getLocalDateString();
                const isFirstOfDay = !state.transactions.some(t => t.date === today);
                const xpEarned = calculateBudgetXP(isFirstOfDay);
                const { newXP, newLevel } = calculateLevelFromXP(
                    financeStat.currentXP + xpEarned,
                    financeStat.currentLevel
                );

                await api.updateStat({
                    statName: 'Finance',
                    currentXP: newXP,
                    currentLevel: newLevel,
                });

                set((state) => ({
                    stats: state.stats.map(s =>
                        s.statName === 'Finance'
                            ? { ...s, currentXP: newXP, currentLevel: newLevel }
                            : s
                    ),
                }));
            }
        } catch (e) {
            console.error('Failed to award budget XP', e);
        }

        get().fetchTransactions();
    },

    updateTransaction: async (tx) => {
        await api.updateTransaction(tx);
        get().fetchTransactions();
    },

    deleteTransaction: async (id) => {
        await api.deleteTransaction(id);
        get().fetchTransactions();
    },

    fetchBudgetTargets: async (month?) => {
        const m = month || get().selectedMonth;
        const budgetTargets = await api.getBudgetTargets(m);
        set({ budgetTargets });
    },

    setBudgetTarget: async (target) => {
        await api.setBudgetTarget(target);
        get().fetchBudgetTargets();
    },

    deleteBudgetTarget: async (id) => {
        await api.deleteBudgetTarget(id);
        get().fetchBudgetTargets();
    },

    setSelectedMonth: (month) => {
        set({ selectedMonth: month });
        get().fetchTransactions(month);
        get().fetchBudgetTargets(month);
    },

    setBudgetFilter: (filter) => set({ budgetFilter: filter }),
});
