import { describe, it, expect } from 'vitest';
import { anchorStreakDays } from '@/lib/streaks';
import type { Streak } from '@/types';

// Tests the REAL anchor-based streak math (src/lib/streaks.ts) used by
// StreaksWidget, YearMode, and the daily currentStreak sync.

function mkStreak(overrides: Partial<Streak>): Streak {
    return {
        id: 1,
        title: 'Test',
        currentStreak: 0,
        lastUpdated: '',
        isPaused: 0,
        createdAt: '',
        ...overrides,
    } as Streak;
}

describe('anchorStreakDays', () => {
    it('returns 0 when the anchor is today', () => {
        const now = new Date(2026, 4, 10, 23, 30, 0);
        const s = mkStreak({ createdAt: new Date(2026, 4, 10, 9, 0, 0).toISOString() });
        expect(anchorStreakDays(s, now)).toBe(0);
    });

    it('returns 1 across midnight, even with < 24h elapsed', () => {
        const now = new Date(2026, 4, 11, 1, 0, 0);
        const s = mkStreak({ createdAt: new Date(2026, 4, 10, 23, 0, 0).toISOString() });
        expect(anchorStreakDays(s, now)).toBe(1);
    });

    it('returns N for an N-day gap', () => {
        const now = new Date(2026, 4, 11);
        const s = mkStreak({ createdAt: new Date(2026, 4, 1).toISOString() });
        expect(anchorStreakDays(s, now)).toBe(10);
    });

    it('never goes negative when the anchor is in the future', () => {
        const now = new Date(2026, 4, 8);
        const s = mkStreak({ createdAt: new Date(2026, 4, 10).toISOString() });
        expect(anchorStreakDays(s, now)).toBe(0);
    });

    it('freezes at lastUpdated while paused', () => {
        const s = mkStreak({
            createdAt: new Date(2026, 4, 1).toISOString(),
            lastUpdated: new Date(2026, 4, 6).toISOString(),
            isPaused: 1,
        });
        // "now" being weeks later must not matter while paused
        expect(anchorStreakDays(s, new Date(2026, 5, 20))).toBe(5);
    });

    it('falls back to lastUpdated when createdAt is missing', () => {
        const s = mkStreak({ createdAt: '', lastUpdated: new Date(2026, 4, 9).toISOString() });
        expect(anchorStreakDays(s, new Date(2026, 4, 11))).toBe(2);
    });

    it('falls back to stored currentStreak when dates are invalid', () => {
        const s = mkStreak({ createdAt: 'garbage', currentStreak: 7 });
        expect(anchorStreakDays(s, new Date(2026, 4, 11))).toBe(7);
    });
});
