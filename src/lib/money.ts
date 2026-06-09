// Money helpers — aggregate in integer cents, never in floats.
// 0.1 + 0.2 !== 0.3 in IEEE-754; for a budget app the running totals must be
// penny-exact. Postgres stores NUMERIC(12,2) (exact); these helpers keep the
// client-side math exact too. Convert to display dollars only at the boundary.

/** Round a dollar amount to integer cents. Use BEFORE summing so a single bad
 *  input doesn't poison the running total. */
export function toCents(amount: number | string): number {
    const n = Number(amount);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function centsToAmount(cents: number): number {
    return cents / 100;
}

/** Exact sum of dollar amounts (returns dollars). */
export function sumAmounts(amounts: Array<number | string>): number {
    return centsToAmount(amounts.reduce<number>((acc, a) => acc + toCents(a), 0));
}

export function formatAmount(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
