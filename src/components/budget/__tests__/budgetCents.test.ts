import { describe, it, expect } from 'vitest';

// Mirrors the integer-cent aggregation in BudgetCharts.tsx — kept here so the test
// runs without rendering a React tree.
function aggregateInCents(amounts: number[]): number {
    let totalCents = 0;
    for (const a of amounts) {
        totalCents += Math.round(a * 100);
    }
    return totalCents / 100;
}

// Demonstrates the IEEE-754 drift that the fix avoids.
function aggregateNaive(amounts: number[]): number {
    return amounts.reduce((sum, a) => sum + a, 0);
}

describe('budget aggregation precision', () => {
    it('integer-cent sum is exact for the classic 0.1+0.2 case', () => {
        expect(aggregateInCents([0.1, 0.2])).toBe(0.3);
        expect(aggregateNaive([0.1, 0.2])).not.toBe(0.3); // proves the bug existed
    });

    it('handles many small transactions without drift', () => {
        const txs = Array.from({ length: 1000 }, () => 0.01);
        expect(aggregateInCents(txs)).toBe(10);
        // Naive may produce 9.999999... or similar:
        const naive = aggregateNaive(txs);
        expect(Math.abs(naive - 10)).toBeLessThan(0.001); // close, but not exact
    });

    it('preserves cents on mixed amounts', () => {
        expect(aggregateInCents([12.99, 3.50, 0.05])).toBe(16.54);
    });
});
