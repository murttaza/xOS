import { useState } from 'react';
import { BudgetCategory, BudgetTarget, Transaction } from '@/types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { Plus, X, Check, Settings2 } from 'lucide-react';

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
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [addingCategoryId, setAddingCategoryId] = useState<number | null>(null);
    const [newAmount, setNewAmount] = useState('');

    const expenseCategories = categories.filter(c => !c.isIncome);
    const targetMap = new Map(targets.map(t => [t.categoryId, t]));

    // Calculate spending per category
    const spendingMap = new Map<number, number>();
    for (const tx of transactions) {
        if (!tx.isIncome) {
            spendingMap.set(tx.categoryId, (spendingMap.get(tx.categoryId) || 0) + Number(tx.amount));
        }
    }

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

            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
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
                                    onClick={() => target.id && onDeleteTarget(target.id)}
                                >
                                    <X className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>

                            {editingId === cat.id ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">$</span>
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
                                            ${spent.toFixed(2)} spent
                                        </span>
                                        <span className="text-muted-foreground">
                                            ${limit.toFixed(2)} limit
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

            {/* No targets empty state */}
            {categoriesWithTargets.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                    No budget targets set yet
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
                            <span className="text-sm text-muted-foreground">$</span>
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
