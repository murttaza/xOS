/** Parse the leading weight out of a top-set string like "275x5" or "275.5 x 5".
 *  Captures it as a float so "275.5x5" doesn't round down to 275. */
export function parseTopSet(val: string | null): number | null {
    if (!val) return null;
    const match = val.match(/^\s*([\d.]+)/);
    if (!match) return null;
    const n = parseFloat(match[1]);
    return Number.isFinite(n) ? n : null;
}
