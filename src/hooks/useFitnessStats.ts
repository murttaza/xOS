import { useMemo } from 'react';
import { useStore } from '@/store';
import type { ExerciseLog, WorkoutSession } from '@/types';

type LoggedExerciseSummary = {
    exerciseId: string | null;
    programExerciseId: string;
    name: string;
    count: number;
    lastDate: string;
};

/** Epley e1RM — the ONE formula used everywhere (ExerciseHistory previously
 *  inlined Brzycki, so the same lift showed different 1RMs on different tabs). */
export function epley(weight: number | null, reps: number | null): number | null {
    if (!weight || !reps || reps <= 0) return null;
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function logDate(log: ExerciseLog & { workout_session?: { scheduled_date?: string; completed_at?: string | null } }, sessionsById: Map<string, WorkoutSession>): string {
    // Prefer joined workout_session, fall back to lookup by session_id, then created_at.
    if (log.workout_session?.completed_at) return log.workout_session.completed_at.slice(0, 10);
    if (log.workout_session?.scheduled_date) return log.workout_session.scheduled_date;
    const sess = sessionsById.get(log.session_id);
    if (sess?.completed_at) return sess.completed_at.slice(0, 10);
    if (sess?.scheduled_date) return sess.scheduled_date;
    return (log.created_at || '').slice(0, 10);
}

function nameForLog(log: ExerciseLog & { program_exercise?: { display_name?: string } }, programExercisesById: Map<string, { display_name: string }>): string {
    if (log.program_exercise?.display_name) return log.program_exercise.display_name;
    return programExercisesById.get(log.program_exercise_id)?.display_name || 'Unknown';
}

function isLoggedAndCompleted(l: ExerciseLog): boolean {
    return Boolean(l.is_completed) && (l.working_weight !== null || l.reps_hit !== null || l.sets_completed !== null);
}

/** All exercises that have been logged at least once, sorted most-recent first. */
export function useLoggedExercises(): LoggedExerciseSummary[] {
    const allLogs = useStore(s => s.allExerciseLogs);
    const programExercises = useStore(s => s.programExercises);
    const sessions = useStore(s => s.workoutSessions);

    return useMemo(() => {
        const sessById = new Map(sessions.map(s => [s.id, s]));
        const peById = new Map(programExercises.map(pe => [pe.id, pe]));
        const map = new Map<string, LoggedExerciseSummary>();
        for (const log of allLogs) {
            if (!isLoggedAndCompleted(log)) continue;
            const key = (log.exercise_id || log.program_exercise_id) as string;
            const date = logDate(log as any, sessById);
            const existing = map.get(key);
            if (existing) {
                existing.count++;
                if (date > existing.lastDate) existing.lastDate = date;
            } else {
                map.set(key, {
                    exerciseId: log.exercise_id,
                    programExerciseId: log.program_exercise_id,
                    name: nameForLog(log as any, peById),
                    count: 1,
                    lastDate: date,
                });
            }
        }
        return [...map.values()].sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''));
    }, [allLogs, programExercises, sessions]);
}

export type ExerciseHistoryPoint = { date: string; weight: number; reps: number; e1rm: number | null };

/** Time series of working_weight + e1RM for a given exercise (or program_exercise) id. */
export function useExerciseHistory(key: string | null, range: '4w' | '12w' | 'all' = 'all'): ExerciseHistoryPoint[] {
    const allLogs = useStore(s => s.allExerciseLogs);
    const sessions = useStore(s => s.workoutSessions);

    return useMemo(() => {
        if (!key) return [];
        const sessById = new Map(sessions.map(s => [s.id, s]));
        const cutoff = (() => {
            if (range === 'all') return null;
            const d = new Date();
            d.setDate(d.getDate() - (range === '4w' ? 28 : 84));
            return d.toISOString().slice(0, 10);
        })();
        const points: ExerciseHistoryPoint[] = [];
        for (const log of allLogs) {
            if (!isLoggedAndCompleted(log)) continue;
            const matches = log.exercise_id === key || log.program_exercise_id === key;
            if (!matches) continue;
            const w = Number(log.working_weight);
            const r = Number(log.reps_hit);
            if (!Number.isFinite(w) || w <= 0) continue;
            const date = logDate(log as any, sessById);
            if (cutoff && date < cutoff) continue;
            points.push({ date, weight: w, reps: r || 0, e1rm: epley(w, r || 0) });
        }
        return points.sort((a, b) => a.date.localeCompare(b.date));
    }, [allLogs, sessions, key, range]);
}

export type ImprovedLift = { exerciseId: string; name: string; pctGain: number; firstAvg: number; lastAvg: number; sparkline: number[] };

/** Lift with the largest % gain comparing first 4 weeks to last 4 weeks of logged data. */
export function useMostImprovedLift(): ImprovedLift | null {
    const allLogs = useStore(s => s.allExerciseLogs);
    const sessions = useStore(s => s.workoutSessions);
    const programExercises = useStore(s => s.programExercises);

    return useMemo(() => {
        if (!allLogs.length) return null;
        const sessById = new Map(sessions.map(s => [s.id, s]));
        const peById = new Map(programExercises.map(pe => [pe.id, pe]));
        // Group by exercise key.
        const groups = new Map<string, { name: string; rows: { date: string; weight: number }[] }>();
        for (const log of allLogs) {
            if (!isLoggedAndCompleted(log)) continue;
            const w = Number(log.working_weight);
            if (!Number.isFinite(w) || w <= 0) continue;
            const key = (log.exercise_id || log.program_exercise_id) as string;
            const date = logDate(log as any, sessById);
            const name = nameForLog(log as any, peById);
            const g = groups.get(key) || { name, rows: [] };
            g.rows.push({ date, weight: w });
            groups.set(key, g);
        }
        let best: ImprovedLift | null = null;
        for (const [exerciseId, g] of groups) {
            const rows = g.rows.sort((a, b) => a.date.localeCompare(b.date));
            if (rows.length < 6) continue; // Need enough data.
            // First 4-week window from first date; last 4-week window from last date.
            const firstDate = rows[0].date;
            const lastDate = rows[rows.length - 1].date;
            const firstCut = (() => { const d = new Date(firstDate + 'T00:00:00'); d.setDate(d.getDate() + 28); return d.toISOString().slice(0, 10); })();
            const lastCut = (() => { const d = new Date(lastDate + 'T00:00:00'); d.setDate(d.getDate() - 28); return d.toISOString().slice(0, 10); })();
            const firstWindow = rows.filter(r => r.date <= firstCut);
            const lastWindow = rows.filter(r => r.date >= lastCut);
            if (firstWindow.length < 3 || lastWindow.length < 3) continue;
            const firstAvg = firstWindow.reduce((a, r) => a + r.weight, 0) / firstWindow.length;
            const lastAvg = lastWindow.reduce((a, r) => a + r.weight, 0) / lastWindow.length;
            if (firstAvg <= 0) continue;
            const pctGain = ((lastAvg - firstAvg) / firstAvg) * 100;
            if (!best || pctGain > best.pctGain) {
                best = {
                    exerciseId,
                    name: g.name,
                    pctGain: Math.round(pctGain * 10) / 10,
                    firstAvg: Math.round(firstAvg * 10) / 10,
                    lastAvg: Math.round(lastAvg * 10) / 10,
                    sparkline: rows.map(r => r.weight),
                };
            }
        }
        return best;
    }, [allLogs, sessions, programExercises]);
}

export type FavouriteLift = { exerciseId: string; name: string; count: number };

/** Top exercises by completed-log count. */
export function useFavouriteLifts(limit = 3): FavouriteLift[] {
    const allLogs = useStore(s => s.allExerciseLogs);
    const programExercises = useStore(s => s.programExercises);

    return useMemo(() => {
        const peById = new Map(programExercises.map(pe => [pe.id, pe]));
        const counts = new Map<string, FavouriteLift>();
        for (const log of allLogs) {
            if (!isLoggedAndCompleted(log)) continue;
            const key = (log.exercise_id || log.program_exercise_id) as string;
            const name = nameForLog(log as any, peById);
            const existing = counts.get(key);
            if (existing) existing.count++;
            else counts.set(key, { exerciseId: key, name, count: 1 });
        }
        return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
    }, [allLogs, programExercises, limit]);
}

export type LeastLovedLift = { exerciseId: string; name: string; skipRatio: number; expected: number; logged: number };

/** Loggable program_exercise that's most often skipped — programmed appearances vs completed logs. */
export function useLeastLovedLift(): LeastLovedLift | null {
    const allLogs = useStore(s => s.allExerciseLogs);
    const sessions = useStore(s => s.workoutSessions);
    const programExercises = useStore(s => s.programExercises);

    return useMemo(() => {
        // For each loggable program_exercise, count how many times it should have appeared
        // (= count of completed sessions whose program_day_id matches the exercise's program_day_id).
        const completedSessions = sessions.filter(s => s.status === 'completed');
        const completedByDay = new Map<string, number>();
        for (const s of completedSessions) {
            completedByDay.set(s.program_day_id, (completedByDay.get(s.program_day_id) || 0) + 1);
        }
        // Logged counts per program_exercise.
        const loggedByPe = new Map<string, number>();
        for (const log of allLogs) {
            if (!isLoggedAndCompleted(log)) continue;
            loggedByPe.set(log.program_exercise_id, (loggedByPe.get(log.program_exercise_id) || 0) + 1);
        }
        let worst: LeastLovedLift | null = null;
        for (const pe of programExercises) {
            if (!pe.is_loggable) continue;
            const expected = completedByDay.get(pe.program_day_id) || 0;
            if (expected < 3) continue;
            const logged = loggedByPe.get(pe.id) || 0;
            const skipped = Math.max(0, expected - logged);
            const skipRatio = skipped / expected;
            if (skipRatio <= 0) continue;
            if (!worst || skipRatio > worst.skipRatio) {
                worst = {
                    exerciseId: pe.id,
                    name: pe.display_name,
                    skipRatio: Math.round(skipRatio * 100) / 100,
                    expected,
                    logged,
                };
            }
        }
        return worst;
    }, [allLogs, sessions, programExercises]);
}

export type VolumeWeekPoint = { weekStart: string; volume: number };

/** Weekly volume = sum(weight × reps × sets) across all logged exercises. */
export function useVolumePerWeek(range: '4w' | '12w' | 'all' = '12w'): VolumeWeekPoint[] {
    const allLogs = useStore(s => s.allExerciseLogs);
    const sessions = useStore(s => s.workoutSessions);

    return useMemo(() => {
        const sessById = new Map(sessions.map(s => [s.id, s]));
        const cutoff = (() => {
            if (range === 'all') return null;
            const d = new Date();
            d.setDate(d.getDate() - (range === '4w' ? 28 : 84));
            return d.toISOString().slice(0, 10);
        })();
        const buckets = new Map<string, number>();
        for (const log of allLogs) {
            if (!isLoggedAndCompleted(log)) continue;
            const w = Number(log.working_weight) || 0;
            const r = Number(log.reps_hit) || 0;
            const s = Number(log.sets_completed) || 0;
            const vol = w * r * s;
            if (vol <= 0) continue;
            const date = logDate(log as any, sessById);
            if (cutoff && date < cutoff) continue;
            // Bucket by ISO week start (Monday).
            const d = new Date(date + 'T00:00:00');
            const day = d.getDay();
            const diff = day === 0 ? 6 : day - 1;
            d.setDate(d.getDate() - diff);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            buckets.set(key, (buckets.get(key) || 0) + vol);
        }
        return [...buckets.entries()]
            .map(([weekStart, volume]) => ({ weekStart, volume: Math.round(volume) }))
            .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    }, [allLogs, sessions, range]);
}

/** Current consecutive streak of completed sessions ordered by completed_at desc. */
export function useCurrentStreak(): number {
    const sessions = useStore(s => s.workoutSessions);
    return useMemo(() => {
        const ordered = sessions
            .filter(s => s.completed_at && s.status === 'completed')
            .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
        if (!ordered.length) return 0;
        // Walk forward until a skipped or planned interrupts. Since we only filtered to
        // completed, the streak is just contiguous from the most recent completed back
        // — interrupted by any skipped session whose completed_at (no, skipped has none) —
        // simplest model: count completed sessions until a skipped session exists between
        // two consecutive completed ones (by scheduled_date).
        const skipped = sessions.filter(s => s.status === 'skipped').sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
        let count = 0;
        for (const s of ordered) {
            // If a skipped session sits AFTER this one's scheduled_date and BEFORE the streak's
            // most recent so far, the streak resets.
            const cutoff = ordered[0].scheduled_date;
            const interrupting = skipped.find(k => k.scheduled_date > s.scheduled_date && k.scheduled_date <= cutoff);
            if (interrupting) break;
            count++;
        }
        return count;
    }, [sessions]);
}

/** Estimated 1RM for an exercise, using the best (weight × (1 + reps/30)) over all logs. */
export function useEstimatedOneRM(key: string | null): number | null {
    const allLogs = useStore(s => s.allExerciseLogs);
    return useMemo(() => {
        if (!key) return null;
        let best = 0;
        for (const log of allLogs) {
            if (log.exercise_id !== key && log.program_exercise_id !== key) continue;
            const w = Number(log.working_weight);
            const r = Number(log.reps_hit);
            const e = epley(w, r);
            if (e && e > best) best = e;
        }
        return best || null;
    }, [allLogs, key]);
}
