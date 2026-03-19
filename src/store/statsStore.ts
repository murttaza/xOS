import { StateCreator } from 'zustand';
import { Stat, Streak } from '@/types';
import { api } from '@/api';
import type { AppState } from './index';

export interface StatsSlice {
    stats: Stat[];
    streaks: Streak[];

    fetchStats: () => Promise<void>;
    addStat: (statName: string) => Promise<void>;
    deleteStat: (statName: string) => Promise<void>;
    renameStat: (oldName: string, newName: string) => Promise<void>;

    fetchStreaks: () => Promise<void>;
    createStreak: (streak: Omit<Streak, 'id'>) => Promise<void>;
    updateStreak: (streak: Streak) => Promise<void>;
    deleteStreak: (id: number) => Promise<void>;
}

export const createStatsSlice: StateCreator<AppState, [], [], StatsSlice> = (set, get) => ({
    stats: [],
    streaks: [],

    fetchStats: async () => {
        try {
            const stats = await api.getStats();
            set({ stats });
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    },

    addStat: async (statName) => {
        await api.addStat(statName);
        get().fetchStats();
    },

    deleteStat: async (statName) => {
        await api.deleteStat(statName);
        get().fetchStats();
    },

    renameStat: async (oldName, newName) => {
        await api.renameStat(oldName, newName);
        get().fetchStats();
        get().fetchTasks(); // Tasks might have been updated
    },

    fetchStreaks: async () => {
        const streaks = await api.getStreaks();
        set({ streaks });
    },

    createStreak: async (streak) => {
        await api.createStreak(streak);
        get().fetchStreaks();
    },

    updateStreak: async (streak) => {
        await api.updateStreak(streak);
        get().fetchStreaks();
    },

    deleteStreak: async (id) => {
        await api.deleteStreak(id);
        get().fetchStreaks();
    },
});
