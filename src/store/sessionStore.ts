import { StateCreator } from 'zustand';
import { Session, DailyLog } from '@/types';
import { api } from '@/api';
import { safeJSONParse, calculateSessionXP, calculateLevelFromXP, calculatePrayerXP, getLocalDateString } from '@/lib/utils';
import { showErrorToast } from '@/components/ui/toast';
import type { AppState } from './index';

const MAX_TIMER_SECONDS = 86400; // 24-hour cap

/** Whole seconds elapsed since an ISO start timestamp. Single source of truth
 *  for timer math (syncTimers / incrementTimers / stopTaskTimer) — so a future
 *  pause feature only has to change this one formula, not three call sites. */
function elapsedSeconds(startTimeISO: string, now: number = Date.now()): number {
    return Math.floor((now - new Date(startTimeISO).getTime()) / 1000);
}

// Module-level set: tracks timers recently stopped locally so syncTimers
// doesn't re-restore them from Supabase during the async removal window.
const recentlyStoppedTimers = new Set<number>();

// Tracks timers recently started locally so syncTimers doesn't remove them
// before the initial push to Supabase has completed.
const recentlyStartedTimers = new Set<number>();

// Prayer toggles update the UI synchronously and persist through this shared
// chain, one write at a time in tap order. Without it, rapid taps interleaved
// their read-modify-write cycles and landed in whatever order the network
// returned — toggles popped in late, out of order, or overwrote each other.
let prayerWriteChain: Promise<void> = Promise.resolve();
let pendingPrayerWrites = 0;
let prayerReconcileNeeded = false;

export interface SessionSlice {
    sessions: Session[];
    /** The log for whatever date the calendar is viewing. */
    dailyLog: DailyLog | null;
    /** Always today's log — header prayer pills read this, so browsing the
     *  calendar can never hijack them. */
    todayLog: DailyLog | null;

    // Timer state - Multi-tasking support (synced to Supabase for cross-device)
    activeTimers: Record<number, number>; // taskId -> duration in seconds (derived from startTimes)
    timerStartTimes: Record<number, string>; // taskId -> ISO start timestamp
    toggleTaskTimer: (taskId: number) => Promise<void>;
    /** Stop a timer and record the session. `discardSeconds` trims that much
     *  off the end before recording (used by the idle-return prompt); if the
     *  whole session was idle, nothing is recorded. */
    stopTaskTimer: (taskId: number, opts?: { discardSeconds?: number }) => Promise<void>;
    incrementTimers: () => void;
    syncTimers: () => Promise<void>;

    // Pomodoro — wall-clock anchored (see pomodoroEndsAt)
    pomodoroTime: number;
    /** Epoch ms when the running pomodoro completes; null while paused. */
    pomodoroEndsAt: number | null;
    isPomodoroRunning: boolean;
    setPomodoroTime: (time: number) => void;
    setIsPomodoroRunning: (isRunning: boolean) => void;
    /** Recompute remaining seconds from the wall clock. Returns true the tick
     *  the pomodoro completes. */
    syncPomodoro: () => boolean;

    fetchDailyLog: (date: string) => Promise<void>;
    /** Refresh today's log cache without changing which date the calendar views. */
    fetchTodayLog: () => Promise<void>;
    fetchSessionsRange: (startDate: string, endDate: string) => Promise<void>;
    addSession: (session: Omit<Session, 'id'>) => Promise<void>;
    saveJournalEntry: (date: string, entry: string) => Promise<void>;
    togglePrayer: (prayerName: string) => Promise<void>;
}

export const createSessionSlice: StateCreator<AppState, [], [], SessionSlice> = (set, get) => ({
    sessions: [],
    dailyLog: null,
    todayLog: null,
    activeTimers: {},
    timerStartTimes: {},

    // The countdown is anchored to a wall-clock end timestamp instead of
    // decrementing once per tick — browsers throttle background intervals,
    // which made the old version drift, and reloads reset it. The anchor is
    // persisted (store/index.ts), so a running pomodoro survives restarts.
    pomodoroTime: 25 * 60,
    pomodoroEndsAt: null,
    isPomodoroRunning: false,
    setPomodoroTime: (time) => set((state) => ({
        pomodoroTime: time,
        pomodoroEndsAt: state.isPomodoroRunning ? Date.now() + time * 1000 : null,
    })),
    setIsPomodoroRunning: (isRunning) => set((state) => isRunning
        ? { isPomodoroRunning: true, pomodoroEndsAt: Date.now() + state.pomodoroTime * 1000 }
        : { isPomodoroRunning: false, pomodoroEndsAt: null }),
    syncPomodoro: () => {
        const { isPomodoroRunning, pomodoroEndsAt, pomodoroTime } = get();
        if (!isPomodoroRunning || !pomodoroEndsAt) return false;
        const remaining = Math.max(0, Math.round((pomodoroEndsAt - Date.now()) / 1000));
        if (remaining <= 0) {
            set({ pomodoroTime: 0, isPomodoroRunning: false, pomodoroEndsAt: null });
            return true;
        }
        if (remaining !== pomodoroTime) set({ pomodoroTime: remaining });
        return false;
    },

    fetchDailyLog: async (date) => {
        // While prayer writes are in flight, a refetch of today would replace
        // the optimistic toggles with stale server state. Skip — the chain's
        // reconcile step refetches if anything actually failed.
        if (pendingPrayerWrites > 0 && date === getLocalDateString()) return;
        const log = await api.getDailyLog(date);
        if (pendingPrayerWrites > 0 && date === getLocalDateString()) return;
        set({
            dailyLog: log || null,
            ...(date === getLocalDateString() ? { todayLog: log || null } : {}),
        });
    },

    fetchTodayLog: async () => {
        if (pendingPrayerWrites > 0) return;
        const today = getLocalDateString();
        const log = await api.getDailyLog(today);
        if (pendingPrayerWrites > 0) return;
        set((state) => ({
            todayLog: log || null,
            // Mirror into the viewed slot only when the calendar is on today —
            // never yank the view away from a date the user is browsing.
            ...(state.dailyLog?.date === today ? { dailyLog: log || null } : {}),
        }));
    },

    fetchSessionsRange: async (startDate, endDate) => {
        const sessions = await api.getSessionsRange(startDate, endDate);
        set({ sessions });
    },

    addSession: async (session) => {
        // Capture the inserted row (with its real id) so the optimistic push
        // below isn't an id-less object. Null when queued offline.
        const inserted = await api.addSession(session);

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

        // Optimistically update sessions and stats. Prefer the inserted row
        // (carries the real id) over the id-less input when available.
        set((state) => ({
            sessions: [...state.sessions, (inserted ?? session) as Session],
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
        const today = getLocalDateString();
        const state = get();

        // Prayers always target TODAY, regardless of which date the calendar
        // is viewing — the dedicated todayLog slot makes that unambiguous.
        const base = state.todayLog?.date === today
            ? state.todayLog
            : { date: today, journalEntry: "", prayersCompleted: "{}" };

        const prayers = safeJSONParse<Record<string, boolean>>(base.prayersCompleted, {});
        const wasCompleted = !!prayers[prayerName];
        prayers[prayerName] = !wasCompleted;
        const prayersJson = JSON.stringify(prayers);
        const newLog = { ...base, prayersCompleted: prayersJson };

        // Optimistic: the pill flips on the tap itself, before any network.
        // Each tap in a burst builds on the previous one's state synchronously,
        // so the queued snapshots are cumulative and the last write wins whole.
        set((s) => ({
            todayLog: newLog,
            ...(s.dailyLog?.date === today ? { dailyLog: newLog } : {}),
        }));

        pendingPrayerWrites++;
        prayerWriteChain = prayerWriteChain.then(async () => {
            try {
                await api.savePrayers(today, prayersJson);
            } catch (err) {
                console.error('togglePrayer: failed to save prayers', err);
                showErrorToast(`Couldn't save ${prayerName} — check your connection.`);
                prayerReconcileNeeded = true;
                return; // no XP for a toggle that didn't persist
            }

            if (wasCompleted) return;

            // XP is garnish — log failures but never disturb the saved toggle.
            try {
                await get().fetchStats(); // fresh stats so another device's XP isn't overwritten
                const stats = get().stats;
                const statIndex = stats.findIndex(s => s.statName === "Religion");
                if (statIndex === -1) return;

                const stat = stats[statIndex];
                const prayerXP = calculatePrayerXP(stat.currentLevel);
                const { newXP, newLevel } = calculateLevelFromXP(stat.currentXP + prayerXP, stat.currentLevel);

                await api.updateStat({
                    statName: "Religion",
                    currentXP: newXP,
                    currentLevel: newLevel
                });

                const newStats = [...get().stats];
                newStats[statIndex] = { ...stat, currentXP: newXP, currentLevel: newLevel };
                set({ stats: newStats });
            } catch (err) {
                console.error('togglePrayer: failed to award prayer XP', err);
            }
        }).finally(() => {
            pendingPrayerWrites--;
            // Last write in the burst settles the books: if anything failed,
            // re-pull server truth so the pills don't show unsaved state.
            if (pendingPrayerWrites === 0 && prayerReconcileNeeded) {
                prayerReconcileNeeded = false;
                get().fetchTodayLog().catch(() => {});
            }
        });

        await prayerWriteChain;
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
            timers[Number(id)] = Math.min(elapsedSeconds(startTime, now), MAX_TIMER_SECONDS);
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
            // Persist to Supabase for cross-device sync. Offline writes are
            // queued by the adapter (no throw); a throw means an online failure,
            // so surface it — the timer runs locally but may not have synced.
            try {
                await api.setActiveTimer(taskId, now);
            } catch (err) {
                console.error('toggleTaskTimer: failed to persist timer start', err);
                showErrorToast("Timer started, but couldn't sync — it may not appear on your other devices.");
            }
        }
    },

    stopTaskTimer: async (taskId: number, opts?: { discardSeconds?: number }) => {
        const state = get();
        const startTimeStr = state.timerStartTimes[taskId];

        if (startTimeStr === undefined) return;

        // Prevent syncTimers from re-restoring this timer during the async removal window
        recentlyStoppedTimers.add(taskId);
        setTimeout(() => recentlyStoppedTimers.delete(taskId), 15000);

        // Stop timer immediately in UI for responsiveness
        const newTimers = { ...state.activeTimers };
        delete newTimers[taskId];
        const newStartTimes = { ...state.timerStartTimes };
        delete newStartTimes[taskId];
        set({ activeTimers: newTimers, timerStartTimes: newStartTimes });

        const startISO = new Date(startTimeStr).toISOString();
        const now = Date.now();
        const discardSeconds = Math.max(0, opts?.discardSeconds ?? 0);
        const rawSeconds = elapsedSeconds(startTimeStr, now) - discardSeconds;

        if (rawSeconds <= 0) {
            // Entire session was idle — record nothing, just clear the server timer.
            await api.removeActiveTimer(taskId).catch(err =>
                console.error('stopTaskTimer: failed to clear idle timer', err));
            return;
        }

        const duration = Math.min(rawSeconds, MAX_TIMER_SECONDS);
        if (rawSeconds > MAX_TIMER_SECONDS) {
            // Most likely the laptop slept for a long stretch — surface the cap.
            const hours = Math.round(rawSeconds / 3600);
            console.warn(`[timer] Capped session for task ${taskId}: ran ~${hours}h, saving ${MAX_TIMER_SECONDS / 3600}h.`);
            showErrorToast(`Timer ran for ~${hours}h (likely while idle). Saved the maximum 24h — adjust manually if needed.`);
        }
        // Round (not floor) so sessions aren't systematically under-counted by
        // up to 59s each; a sub-30s session still records nothing.
        const durationMinutes = Math.round(duration / 60);
        // End the recorded session where work actually stopped, not where the
        // idle prompt was answered.
        const endTime = new Date(now - discardSeconds * 1000);

        // Record the session BEFORE removing the server-side timer, so an online
        // write failure can't lose the work: the active_timer stays put and the
        // next sync/stop recovers it. (addSession queues itself when offline.)
        try {
            if (durationMinutes > 0) {
                // Prevent duplicate sessions when both devices stop the same timer
                const alreadyRecorded = await api.sessionExistsForTimer(taskId, startISO);
                if (!alreadyRecorded) {
                    await state.addSession({
                        taskId: taskId,
                        startTime: startISO,
                        endTime: endTime.toISOString(),
                        duration_minutes: durationMinutes,
                        dateLogged: getLocalDateString(endTime)
                    });
                }
            }
            await api.removeActiveTimer(taskId);
        } catch (err) {
            console.error('stopTaskTimer: failed to record session or clear timer', err);
            showErrorToast("Couldn't save that session — check your connection. Your timer is preserved; try stopping it again.");
        }
    },

    incrementTimers: () => set((state) => {
        const startTimes = state.timerStartTimes;
        if (Object.keys(startTimes).length === 0) return {};

        const now = Date.now();
        const newTimers: Record<number, number> = {};
        for (const id in startTimes) {
            newTimers[Number(id)] = Math.min(elapsedSeconds(startTimes[id], now), MAX_TIMER_SECONDS);
        }
        return { activeTimers: newTimers };
    }),
});
