import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Repeat, Eye } from "lucide-react";
import { useStore } from "@/store";
import { TaskDialog } from "./TaskDialog";
import { TaskItem } from "./TaskItem";
import { Task, RepeatingTask } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RepeatingTaskDialog } from "./RepeatingTaskDialog";
import { RepeatingTaskItem } from "./RepeatingTaskItem";
import { getLocalDateString } from "@/lib/utils";

export function TaskBoard() {
    const tasks = useStore(state => state.tasks);
    const activeTimerIdsString = useStore(state => Object.keys(state.activeTimers).sort().join(','));
    const activeTimerIds = useMemo(() => new Set(activeTimerIdsString.split(',').filter(Boolean).map(Number)), [activeTimerIdsString]);
    const repeatingTasks = useStore(state => state.repeatingTasks);

    // Actions (stable)
    const addTask = useStore(state => state.addTask);
    const updateTask = useStore(state => state.updateTask);
    const deleteTask = useStore(state => state.deleteTask);
    const toggleTaskTimer = useStore(state => state.toggleTaskTimer);
    const stopTaskTimer = useStore(state => state.stopTaskTimer);
    const addRepeatingTask = useStore(state => state.addRepeatingTask);
    const updateRepeatingTask = useStore(state => state.updateRepeatingTask);
    const deleteRepeatingTask = useStore(state => state.deleteRepeatingTask);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    const [isRepeatingDialogOpen, setIsRepeatingDialogOpen] = useState(false);
    const [editingRepeatingTask, setEditingRepeatingTask] = useState<RepeatingTask | null>(null);

    const [untimedTaskToComplete, setUntimedTaskToComplete] = useState<Task | null>(null);
    const [manualDuration, setManualDuration] = useState("30");

    const [activePage, setActivePage] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleAddClick = useCallback(() => {
        if (activePage === 0) {
            setEditingTask(null);
            setIsDialogOpen(true);
        } else {
            setEditingRepeatingTask(null);
            setIsRepeatingDialogOpen(true);
        }
    }, [activePage]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                handleAddClick();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleAddClick]);

    const handleSubmit = useCallback(async (task: Task | Omit<Task, "id">) => {
        if ("id" in task && task.id) {
            await updateTask(task as Task);
        } else {
            await addTask(task);
        }
    }, [addTask, updateTask]);

    const handleRepeatingSubmit = useCallback(async (task: RepeatingTask | Omit<RepeatingTask, "id">) => {
        if ("id" in task && task.id) {
            await updateRepeatingTask(task as RepeatingTask);
        } else {
            await addRepeatingTask(task);
        }
    }, [addRepeatingTask, updateRepeatingTask]);

    const handleRepeatingEdit = useCallback((t: RepeatingTask) => {
        setEditingRepeatingTask(t);
        setIsRepeatingDialogOpen(true);
    }, []);

    const handleRepeatingToggleActive = useCallback((t: RepeatingTask) => {
        updateRepeatingTask({ ...t, isActive: t.isActive ? 0 : 1 });
    }, [updateRepeatingTask]);

    const handleToggleTimer = useCallback(async (id: number) => {
        await toggleTaskTimer(id);
    }, [toggleTaskTimer]);

    const addSession = useStore(state => state.addSession);

    const handleComplete = useCallback(async (task: Task) => {
        // Check for untimed task
        if (task.labels?.includes("untimed")) {
            setUntimedTaskToComplete(task);
            setManualDuration("30");
            return;
        }

        await updateTask({ ...task, isComplete: 1 });
        if (task.id) {
            await stopTaskTimer(task.id);
        }
    }, [updateTask, stopTaskTimer]);

    const confirmUntimedCompletion = async () => {
        if (!untimedTaskToComplete) return;

        const duration = parseInt(manualDuration);
        if (!isNaN(duration) && duration > 0) {
            // Add session
            const now = new Date();
            const startTime = new Date(now.getTime() - duration * 60000).toISOString();

            await addSession({
                taskId: untimedTaskToComplete.id!,
                startTime: startTime,
                endTime: now.toISOString(),
                duration_minutes: duration,
                dateLogged: getLocalDateString(now)
            });
        }

        // Complete task
        await updateTask({ ...untimedTaskToComplete, isComplete: 1 });
        if (untimedTaskToComplete.id) {
            await stopTaskTimer(untimedTaskToComplete.id);
        }

        setUntimedTaskToComplete(null);
    };

    const handleEditClick = useCallback((task: Task) => {
        setEditingTask(task);
        setIsDialogOpen(true);
    }, []);

    const { datedTasks, looseTasks, completedTasks } = useMemo(() => {
        const dated: Task[] = [];
        const loose: Task[] = [];
        const completed: Task[] = [];

        tasks.forEach(t => {
            if (t.isComplete) {
                completed.push(t);
            } else if (t.dueDate) {
                dated.push(t);
            } else {
                loose.push(t);
            }
        });

        // Sort dated tasks by due date ascending (overdue → today → future)
        dated.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

        // Sort loose tasks by difficulty descending (hardest first)
        loose.sort((a, b) => (b.difficulty || 0) - (a.difficulty || 0));

        // Sort completed tasks by completion date (most recent first)
        completed.sort((a, b) => {
            if (a.completedAt && b.completedAt) {
                return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
            }
            if (a.completedAt && !b.completedAt) return -1;
            if (!a.completedAt && b.completedAt) return 1;
            return (b.id || 0) - (a.id || 0);
        });

        return { datedTasks: dated, looseTasks: loose, completedTasks: completed };
    }, [tasks]);

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const scrollTop = scrollContainerRef.current.scrollTop;
            const height = scrollContainerRef.current.offsetHeight;
            const page = Math.round(scrollTop / height);
            setActivePage(page);
        }
    };

    const scrollToPage = (page: number) => {
        if (scrollContainerRef.current) {
            const height = scrollContainerRef.current.offsetHeight;
            scrollContainerRef.current.scrollTo({
                top: page * height,
                behavior: 'smooth'
            });
            // setActivePage will be handled by onScroll, but setting it here gives immediate feedback if needed
            // setActivePage(page); 
        }
    };

    const [isAllTasksOpen, setIsAllTasksOpen] = useState(false);

    const todayStr = getLocalDateString(new Date());
    const completedTodayCount = completedTasks.filter(t => t.completedAt && t.completedAt.startsWith(todayStr)).length;

    return (
        <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between px-4 pt-6 pb-4">
                <div
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity group"
                    onClick={() => scrollToPage(activePage === 0 ? 1 : 0)}
                >
                    <CardTitle className="text-xl font-bold tracking-tight select-none flex items-center gap-3">
                        {activePage === 0 ? "Tasks" : "Repeating Tasks"}
                        {activePage === 0 && completedTodayCount > 0 && (
                            <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20 font-medium">
                                {completedTodayCount} done today
                            </span>
                        )}
                    </CardTitle>
                    <div className="flex flex-col gap-1 ml-1 group-hover:gap-1.5 transition-all">
                        <div className={`h-1.5 w-1.5 rounded-full transition-colors ${activePage === 0 ? "bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-white/20"}`} />
                        <div className={`h-1.5 w-1.5 rounded-full transition-colors ${activePage === 1 ? "bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-white/20"}`} />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {activePage === 0 && (
                        <Button variant="ghost" size="icon" onClick={() => setIsAllTasksOpen(true)} className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                            <Eye className="h-4 w-4" />
                        </Button>
                    )}
                    <Button
                        size="sm"
                        onClick={handleAddClick}
                        className="group relative overflow-hidden bg-white/5 text-white border border-white/10 hover:border-primary/50 shadow-none transition-all duration-150 hover:scale-105 active:scale-95 px-4 h-9"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-blue-600/80 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-150 ease-in-out" />
                        <span className="relative z-10 flex items-center font-medium">
                            <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-150" />
                            Add {activePage === 0 ? "Task" : "Repeat"}
                        </span>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex-1 px-0 overflow-hidden flex flex-col relative">
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto snap-y snap-mandatory flex flex-col no-scrollbar"
                    style={{ scrollBehavior: 'smooth' }}
                >
                    {/* Page 1: Task List */}
                    <div className="w-full min-h-full snap-center flex flex-col">
                        <ScrollArea className="flex-1 px-4">
                            <Accordion type="single" collapsible defaultValue="dated" className="w-full space-y-4">
                                {/* Dated Tasks */}
                                <AccordionItem value="dated" className="border-none bg-card/40 rounded-xl overflow-hidden shadow-sm">
                                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 transition-colors">
                                        <span className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                                            Dated Tasks
                                            <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs">{datedTasks.length}</span>
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-2 space-y-2">
                                        {datedTasks.length === 0 && <p className="text-xs text-muted-foreground italic px-2">No dated tasks.</p>}
                                        <div className="max-h-[45vh] overscroll-contain overflow-y-auto snap-y snap-mandatory no-scrollbar space-y-2">
                                            {datedTasks.map(task => (
                                                <div key={task.id} className="snap-start">
                                                    <TaskItem
                                                        task={task}
                                                        isActive={task.id !== undefined && activeTimerIds.has(task.id)}
                                                        isTimerRunning={task.id !== undefined && activeTimerIds.has(task.id)}
                                                        onToggleTimer={handleToggleTimer}
                                                        onEdit={handleEditClick}
                                                        onDelete={deleteTask}
                                                        onComplete={handleComplete}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* Loose Tasks */}
                                <AccordionItem value="loose" className="border-none bg-card/40 rounded-xl overflow-hidden shadow-sm">
                                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 transition-colors">
                                        <span className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                                            Loose Tasks
                                            <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs">{looseTasks.length}</span>
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-2 space-y-2">
                                        {looseTasks.length === 0 && <p className="text-xs text-muted-foreground italic px-2">No loose tasks.</p>}
                                        <div className="max-h-[45vh] overscroll-contain overflow-y-auto snap-y snap-mandatory no-scrollbar space-y-2">
                                            {looseTasks.map(task => (
                                                <div key={task.id} className="snap-start">
                                                    <TaskItem
                                                        task={task}
                                                        isActive={task.id !== undefined && activeTimerIds.has(task.id)}
                                                        isTimerRunning={task.id !== undefined && activeTimerIds.has(task.id)}
                                                        onToggleTimer={handleToggleTimer}
                                                        onEdit={handleEditClick}
                                                        onDelete={deleteTask}
                                                        onComplete={handleComplete}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* Completed Tasks (recent only) */}
                                {completedTasks.length > 0 && (() => {
                                    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                                    const recentCompleted = completedTasks.filter(t => t.completedAt && t.completedAt > sevenDaysAgo);
                                    const displayTasks = recentCompleted.length > 0 ? recentCompleted : completedTasks.slice(0, 5);
                                    return (
                                    <AccordionItem value="completed" className="border-none bg-card/40 rounded-xl overflow-hidden">
                                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 transition-colors">
                                            <span className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                                                Completed
                                                <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs">
                                                    {recentCompleted.length > 0 && recentCompleted.length !== completedTasks.length
                                                        ? `${recentCompleted.length} recent · ${completedTasks.length} total`
                                                        : completedTasks.length}
                                                </span>
                                            </span>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4 pt-2 space-y-2 opacity-60 grayscale hover:grayscale-0 transition-all duration-150">
                                            <div className="max-h-[45vh] overscroll-contain overflow-y-auto snap-y snap-mandatory no-scrollbar space-y-2">
                                                {displayTasks.map(task => (
                                                    <div key={task.id} className="snap-start">
                                                        <TaskItem
                                                            task={task}
                                                            isActive={false}
                                                            isTimerRunning={false}
                                                            onToggleTimer={() => { }}
                                                            onEdit={handleEditClick}
                                                            onDelete={deleteTask}
                                                            onComplete={() => updateTask({ ...task, isComplete: 0 })}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                    );
                                })()}
                            </Accordion>
                        </ScrollArea>
                    </div>

                    {/* Page 2: Repeating Tasks */}
                    <div className="w-full min-h-full snap-center flex flex-col">
                        <ScrollArea className="flex-1 px-4">
                            <div className="space-y-2">
                                {repeatingTasks.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                        <Repeat className="h-8 w-8 mb-2 opacity-20" />
                                        <p className="text-sm">No repeating tasks</p>
                                    </div>
                                )}
                                {repeatingTasks.map(task => (
                                    <RepeatingTaskItem
                                        key={task.id}
                                        task={task}
                                        onEdit={handleRepeatingEdit}
                                        onDelete={deleteRepeatingTask}
                                        onToggleActive={handleRepeatingToggleActive}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </CardContent>

            <TaskDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSubmit={handleSubmit}
                initialTask={editingTask}
            />

            <RepeatingTaskDialog
                open={isRepeatingDialogOpen}
                onOpenChange={setIsRepeatingDialogOpen}
                onSubmit={handleRepeatingSubmit}
                initialTask={editingRepeatingTask}
            />

            {/* View All Tasks Dialog */}
            <Dialog open={isAllTasksOpen} onOpenChange={setIsAllTasksOpen}>
                <DialogContent className="max-w-4xl h-[80vh] bg-black/90 backdrop-blur-xl border-white/10 text-white flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b border-white/10">
                        <DialogTitle className="text-xl font-light tracking-wide text-white/90">All Tasks</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* Dated */}
                        <div>
                            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Dated Tasks</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {datedTasks.map(task => (
                                    <TaskItem key={task.id} task={task} isActive={false} isTimerRunning={false} onToggleTimer={() => { }} onEdit={handleEditClick} onDelete={deleteTask} onComplete={handleComplete} />
                                ))}
                                {datedTasks.length === 0 && <p className="text-white/30 italic text-sm">No dated tasks</p>}
                            </div>
                        </div>

                        {/* Loose */}
                        <div>
                            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Loose Tasks</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {looseTasks.map(task => (
                                    <TaskItem key={task.id} task={task} isActive={false} isTimerRunning={false} onToggleTimer={() => { }} onEdit={handleEditClick} onDelete={deleteTask} onComplete={handleComplete} />
                                ))}
                                {looseTasks.length === 0 && <p className="text-white/30 italic text-sm">No loose tasks</p>}
                            </div>
                        </div>

                        {/* Completed */}
                        <div>
                            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Completed Tasks</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
                                {completedTasks.map(task => (
                                    <TaskItem key={task.id} task={task} isActive={false} isTimerRunning={false} onToggleTimer={() => { }} onEdit={handleEditClick} onDelete={deleteTask} onComplete={() => updateTask({ ...task, isComplete: 0 })} />
                                ))}
                                {completedTasks.length === 0 && <p className="text-white/30 italic text-sm">No completed tasks</p>}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>


            {/* Manual Duration Dialog */}
            {untimedTaskToComplete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-black/90 border border-white/10 rounded-xl shadow-2xl p-6">
                        <h3 className="text-lg font-light text-white mb-2">Duration Worked</h3>
                        <p className="text-xs text-white/60 mb-4">
                            How many minutes did you work on "{untimedTaskToComplete.title}"?
                        </p>

                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="duration" className="text-xs uppercase tracking-wider text-white/60">Minutes</Label>
                                <Input
                                    id="duration"
                                    type="number"
                                    min="0"
                                    value={manualDuration}
                                    onChange={(e) => setManualDuration(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') confirmUntimedCompletion();
                                    }}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setUntimedTaskToComplete(null)} className="text-white/60 hover:text-white hover:bg-white/10">
                                    Cancel
                                </Button>
                                <Button onClick={confirmUntimedCompletion} className="bg-white text-black hover:bg-white/90">
                                    Confirm
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}
