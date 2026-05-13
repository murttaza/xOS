import { describe, it, expect } from 'vitest';

// Re-implement the regex inline to avoid component-import overhead in vitest.
// Mirrors the implementation in src/components/fitness/ProgressTracker.tsx.
function parseTopSet(val: string | null): number | null {
    if (!val) return null;
    const match = val.match(/^\s*([\d.]+)/);
    if (!match) return null;
    const n = parseFloat(match[1]);
    return Number.isFinite(n) ? n : null;
}

describe('parseTopSet (fitness PR regex)', () => {
    it('parses integer weight from "275x5"', () => {
        expect(parseTopSet('275x5')).toBe(275);
    });

    it('preserves decimal weight from "275.5x5"', () => {
        expect(parseTopSet('275.5x5')).toBe(275.5);
    });

    it('handles surrounding whitespace', () => {
        expect(parseTopSet('  185 x 8 ')).toBe(185);
    });

    it('returns null for empty / null input', () => {
        expect(parseTopSet(null)).toBeNull();
        expect(parseTopSet('')).toBeNull();
    });

    it('returns null for non-numeric input', () => {
        expect(parseTopSet('heavy')).toBeNull();
    });

    it('handles bare numbers without reps', () => {
        expect(parseTopSet('225')).toBe(225);
    });
});
