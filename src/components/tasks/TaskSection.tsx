import { memo } from "react";
import { Task } from "@/types";
import { TaskItem } from "@/components/TaskItem";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Plus } from "lucide-react";

interface TaskSectionProps {
    value: string;
    label: string;
    tasks: Task[];
    activeTimerIds: Set<number>;
    emptyMessage: string;
    onToggleTimer: (id: number) => void;
    onEdit: (task: Task) => void;
    onDelete: (id: number) => Promise<void>;
    onComplete: (task: Task) => void;
    onAdd?: () => void;
    addLabel?: string;
    className?: string;
}

export const TaskSection = memo(function TaskSection({
    value,
    label,
    tasks,
    activeTimerIds,
    emptyMessage,
    onToggleTimer,
    onEdit,
    onDelete,
    onComplete,
    onAdd,
    addLabel,
    className,
}: TaskSectionProps) {
    return (
        <AccordionItem value={value} className={`border-none bg-card/40 rounded-xl overflow-hidden shadow-sm ${className || ''}`}>
            <AccordionTrigger className="px-4 py-3 min-h-[44px] hover:no-underline hover:bg-muted/50 transition-colors">
                <span className="font-semibold text-sm text-muted-foreground flex items-center gap-2 flex-1">
                    {label}
                    <span className="bg-muted px-2 py-0.5 rounded-full text-xs">{tasks.length}</span>
                    {onAdd && (
                        <span
                            role="button"
                            tabIndex={0}
                            aria-label={addLabel || `Add task to ${label}`}
                            title={addLabel || `Add task to ${label}`}
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAdd(); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onAdd();
                                }
                            }}
                            className="ml-auto inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </span>
                    )}
                </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-2 space-y-2">
                {tasks.length === 0 && <p className="text-xs text-muted-foreground italic px-2">{emptyMessage}</p>}
                <div className="max-h-[60vh] lg:max-h-[45vh] overscroll-contain overflow-y-auto lg:snap-y lg:snap-mandatory no-scrollbar space-y-2">
                    {tasks.map(task => (
                        <div key={task.id} className="lg:snap-start">
                            <TaskItem
                                task={task}
                                isActive={task.id !== undefined && activeTimerIds.has(task.id)}
                                isTimerRunning={task.id !== undefined && activeTimerIds.has(task.id)}
                                onToggleTimer={onToggleTimer}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onComplete={onComplete}
                            />
                        </div>
                    ))}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
});
