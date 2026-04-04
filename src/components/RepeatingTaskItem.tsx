import { memo, useMemo } from "react";
import { RepeatingTask } from "@/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Edit, Trash, Repeat, CheckCircle2, Flame } from "lucide-react";
import { cn, getLocalDateString, getStatColor, getDifficultyPulse } from "@/lib/utils";
import { useStore } from "@/store";
import { startOfWeek, addDays, format, isSameDay } from "date-fns";

interface RepeatingTaskItemProps {
    task: RepeatingTask;
    onEdit: (task: RepeatingTask) => void;
    onDelete: (id: number) => void;
    onToggleActive: (task: RepeatingTask) => void;
}

export const RepeatingTaskItem = memo(function RepeatingTaskItem({ task, onEdit, onDelete, onToggleActive }: RepeatingTaskItemProps) {
    const tasks = useStore(state => state.tasks);
    const relatedTasks = useMemo(() => tasks.filter(t => t.repeatingTaskId === task.id), [tasks, task.id]);
    const today = getLocalDateString();
    const todayDate = useMemo(() => new Date(), []);
    const todayDayOfWeek = todayDate.getDay(); // 0 = Sunday, 6 = Saturday

    // Check if done today
    const isDoneToday = useMemo(() => relatedTasks.some(t =>
        t.dueDate === today &&
        t.isComplete === 1
    ), [relatedTasks, today]);

    // For weekly tasks: check if all remaining scheduled days this week are completed
    const isWeeklyDoneForRemainingDays = useMemo(() => {
        if (task.repeatType !== 'weekly' || !task.repeatDays || task.repeatDays.length === 0) {
            return false;
        }

        const start = startOfWeek(todayDate);

        // Get scheduled days that are today or in the future (within this week)
        const remainingScheduledDays = task.repeatDays.filter(dayIndex => dayIndex >= todayDayOfWeek);

        if (remainingScheduledDays.length === 0) {
            // No more scheduled days left this week - fade it
            return true;
        }

        // Check if all remaining scheduled days are completed
        return remainingScheduledDays.every(dayIndex => {
            const dateStr = format(addDays(start, dayIndex), "yyyy-MM-dd");
            return relatedTasks.some(t =>
                t.dueDate === dateStr &&
                t.isComplete === 1
            );
        });
    }, [task, relatedTasks, todayDate, todayDayOfWeek]);

    const statColor = getStatColor(task.statTarget?.[0] || "");
    const pulse = useMemo(() => getDifficultyPulse(task.difficulty, statColor.rgb), [task.difficulty, statColor.rgb]);

    const getRepeatText = () => {
        if (task.repeatType === 'daily') return "Daily";
        if (task.repeatType === 'weekly') {
            const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            if (!task.repeatDays || task.repeatDays.length === 0) return "Weekly (No days)";
            if (task.repeatDays.length === 7) return "Every day";
            return (task.repeatDays || []).map(d => days[d]).join(", ");
        }
        return "Unknown";
    };

    // Weekly visualization
    const renderWeeklyProgress = () => {
        if (task.repeatType !== 'weekly') return null;

        const start = startOfWeek(todayDate);
        const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));
        const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

        return (
            <div className="flex items-center gap-1 mt-1">
                {weekDays.map((date, idx) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const isScheduled = (task.repeatDays || []).includes(idx);
                    const isCompleted = relatedTasks.some(t =>
                        t.dueDate === dateStr &&
                        t.isComplete === 1
                    );
                    const isToday = isSameDay(date, todayDate);
                    const isPast = date < todayDate && !isToday;

                    if (!isScheduled) {
                        return (
                            <div key={idx} className="w-4 h-4 flex items-center justify-center text-[8px] text-muted-foreground/30 select-none">
                                {dayLabels[idx]}
                            </div>
                        );
                    }

                    return (
                        <div
                            key={idx}
                            className={cn(
                                "w-4 h-4 rounded-full flex items-center justify-center text-[8px] border transition-all",
                                isCompleted ? "bg-primary border-primary text-primary-foreground" :
                                    isToday ? "border-primary text-primary" :
                                        isPast ? "border-destructive/50 text-destructive/50" : "border-muted-foreground/50 text-muted-foreground"
                            )}
                            title={`${format(date, "EEE, MMM d")}${isCompleted ? " - Done" : ""}`}
                        >
                            {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : dayLabels[idx]}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-1">
            <div className={cn(
                "group relative flex items-center justify-between p-3 rounded-xl transition-colors border border-transparent hover:border-border cursor-pointer",
                task.isActive ? "bg-secondary/50 hover:bg-secondary" : "bg-secondary/20 hover:bg-secondary/30 opacity-70",
                (isDoneToday && task.repeatType === 'daily') && "opacity-50 grayscale-[0.5]",
                (isWeeklyDoneForRemainingDays && task.repeatType === 'weekly') && "opacity-50 grayscale-[0.5]"
            )}>
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <div className={cn("w-1 h-8 rounded-full", statColor.bg, pulse.className)} style={pulse.style} title={`${task.statTarget?.[0] || 'General'} • Difficulty ${task.difficulty}`} />
                    <div className="flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2">
                            <h3 className={cn("font-medium truncate text-sm", !task.isActive && "line-through text-muted-foreground")}>
                                {task.title}
                            </h3>
                            {task.streak !== undefined && task.streak > 0 && (
                                <span className="text-[11px] bg-orange-500/20 text-orange-500 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5" title="Current Streak">
                                    <Flame className="w-3 h-3 fill-orange-500" /> {task.streak}
                                </span>
                            )}
                            {isDoneToday && task.repeatType === 'daily' && (
                                <span className="text-[11px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Done
                                </span>
                            )}
                        </div>

                        {task.repeatType === 'weekly' ? (
                            renderWeeklyProgress()
                        ) : (
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex gap-2 items-center">
                                <Repeat className="h-3 w-3" />
                                <span>{getRepeatText()}</span>
                                <span className="bg-secondary/50 px-1.5 py-0.5 rounded">{Array.isArray(task.statTarget) ? task.statTarget.join(", ") : task.statTarget}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <Switch
                        checked={!!task.isActive}
                        onCheckedChange={() => onToggleActive(task)}
                    />
                    <Button variant="ghost" size="icon" className="h-9 w-9 lg:h-7 lg:w-7 hover:bg-muted" onClick={(e) => { e.stopPropagation(); onEdit(task); }}>
                        <Edit className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 lg:h-7 lg:w-7 hover:bg-destructive/20 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(task.id!); }}>
                        <Trash className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
});
