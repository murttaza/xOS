import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useStore } from '@/store';

/**
 * Single global timer hook — drives all active task timers from one interval.
 *
 * Uses persisted timerStartTimes to survive page reloads and background tabs.
 * incrementTimers recalculates elapsed time from start timestamps each tick.
 */
export function useTaskTimer() {
    const timerStartTimes = useStore(s => s.timerStartTimes);
    const incrementTimers = useStore(s => s.incrementTimers);

    const hasActiveTimers = useMemo(() => Object.keys(timerStartTimes).length > 0, [timerStartTimes]);

    const incrementTimersRef = useRef(incrementTimers);
    incrementTimersRef.current = incrementTimers;

    const tick = useCallback(() => {
        incrementTimersRef.current();
    }, []);

    useEffect(() => {
        if (!hasActiveTimers) return;

        // Immediately sync elapsed times on mount/resume
        tick();

        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [hasActiveTimers, tick]);
}
