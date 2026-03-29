import { useState, useRef, useEffect } from 'react';
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
    '\u{1F354}', '\u{1F697}', '\u{1F3E0}', '\u{26A1}', '\u{1F4FA}', '\u{1F6CD}\uFE0F',
    '\u{1FA7A}', '\u{1F393}', '\u{2728}', '\u{1F4B0}',
    '\u{1F4BC}', '\u{1F4BB}', '\u{1F4C8}', '\u{2795}',
    '\u{2708}\uFE0F', '\u{1F381}', '\u{2615}', '\u{1F3B5}', '\u{1F4AA}', '\u{1F4DA}',
    '\u{1F6D2}', '\u{1F48A}', '\u{1F3AE}', '\u{1F4B3}', '\u{1F4E6}', '\u{1F37D}\uFE0F',
    '\u{1F46A}', '\u{1F4B5}', '\u{1F3D7}\uFE0F', '\u{1F4F1}',
];

export function CategoryManager({ open, onOpenChange, categories, onCreate, onUpdate, onDelete }: CategoryManagerProps) {
    const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState('');
    const [color, setColor] = useState(DEFAULT_COLORS[0]);
    const [icon, setIcon] = useState('\u{1F4B0}');
    const [isIncome, setIsIncome] = useState(0);
    const nameInputRef = useRef<HTMLInputElement>(null);

    const isEditing = isCreating || editingCategory;

    // Force focus the name input when entering create/edit mode (fixes Electron frameless window focus issues)
    useEffect(() => {
        if (isEditing) {
            const timer = setTimeout(() => nameInputRef.current?.focus(), 50);
            return () => clearTimeout(timer);
        }
    }, [isEditing]);

    const expenseCategories = categories.filter(c => !c.isIncome);
    const incomeCategories = categories.filter(c => c.isIncome);

    const startCreate = () => {
        setIsCreating(true);
        setEditingCategory(null);
        setName('');
        setColor(DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]);
        setIcon('\u{1F4B0}');
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

    const handleSave = async () => {
        if (!name.trim()) return;
        try {
            if (editingCategory) {
                await onUpdate({ ...editingCategory, name: name.trim(), color, icon, isIncome });
            } else {
                await onCreate({
                    name: name.trim(),
                    color,
                    icon,
                    isIncome,
                    orderIndex: categories.filter(c => c.isIncome === isIncome).length,
                });
            }
            setEditingCategory(null);
            setIsCreating(false);
        } catch (err) {
            console.error('Failed to save category:', err);
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Delete this category and all its transactions?')) {
            onDelete(id);
            if (editingCategory?.id === id) {
                setEditingCategory(null);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:rounded-none max-sm:border-0 max-sm:p-0 flex flex-col">
                <DialogHeader className="max-sm:px-4 max-sm:pb-2 shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}>
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
                                    ref={nameInputRef}
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Category name"
                                    className="h-12"
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
                                            className={`w-10 h-10 text-lg rounded-lg border transition-colors flex items-center justify-center ${icon === i ? 'bg-primary/20 border-primary scale-110' : 'bg-secondary border-border'}`}
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
                                            <span className="text-lg shrink-0">{cat.icon}</span>
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                            <span className="text-sm flex-1">{cat.name}</span>
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
                                            <span className="text-lg shrink-0">{cat.icon}</span>
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                            <span className="text-sm flex-1">{cat.name}</span>
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
