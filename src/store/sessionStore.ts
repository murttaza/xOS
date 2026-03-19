import { StateCreator } from 'zustand';
import { Session, DailyLog } from '@/types';
import { api } from '@/api';
import { safeJSONParse, calculateSessionXP, calculateLevelFromXP, calculatePrayerXP, getLocalDateString } from '@/lib/utils';
import type { AppState } from './index';

export interface SessionSlice {
    sessions: Session[];
    dailyLog: DailyLog | null;

    // Timer state - Multi-tasking support
    activeTimers: Record<number, number>; // taskId -> duration in seconds
    toggleTaskTimer: (taskId: number) => Promise<void>;
    stopTaskTimer: (taskId: number) => Promise<void>;
    incrementTimers: () => void;

    // Pomodoro
    pomodoroTime: number;
    isPomodoroRunning: boolean;
    setPomodoroTime: (time: number) => void;
    setIsPomodoroRunning: (isRunning: boolean) => void;

    fetchDailyLog: (date: string) => Promise<void>;
    fetchSessionsRange: (startDate: string, endDate: string) => Promise<void>;
    addSession: (session: Omit<Session, 'id'>) => Promise<void>;
    saveJournalEntry: (date: string, entry: string) => Promise<void>;
    togglePrayer: (prayerName: string) => Promise<void>;
}

export const createSessionSlice: StateCreator<AppState, [], [], SessionSlice> = (set, get) => ({
    sessions: [],
    dailyLog: null,
    activeTimers: {},

    pomodoroTime: 25 * 60,
    isPomodoroRunning: false,
    setPomodoroTime: (time) => set({ pomodoroTime: time }),
    setIsPomodoroRunning: (isRunning) => set({ isPomodoroRunning: isRunning }),

    fetchDailyLog: async (date) => {
        const log = await api.getDailyLog(date);
        set({ dailyLog: log || null });
    },

    fetchSessionsRange: async (startDate, endDate) => {
        const sessions = await api.getSessionsRange(startDate, endDate);
        set({ sessions });
    },

    addSession: async (session) => {
        await api.addSession(session);

        // Calculate XP and update stats
        const state = get();
        const task = state.tasks.find(t => t.id === session.taskId);
        const newStats = [...state.stats];
        let statsUpdated = false;

        if (task && session.duration_minutes > 0) {
            // Determine streak count from repeating task (if applicable)
            const repeatingTask = task.repeatingTaskId
                ? state.repeatingTasks.find(rt => rt.id === task.repeatingTaskId)
                : null;
            const streakCount = repeatingTask?.streak ?? 0;

            // Check if this is the first session of the day
            const today = getLocalDateString();
            const isFirstSessionOfDay = !state.sessions.some(s => s.dateLogged === today);

            const xpEarned = calculateSessionXP(session.duration_minutes, task.difficulty, {
                streakCount,
                isFirstSessionOfDay,
            });
            // Edge case: ensure statTarget is always an array
            const statTargets = Array.isArray(task.statTarget) ? task.statTarget : (task.statTarget ? [task.statTarget] : []);

            for (const statName of statTargets) {
                if (!statName) continue; // Skip empty/null stat names
                const statIndex = newStats.findIndex(s => s.statName === statName);

                if (statIndex !== -1) {
                    const stat = newStats[statIndex];
                    const { newXP, newLevel } = calculateLevelFromXP(stat.currentXP + xpEarned, stat.currentLevel);

                    await api.updateStat({
                        statName,
                        currentXP: newXP,
                        currentLevel: newLevel
                    });

                    newStats[statIndex] = {
                        ...stat,
                        currentXP: newXP,
                        currentLevel: newLevel
                    };
                    statsUpdated = true;
                }
            }
        }

        // Optimistically update sessions and stats
        set((state) => ({
            sessions: [...state.sessions, session as Session],
            stats: statsUpdated ? newStats : state.stats
        }));
    },

    saveJournalEntry: async (date: string, entry: string) => {
        // Use the specific API that preserves other fields (like prayers)
        await api.saveJournalEntry(date, entry);

        // Only update local state if it's still relevant (i.e., user hasn't switched dates)
        const state = get();
        if (state.dailyLog && state.dailyLog.date === date) {
            set({ dailyLog: { ...state.dailyLog, journalEntry: entry } });
        }
    },

    togglePrayer: async (prayerName: string) => {
        const state = get();
        const today = getLocalDateString();
        let log = state.dailyLog;

        if (!log || log.date !== today) {
            log = {
                date: today,
                journalEntry: "",
                prayersCompleted: "{}"
            };
        }

        const prayers = safeJSONParse<Record<string, boolean>>(log.prayersCompleted, {});
        const wasCompleted = prayers[prayerName];
        prayers[prayerName] = !wasCompleted;

        const newStats = [...state.stats];

        // XP Logic for Prayer
        if (!wasCompleted) {
            const statIndex = newStats.findIndex(s => s.statName === "Religion");
            if (statIndex !== -1) {
                const stat = newStats[statIndex];
                const prayerXP = calculatePrayerXP(stat.currentLevel);
                const { newXP, newLevel } = calculateLevelFromXP(stat.currentXP + prayerXP, stat.currentLevel);

                await api.updateStat({
                    statName: "Religion",
                    currentXP: newXP,
                    currentLevel: newLevel
                });

                newStats[statIndex] = {
                    ...stat,
                    currentXP: newXP,
                    currentLevel: newLevel
                };
            }
        }

        const newLog = { ...log, prayersCompleted: JSON.stringify(prayers) };
        await api.saveDailyLog(newLog);
        set({
            dailyLog: newLog,
            stats: newStats
        });
    },

    toggleTaskTimer: async (taskId: number) => {
        const state = get();

        if (state.activeTimers[taskId] !== undefined) {
            // Task is running, stop it
            await state.stopTaskTimer(taskId);
        } else {
            // Start new task (allow parallel)
            set((state) => ({
                activeTimers: { ...state.activeTimers, [taskId]: 0 }
            }));
        }
    },

    stopTaskTimer: async (taskId: number) => {
        const state = get();
        const duration = state.activeTimers[taskId];

        if (duration === undefined) return;

        // Stop timer immediately in UI
        const newTimers = { ...state.activeTimers };
        delete newTimers[taskId];
        set({ activeTimers: newTimers });

        const durationMinutes = Math.floor(duration / 60);

        if (durationMinutes > 0) {
            const now = new Date();
            await state.addSession({
                taskId: taskId,
                startTime: new Date(now.getTime() - duration * 1000).toISOString(),
                endTime: now.toISOString(),
                duration_minutes: durationMinutes,
                dateLogged: getLocalDateString(now)
            });
        }
    },

    incrementTimers: () => set((state) => {
        const newTimers = { ...state.activeTimers };
        let hasChanges = false;
        for (const id in newTimers) {
            newTimers[id] = newTimers[id] + 1;
            hasChanges = true;
        }
        return hasChanges ? { activeTimers: newTimers } : {};
    }),
});
