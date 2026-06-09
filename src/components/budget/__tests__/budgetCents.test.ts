import { describe, it, expect } from 'vitest';
import { toCents, centsToAmount, sumAmounts } from '@/lib/money';

// Tests the REAL aggregation helpers used by BudgetDashboard/BudgetTargets/
// BudgetCharts (src/lib/money.ts) — not a mirror copy.

// Demonstrates the IEEE-754 drift the helpers avoid.
function aggregateNaive(amounts: number[]): number {
    return amounts.reduce((sum, a) => sum + a, 0);
}

describe('money helpers (integer-cent aggregation)', () => {
    it('integer-cent sum is exact for the classic 0.1+0.2 case', () => {
        expect(sumAmounts([0.1, 0.2])).toBe(0.3);
        expect(aggregateNaive([0.1, 0.2])).not.toBe(0.3); // proves the bug existed
    });

    it('handles many small transactions without drift', () => {
        const txs = Array.from({ length: 1000 }, () => 0.01);
        expect(sumAmounts(txs)).toBe(10);
    });

    it('preserves cents on mixed amounts', () => {
        expect(sumAmounts([12.99, 3.50, 0.05])).toBe(16.54);
    });

    it('accepts string amounts (NUMERIC columns arrive as strings)', () => {
        expect(sumAmounts(['12.99', '3.50'])).toBe(16.49);
        expect(toCents('19.99')).toBe(1999);
    });

    it('treats non-finite input as zero instead of poisoning the sum', () => {
        expect(toCents(NaN)).toBe(0);
        expect(toCents('not-a-number')).toBe(0);
        expect(sumAmounts([1, NaN, 2])).toBe(3);
    });

    it('round-trips cents to dollars', () => {
        expect(centsToAmount(toCents(123.45))).toBe(123.45);
    });
});
