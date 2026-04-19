import { useState, useMemo, memo } from "react";
import { Task, Session, Subtask } from "@/types";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Pause, Edit, Trash, CheckCircle2, Clock, Trophy, TimerOff, BookOpen, AlertCircle } from "lucide-react";
import { cn, calculateSessionXP, getLocalDateString, getStatColor, getDifficultyPulse } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStore } from "@/store";

interface TaskItemProps {
    task: Task;
    isActive: boolean;
    isTimerRunning: boolean;
    onToggleTimer: (id: number) => void;
    onEdit: (task: Task) => void;
    onDelete: (id: number) => void;
    onComplete: (task: Task) => void;
}

export const TaskItem = memo(function TaskItem({ task, isActive, isTimerRunning, onToggleTimer, onEdit, onDelete, onComplete }: TaskItemProps) {
    const [sessions, setSessions] = useState<Session[]>([]);

    const updateTask = useStore(state => state.updateTask);

    const statColor = getStatColor(task.statTarget?.[0] || "");
    const pulse = useMemo(() => getDifficultyPulse(task.difficulty, statColor.rgb), [task.difficulty, statColor.rgb]);

    const loadHistory = async () => {
        if (sessions.length > 0) return;
        try {
            const history = await api.getSessionsByTask(task.id!);
            setSessions(history);
        } catch (e) {
            console.error("Failed to fetch history", e);
        }
    };

    const totalMinutes = useMemo(() => sessions.reduce((acc, s) => acc + s.duration_minutes, 0), [sessions]);
    const totalXP = useMemo(() => sessions.reduce((acc, s) => acc + calculateSessionXP(s.duration_minutes, task.difficulty), 0), [sessions, task.difficulty]);

    const completedSubtasks = (task.subtasks || []).filter(st => st.isComplete).length;
    const totalSubtasks = (task.subtasks || []).length;

    const handleSubtaskToggle = async (subtask: Subtask) => {
        const updatedSubtasks = (task.subtasks || []).map(st =>
            st.id === subtask.id ? { ...st, isComplete: !st.isComplete } : st
        );
        await updateTask({ ...task, subtasks: updatedSubtasks });
    };

    const isOverdue = useMemo(() => {
        if (!task.dueDate || task.isComplete) return false;
        const today = getLocalDateString();
        return task.dueDate < today;
    }, [task.dueDate, task.isComplete]);

    const [isOpeningNote, setIsOpeningNote] = useState(false);

    const handleOpenNote = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!task.noteId || isOpeningNote) return;
        setIsOpeningNote(true);

        try {
            const note = await api.getNote(task.noteId);
            if (!note) {
                const { showErrorToast } = await import('@/components/ui/toast');
                showErrorToast('Linked note no longer exists.');
                return;
            }
            if (note.subjectId == null) {
                const { showErrorToast } = await import('@/components/ui/toast');
                showErrorToast('Linked note is missing its book.');
                return;
            }

            const state = useStore.getState();
            // Ensure subjects are loaded before opening (avoids BookView not rendering)
            if (state.subjects.length === 0) {
                await state.fetchSubjects();
            }
            if (!state.isNotesMode) {
                state.toggleNotesMode();
            }
            // Use a microtask so the notes-mode panel has mounted before we open
            await Promise.resolve();
            await useStore.getState().openSubject(note.subjectId, note.id!);
        } catch (err) {
            console.error("Failed to open note", err);
        } finally {
            setIsOpeningNote(false);
        }
    };

    return (
        <Dialog onOpenChange={(open) => { if (open) loadHistory(); }}>
            <DialogTrigger asChild>
                <div className={cn(
                    "group relative flex items-center justify-between p-3 rounded-xl transition-colors duration-150 border border-transparent hover:border-border cursor-pointer text-left bg-secondary/30",
                    isActive ? "bg-primary/20 border-primary/30" : "hover:bg-secondary/60",
                    task.isComplete && "opacity-50 grayscale-[0.8]",
                    isOverdue && !task.isComplete && !isActive && "border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10"
                )}>
                    {isActive && (
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/10 to-transparent pointer-events-none animate-pulse" />
                    )}

                    <div className="flex items-center gap-2 sm:gap-3 overflow-hidden flex-1 relative z-10">
                        <div className={cn("w-1.5 h-10 rounded-full transition-colors shrink-0", statColor.bg, pulse.className)} style={pulse.style} title={`${task.statTarget?.[0] || 'General'} • Difficulty ${task.difficulty}`} />
                        <div className="flex flex-col flex-1 overflow-hidden pr-1">
                            <h3 className={cn("font-medium truncate text-sm transition-colors",
                                task.isComplete && "line-through text-muted-foreground",
                                isOverdue && !task.isComplete && "text-rose-400"
                            )}>
                                {task.title}
                            </h3>

                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded transition-colors",
                                    isActive ? "bg-primary/20 text-primary-foreground/90" : "bg-muted/50"
                                )}>
                                    {Array.isArray(task.statTarget) ? task.statTarget.join(", ") : task.statTarget}
                                </span>

                                {task.dueDate && (
                                    <span className={cn("flex items-center gap-1", isOverdue && !task.isComplete && "text-rose-500 font-bold")}>
                                        • {isOverdue && !task.isComplete && <AlertCircle className="w-3 h-3 inline-block" />}
                                        {task.dueDate}{task.time ? ` @ ${task.time}` : ''}
                                    </span>
                                )}
                            </div>

                            {totalSubtasks > 0 && (
                                <div className="flex items-center gap-2 mt-1.5 opacity-80">
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full transition-all duration-150 ease-out",
                                                completedSubtasks === totalSubtasks ? "bg-emerald-500" : "bg-primary"
                                            )}
                                            style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-[9px] font-mono text-muted-foreground whitespace-nowrap">
                                        {completedSubtasks}/{totalSubtasks}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-0.5 sm:gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-150 lg:translate-x-2 lg:group-hover:translate-x-0 relative z-10 lg:bg-muted/50 px-0.5 sm:px-1 py-1 rounded-lg lg:backdrop-blur-md shrink-0">
                        {task.noteId && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300" onClick={handleOpenNote} title="Open Linked Note">
                                <BookOpen className="h-3.5 w-3.5 lg:h-3.5 lg:w-3.5" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground/70 hover:bg-red-500/20 hover:text-red-400 transition-colors" onClick={(e) => { e.stopPropagation(); onDelete(task.id!); }}>
                            <Trash className="h-3.5 w-3.5 lg:h-3.5 lg:w-3.5" />
                        </Button>
                        {!task.isComplete && (
                            <Button variant="ghost" size="icon" className={cn("h-8 w-8 lg:h-7 lg:w-7 transition-colors", isActive && isTimerRunning ? "text-amber-400 hover:bg-amber-400/20 hover:text-amber-300" : "text-muted-foreground/70 hover:bg-primary/20 hover:text-primary")} onClick={(e) => { e.stopPropagation(); onToggleTimer(task.id!); }}>
                                {isActive && isTimerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className={cn("h-8 w-8 lg:h-7 lg:w-7 transition-colors", task.isComplete ? "text-green-500 hover:bg-green-500/20" : "text-muted-foreground/70 hover:bg-green-500/20 hover:text-green-400")} onClick={(e) => { e.stopPropagation(); onComplete(task); }}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:rounded-none max-sm:border-0 max-sm:p-0 bg-popover/95 backdrop-blur-xl border-border text-foreground shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <DialogHeader className="pb-4 border-b border-border shrink-0 max-sm:px-4 max-sm:pt-4">
                    <DialogTitle className="text-lg sm:text-xl font-light tracking-wide flex items-center gap-3">
                        <div className={cn("w-2 h-6 rounded-full shrink-0", statColor.bg, pulse.className)} style={pulse.style} />
                        <span className="truncate">{task.title}</span>
                        {task.noteId && (
                            <Button variant="outline" size="sm" onClick={handleOpenNote} className="ml-auto bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 text-xs px-2 h-7 group shrink-0">
                                <BookOpen className="w-3 h-3 mr-1.5 group-hover:scale-110 transition-transform" /> Open Note
                            </Button>
                        )}
                    </DialogTitle>
                    {task.description && <p className="text-sm text-muted-foreground font-light mt-2">{task.description}</p>}
                </DialogHeader>

                <ScrollArea className="flex-1 sm:pr-4 sm:-mr-4 max-sm:px-4">
                    <div className="grid gap-6 sm:gap-8 py-4">
                        {/* Stats & Time */}
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="bg-muted/50 rounded-lg p-3 sm:p-4 border border-border/50 space-y-1">
                                <div className="flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground/60 mb-2">
                                    <Trophy className="w-3 h-3 text-amber-500" /> XP Gained
                                </div>
                                <div className="space-y-1">
                                    {(task.statTarget || []).map((stat) => (
                                        <div key={stat} className="flex justify-between items-center text-xs sm:text-sm">
                                            <span className="text-muted-foreground">{stat}</span>
                                            <span className="font-mono text-amber-500/90 font-medium">+{totalXP} XP</span>
                                        </div>
                                    ))}
                                    {(!task.statTarget || task.statTarget.length === 0) && (
                                        <div className="flex justify-between items-center text-xs sm:text-sm">
                                            <span className="text-muted-foreground">General</span>
                                            <span className="font-mono text-amber-500/90 font-medium">+{totalXP} XP</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3 sm:p-4 border border-border/50 space-y-1">
                                <div className="flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground/60 mb-2">
                                    <Clock className="w-3 h-3 text-blue-400" /> Total Time
                                </div>
                                <div className="text-xl sm:text-2xl font-light text-foreground/90">
                                    {Math.floor(totalMinutes / 60)}<span className="text-sm text-muted-foreground/60 ml-0.5 mr-2 font-mono">h</span>
                                    {totalMinutes % 60}<span className="text-sm text-muted-foreground/60 ml-0.5 font-mono">m</span>
                                </div>
                            </div>
                        </div>

                        {/* Subtasks */}
                        {(task.subtasks && task.subtasks.length > 0) && (
                            <div className="space-y-3">
                                <h4 className="text-xs uppercase tracking-wider text-muted-foreground/60 font-medium flex items-center justify-between">
                                    <span>Subtasks</span>
                                    <span className="text-muted-foreground/40 font-mono">{completedSubtasks}/{totalSubtasks}</span>
                                </h4>
                                <div className="space-y-2">
                                    {task.subtasks.map(st => (
                                        <div key={st.id} className="flex items-center gap-3 bg-muted/50 p-2.5 sm:p-2 rounded-lg hover:bg-muted transition-colors border border-border/50">
                                            <Checkbox
                                                checked={st.isComplete}
                                                onCheckedChange={() => handleSubtaskToggle(st)}
                                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary border-border h-5 w-5 sm:h-4 sm:w-4"
                                            />
                                            <span className={cn("text-sm flex-1 transition-all", st.isComplete && "line-through text-muted-foreground/60")}>{st.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* History */}
                        <div className="space-y-3">
                            <h4 className="text-xs uppercase tracking-wider text-muted-foreground/60 font-medium">Session History</h4>
                            {sessions.length === 0 ? (
                                <p className="text-sm text-muted-foreground/30 italic bg-muted/50 p-4 rounded-lg text-center border border-border/50">No sessions recorded yet.</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {sessions.slice(0, 5).map(session => (
                                        <div key={session.id} className="flex justify-between text-xs text-muted-foreground bg-muted/50 p-2.5 sm:p-2 rounded hover:bg-muted transition-colors border border-border/50">
                                            <span>{new Date(session.startTime).toLocaleDateString()} {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="font-mono text-blue-400">{session.duration_minutes}m</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                <div className="pt-3 sm:pt-4 mt-2 sm:mt-4 border-t border-border flex flex-wrap sm:flex-nowrap justify-end gap-2 shrink-0 bg-muted/50 -mx-6 -mb-6 max-sm:mx-0 max-sm:mb-0 px-4 sm:px-6 py-3 sm:py-4">
                    <Button variant="outline" size="sm" onClick={() => onEdit(task)} className="bg-transparent border-border hover:bg-muted text-foreground hover:text-foreground transition-colors h-9 sm:h-8">
                        <Edit className="w-4 h-4 mr-2" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onDelete(task.id!)} className="bg-transparent border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors h-9 sm:h-8">
                        <Trash className="w-4 h-4 mr-2" /> Delete
                    </Button>
                    {!task.isComplete && (
                        <>
                            {task.labels?.includes("untimed") ? (
                                <Button size="sm" variant="ghost" className="opacity-50 cursor-not-allowed text-muted-foreground/60 hover:bg-transparent hover:text-muted-foreground/60 ml-auto h-9 sm:h-8" disabled title="Untimed Task">
                                    <TimerOff className="w-4 h-4 mr-2" /> Manual
                                </Button>
                            ) : (
                                <Button size="sm" onClick={() => onToggleTimer(task.id!)} className={cn("min-w-[100px] shadow-lg ml-auto transition-all h-10 sm:h-8", isActive && isTimerRunning ? "bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/20" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/10")}>
                                    {isActive && isTimerRunning ? <><Pause className="w-4 h-4 mr-2" /> Pause</> : <><Play className="w-4 h-4 mr-2" /> Start Focus</>}
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
});
