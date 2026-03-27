import { Repeat } from "lucide-react";
import { RepeatingTask } from "@/types";
import { RepeatingTaskItem } from "@/components/RepeatingTaskItem";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RepeatingTasksPageProps {
    repeatingTasks: RepeatingTask[];
    onEdit: (task: RepeatingTask) => void;
    onDelete: (id: number) => Promise<void>;
    onToggleActive: (task: RepeatingTask) => void;
}

export function RepeatingTasksPage({
    repeatingTasks,
    onEdit,
    onDelete,
    onToggleActive,
}: RepeatingTasksPageProps) {
    return (
        <div className="w-full lg:min-h-full lg:snap-center flex flex-col">
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
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onToggleActive={onToggleActive}
                        />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
