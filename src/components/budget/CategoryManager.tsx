import { useState } from 'react';
import { BudgetCategory } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface CategoryManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categories: BudgetCategory[];
    onCreate: (category: Omit<BudgetCategory, 'id'>) => void;
    onUpdate: (category: BudgetCategory) => void;
    onDelete: (id: number) => void;
}

const DEFAULT_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
    '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

const ICON_OPTIONS = [
    'utensils', 'car', 'home', 'zap', 'tv', 'shopping-bag',
    'heart-pulse', 'graduation-cap', 'sparkles', 'circle-dot',
    'briefcase', 'laptop', 'trending-up', 'plus-circle',
    'plane', 'gift', 'coffee', 'music', 'dumbbell', 'book',
];

export function CategoryManager({ open, onOpenChange, categories, onCreate, onUpdate, onDelete }: CategoryManagerProps) {
    const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState('');
    const [color, setColor] = useState(DEFAULT_COLORS[0]);
    const [icon, setIcon] = useState('circle-dot');
    const [isIncome, setIsIncome] = useState(0);

    const expenseCategories = categories.filter(c => !c.isIncome);
    const incomeCategories = categories.filter(c => c.isIncome);

    const startCreate = () => {
        setIsCreating(true);
        setEditingCategory(null);
        setName('');
        setColor(DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]);
        setIcon('circle-dot');
        setIsIncome(0);
    };

    const startEdit = (cat: BudgetCategory) => {
        setEditingCategory(cat);
        setIsCreating(false);
        setName(cat.name);
        setColor(cat.color);
        setIcon(cat.icon);
        setIsIncome(cat.isIncome);
    };

    const handleSave = () => {
        if (!name.trim()) return;
        if (editingCategory) {
            onUpdate({ ...editingCategory, name: name.trim(), color, icon, isIncome });
        } else {
            onCreate({
                name: name.trim(),
                color,
                icon,
                isIncome,
                orderIndex: categories.filter(c => c.isIncome === isIncome).length,
            });
        }
        setEditingCategory(null);
        setIsCreating(false);
    };

    const handleDelete = (id: number) => {
        if (confirm('Delete this category and all its transactions?')) {
            onDelete(id);
            if (editingCategory?.id === id) {
                setEditingCategory(null);
            }
        }
    };

    const isEditing = isCreating || editingCategory;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:rounded-none max-sm:border-0 max-sm:p-0 flex flex-col">
                <DialogHeader className="max-sm:px-4 max-sm:pt-4 max-sm:pb-2 shrink-0">
                    <DialogTitle>Manage Categories</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto max-sm:px-4 max-sm:pb-4">
                    {isEditing ? (
                        <div className="space-y-4">
                            {/* Income/Expense */}
                            <div className="flex bg-secondary rounded-lg p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setIsIncome(0)}
                                    className={`flex-1 px-3 py-2.5 text-sm rounded-md transition-colors ${!isIncome ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                                >
                                    Expense
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsIncome(1)}
                                    className={`flex-1 px-3 py-2.5 text-sm rounded-md transition-colors ${isIncome ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                                >
                                    Income
                                </button>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">Name</Label>
                                <Input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Category name"
                                    className="h-12"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">Color</Label>
                                <div className="flex flex-wrap gap-3">
                                    {DEFAULT_COLORS.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setColor(c)}
                                            className={`w-9 h-9 rounded-full border-2 transition-transform ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">Icon</Label>
                                <div className="flex flex-wrap gap-2">
                                    {ICON_OPTIONS.map(i => (
                                        <button
                                            key={i}
                                            onClick={() => setIcon(i)}
                                            className={`px-3 py-2 text-xs rounded-lg border transition-colors ${icon === i ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border text-muted-foreground'}`}
                                        >
                                            {i}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                                <Button variant="outline" className="h-11" onClick={() => { setIsCreating(false); setEditingCategory(null); }}>Cancel</Button>
                                <Button className="h-11" onClick={handleSave} disabled={!name.trim()}>
                                    {editingCategory ? 'Update' : 'Create'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Expense Categories */}
                            <div>
                                <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Expense Categories</h4>
                                <div className="space-y-1">
                                    {expenseCategories.map(cat => (
                                        <div key={cat.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors">
                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                            <span className="text-sm flex-1">{cat.name}</span>
                                            <span className="text-[10px] text-muted-foreground/50">{cat.icon}</span>
                                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => startEdit(cat)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => cat.id && handleDelete(cat.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Income Categories */}
                            <div>
                                <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Income Categories</h4>
                                <div className="space-y-1">
                                    {incomeCategories.map(cat => (
                                        <div key={cat.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors">
                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                            <span className="text-sm flex-1">{cat.name}</span>
                                            <span className="text-[10px] text-muted-foreground/50">{cat.icon}</span>
                                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => startEdit(cat)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => cat.id && handleDelete(cat.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Button variant="outline" className="w-full h-11" onClick={startCreate}>
                                <Plus className="h-4 w-4 mr-2" />
                                New Category
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
