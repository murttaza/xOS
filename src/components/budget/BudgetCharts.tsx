import { useMemo } from 'react';
import { Transaction } from '@/types';
import { toCents, centsToAmount } from '@/lib/money';
import { useStore } from '@/store';

interface BudgetChartsProps {
    transactions: Transaction[];
    /** When provided, tapping a donut slice (or legend row) filters the
     *  transaction list to that category. */
    onSelectCategory?: (categoryId: number) => void;
}

export function BudgetCharts({ transactions, onSelectCategory }: BudgetChartsProps) {
    const currency = useStore(s => s.currencySymbol);
    // Donut chart data: spending by category (expenses only).
    // Aggregate in integer cents to avoid IEEE-754 drift (0.1 + 0.2 !== 0.3),
    // then convert back to display dollars at the boundary.
    const { segments, total } = useMemo(() => {
        const catCents: Record<string, { categoryId: number; name: string; color: string; cents: number }> = {};

        for (const tx of transactions) {
            if (tx.isIncome) continue;
            const key = String(tx.categoryId);
            if (!catCents[key]) {
                catCents[key] = {
                    categoryId: tx.categoryId,
                    name: tx.categoryName || 'Other',
                    color: tx.categoryColor || '#6b7280',
                    cents: 0,
                };
            }
            catCents[key].cents += toCents(tx.amount);
        }

        const sorted = Object.values(catCents)
            .map(s => ({ categoryId: s.categoryId, name: s.name, color: s.color, amount: s.cents / 100 }))
            .sort((a, b) => b.amount - a.amount);
        const total = sorted.reduce((sum, s) => sum + s.amount, 0);

        return { segments: sorted, total };
    }, [transactions]);

    // Build SVG donut paths
    const donutPaths = useMemo(() => {
        if (total === 0) return [];
        const paths: { d: string; color: string; name: string; percentage: number; categoryId: number }[] = [];
        let startAngle = -90; // Start from top

        const cx = 60, cy = 60, r = 50;

        for (const seg of segments) {
            const percentage = seg.amount / total;
            const angle = percentage * 360;
            const endAngle = startAngle + angle;

            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;

            const x1 = cx + r * Math.cos(startRad);
            const y1 = cy + r * Math.sin(startRad);
            const x2 = cx + r * Math.cos(endRad);
            const y2 = cy + r * Math.sin(endRad);

            const largeArc = angle > 180 ? 1 : 0;

            const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

            paths.push({ d, color: seg.color, name: seg.name, percentage: percentage * 100, categoryId: seg.categoryId });
            startAngle = endAngle;
        }

        return paths;
    }, [segments, total]);

    if (transactions.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground text-sm">
                Add transactions to see charts
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Donut Chart */}
            {total > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Spending Breakdown</h3>
                    <div className="flex items-center gap-4">
                        <svg viewBox="0 0 120 120" className="w-24 h-24 shrink-0">
                            {donutPaths.map((path, i) => (
                                <path
                                    key={i}
                                    d={path.d}
                                    fill={path.color}
                                    opacity={0.85}
                                    className={onSelectCategory ? 'cursor-pointer hover:opacity-100 transition-opacity' : undefined}
                                    onClick={onSelectCategory ? () => onSelectCategory(path.categoryId) : undefined}
                                >
                                    <title>{`${path.name} — ${Math.round(path.percentage)}%`}</title>
                                </path>
                            ))}
                            {/* Center hole */}
                            <circle cx="60" cy="60" r="30" className="fill-background" />
                            <text x="60" y="57" textAnchor="middle" className="fill-foreground text-[8px] font-bold">
                                {currency}{total.toFixed(0)}
                            </text>
                            <text x="60" y="68" textAnchor="middle" className="fill-muted-foreground text-[5px]">
                                total
                            </text>
                        </svg>

                        <div className="space-y-1 flex-1 min-w-0">
                            {segments.slice(0, 5).map((seg, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className="w-full flex items-center gap-2 text-xs rounded px-1 -mx-1 hover:bg-muted/40 transition-colors disabled:hover:bg-transparent text-left"
                                    onClick={onSelectCategory ? () => onSelectCategory(seg.categoryId) : undefined}
                                    disabled={!onSelectCategory}
                                    aria-label={`Filter transactions to ${seg.name}`}
                                >
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                                    <span className="truncate text-muted-foreground">{seg.name}</span>
                                    <span className="ml-auto font-medium tabular-nums shrink-0">{((seg.amount / total) * 100).toFixed(0)}%</span>
                                </button>
                            ))}
                            {segments.length > 5 && (
                                <span className="text-[10px] text-muted-foreground/60">+{segments.length - 5} more</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Daily Spending Bar Chart */}
            <DailySpendingChart transactions={transactions} currency={currency} />
        </div>
    );
}

function DailySpendingChart({ transactions, currency }: { transactions: Transaction[]; currency: string }) {
    const dailyData = useMemo(() => {
        // Aggregate in integer cents (see src/lib/money.ts)
        const map = new Map<string, { incomeCents: number; expenseCents: number }>();

        for (const tx of transactions) {
            const day = tx.date.slice(-2); // DD
            const existing = map.get(day) || { incomeCents: 0, expenseCents: 0 };
            if (tx.isIncome) {
                existing.incomeCents += toCents(tx.amount);
            } else {
                existing.expenseCents += toCents(tx.amount);
            }
            map.set(day, existing);
        }

        return [...map.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([day, data]) => ({
                day,
                income: centsToAmount(data.incomeCents),
                expense: centsToAmount(data.expenseCents),
            }));
    }, [transactions]);

    if (dailyData.length === 0) return null;

    // Scale against the largest combined day so a day with both income and
    // expense can never stack past the chart's height.
    const maxAmount = Math.max(...dailyData.map(d => d.income + d.expense), 1);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Daily Activity</h3>
                {/* Legend so income/expense are readable without hovering (touch). */}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-success/60" />In</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/60" />Out</span>
                </div>
            </div>
            <div className="flex items-end gap-0.5 h-20">
                {dailyData.map(d => (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5 justify-end h-full min-w-0">
                        {d.income > 0 && (
                            <div
                                className="w-full bg-success/60 rounded-t-sm min-h-[2px]"
                                style={{ height: `${(d.income / maxAmount) * 100}%` }}
                                title={`Income: ${currency}${d.income.toFixed(2)}`}
                            />
                        )}
                        {d.expense > 0 && (
                            <div
                                className="w-full bg-red-500/60 rounded-t-sm min-h-[2px]"
                                style={{ height: `${(d.expense / maxAmount) * 100}%` }}
                                title={`Expense: ${currency}${d.expense.toFixed(2)}`}
                            />
                        )}
                    </div>
                ))}
            </div>
            <div className="flex gap-0.5">
                {dailyData.map(d => (
                    <div key={d.day} className="flex-1 text-center">
                        <span className="text-[7px] text-muted-foreground/50">{d.day}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
