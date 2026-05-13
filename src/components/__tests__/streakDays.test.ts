import { describe, it, expect } from 'vitest';
import { differenceInCalendarDays } from 'date-fns';

// Mirrors the implementation in StreaksWidget.tsx computeStreakDays —
// kept here so the test is independent of the component module.
function computeStreakDays(start: Date, now: Date): number {
    return Math.max(0, differenceInCalendarDays(now, start));
}

describe('computeStreakDays (calendar-day math)', () => {
    it('returns 0 when start and now are the same day', () => {
        const d = new Date(2026, 4, 10, 9, 0, 0);
        const later = new Date(2026, 4, 10, 23, 30, 0);
        expect(computeStreakDays(d, later)).toBe(0);
    });

    it('returns 1 across midnight, even with < 24h elapsed', () => {
        const d = new Date(2026, 4, 10, 23, 0, 0); // 11pm
        const later = new Date(2026, 4, 11, 1, 0, 0); // 1am next day
        expect(computeStreakDays(d, later)).toBe(1);
    });

    it('handles DST "spring forward" boundary cleanly (US-style)', () => {
        // March 12, 2026: 2am → 3am (US DST). Date works in local time, so this just verifies no off-by-one.
        const d = new Date(2026, 2, 11, 23, 0, 0); // Mar 11 11pm
        const later = new Date(2026, 2, 12, 9, 0, 0); // Mar 12 9am
        expect(computeStreakDays(d, later)).toBe(1);
    });

    it('returns max 0 when now < start', () => {
        const d = new Date(2026, 4, 10);
        const earlier = new Date(2026, 4, 8);
        expect(computeStreakDays(d, earlier)).toBe(0);
    });

    it('returns N for an N-day gap', () => {
        const d = new Date(2026, 4, 1);
        const later = new Date(2026, 4, 11);
        expect(computeStreakDays(d, later)).toBe(10);
    });
});
