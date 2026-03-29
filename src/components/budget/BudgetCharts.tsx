import { useMemo } from 'react';
import { Transaction } from '@/types';

interface BudgetChartsProps {
    transactions: Transaction[];
}

export function BudgetCharts({ transactions }: BudgetChartsProps) {
    // Donut chart data: spending by category (expenses only)
    const { segments, total } = useMemo(() => {
        const catTotals: Record<string, { name: string; color: string; amount: number }> = {};

        for (const tx of transactions) {
            if (tx.isIncome) continue;
            const key = String(tx.categoryId);
            if (!catTotals[key]) {
                catTotals[key] = {
                    name: tx.categoryName || 'Other',
                    color: tx.categoryColor || '#6b7280',
                    amount: 0,
                };
            }
            catTotals[key].amount += Number(tx.amount);
        }

        const sorted = Object.values(catTotals).sort((a, b) => b.amount - a.amount);
        const total = sorted.reduce((sum, s) => sum + s.amount, 0);

        return { segments: sorted, total };
    }, [transactions]);

    // Build SVG donut paths
    const donutPaths = useMemo(() => {
        if (total === 0) return [];
        const paths: { d: string; color: string; name: string; percentage: number }[] = [];
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

            paths.push({ d, color: seg.color, name: seg.name, percentage: percentage * 100 });
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
                                <path key={i} d={path.d} fill={path.color} opacity={0.85} />
                            ))}
                            {/* Center hole */}
                            <circle cx="60" cy="60" r="30" className="fill-background" />
                            <text x="60" y="57" textAnchor="middle" className="fill-foreground text-[8px] font-bold">
                                ${total.toFixed(0)}
                            </text>
                            <text x="60" y="68" textAnchor="middle" className="fill-muted-foreground text-[5px]">
                                total
                            </text>
                        </svg>

                        <div className="space-y-1 flex-1 min-w-0">
                            {segments.slice(0, 5).map((seg, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                                    <span className="truncate text-muted-foreground">{seg.name}</span>
                                    <span className="ml-auto font-medium tabular-nums shrink-0">{((seg.amount / total) * 100).toFixed(0)}%</span>
                                </div>
                            ))}
                            {segments.length > 5 && (
                                <span className="text-[10px] text-muted-foreground/60">+{segments.length - 5} more</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Daily Spending Bar Chart */}
            <DailySpendingChart transactions={transactions} />
        </div>
    );
}

function DailySpendingChart({ transactions }: { transactions: Transaction[] }) {
    const dailyData = useMemo(() => {
        const map = new Map<string, { income: number; expense: number }>();

        for (const tx of transactions) {
            const day = tx.date.slice(-2); // DD
            const existing = map.get(day) || { income: 0, expense: 0 };
            if (tx.isIncome) {
                existing.income += Number(tx.amount);
            } else {
                existing.expense += Number(tx.amount);
            }
            map.set(day, existing);
        }

        return [...map.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([day, data]) => ({ day, ...data }));
    }, [transactions]);

    if (dailyData.length === 0) return null;

    const maxAmount = Math.max(...dailyData.map(d => Math.max(d.income, d.expense)), 1);

    return (
        <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Daily Activity</h3>
            <div className="flex items-end gap-0.5 h-20">
                {dailyData.map(d => (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5 justify-end h-full min-w-0">
                        {d.income > 0 && (
                            <div
                                className="w-full bg-green-500/60 rounded-t-sm min-h-[2px]"
                                style={{ height: `${(d.income / maxAmount) * 100}%` }}
                                title={`Income: $${d.income.toFixed(2)}`}
                            />
                        )}
                        {d.expense > 0 && (
                            <div
                                className="w-full bg-red-500/60 rounded-t-sm min-h-[2px]"
                                style={{ height: `${(d.expense / maxAmount) * 100}%` }}
                                title={`Expense: $${d.expense.toFixed(2)}`}
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
