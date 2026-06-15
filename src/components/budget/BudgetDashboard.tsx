import { useMemo } from 'react';
import { Transaction, BudgetTarget } from '@/types';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Progress } from '../ui/progress';
import { toCents, centsToAmount, formatAmount } from '@/lib/money';
import { useStore } from '@/store';

interface BudgetDashboardProps {
    transactions: Transaction[];
    budgetTargets: BudgetTarget[];
}

export function BudgetDashboard({ transactions, budgetTargets }: BudgetDashboardProps) {
    // All aggregation in integer cents — see src/lib/money.ts.
    const { totalIncome, totalExpenses, net, categoryBreakdown } = useMemo(() => {
        let incomeCents = 0;
        let expenseCents = 0;
        const catSpending: Record<number, { name: string; color: string; spentCents: number }> = {};

        for (const tx of transactions) {
            const cents = toCents(tx.amount);
            if (tx.isIncome) {
                incomeCents += cents;
            } else {
                expenseCents += cents;
                if (!catSpending[tx.categoryId]) {
                    catSpending[tx.categoryId] = {
                        name: tx.categoryName || 'Unknown',
                        color: tx.categoryColor || '#6b7280',
                        spentCents: 0,
                    };
                }
                catSpending[tx.categoryId].spentCents += cents;
            }
        }

        return {
            totalIncome: centsToAmount(incomeCents),
            totalExpenses: centsToAmount(expenseCents),
            net: centsToAmount(incomeCents - expenseCents),
            categoryBreakdown: Object.entries(catSpending)
                .map(([id, data]) => ({
                    categoryId: Number(id),
                    name: data.name,
                    color: data.color,
                    spent: centsToAmount(data.spentCents),
                }))
                .sort((a, b) => b.spent - a.spent),
        };
    }, [transactions]);

    const targetMap = useMemo(() => {
        const map = new Map<number, number>();
        for (const t of budgetTargets) {
            map.set(t.categoryId, Number(t.limitAmount));
        }
        return map;
    }, [budgetTargets]);

    const fmt = formatAmount;
    const currency = useStore(s => s.currencySymbol);

    return (
        <div className="space-y-4">
            {/* Net Balance Card */}
            <div className="bg-secondary rounded-2xl p-4">
                <p className="text-xs text-muted-foreground font-medium mb-1">Net Balance</p>
                <p className={`text-3xl font-bold tabular-nums ${net >= 0 ? 'text-success' : 'text-red-500'}`}>
                    {net >= 0 ? '+' : '−'}{currency}{fmt(Math.abs(net))}
                </p>

                {/* Income / Expense row */}
                <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-success/15 flex items-center justify-center">
                            <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Income</p>
                            <p className="text-sm font-semibold text-success tabular-nums">{currency}{fmt(totalIncome)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-red-500/15 flex items-center justify-center">
                            <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Expenses</p>
                            <p className="text-sm font-semibold text-red-500 tabular-nums">{currency}{fmt(totalExpenses)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Breakdown */}
            {categoryBreakdown.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Spending by Category</h3>
                    <div className="space-y-2">
                        {categoryBreakdown.map(cat => {
                            const limit = targetMap.get(cat.categoryId);
                            const rawPercentage = limit ? (cat.spent / limit) * 100 : 0;
                            const percentage = Math.min(rawPercentage, 100); // bar caps at 100%
                            const isOverBudget = limit ? cat.spent > limit : false;
                            const isNearBudget = limit ? percentage >= 75 && !isOverBudget : false;

                            return (
                                <div key={cat.categoryId} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                            <span className="text-foreground">{cat.name}</span>
                                        </div>
                                        <span className={`font-medium ${isOverBudget ? 'text-red-500' : 'text-muted-foreground'}`}>
                                            {currency}{fmt(cat.spent)}
                                            {limit && <span className="text-muted-foreground/60"> / {currency}{fmt(limit)}</span>}
                                            {isOverBudget && <span className="text-red-500/70 text-[10px] ml-1">({Math.round(rawPercentage)}%)</span>}
                                        </span>
                                    </div>
                                    {limit && (
                                        <Progress
                                            value={percentage}
                                            className={`h-1.5 ${isOverBudget ? '[&>div]:bg-red-500' : isNearBudget ? '[&>div]:bg-warning' : '[&>div]:bg-success'}`}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {categoryBreakdown.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                    No transactions this month
                </div>
            )}
        </div>
    );
}
