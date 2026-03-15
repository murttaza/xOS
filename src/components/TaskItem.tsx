import { useState, useMemo, memo } from "react";
import { Task, Session, Subtask } from "@/types";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Pause, Edit, Trash, CheckCircle2, Clock, Trophy, TimerOff, BookOpen, AlertCircle } from "lucide-react";
import { cn, calculateSessionXP, getLocalDateString } from "@/lib/utils";
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

    const difficultyColor = {
        1: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
        2: "bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.5)]",
        3: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
        4: "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]",
        5: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
    }[task.difficulty] || "bg-gray-500";

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

    const handleOpenNote = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!task.noteId) return;

        try {
            const note = await api.getNote(task.noteId);
            if (note) {
                const state = useStore.getState();
                if (!state.isNotesMode) {
                    state.toggleNotesMode();
                }
                setTimeout(() => {
                    useStore.getState().openSubject(note.subjectId, note.id!);
                }, 100);
            }
        } catch (err) {
            console.error("Failed to open note", err);
        }
    };

    return (
        <Dialog onOpenChange={(open) => { if (open) loadHistory(); }}>
            <DialogTrigger asChild>
                <div className={cn(
                    "group relative flex items-center justify-between p-3 rounded-xl transition-colors duration-150 border border-transparent hover:border-white/10 cursor-pointer text-left bg-secondary/30",
                    isActive ? "bg-primary/20 border-primary/30" : "hover:bg-secondary/60",
                    task.isComplete && "opacity-50 grayscale-[0.8]",
                    isOverdue && !task.isComplete && !isActive && "border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10"
                )}>
                    {isActive && (
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/10 to-transparent pointer-events-none animate-pulse" />
                    )}

                    <div className="flex items-center gap-3 overflow-hidden flex-1 relative z-10">
                        <div className={cn("w-1.5 h-10 rounded-full transition-colors", difficultyColor)} title={`Difficulty: ${task.difficulty}`} />
                        <div className="flex flex-col flex-1 overflow-hidden pr-2">
                            <h3 className={cn("font-medium truncate text-sm transition-colors",
                                task.isComplete && "line-through text-muted-foreground",
                                isOverdue && !task.isComplete && "text-rose-400"
                            )}>
                                {task.title}
                            </h3>

                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2 mt-0.5">
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded transition-colors",
                                    isActive ? "bg-primary/20 text-primary-foreground/90" : "bg-black/20"
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
                                    <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
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

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-2 group-hover:translate-x-0 relative z-10 bg-black/20 px-1 py-1 rounded-lg backdrop-blur-md">
                        {task.noteId && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300" onClick={handleOpenNote} title="Open Linked Note">
                                <BookOpen className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-white/50 hover:bg-red-500/20 hover:text-red-400 transition-colors" onClick={(e) => { e.stopPropagation(); onDelete(task.id!); }}>
                            <Trash className="h-3.5 w-3.5" />
                        </Button>
                        {!task.isComplete && (
                            <Button variant="ghost" size="icon" className={cn("h-7 w-7 transition-colors", isActive && isTimerRunning ? "text-amber-400 hover:bg-amber-400/20 hover:text-amber-300" : "text-white/50 hover:bg-primary/20 hover:text-primary")} onClick={(e) => { e.stopPropagation(); onToggleTimer(task.id!); }}>
                                {isActive && isTimerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className={cn("h-7 w-7 transition-colors", task.isComplete ? "text-green-500 hover:bg-green-500/20" : "text-white/50 hover:bg-green-500/20 hover:text-green-400")} onClick={(e) => { e.stopPropagation(); onComplete(task); }}>
                            <CheckCircle2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-black/90 backdrop-blur-xl border-white/10 text-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <DialogHeader className="pb-4 border-b border-white/10 shrink-0">
                    <DialogTitle className="text-xl font-light tracking-wide flex items-center gap-3">
                        <div className={cn("w-2 h-6 rounded-full", difficultyColor)} />
                        {task.title}
                        {task.noteId && (
                            <Button variant="outline" size="sm" onClick={handleOpenNote} className="ml-auto bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 text-xs px-2 h-7 group">
                                <BookOpen className="w-3 h-3 mr-1.5 group-hover:scale-110 transition-transform" /> Open Note
                            </Button>
                        )}
                    </DialogTitle>
                    {task.description && <p className="text-sm text-white/60 font-light mt-2">{task.description}</p>}
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4 -mr-4">
                    <div className="grid gap-8 py-4">
                        {/* Stats & Time */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 rounded-lg p-4 border border-white/5 space-y-1">
                                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40 mb-2">
                                    <Trophy className="w-3 h-3 text-amber-500" /> XP Gained
                                </div>
                                <div className="space-y-1">
                                    {(task.statTarget || []).map((stat) => (
                                        <div key={stat} className="flex justify-between items-center text-sm">
                                            <span className="text-white/60">{stat}</span>
                                            <span className="font-mono text-amber-500/90 font-medium">+{totalXP} XP</span>
                                        </div>
                                    ))}
                                    {(!task.statTarget || task.statTarget.length === 0) && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-white/60">General</span>
                                            <span className="font-mono text-amber-500/90 font-medium">+{totalXP} XP</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-4 border border-white/5 space-y-1">
                                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40 mb-2">
                                    <Clock className="w-3 h-3 text-blue-400" /> Total Time
                                </div>
                                <div className="text-2xl font-light text-white/90">
                                    {Math.floor(totalMinutes / 60)}<span className="text-sm text-white/40 ml-0.5 mr-2 font-mono">h</span>
                                    {totalMinutes % 60}<span className="text-sm text-white/40 ml-0.5 font-mono">m</span>
                                </div>
                            </div>
                        </div>

                        {/* Subtasks */}
                        {(task.subtasks && task.subtasks.length > 0) && (
                            <div className="space-y-3">
                                <h4 className="text-xs uppercase tracking-wider text-white/40 font-medium flex items-center justify-between">
                                    <span>Subtasks</span>
                                    <span className="text-white/30 font-mono">{completedSubtasks}/{totalSubtasks}</span>
                                </h4>
                                <div className="space-y-2">
                                    {task.subtasks.map(st => (
                                        <div key={st.id} className="flex items-center gap-3 bg-white/5 p-2 rounded-lg hover:bg-white/10 transition-colors border border-white/5">
                                            <Checkbox
                                                checked={st.isComplete}
                                                onCheckedChange={() => handleSubtaskToggle(st)}
                                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary border-white/20"
                                            />
                                            <span className={cn("text-sm flex-1 transition-all", st.isComplete && "line-through text-white/40")}>{st.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* History */}
                        <div className="space-y-3">
                            <h4 className="text-xs uppercase tracking-wider text-white/40 font-medium">Session History</h4>
                            {sessions.length === 0 ? (
                                <p className="text-sm text-white/20 italic bg-white/5 p-4 rounded-lg text-center border border-white/5">No sessions recorded yet.</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {sessions.slice(0, 5).map(session => (
                                        <div key={session.id} className="flex justify-between text-xs text-white/60 bg-white/5 p-2 rounded hover:bg-white/10 transition-colors border border-white/5">
                                            <span>{new Date(session.startTime).toLocaleDateString()} {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="font-mono text-blue-400">{session.duration_minutes}m</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                <div className="pt-4 mt-4 border-t border-white/10 flex justify-end gap-2 shrink-0 bg-black/40 -mx-6 -mb-6 px-6 py-4">
                    <Button variant="outline" size="sm" onClick={() => onEdit(task)} className="bg-transparent border-white/10 hover:bg-white/10 text-white hover:text-white transition-colors">
                        <Edit className="w-4 h-4 mr-2" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onDelete(task.id!)} className="bg-transparent border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
                        <Trash className="w-4 h-4 mr-2" /> Delete
                    </Button>
                    {!task.isComplete && (
                        <>
                            {task.labels?.includes("untimed") ? (
                                <Button size="sm" variant="ghost" className="opacity-50 cursor-not-allowed text-white/40 hover:bg-transparent hover:text-white/40 ml-auto" disabled title="Untimed Task">
                                    <TimerOff className="w-4 h-4 mr-2" /> Manual
                                </Button>
                            ) : (
                                <Button size="sm" onClick={() => onToggleTimer(task.id!)} className={cn("min-w-[100px] shadow-lg ml-auto transition-all", isActive && isTimerRunning ? "bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/20" : "bg-white text-black hover:bg-white/90 shadow-white/10")}>
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
