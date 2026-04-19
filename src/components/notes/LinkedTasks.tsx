import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store';
import { Note, Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Link2, Plus, X, CheckCircle2, Circle, Search, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LinkedTasksProps {
    note: Note;
}

export function LinkedTasks({ note }: LinkedTasksProps) {
    const tasks = useStore((s) => s.tasks);
    const fetchTasks = useStore((s) => s.fetchTasks);
    const updateTask = useStore((s) => s.updateTask);
    const addTask = useStore((s) => s.addTask);

    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        // Ensure we have tasks loaded (notes mode can be opened before dashboard loads them)
        if (tasks.length === 0) {
            fetchTasks();
        }
    }, [fetchTasks, tasks.length]);

    const linkedTasks = useMemo(
        () => (note.id == null ? [] : tasks.filter((t) => t.noteId === note.id)),
        [tasks, note.id]
    );

    const unlinkedTasks = useMemo(() => {
        if (note.id == null) return [];
        const base = tasks.filter((t) => t.noteId !== note.id && !t.isComplete);
        if (!search.trim()) return base;
        const q = search.toLowerCase();
        return base.filter((t) => t.title.toLowerCase().includes(q));
    }, [tasks, note.id, search]);

    const handleLink = async (task: Task) => {
        try {
            await updateTask({ ...task, noteId: note.id ?? null });
        } catch (e) {
            console.error('Failed to link task to note', e);
        }
        setIsPickerOpen(false);
        setSearch('');
    };

    const handleUnlink = async (task: Task) => {
        try {
            await updateTask({ ...task, noteId: null });
        } catch (e) {
            console.error('Failed to unlink task from note', e);
        }
    };

    const handleCreateLinked = async () => {
        if (!note.id) return;
        try {
            await addTask({
                title: `From: ${note.title || 'Untitled Note'}`,
                description: '',
                dueDate: '',
                difficulty: 1,
                isComplete: 0,
                statTarget: ['Social'],
                labels: [],
                subtasks: [],
                noteId: note.id,
                time: '',
            });
        } catch (e) {
            console.error('Failed to create linked task', e);
        }
    };

    return (
        <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
                    <ListTodo className="h-3 w-3" />
                    Linked Tasks
                    {linkedTasks.length > 0 && (
                        <span className="text-muted-foreground/50">({linkedTasks.length})</span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setIsPickerOpen(true)}
                        title="Link existing task"
                    >
                        <Link2 className="h-3 w-3 mr-1" /> Link
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={handleCreateLinked}
                        title="Create new task linked to this note"
                    >
                        <Plus className="h-3 w-3 mr-1" /> New
                    </Button>
                </div>
            </div>

            {linkedTasks.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                    {linkedTasks.map((t) => (
                        <div
                            key={t.id}
                            className={cn(
                                'group inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md border text-xs transition-colors max-w-full',
                                t.isComplete
                                    ? 'bg-muted/40 border-border/50 text-muted-foreground line-through'
                                    : 'bg-muted/60 border-border hover:bg-muted'
                            )}
                        >
                            {t.isComplete ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                            ) : (
                                <Circle className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
                            <span className="truncate max-w-[12rem]">{t.title}</span>
                            <button
                                type="button"
                                onClick={() => handleUnlink(t)}
                                className="h-4 w-4 rounded-sm inline-flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                title="Unlink task"
                                aria-label={`Unlink ${t.title}`}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-xs text-muted-foreground/50 italic">
                    No tasks linked to this note yet.
                </div>
            )}

            <Dialog
                open={isPickerOpen}
                onOpenChange={(o) => {
                    setIsPickerOpen(o);
                    if (!o) setSearch('');
                }}
            >
                <DialogContent className="sm:max-w-[480px] max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:rounded-none max-sm:border-0 max-sm:p-0 bg-popover/95 backdrop-blur-xl border-border text-foreground shadow-2xl flex flex-col">
                    <DialogHeader className="max-sm:px-4 max-sm:pt-4 max-sm:pb-2 shrink-0">
                        <DialogTitle className="text-lg font-light tracking-wide text-foreground/90">
                            Link Existing Task
                        </DialogTitle>
                    </DialogHeader>
                    <div className="px-4 sm:px-6 pb-2 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                autoFocus
                                placeholder="Search tasks..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 bg-muted/50 border-border text-sm h-9"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 space-y-1.5 min-h-0">
                        {unlinkedTasks.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground text-sm">
                                {search ? 'No tasks match' : 'No unlinked tasks available'}
                            </div>
                        )}
                        {unlinkedTasks.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => handleLink(t)}
                                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/50 hover:bg-muted hover:border-border transition-all text-left"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <div className="text-sm text-foreground truncate">{t.title}</div>
                                        {(t.dueDate || (t.statTarget && t.statTarget.length > 0)) && (
                                            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                {t.statTarget?.[0] && <span>{t.statTarget[0]}</span>}
                                                {t.dueDate && <span>· {t.dueDate}</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
