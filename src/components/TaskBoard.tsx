import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Eye, ChevronDown, Repeat } from "lucide-react";
import { useStore } from "@/store";
import { TaskDialog } from "./TaskDialog";
import { TaskItem } from "./TaskItem";
import { Task, RepeatingTask } from "@/types";
import { Accordion } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RepeatingTaskDialog } from "./RepeatingTaskDialog";
import { getLocalDateString } from "@/lib/utils";
import { endOfWeek } from "date-fns";

import { TaskSection } from "./tasks/TaskSection";
import { RepeatingTasksPage } from "./tasks/RepeatingTasksPage";
import { CompletedTasks } from "./tasks/CompletedTasks";

export function TaskBoard() {
    const tasks = useStore(state => state.tasks);
    const activeTimerIdsString = useStore(state => Object.keys(state.activeTimers).join(','));
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

    const [showRepeating, setShowRepeating] = useState(false);

    const handleAddClick = useCallback(() => {
        if (showRepeating) {
            setEditingRepeatingTask(null);
            setIsRepeatingDialogOpen(true);
        } else {
            setEditingTask(null);
            setIsDialogOpen(true);
        }
    }, [showRepeating]);

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

    const handleUncomplete = useCallback((task: Task) => {
        updateTask({ ...task, isComplete: 0 });
    }, [updateTask]);

    const { overdueTasks, todayTasks, thisWeekTasks, laterTasks, looseTasks, completedTasks } = useMemo(() => {
        const overdue: Task[] = [];
        const today: Task[] = [];
        const thisWeek: Task[] = [];
        const later: Task[] = [];
        const loose: Task[] = [];
        const completed: Task[] = [];

        const todayStr = getLocalDateString(new Date());
        const weekEnd = getLocalDateString(endOfWeek(new Date(), { weekStartsOn: 0 }));

        tasks.forEach(t => {
            if (t.isComplete) {
                completed.push(t);
            } else if (t.dueDate) {
                if (t.dueDate < todayStr) {
                    overdue.push(t);
                } else if (t.dueDate === todayStr) {
                    today.push(t);
                } else if (t.dueDate <= weekEnd) {
                    thisWeek.push(t);
                } else {
                    later.push(t);
                }
            } else {
                loose.push(t);
            }
        });

        // Sort each group by due date ascending
        overdue.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        today.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        thisWeek.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        later.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

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

        return { overdueTasks: overdue, todayTasks: today, thisWeekTasks: thisWeek, laterTasks: later, looseTasks: loose, completedTasks: completed };
    }, [tasks]);

    const [isAllTasksOpen, setIsAllTasksOpen] = useState(false);
    const [isMobileExpanded, setIsMobileExpanded] = useState(true);

    const todayStr = getLocalDateString(new Date());
    const completedTodayCount = completedTasks.filter(t => t.completedAt && getLocalDateString(new Date(t.completedAt)) === todayStr).length;

    const handleTitleClick = useCallback(() => {
        if (window.innerWidth < 1024) {
            setIsMobileExpanded(prev => !prev);
        }
    }, []);

    return (
        <Card className="lg:h-full flex flex-col border-none shadow-none bg-transparent">
            <CardHeader className="flex flex-col px-3 sm:px-4 pt-4 sm:pt-6 pb-3 sm:pb-4 gap-2">
                <div className="flex flex-row items-center justify-between gap-2">
                    <div
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity group min-w-0 lg:cursor-default"
                        onClick={handleTitleClick}
                    >
                        <CardTitle className="text-lg sm:text-xl font-bold tracking-tight select-none flex items-center gap-2 sm:gap-3">
                            {showRepeating ? "Repeating" : "Tasks"}
                            <ChevronDown className={`h-4 w-4 lg:hidden transition-transform ${isMobileExpanded ? 'rotate-180' : ''}`} />
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        {!showRepeating && (
                            <Button variant="ghost" size="icon" onClick={() => setIsAllTasksOpen(true)} className="h-8 w-8 text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors">
                                <Eye className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            size="sm"
                            onClick={handleAddClick}
                            className="group relative overflow-hidden bg-muted/50 text-foreground border border-border hover:border-primary/50 shadow-none transition-all duration-150 hover:scale-105 active:scale-95 px-3 sm:px-4 h-8 sm:h-9 text-xs sm:text-sm"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-blue-600/80 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-150 ease-in-out" />
                            <span className="relative z-10 flex items-center font-medium">
                                <Plus className="h-4 w-4 mr-1 sm:mr-2 group-hover:rotate-90 transition-transform duration-150" />
                                Add {showRepeating ? "Repeat" : "Task"}
                            </span>
                        </Button>
                    </div>
                </div>
                {/* Tab switcher — all screen sizes */}
                <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
                    <button
                        onClick={() => setShowRepeating(false)}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all ${!showRepeating ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                    >
                        Tasks
                        {completedTodayCount > 0 && !showRepeating && (
                            <span className="text-[9px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full font-medium">{completedTodayCount}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setShowRepeating(true)}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all ${showRepeating ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                    >
                        <Repeat className="h-3 w-3" />
                        Repeating
                    </button>
                </div>
            </CardHeader>
            <CardContent className={`${isMobileExpanded ? 'flex' : 'hidden'} lg:flex flex-1 px-0 overflow-hidden flex-col relative`}>
                <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col no-scrollbar">
                    {/* Task List */}
                    {!showRepeating && (
                        <div className="w-full flex flex-col">
                            <div className="flex-1 lg:overflow-y-auto no-scrollbar px-3 sm:px-4">
                                <Accordion type="single" collapsible defaultValue={overdueTasks.length > 0 ? "overdue" : todayTasks.length > 0 ? "today" : "thisweek"} className="w-full space-y-4">
                                    {overdueTasks.length > 0 && (
                                        <TaskSection
                                            value="overdue"
                                            label="Overdue"
                                            tasks={overdueTasks}
                                            activeTimerIds={activeTimerIds}
                                            emptyMessage="No overdue tasks."
                                            onToggleTimer={handleToggleTimer}
                                            onEdit={handleEditClick}
                                            onDelete={deleteTask}
                                            onComplete={handleComplete}
                                            className="border-l-2 border-l-red-500/50"
                                        />
                                    )}

                                    <TaskSection
                                        value="today"
                                        label="Today"
                                        tasks={todayTasks}
                                        activeTimerIds={activeTimerIds}
                                        emptyMessage="Nothing due today."
                                        onToggleTimer={handleToggleTimer}
                                        onEdit={handleEditClick}
                                        onDelete={deleteTask}
                                        onComplete={handleComplete}
                                    />

                                    <TaskSection
                                        value="thisweek"
                                        label="This Week"
                                        tasks={thisWeekTasks}
                                        activeTimerIds={activeTimerIds}
                                        emptyMessage="Nothing else this week."
                                        onToggleTimer={handleToggleTimer}
                                        onEdit={handleEditClick}
                                        onDelete={deleteTask}
                                        onComplete={handleComplete}
                                    />

                                    {laterTasks.length > 0 && (
                                        <TaskSection
                                            value="later"
                                            label="Later"
                                            tasks={laterTasks}
                                            activeTimerIds={activeTimerIds}
                                            emptyMessage="No upcoming tasks."
                                            onToggleTimer={handleToggleTimer}
                                            onEdit={handleEditClick}
                                            onDelete={deleteTask}
                                            onComplete={handleComplete}
                                        />
                                    )}

                                    <TaskSection
                                        value="loose"
                                        label="Loose Tasks"
                                        tasks={looseTasks}
                                        activeTimerIds={activeTimerIds}
                                        emptyMessage="No loose tasks."
                                        onToggleTimer={handleToggleTimer}
                                        onEdit={handleEditClick}
                                        onDelete={deleteTask}
                                        onComplete={handleComplete}
                                    />

                                    <CompletedTasks
                                        completedTasks={completedTasks}
                                        onEdit={handleEditClick}
                                        onDelete={deleteTask}
                                        onUncomplete={handleUncomplete}
                                    />
                                </Accordion>
                            </div>
                        </div>
                    )}

                    {/* Repeating Tasks */}
                    {showRepeating && (
                        <RepeatingTasksPage
                            repeatingTasks={repeatingTasks}
                            onEdit={handleRepeatingEdit}
                            onDelete={deleteRepeatingTask}
                            onToggleActive={handleRepeatingToggleActive}
                        />
                    )}
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
                <DialogContent className="max-w-4xl h-[95vh] sm:h-[80vh] bg-popover/95 backdrop-blur-xl border-border text-foreground flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b border-border">
                        <DialogTitle className="text-xl font-light tracking-wide text-foreground/90">All Tasks</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {overdueTasks.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium text-red-400 uppercase tracking-wider mb-4 border-b border-border pb-2">Overdue</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {overdueTasks.map(task => (
                                        <TaskItem key={task.id} task={task} isActive={false} isTimerRunning={false} onToggleTimer={() => { }} onEdit={handleEditClick} onDelete={deleteTask} onComplete={handleComplete} />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">Today</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {todayTasks.map(task => (
                                    <TaskItem key={task.id} task={task} isActive={false} isTimerRunning={false} onToggleTimer={() => { }} onEdit={handleEditClick} onDelete={deleteTask} onComplete={handleComplete} />
                                ))}
                                {todayTasks.length === 0 && <p className="text-muted-foreground/40 italic text-sm">Nothing due today</p>}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">This Week</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {thisWeekTasks.map(task => (
                                    <TaskItem key={task.id} task={task} isActive={false} isTimerRunning={false} onToggleTimer={() => { }} onEdit={handleEditClick} onDelete={deleteTask} onComplete={handleComplete} />
                                ))}
                                {thisWeekTasks.length === 0 && <p className="text-muted-foreground/40 italic text-sm">Nothing else this week</p>}
                            </div>
                        </div>

                        {laterTasks.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">Later</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {laterTasks.map(task => (
                                        <TaskItem key={task.id} task={task} isActive={false} isTimerRunning={false} onToggleTimer={() => { }} onEdit={handleEditClick} onDelete={deleteTask} onComplete={handleComplete} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Loose */}
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">Loose Tasks</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {looseTasks.map(task => (
                                    <TaskItem key={task.id} task={task} isActive={false} isTimerRunning={false} onToggleTimer={() => { }} onEdit={handleEditClick} onDelete={deleteTask} onComplete={handleComplete} />
                                ))}
                                {looseTasks.length === 0 && <p className="text-muted-foreground/40 italic text-sm">No loose tasks</p>}
                            </div>
                        </div>

                        {/* Completed */}
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">Completed Tasks</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
                                {completedTasks.map(task => (
                                    <TaskItem key={task.id} task={task} isActive={false} isTimerRunning={false} onToggleTimer={() => { }} onEdit={handleEditClick} onDelete={deleteTask} onComplete={() => updateTask({ ...task, isComplete: 0 })} />
                                ))}
                                {completedTasks.length === 0 && <p className="text-muted-foreground/40 italic text-sm">No completed tasks</p>}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>


            {/* Manual Duration Dialog */}
            {untimedTaskToComplete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-popover/95 border border-border rounded-xl shadow-2xl p-6">
                        <h3 className="text-lg font-light text-foreground mb-2">Duration Worked</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            How many minutes did you work on "{untimedTaskToComplete.title}"?
                        </p>

                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="duration" className="text-xs uppercase tracking-wider text-muted-foreground">Minutes</Label>
                                <Input
                                    id="duration"
                                    type="number"
                                    min="0"
                                    value={manualDuration}
                                    onChange={(e) => setManualDuration(e.target.value)}
                                    className="bg-muted/50 border-border text-foreground"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') confirmUntimedCompletion();
                                    }}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setUntimedTaskToComplete(null)} className="text-muted-foreground hover:text-foreground hover:bg-muted">
                                    Cancel
                                </Button>
                                <Button onClick={confirmUntimedCompletion} className="bg-primary text-primary-foreground hover:bg-primary/90">
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
