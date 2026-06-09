import { describe, it, expect } from 'vitest';
import { parseTopSet } from '@/lib/fitnessParsing';

// Tests the REAL parser used by ProgressTracker (src/lib/fitnessParsing.ts).

describe('parseTopSet (fitness PR parser)', () => {
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
