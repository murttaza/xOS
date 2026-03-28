import { memo } from "react";
import { Task } from "@/types";
import { TaskItem } from "@/components/TaskItem";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const noop = () => { };

interface CompletedTasksProps {
    completedTasks: Task[];
    onEdit: (task: Task) => void;
    onDelete: (id: number) => Promise<void>;
    onUncomplete: (task: Task) => void;
}

export const CompletedTasks = memo(function CompletedTasks({
    completedTasks,
    onEdit,
    onDelete,
    onUncomplete,
}: CompletedTasksProps) {
    if (completedTasks.length === 0) return null;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentCompleted = completedTasks.filter(t => t.completedAt && t.completedAt > sevenDaysAgo);
    const displayTasks = recentCompleted.length > 0 ? recentCompleted : completedTasks.slice(0, 5);

    return (
        <AccordionItem value="completed" className="border-none bg-card/40 rounded-xl overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                <span className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                    Completed
                    <span className="bg-muted px-2 py-0.5 rounded-full text-xs">
                        {recentCompleted.length > 0 && recentCompleted.length !== completedTasks.length
                            ? `${recentCompleted.length} recent \u00b7 ${completedTasks.length} total`
                            : completedTasks.length}
                    </span>
                </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-2 space-y-2 opacity-60 grayscale hover:grayscale-0 transition-all duration-150">
                <div className="max-h-[60vh] lg:max-h-[45vh] overscroll-contain overflow-y-auto lg:snap-y lg:snap-mandatory no-scrollbar space-y-2">
                    {displayTasks.map(task => (
                        <div key={task.id} className="lg:snap-start">
                            <TaskItem
                                task={task}
                                isActive={false}
                                isTimerRunning={false}
                                onToggleTimer={noop}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onComplete={() => onUncomplete(task)}
                            />
                        </div>
                    ))}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
});
