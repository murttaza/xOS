import { useState } from 'react';
import { BudgetCategory, BudgetTarget, Transaction } from '@/types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { Plus, X, Check, Settings2 } from 'lucide-react';
import { toCents, centsToAmount } from '@/lib/money';
import { showConfirm } from '../ui/confirm-dialog';
import { useStore } from '@/store';
import { api } from '@/api';
import { showErrorToast } from '../ui/toast';
import { format, parse, subMonths } from 'date-fns';

interface BudgetTargetsProps {
    categories: BudgetCategory[];
    targets: BudgetTarget[];
    transactions: Transaction[];
    selectedMonth: string;
    onSetTarget: (target: Omit<BudgetTarget, 'id'>) => void;
    onDeleteTarget: (id: number) => void;
    onOpenCategoryManager?: () => void;
}

export function BudgetTargets({ categories, targets, transactions, selectedMonth, onSetTarget, onDeleteTarget, onOpenCategoryManager }: BudgetTargetsProps) {
    const currency = useStore(s => s.currencySymbol);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [addingCategoryId, setAddingCategoryId] = useState<number | null>(null);
    const [newAmount, setNewAmount] = useState('');

    const expenseCategories = categories.filter(c => !c.isIncome);
    const targetMap = new Map(targets.map(t => [t.categoryId, t]));

    // Calculate spending per category — in integer cents (see src/lib/money.ts)
    const spendingCents = new Map<number, number>();
    for (const tx of transactions) {
        if (!tx.isIncome) {
            spendingCents.set(tx.categoryId, (spendingCents.get(tx.categoryId) || 0) + toCents(tx.amount));
        }
    }
    const spendingMap = new Map<number, number>(
        [...spendingCents.entries()].map(([id, cents]) => [id, centsToAmount(cents)])
    );

    const categoriesWithoutTargets = expenseCategories.filter(c => !targetMap.has(c.id!));

    const handleSaveTarget = (categoryId: number, amount: string) => {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) return;
        onSetTarget({ categoryId, month: selectedMonth, limitAmount: parsed });
        setEditingId(null);
        setNewAmount('');
        setEditAmount('');
        setAddingCategoryId(null);
    };

    const categoriesWithTargets = expenseCategories.filter(c => targetMap.has(c.id!));

    return (
        <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Budget Targets</h3>

            <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
                {categoriesWithTargets.map(cat => {
                    const target = targetMap.get(cat.id!)!;
                    const spent = spendingMap.get(cat.id!) || 0;
                    const limit = Number(target.limitAmount);
                    const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
                    const isOver = spent > limit;
                    const isNear = percentage >= 75 && !isOver;

                    return (
                        <div key={cat.id} className="bg-secondary rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm">{cat.icon}</span>
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                    <span className="text-sm font-medium">{cat.name}</span>
                                </div>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 shrink-0"
                                    aria-label={`Remove budget target for ${cat.name}`}
                                    title="Remove target"
                                    onClick={async () => {
                                        if (!target.id) return;
                                        const ok = await showConfirm({
                                            title: 'Remove budget target',
                                            message: `Remove the monthly limit for ${cat.name}?`,
                                            confirmLabel: 'Remove',
                                            destructive: true,
                                        });
                                        if (ok) onDeleteTarget(target.id!);
                                    }}
                                >
                                    <X className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>

                            {editingId === cat.id ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">{currency}</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={editAmount}
                                        onChange={e => setEditAmount(e.target.value)}
                                        className="h-10 flex-1"
                                        autoFocus
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleSaveTarget(cat.id!, editAmount);
                                            if (e.key === 'Escape') setEditingId(null);
                                        }}
                                    />
                                    <Button size="icon" className="h-10 w-10 shrink-0" onClick={() => handleSaveTarget(cat.id!, editAmount)}>
                                        <Check className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={() => setEditingId(null)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { setEditingId(cat.id!); setEditAmount(String(limit)); }}
                                    className="w-full text-left"
                                >
                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                        <span className={`font-medium ${isOver ? 'text-red-500' : 'text-muted-foreground'}`}>
                                            {currency}{spent.toFixed(2)} spent
                                        </span>
                                        <span className="text-muted-foreground">
                                            {currency}{limit.toFixed(2)} limit
                                        </span>
                                    </div>
                                    <Progress
                                        value={percentage}
                                        className={`h-2 ${isOver ? '[&>div]:bg-red-500' : isNear ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`}
                                    />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* No targets empty state — offer last month's as a starting point,
                since targets are per-month and used to restart empty every month */}
            {categoriesWithTargets.length === 0 && (
                <div className="text-center py-6 space-y-3">
                    <p className="text-muted-foreground text-sm">No budget targets set for this month</p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={async () => {
                            try {
                                const prevMonth = format(subMonths(parse(selectedMonth, 'yyyy-MM', new Date()), 1), 'yyyy-MM');
                                const prev = await api.getBudgetTargets(prevMonth);
                                if (!prev || prev.length === 0) {
                                    showErrorToast('Last month had no targets to copy.');
                                    return;
                                }
                                for (const t of prev) {
                                    onSetTarget({ categoryId: t.categoryId, month: selectedMonth, limitAmount: t.limitAmount });
                                }
                            } catch (err) {
                                console.error('Copy targets failed:', err);
                                showErrorToast("Couldn't copy last month's targets.");
                            }
                        }}
                    >
                        Copy last month's targets
                    </Button>
                </div>
            )}

            {/* Add Target */}
            <div>
                {addingCategoryId ? (
                    <div className="bg-secondary rounded-xl p-3 space-y-3">
                        <select
                            value={addingCategoryId}
                            onChange={e => setAddingCategoryId(Number(e.target.value))}
                            className="w-full h-12 bg-background border border-input rounded-md px-3 text-sm text-foreground"
                        >
                            {expenseCategories.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.icon} {c.name}{targetMap.has(c.id!) ? ' (update)' : ''}
                                </option>
                            ))}
                        </select>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{currency}</span>
                            <Input
                                type="number"
                                step="0.01"
                                value={newAmount}
                                onChange={e => setNewAmount(e.target.value)}
                                placeholder="Monthly limit"
                                className="h-12 flex-1"
                                autoFocus
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveTarget(addingCategoryId, newAmount);
                                    if (e.key === 'Escape') setAddingCategoryId(null);
                                }}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1 h-11" onClick={() => setAddingCategoryId(null)}>
                                Cancel
                            </Button>
                            <Button className="flex-1 h-11" onClick={() => handleSaveTarget(addingCategoryId, newAmount)}>
                                Set Target
                            </Button>
                        </div>
                    </div>
                ) : (
                    expenseCategories.length > 0 && (
                        <Button
                            variant="outline"
                            className="w-full h-11"
                            onClick={() => {
                                const first = categoriesWithoutTargets[0] || expenseCategories[0];
                                setAddingCategoryId(first?.id || null);
                            }}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Budget Target
                        </Button>
                    )
                )}
            </div>

            {/* Manage Categories */}
            {onOpenCategoryManager && (
                <Button
                    variant="ghost"
                    className="w-full h-11 text-muted-foreground"
                    onClick={onOpenCategoryManager}
                >
                    <Settings2 className="h-4 w-4 mr-2" />
                    Manage Categories
                </Button>
            )}
        </div>
    );
}
