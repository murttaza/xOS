import { differenceInCalendarDays } from 'date-fns';
import type { Streak } from '@/types';

/**
 * Streak days derived from the createdAt anchor — the single source of truth
 * for manual streaks. Pause/resume adjust the anchor (YearMode), and
 * taskStore.checkMissedTasks syncs the DB's currentStreak FROM this value so
 * the tray/widget agree with the UI.
 */
export function anchorStreakDays(streak: Streak, now: Date): number {
    const anchor = streak.createdAt ? new Date(streak.createdAt) : new Date(streak.lastUpdated || now);
    const effectiveNow = streak.isPaused ? new Date(streak.lastUpdated || now) : now;
    if (isNaN(anchor.getTime()) || isNaN(effectiveNow.getTime())) return streak.currentStreak ?? 0;
    return Math.max(0, differenceInCalendarDays(effectiveNow, anchor));
}
