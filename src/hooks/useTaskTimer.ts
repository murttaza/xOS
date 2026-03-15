import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useStore } from '@/store';

/**
 * Single global timer hook — drives all active task timers from one interval.
 * 
 * Performance optimization: Uses a ref to track whether any timers are active,
 * so the interval is only created/destroyed when timers start/stop (not every second).
 * The incrementTimers function uses an early-out when no timers are active.
 */
export function useTaskTimer() {
    const activeTimers = useStore(s => s.activeTimers);
    const incrementTimers = useStore(s => s.incrementTimers);

    // Memoize the check to prevent unnecessary effect triggers
    const hasActiveTimers = useMemo(() => Object.keys(activeTimers).length > 0, [activeTimers]);

    // Use ref for the callback so the interval doesn't need to be recreated
    const incrementTimersRef = useRef(incrementTimers);
    incrementTimersRef.current = incrementTimers;

    const tick = useCallback(() => {
        incrementTimersRef.current();
    }, []);

    useEffect(() => {
        if (!hasActiveTimers) return;

        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [hasActiveTimers, tick]);
}
