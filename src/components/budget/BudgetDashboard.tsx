import { useMemo } from 'react';
import { Transaction, BudgetTarget } from '@/types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Progress } from '../ui/progress';

interface BudgetDashboardProps {
    transactions: Transaction[];
    budgetTargets: BudgetTarget[];
}

export function BudgetDashboard({ transactions, budgetTargets }: BudgetDashboardProps) {
    const { totalIncome, totalExpenses, net, categoryBreakdown } = useMemo(() => {
        let income = 0;
        let expenses = 0;
        const catSpending: Record<number, { name: string; color: string; spent: number }> = {};

        for (const tx of transactions) {
            const amount = Number(tx.amount);
            if (tx.isIncome) {
                income += amount;
            } else {
                expenses += amount;
                if (!catSpending[tx.categoryId]) {
                    catSpending[tx.categoryId] = {
                        name: tx.categoryName || 'Unknown',
                        color: tx.categoryColor || '#6b7280',
                        spent: 0,
                    };
                }
                catSpending[tx.categoryId].spent += amount;
            }
        }

        return {
            totalIncome: income,
            totalExpenses: expenses,
            net: income - expenses,
            categoryBreakdown: Object.entries(catSpending)
                .map(([id, data]) => ({ categoryId: Number(id), ...data }))
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

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-secondary rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Income</span>
                    </div>
                    <p className="text-lg font-bold text-green-500">${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-secondary rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <TrendingDown className="h-3 w-3 text-red-500" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Expenses</span>
                    </div>
                    <p className="text-lg font-bold text-red-500">${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-secondary rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <Minus className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Net</span>
                    </div>
                    <p className={`text-lg font-bold ${net >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {net >= 0 ? '+' : ''}${net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Category Breakdown */}
            {categoryBreakdown.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Spending by Category</h3>
                    <div className="space-y-2">
                        {categoryBreakdown.map(cat => {
                            const limit = targetMap.get(cat.categoryId);
                            const percentage = limit ? Math.min((cat.spent / limit) * 100, 100) : 0;
                            const isOverBudget = limit ? cat.spent > limit : false;
                            const isNearBudget = limit ? percentage >= 75 && !isOverBudget : false;

                            return (
                                <div key={cat.categoryId} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                            <span className="text-foreground">{cat.name}</span>
                                        </div>
                                        <span className={`font-medium ${isOverBudget ? 'text-red-500' : 'text-muted-foreground'}`}>
                                            ${cat.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            {limit && <span className="text-muted-foreground/60"> / ${limit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>}
                                        </span>
                                    </div>
                                    {limit && (
                                        <Progress
                                            value={percentage}
                                            className={`h-1.5 ${isOverBudget ? '[&>div]:bg-red-500' : isNearBudget ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {categoryBreakdown.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                    No transactions this month
                </div>
            )}
        </div>
    );
}
