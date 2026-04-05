import { StateCreator } from 'zustand';
import { Session, DailyLog } from '@/types';
import { api } from '@/api';
import { safeJSONParse, calculateSessionXP, calculateLevelFromXP, calculatePrayerXP, getLocalDateString } from '@/lib/utils';
import type { AppState } from './index';

const MAX_TIMER_SECONDS = 86400; // 24-hour cap

// Module-level set: tracks timers recently stopped locally so syncTimers
// doesn't re-restore them from Supabase during the async removal window.
const recentlyStoppedTimers = new Set<number>();

// Tracks timers recently started locally so syncTimers doesn't remove them
// before the initial push to Supabase has completed.
const recentlyStartedTimers = new Set<number>();

export interface SessionSlice {
    sessions: Session[];
    dailyLog: DailyLog | null;

    // Timer state - Multi-tasking support (synced to Supabase for cross-device)
    activeTimers: Record<number, number>; // taskId -> duration in seconds (derived from startTimes)
    timerStartTimes: Record<number, string>; // taskId -> ISO start timestamp
    toggleTaskTimer: (taskId: number) => Promise<void>;
    stopTaskTimer: (taskId: number) => Promise<void>;
    incrementTimers: () => void;
    syncTimers: () => Promise<void>;

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
    timerStartTimes: {},

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

        // Fetch fresh stats from Supabase before computing XP to avoid
        // stale local state overwriting values updated by another device.
        await get().fetchStats();

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
            // Use the session being added rather than stale local state which may only
            // contain sessions from the currently viewed date range
            const today = getLocalDateString();
            let isFirstSessionOfDay = !state.sessions.some(s => s.dateLogged === today && s.startTime !== session.startTime);
            // Double-check with server data for accuracy
            try {
                const todaySessions = await api.getSessionsByDate(today);
                isFirstSessionOfDay = todaySessions.length <= 1; // 1 = the session we just inserted
            } catch { /* fallback to local check above */ }

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
        // Fetch fresh stats before computing prayer XP
        await get().fetchStats();

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

    syncTimers: async () => {
        const localStartTimes = get().timerStartTimes;
        let remoteTimers: { taskId: number; startTime: string }[] = [];
        try {
            remoteTimers = await api.getActiveTimers();
        } catch (err) {
            // If Supabase fetch fails, keep local timers as-is
            console.error('syncTimers: failed to fetch remote timers', err);
            return;
        }

        // Build set of remote task IDs for quick lookup
        const remoteIds = new Set(remoteTimers.map(t => t.taskId));

        // Start with remote timers (Supabase is source of truth)
        const merged: Record<number, string> = {};
        for (const t of remoteTimers) {
            // Skip timers the user just stopped locally — they may still be in
            // Supabase because the async removal hasn't completed yet.
            if (!recentlyStoppedTimers.has(t.taskId)) {
                merged[t.taskId] = t.startTime;
            }
        }

        // For local-only timers: only keep them if they were just started
        // (push might still be in flight). Otherwise, another device stopped
        // them — let them go.
        for (const [id, startTime] of Object.entries(localStartTimes)) {
            const taskId = Number(id);
            if (!remoteIds.has(taskId) && recentlyStartedTimers.has(taskId)) {
                merged[taskId] = startTime;
            }
        }

        const now = Date.now();
        const timers: Record<number, number> = {};
        for (const [id, startTime] of Object.entries(merged)) {
            timers[Number(id)] = Math.min(Math.floor((now - new Date(startTime).getTime()) / 1000), MAX_TIMER_SECONDS);
        }
        set({ timerStartTimes: merged, activeTimers: timers });
    },

    toggleTaskTimer: async (taskId: number) => {
        const state = get();

        if (state.timerStartTimes[taskId] !== undefined) {
            await state.stopTaskTimer(taskId);
        } else {
            const now = new Date().toISOString();

            // Protect this timer from being removed by syncTimers before
            // the Supabase push completes
            recentlyStartedTimers.add(taskId);
            setTimeout(() => recentlyStartedTimers.delete(taskId), 15000);

            set((state) => ({
                activeTimers: { ...state.activeTimers, [taskId]: 0 },
                timerStartTimes: { ...state.timerStartTimes, [taskId]: now }
            }));
            // Persist to Supabase for cross-device sync
            try { await api.setActiveTimer(taskId, now); } catch {}
        }
    },

    stopTaskTimer: async (taskId: number) => {
        const state = get();
        const startTimeStr = state.timerStartTimes[taskId];

        if (startTimeStr === undefined) return;

        // Prevent syncTimers from re-restoring this timer during the async removal window
        recentlyStoppedTimers.add(taskId);
        setTimeout(() => recentlyStoppedTimers.delete(taskId), 15000);

        // Stop timer immediately in UI
        const newTimers = { ...state.activeTimers };
        delete newTimers[taskId];
        const newStartTimes = { ...state.timerStartTimes };
        delete newStartTimes[taskId];
        set({ activeTimers: newTimers, timerStartTimes: newStartTimes });

        // Remove from Supabase
        await api.removeActiveTimer(taskId);

        const startTime = new Date(startTimeStr);
        const now = new Date();
        const duration = Math.min(Math.floor((now.getTime() - startTime.getTime()) / 1000), MAX_TIMER_SECONDS);
        const durationMinutes = Math.floor(duration / 60);

        if (durationMinutes > 0) {
            // Prevent duplicate sessions when both devices stop the same timer
            const alreadyRecorded = await api.sessionExistsForTimer(taskId, startTime.toISOString());
            if (!alreadyRecorded) {
                await state.addSession({
                    taskId: taskId,
                    startTime: startTime.toISOString(),
                    endTime: now.toISOString(),
                    duration_minutes: durationMinutes,
                    dateLogged: getLocalDateString(now)
                });
            }
        }
    },

    incrementTimers: () => set((state) => {
        const startTimes = state.timerStartTimes;
        if (Object.keys(startTimes).length === 0) return {};

        const now = Date.now();
        const newTimers: Record<number, number> = {};
        for (const id in startTimes) {
            const elapsed = Math.floor((now - new Date(startTimes[id]).getTime()) / 1000);
            newTimers[Number(id)] = Math.min(elapsed, MAX_TIMER_SECONDS);
        }
        return { activeTimers: newTimers };
    }),
});
