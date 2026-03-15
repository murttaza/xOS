import { useMemo } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SessionsListProps {
    selectedDate: Date | undefined;
}

export function SessionsList({ selectedDate }: SessionsListProps) {
    const sessions = useStore(s => s.sessions);
    const tasks = useStore(s => s.tasks);

    const taskMap = useMemo(() => {
        const map = new Map();
        tasks.forEach(t => map.set(t.id, t));
        return map;
    }, [tasks]);

    const dailySessions = useMemo(() => {
        if (!selectedDate) return [];
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        return sessions.filter(s => s.dateLogged === dateStr);
    }, [selectedDate, sessions]);

    const getTaskTitle = (taskId: number) => {
        const task = taskMap.get(taskId);
        return task ? task.title : "Unknown Task";
    };

    if (!selectedDate) return null;

    return (
        <Card className="mt-4 border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Work Sessions ({dailySessions.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
                <ScrollArea className="h-[150px] w-full rounded-md border border-border/50 bg-card/30 backdrop-blur-sm p-4">
                    {dailySessions.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No work sessions recorded for this day.</p>
                    ) : (
                        <div className="space-y-3">
                            {dailySessions.map((session, index) => (
                                <div key={index} className="flex flex-col gap-1 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-sm text-foreground">{getTaskTitle(session.taskId)}</span>
                                        <span className="text-xs text-muted-foreground">{session.duration_minutes} min</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <span>{format(new Date(session.startTime), "h:mm a")} - {format(new Date(session.endTime), "h:mm a")}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
