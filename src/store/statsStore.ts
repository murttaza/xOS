import { StateCreator } from 'zustand';
import { Stat, Streak } from '@/types';
import { api } from '@/api';
import { showErrorToast } from '@/components/ui/toast';
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
        try {
            await api.addStat(statName);
        } catch (error) {
            console.error('Failed to add stat:', error);
            showErrorToast('Could not add the stat.');
            return;
        }
        get().fetchStats();
    },

    deleteStat: async (statName) => {
        try {
            await api.deleteStat(statName);
        } catch (error) {
            console.error('Failed to delete stat:', error);
            showErrorToast('Could not delete the stat.');
            return;
        }
        get().fetchStats();
    },

    renameStat: async (oldName, newName) => {
        try {
            await api.renameStat(oldName, newName);
        } catch (error) {
            console.error('Failed to rename stat:', error);
            showErrorToast('Could not rename the stat.');
            return;
        }
        get().fetchStats();
        get().fetchTasks(); // Tasks might have been updated
    },

    fetchStreaks: async () => {
        try {
            const streaks = await api.getStreaks();
            set({ streaks });
        } catch (error) {
            console.error('Failed to fetch streaks:', error);
        }
    },

    createStreak: async (streak) => {
        try {
            await api.createStreak(streak);
        } catch (error) {
            console.error('Failed to create streak:', error);
            showErrorToast('Could not create the streak.');
            return;
        }
        get().fetchStreaks();
    },

    updateStreak: async (streak) => {
        try {
            await api.updateStreak(streak);
        } catch (error) {
            console.error('Failed to update streak:', error);
            showErrorToast('Could not save streak changes.');
            return;
        }
        get().fetchStreaks();
    },

    deleteStreak: async (id) => {
        try {
            await api.deleteStreak(id);
        } catch (error) {
            console.error('Failed to delete streak:', error);
            showErrorToast('Could not delete the streak.');
            return;
        }
        get().fetchStreaks();
    },
});
