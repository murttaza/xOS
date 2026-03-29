import { useState, useEffect } from 'react';
import { Transaction, BudgetCategory } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { getLocalDateString } from '@/lib/utils';

interface TransactionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categories: BudgetCategory[];
    transaction?: Transaction | null; // null = create mode
    onSave: (tx: Omit<Transaction, 'id'> | Transaction) => void;
}

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Cash' },
    { value: 'debit', label: 'Debit Card' },
    { value: 'credit', label: 'Credit Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'other', label: 'Other' },
];

export function TransactionDialog({ open, onOpenChange, categories, transaction, onSave }: TransactionDialogProps) {
    const [isIncome, setIsIncome] = useState(0);
    const [amount, setAmount] = useState('');
    const [categoryId, setCategoryId] = useState<number | ''>('');
    const [date, setDate] = useState(getLocalDateString());
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [notes, setNotes] = useState('');
    const [isRecurring, setIsRecurring] = useState(0);

    useEffect(() => {
        if (transaction) {
            setIsIncome(transaction.isIncome);
            setAmount(String(transaction.amount));
            setCategoryId(transaction.categoryId);
            setDate(transaction.date);
            setPaymentMethod(transaction.paymentMethod || 'cash');
            setNotes(transaction.notes || '');
            setIsRecurring(transaction.isRecurring);
        } else {
            setIsIncome(0);
            setAmount('');
            setCategoryId('');
            setDate(getLocalDateString());
            setPaymentMethod('cash');
            setNotes('');
            setIsRecurring(0);
        }
    }, [transaction, open]);

    const filteredCategories = categories.filter(c => c.isIncome === isIncome);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !categoryId) return;

        const data = {
            ...(transaction?.id ? { id: transaction.id } : {}),
            amount: parseFloat(amount),
            categoryId: Number(categoryId),
            isIncome,
            date,
            paymentMethod,
            notes,
            isRecurring,
        } as Omit<Transaction, 'id'> | Transaction;

        onSave(data);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:rounded-none max-sm:border-0 max-sm:p-0 flex flex-col">
                <DialogHeader className="max-sm:px-4 max-sm:pt-4 max-sm:pb-2 shrink-0">
                    <DialogTitle>{transaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="space-y-4 overflow-y-auto flex-1 max-sm:px-4">
                        {/* Income/Expense Toggle */}
                        <div className="flex bg-secondary rounded-lg p-0.5">
                            <button
                                type="button"
                                onClick={() => { setIsIncome(0); setCategoryId(''); }}
                                className={`flex-1 px-3 py-2.5 text-sm rounded-md transition-colors ${!isIncome ? 'bg-red-500/20 text-red-500 font-medium' : 'text-muted-foreground'}`}
                            >
                                Expense
                            </button>
                            <button
                                type="button"
                                onClick={() => { setIsIncome(1); setCategoryId(''); }}
                                className={`flex-1 px-3 py-2.5 text-sm rounded-md transition-colors ${isIncome ? 'bg-green-500/20 text-green-500 font-medium' : 'text-muted-foreground'}`}
                            >
                                Income
                            </button>
                        </div>

                        {/* Amount */}
                        <div className="space-y-1.5">
                            <Label htmlFor="amount" className="text-xs">Amount</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="pl-7 text-lg font-semibold h-12"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Category */}
                        <div className="space-y-1.5">
                            <Label htmlFor="category" className="text-xs">Category</Label>
                            <select
                                id="category"
                                value={categoryId}
                                onChange={e => setCategoryId(Number(e.target.value))}
                                className="w-full h-12 bg-background border border-input rounded-md px-3 text-sm text-foreground"
                                required
                            >
                                <option value="">Select category...</option>
                                {filteredCategories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date */}
                        <div className="space-y-1.5">
                            <Label htmlFor="date" className="text-xs">Date</Label>
                            <Input
                                id="date"
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="h-12"
                                required
                            />
                        </div>

                        {/* Payment Method */}
                        <div className="space-y-1.5">
                            <Label htmlFor="payment" className="text-xs">Payment Method</Label>
                            <select
                                id="payment"
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value)}
                                className="w-full h-12 bg-background border border-input rounded-md px-3 text-sm text-foreground"
                            >
                                {PAYMENT_METHODS.map(pm => (
                                    <option key={pm.value} value={pm.value}>{pm.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1.5">
                            <Label htmlFor="notes" className="text-xs">Notes</Label>
                            <Input
                                id="notes"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Optional note..."
                                className="h-12"
                            />
                        </div>

                        {/* Recurring Toggle */}
                        <label className="flex items-center gap-3 cursor-pointer py-1">
                            <input
                                type="checkbox"
                                checked={!!isRecurring}
                                onChange={e => setIsRecurring(e.target.checked ? 1 : 0)}
                                className="rounded border-border h-5 w-5"
                            />
                            <span className="text-sm text-muted-foreground">Recurring transaction</span>
                        </label>
                    </div>

                    <DialogFooter className="max-sm:px-4 max-sm:pb-4 max-sm:pt-3 shrink-0">
                        <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" className="h-11" disabled={!amount || !categoryId}>
                            {transaction ? 'Update' : 'Add'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
