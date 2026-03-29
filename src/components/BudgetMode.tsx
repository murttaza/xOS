import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { Transaction } from '../types';
import { cn } from '../lib/utils';
import { ArrowLeft, Wallet, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { ModeToggle } from './ModeToggle';
import { WindowControls } from './WindowControls';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

import { MonthSelector } from './budget/MonthSelector';
import { BudgetDashboard } from './budget/BudgetDashboard';
import { TransactionList } from './budget/TransactionList';
import { TransactionDialog } from './budget/TransactionDialog';
import { BudgetTargets } from './budget/BudgetTargets';
import { BudgetCharts } from './budget/BudgetCharts';
import { CategoryManager } from './budget/CategoryManager';

export function BudgetMode() {
    const isBudgetMode = useStore(s => s.isBudgetMode);
    const toggleBudgetMode = useStore(s => s.toggleBudgetMode);
    const budgetCategories = useStore(s => s.budgetCategories);
    const transactions = useStore(s => s.transactions);
    const budgetTargets = useStore(s => s.budgetTargets);
    const selectedMonth = useStore(s => s.selectedMonth);
    const budgetFilter = useStore(s => s.budgetFilter);

    const fetchBudgetCategories = useStore(s => s.fetchBudgetCategories);
    const fetchTransactions = useStore(s => s.fetchTransactions);
    const fetchBudgetTargets = useStore(s => s.fetchBudgetTargets);
    const setSelectedMonth = useStore(s => s.setSelectedMonth);
    const setBudgetFilter = useStore(s => s.setBudgetFilter);

    const addTransaction = useStore(s => s.addTransaction);
    const updateTransaction = useStore(s => s.updateTransaction);
    const deleteTransaction = useStore(s => s.deleteTransaction);

    const createBudgetCategory = useStore(s => s.createBudgetCategory);
    const updateBudgetCategory = useStore(s => s.updateBudgetCategory);
    const deleteBudgetCategory = useStore(s => s.deleteBudgetCategory);

    const setBudgetTarget = useStore(s => s.setBudgetTarget);
    const deleteBudgetTarget = useStore(s => s.deleteBudgetTarget);

    const [txDialogOpen, setTxDialogOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

    useEffect(() => {
        if (isBudgetMode) {
            fetchBudgetCategories();
            fetchTransactions();
            fetchBudgetTargets();
        }
    }, [isBudgetMode, fetchBudgetCategories, fetchTransactions, fetchBudgetTargets]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isBudgetMode) {
                toggleBudgetMode();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isBudgetMode, toggleBudgetMode]);

    const handleSaveTx = (tx: Omit<Transaction, 'id'> | Transaction) => {
        if ('id' in tx && tx.id) {
            updateTransaction(tx as Transaction);
        } else {
            addTransaction(tx as Omit<Transaction, 'id'>);
        }
        setEditingTx(null);
    };

    const handleEditTx = (tx: Transaction) => {
        setEditingTx(tx);
        setTxDialogOpen(true);
    };

    const handleNewTx = () => {
        setEditingTx(null);
        setTxDialogOpen(true);
    };

    return (
        <AnimatePresence>
            {isBudgetMode && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={cn(
                        "fixed inset-0 z-[55] text-foreground overflow-hidden flex flex-col font-sans no-drag",
                        "bg-background"
                    )}
                >
                    {/* Header */}
                    <div
                        className="shrink-0 border-b border-border/50"
                        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
                    >
                        {/* Top bar: back + title + month (desktop) + controls */}
                        <div className="flex items-center justify-between px-3 sm:px-6 lg:px-8 py-3 lg:py-4">
                            <div className="flex items-center gap-2">
                                {/* Mobile back button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 lg:hidden"
                                    onClick={toggleBudgetMode}
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                {/* Mobile title */}
                                <span className="text-base font-semibold lg:hidden">Budget</span>
                                {/* Desktop title */}
                                <div className="hidden lg:flex items-center gap-3">
                                    <Wallet className="h-5 w-5 text-primary" />
                                    <h2 className="text-lg font-bold tracking-tight">Budget</h2>
                                </div>
                            </div>

                            {/* Desktop month selector in header */}
                            <div className="hidden lg:block">
                                <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
                            </div>

                            <div className="flex items-center gap-2">
                                <ModeToggle />
                                <WindowControls />
                            </div>
                        </div>

                        {/* Mobile month selector - own row below header */}
                        <div className="lg:hidden flex justify-center px-3 pb-3">
                            <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden">
                        {/* Desktop Layout */}
                        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-6 h-full p-6">
                            {/* Left: Dashboard + Targets */}
                            <div className="col-span-3 overflow-y-auto no-scrollbar space-y-6">
                                <BudgetDashboard
                                    transactions={transactions}
                                    budgetTargets={budgetTargets}
                                />
                                <BudgetTargets
                                    categories={budgetCategories}
                                    targets={budgetTargets}
                                    transactions={transactions}
                                    selectedMonth={selectedMonth}
                                    onSetTarget={setBudgetTarget}
                                    onDeleteTarget={deleteBudgetTarget}
                                    onOpenCategoryManager={() => setCategoryManagerOpen(true)}
                                />
                            </div>

                            {/* Center: Transaction List */}
                            <div className="col-span-6 overflow-hidden flex flex-col">
                                <TransactionList
                                    transactions={transactions}
                                    categories={budgetCategories}
                                    filter={budgetFilter}
                                    onFilterChange={setBudgetFilter}
                                    onEdit={handleEditTx}
                                    onDelete={deleteTransaction}
                                    onAdd={handleNewTx}
                                />
                            </div>

                            {/* Right: Charts */}
                            <div className="col-span-3 overflow-y-auto no-scrollbar">
                                <BudgetCharts transactions={transactions} />
                            </div>
                        </div>

                        {/* Mobile Layout */}
                        <div className="lg:hidden flex flex-col h-full">
                            <Tabs defaultValue="summary" className="flex-1 flex flex-col">
                                <TabsList className="mx-4 mt-3 shrink-0">
                                    <TabsTrigger value="summary" className="flex-1 text-xs">Summary</TabsTrigger>
                                    <TabsTrigger value="transactions" className="flex-1 text-xs">Transactions</TabsTrigger>
                                    <TabsTrigger value="budget" className="flex-1 text-xs">Budget</TabsTrigger>
                                </TabsList>

                                <TabsContent value="summary" className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
                                    <BudgetDashboard
                                        transactions={transactions}
                                        budgetTargets={budgetTargets}
                                    />
                                    <BudgetCharts transactions={transactions} />
                                </TabsContent>

                                <TabsContent value="transactions" className="flex-1 overflow-hidden p-4">
                                    <TransactionList
                                        transactions={transactions}
                                        categories={budgetCategories}
                                        filter={budgetFilter}
                                        onFilterChange={setBudgetFilter}
                                        onEdit={handleEditTx}
                                        onDelete={deleteTransaction}
                                        onAdd={handleNewTx}
                                    />
                                </TabsContent>

                                <TabsContent value="budget" className="flex-1 overflow-y-auto p-4 no-scrollbar">
                                    <BudgetTargets
                                        categories={budgetCategories}
                                        targets={budgetTargets}
                                        transactions={transactions}
                                        selectedMonth={selectedMonth}
                                        onSetTarget={setBudgetTarget}
                                        onDeleteTarget={deleteBudgetTarget}
                                        onOpenCategoryManager={() => setCategoryManagerOpen(true)}
                                    />
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>

                    {/* Floating Add Button */}
                    <Button
                        onClick={handleNewTx}
                        className="fixed bottom-8 right-4 sm:bottom-6 sm:right-6 h-12 sm:h-11 rounded-full shadow-lg shadow-primary/25 z-10 px-4 sm:px-5 gap-2"
                        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
                    >
                        <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline text-sm font-medium">Add Transaction</span>
                    </Button>

                    {/* Transaction Dialog */}
                    <TransactionDialog
                        open={txDialogOpen}
                        onOpenChange={setTxDialogOpen}
                        categories={budgetCategories}
                        transaction={editingTx}
                        onSave={handleSaveTx}
                    />

                    {/* Category Manager */}
                    <CategoryManager
                        open={categoryManagerOpen}
                        onOpenChange={setCategoryManagerOpen}
                        categories={budgetCategories}
                        onCreate={createBudgetCategory}
                        onUpdate={updateBudgetCategory}
                        onDelete={deleteBudgetCategory}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
