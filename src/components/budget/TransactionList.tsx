import { useMemo } from 'react';
import { Transaction, BudgetCategory } from '@/types';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { format, parse } from 'date-fns';

interface TransactionListProps {
    transactions: Transaction[];
    categories: BudgetCategory[];
    filter: { type: 'all' | 'income' | 'expense'; categoryId?: number };
    onFilterChange: (filter: { type: 'all' | 'income' | 'expense'; categoryId?: number }) => void;
    onEdit: (tx: Transaction) => void;
    onDelete: (id: number) => void;
    onAdd?: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Cash',
    debit: 'Debit',
    credit: 'Credit',
    bank_transfer: 'Transfer',
    other: 'Other',
};

export function TransactionList({ transactions, categories, filter, onFilterChange, onEdit, onDelete, onAdd }: TransactionListProps) {
    const filtered = useMemo(() => {
        return transactions.filter(tx => {
            if (filter.type === 'income' && !tx.isIncome) return false;
            if (filter.type === 'expense' && tx.isIncome) return false;
            if (filter.categoryId && tx.categoryId !== filter.categoryId) return false;
            return true;
        });
    }, [transactions, filter]);

    // Group by date
    const grouped = useMemo(() => {
        const map = new Map<string, Transaction[]>();
        for (const tx of filtered) {
            const existing = map.get(tx.date) || [];
            existing.push(tx);
            map.set(tx.date, existing);
        }
        return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    }, [filtered]);

    const expenseCategories = categories.filter(c => !c.isIncome);

    return (
        <div className="flex flex-col h-full">
            {/* Filter Bar */}
            <div className="flex items-center gap-2 pb-3 flex-wrap">
                {onAdd && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={onAdd}>
                        <Plus className="h-3 w-3" />
                        Add
                    </Button>
                )}
                <div className="flex bg-secondary rounded-lg p-0.5">
                    {(['all', 'expense', 'income'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => onFilterChange({ ...filter, type })}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${filter.type === type
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                    ))}
                </div>
                <select
                    value={filter.categoryId || ''}
                    onChange={e => onFilterChange({ ...filter, categoryId: e.target.value ? Number(e.target.value) : undefined })}
                    className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground appearance-none cursor-pointer pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat"
                >
                    <option value="">All Categories</option>
                    {expenseCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {/* Transaction List */}
            <ScrollArea className="flex-1">
                <div className="space-y-4 pr-2">
                    {grouped.map(([date, txs]) => {
                        let dateLabel: string;
                        try {
                            dateLabel = format(parse(date, 'yyyy-MM-dd', new Date()), 'EEE, MMM d');
                        } catch {
                            dateLabel = date;
                        }

                        return (
                            <div key={date}>
                                <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">{dateLabel}</h4>
                                <div className="space-y-1">
                                    {txs.map(tx => (
                                        <div
                                            key={tx.id}
                                            onClick={() => onEdit(tx)}
                                            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary transition-colors cursor-pointer group"
                                        >
                                            {/* Category Color Stripe */}
                                            <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: tx.categoryColor || '#6b7280' }} />

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium truncate">{tx.categoryName || 'Uncategorized'}</span>
                                                    {tx.paymentMethod && (
                                                        <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                                                            {PAYMENT_LABELS[tx.paymentMethod] || tx.paymentMethod}
                                                        </span>
                                                    )}
                                                </div>
                                                {tx.notes && (
                                                    <p className="text-xs text-muted-foreground truncate">{tx.notes}</p>
                                                )}
                                            </div>

                                            <span className={`text-sm font-semibold tabular-nums shrink-0 ${tx.isIncome ? 'text-green-500' : 'text-red-500'}`}>
                                                {tx.isIncome ? '+' : '-'}${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (tx.id) onDelete(tx.id);
                                                }}
                                            >
                                                <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {filtered.length === 0 && (
                        <div className="text-center py-12 space-y-3">
                            <p className="text-muted-foreground text-sm">No transactions found</p>
                            {onAdd && (
                                <Button variant="outline" size="sm" className="gap-1.5" onClick={onAdd}>
                                    <Plus className="h-3.5 w-3.5" />
                                    Add your first transaction
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
