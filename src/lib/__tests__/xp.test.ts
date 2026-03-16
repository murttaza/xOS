import { describe, it, expect } from 'vitest';
import {
    calculateSessionXP,
    calculateXPNeeded,
    calculateLevelFromXP,
    calculateStreakMultiplier,
    calculatePenalty,
    calculatePrayerXP,
    migrateXPToNewCurve,
} from '../utils';

// ── calculateXPNeeded ──────────────────────────────────────────────

describe('calculateXPNeeded', () => {
    it('returns expected values at key levels', () => {
        expect(calculateXPNeeded(1)).toBe(1200);
        expect(calculateXPNeeded(5)).toBe(5969);
        expect(calculateXPNeeded(10)).toBe(14637);
    });

    it('is monotonically increasing', () => {
        for (let level = 1; level < 50; level++) {
            expect(calculateXPNeeded(level + 1)).toBeGreaterThan(calculateXPNeeded(level));
        }
    });

    it('returns a positive integer for all reasonable levels', () => {
        for (let level = 1; level <= 100; level++) {
            const xp = calculateXPNeeded(level);
            expect(xp).toBeGreaterThan(0);
            expect(Number.isFinite(xp)).toBe(true);
            expect(Math.floor(xp)).toBe(xp);
        }
    });

    it('handles edge cases gracefully', () => {
        expect(calculateXPNeeded(0)).toBe(800);
        expect(calculateXPNeeded(-1)).toBe(800);
    });

    it('grows slower than the old 1000*level^1.5 curve at higher levels', () => {
        const oldCurve = (l: number) => Math.floor(1000 * Math.pow(l, 1.5));
        for (const level of [10, 20, 30, 50]) {
            expect(calculateXPNeeded(level)).toBeLessThan(oldCurve(level));
        }
    });
});

// ── calculateStreakMultiplier ──────────────────────────────────────

describe('calculateStreakMultiplier', () => {
    it('returns 1.0 for zero streak', () => {
        expect(calculateStreakMultiplier(0)).toBe(1.0);
    });

    it('returns 1.0 for negative streak', () => {
        expect(calculateStreakMultiplier(-5)).toBe(1.0);
    });

    it('returns > 1.0 for positive streak', () => {
        expect(calculateStreakMultiplier(1)).toBeGreaterThan(1.0);
    });

    it('is monotonically increasing up to cap', () => {
        for (let s = 1; s < 30; s++) {
            expect(calculateStreakMultiplier(s + 1)).toBeGreaterThanOrEqual(calculateStreakMultiplier(s));
        }
    });

    it('caps at 1.5', () => {
        expect(calculateStreakMultiplier(30)).toBeCloseTo(1.5, 1);
        expect(calculateStreakMultiplier(100)).toBe(1.5);
        expect(calculateStreakMultiplier(1000)).toBe(1.5);
    });

    it('gives meaningful bonus at 7-day streak', () => {
        const mult = calculateStreakMultiplier(7);
        expect(mult).toBeGreaterThan(1.2);
        expect(mult).toBeLessThan(1.4);
    });
});

// ── calculateSessionXP ────────────────────────────────────────────

describe('calculateSessionXP', () => {
    it('calculates base XP without options', () => {
        // 30 min, difficulty 3: 30 * 10 * (1 + 0.6) = 480
        expect(calculateSessionXP(30, 3)).toBe(480);
    });

    it('returns 0 for zero duration', () => {
        expect(calculateSessionXP(0, 5)).toBe(0);
    });

    it('uses 1x multiplier for zero difficulty', () => {
        // 60 min, difficulty 0: 60 * 10 * 1.0 = 600
        expect(calculateSessionXP(60, 0)).toBe(600);
    });

    it('applies streak multiplier', () => {
        const baseXP = calculateSessionXP(30, 3);
        const withStreak = calculateSessionXP(30, 3, { streakCount: 7 });
        expect(withStreak).toBeGreaterThan(baseXP);
    });

    it('adds daily first-session bonus', () => {
        const baseXP = calculateSessionXP(30, 3);
        const withBonus = calculateSessionXP(30, 3, { isFirstSessionOfDay: true });
        expect(withBonus).toBe(baseXP + 200);
    });

    it('applies both streak and daily bonus together', () => {
        const withBoth = calculateSessionXP(30, 3, { streakCount: 7, isFirstSessionOfDay: true });
        const baseXP = 30 * 10 * (1 + 3 * 0.2);
        const streakMult = calculateStreakMultiplier(7);
        const expected = Math.round(baseXP * streakMult) + 200;
        expect(withBoth).toBe(expected);
    });

    it('handles undefined options like no options', () => {
        expect(calculateSessionXP(30, 3, undefined)).toBe(calculateSessionXP(30, 3));
        expect(calculateSessionXP(30, 3, {})).toBe(calculateSessionXP(30, 3));
    });

    it('handles high difficulty', () => {
        // 60 min, difficulty 10: 60 * 10 * (1 + 2.0) = 1800
        expect(calculateSessionXP(60, 10)).toBe(1800);
    });
});

// ── calculateLevelFromXP ──────────────────────────────────────────

describe('calculateLevelFromXP', () => {
    it('stays at current level when XP is below threshold', () => {
        const result = calculateLevelFromXP(500, 1);
        expect(result.newLevel).toBe(1);
        expect(result.newXP).toBe(500);
    });

    it('levels up when XP exactly meets threshold', () => {
        const needed = calculateXPNeeded(1);
        const result = calculateLevelFromXP(needed, 1);
        expect(result.newLevel).toBe(2);
        expect(result.newXP).toBe(0);
    });

    it('does not level up when XP is one below threshold', () => {
        const needed = calculateXPNeeded(1);
        const result = calculateLevelFromXP(needed - 1, 1);
        expect(result.newLevel).toBe(1);
        expect(result.newXP).toBe(needed - 1);
    });

    it('handles multiple level-ups from large XP', () => {
        const xpFor1 = calculateXPNeeded(1);
        const xpFor2 = calculateXPNeeded(2);
        const totalXP = xpFor1 + xpFor2 + 100;
        const result = calculateLevelFromXP(totalXP, 1);
        expect(result.newLevel).toBe(3);
        expect(result.newXP).toBe(100);
    });

    it('returns same level for 0 XP', () => {
        const result = calculateLevelFromXP(0, 5);
        expect(result.newLevel).toBe(5);
        expect(result.newXP).toBe(0);
    });

    it('carries over remainder correctly', () => {
        const needed = calculateXPNeeded(3);
        const result = calculateLevelFromXP(needed + 42, 3);
        expect(result.newLevel).toBe(4);
        expect(result.newXP).toBe(42);
    });
});

// ── calculatePenalty ──────────────────────────────────────────────

describe('calculatePenalty', () => {
    it('returns 0 for difficulty 0', () => {
        expect(calculatePenalty(0, 5)).toBe(0);
    });

    it('returns 0 for negative difficulty', () => {
        expect(calculatePenalty(-1, 5)).toBe(0);
    });

    it('returns base penalty at level 1', () => {
        // difficulty 5, level 1: 5*50 * 1.0 = 250, but capped at 20% of 1200 = 240
        expect(calculatePenalty(5, 1)).toBe(240);
    });

    it('scales with level', () => {
        const penaltyLvl1 = calculatePenalty(3, 1);
        const penaltyLvl10 = calculatePenalty(3, 10);
        expect(penaltyLvl10).toBeGreaterThan(penaltyLvl1);
    });

    it('respects 20% XP-needed cap', () => {
        for (let level = 1; level <= 30; level++) {
            const penalty = calculatePenalty(5, level);
            const maxAllowed = Math.floor(calculateXPNeeded(level) * 0.2);
            expect(penalty).toBeLessThanOrEqual(maxAllowed);
        }
    });

    it('penalty is always non-negative', () => {
        for (let d = 0; d <= 5; d++) {
            for (let l = 1; l <= 20; l++) {
                expect(calculatePenalty(d, l)).toBeGreaterThanOrEqual(0);
            }
        }
    });
});

// ── calculatePrayerXP ─────────────────────────────────────────────

describe('calculatePrayerXP', () => {
    it('returns 320 at level 1', () => {
        expect(calculatePrayerXP(1)).toBe(320);
    });

    it('returns 500 at level 10', () => {
        expect(calculatePrayerXP(10)).toBe(500);
    });

    it('scales with level', () => {
        expect(calculatePrayerXP(20)).toBeGreaterThan(calculatePrayerXP(10));
    });

    it('always returns a positive number', () => {
        expect(calculatePrayerXP(0)).toBeGreaterThan(0);
        expect(calculatePrayerXP(1)).toBeGreaterThan(0);
    });
});

// ── migrateXPToNewCurve ───────────────────────────────────────────

describe('migrateXPToNewCurve', () => {
    const oldCurve = (l: number) => Math.floor(1000 * Math.pow(l, 1.5));
    const newCurve = calculateXPNeeded;

    it('level 1 with 0 XP stays unchanged', () => {
        const result = migrateXPToNewCurve(1, 0, oldCurve, newCurve);
        expect(result.newLevel).toBe(1);
        expect(result.newXP).toBe(0);
    });

    it('never loses levels', () => {
        for (const oldLevel of [1, 5, 10, 15, 20]) {
            const result = migrateXPToNewCurve(oldLevel, 500, oldCurve, newCurve);
            expect(result.newLevel).toBeGreaterThanOrEqual(oldLevel);
        }
    });

    it('gains levels since new curve is easier', () => {
        // Level 10 under old curve = massive total XP, should be higher under new curve
        const result = migrateXPToNewCurve(10, 5000, oldCurve, newCurve);
        expect(result.newLevel).toBeGreaterThanOrEqual(10);
    });

    it('preserves total XP (no XP lost)', () => {
        const oldLevel = 5;
        const oldXP = 3000;

        // Calculate total XP
        let totalOld = oldXP;
        for (let l = 1; l < oldLevel; l++) totalOld += oldCurve(l);

        // Calculate total XP from migrated result
        const result = migrateXPToNewCurve(oldLevel, oldXP, oldCurve, newCurve);
        let totalNew = result.newXP;
        for (let l = 1; l < result.newLevel; l++) totalNew += newCurve(l);

        // Total XP under new curve should account for all old XP
        // (may differ slightly due to level floor guarantee)
        expect(totalNew).toBeGreaterThanOrEqual(totalOld - 1);
    });

    it('handles level 1 with enough XP to level up under new curve', () => {
        const result = migrateXPToNewCurve(1, 2000, oldCurve, newCurve);
        expect(result.newLevel).toBeGreaterThanOrEqual(2);
    });

    it('returns integer XP', () => {
        const result = migrateXPToNewCurve(7, 1234, oldCurve, newCurve);
        expect(Math.floor(result.newXP)).toBe(result.newXP);
    });
});
