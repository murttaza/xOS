import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RepeatingTask, Subtask } from "@/types";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

import { Plus, X, TimerOff } from "lucide-react";

interface RepeatingTaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (task: Omit<RepeatingTask, "id"> | RepeatingTask) => void;
    initialTask?: RepeatingTask | null;
}

export function RepeatingTaskDialog({ open, onOpenChange, onSubmit, initialTask }: RepeatingTaskDialogProps) {
    const stats = useStore(state => state.stats);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [difficulty, setDifficulty] = useState(1);
    const [statTarget, setStatTarget] = useState<string[]>(["Fitness"]);
    const [repeatType, setRepeatType] = useState<'daily' | 'weekly'>('daily');
    const [repeatDays, setRepeatDays] = useState<number[]>([]);
    const [subtasks, setSubtasks] = useState<Subtask[]>([]);
    const [newSubtask, setNewSubtask] = useState("");
    const [isUntimed, setIsUntimed] = useState(false);
    const [existingLabels, setExistingLabels] = useState<string[]>([]);

    useEffect(() => {
        if (initialTask) {
            setTitle(initialTask.title);
            setDescription(initialTask.description);
            setDifficulty(initialTask.difficulty);
            setStatTarget(initialTask.statTarget || ["Fitness"]);
            setRepeatType(initialTask.repeatType);
            setRepeatDays(initialTask.repeatDays || []);
            setSubtasks(initialTask.subtasks || []);
            setExistingLabels(initialTask.labels || []);
            setIsUntimed(initialTask.labels?.includes("untimed") || false);
        } else {
            setTitle("");
            setDescription("");
            setDifficulty(1);
            // First existing stat, not a hardcoded name (see TaskDialog).
            setStatTarget(stats[0] ? [stats[0].statName] : []);
            setRepeatType('daily');
            setRepeatDays([]);
            setSubtasks([]);
            setIsUntimed(false);
            setExistingLabels([]);
        }
    }, [initialTask, open]);

    // A weekly task with no days never repeats — block that and empty titles.
    const isValid = !!title.trim() && (repeatType === 'daily' || repeatDays.length > 0);

    const handleSubmit = () => {
        if (!isValid) return;
        // Construct labels
        const otherLabels = existingLabels.filter(l => l !== "untimed");
        const finalLabels = isUntimed ? [...otherLabels, "untimed"] : otherLabels;

        onSubmit({
            ...(initialTask ? { id: initialTask.id, isActive: initialTask.isActive, lastGeneratedDate: initialTask.lastGeneratedDate, streak: initialTask.streak } : { isActive: 1, streak: 0 }),
            title,
            description,
            difficulty,
            statTarget,
            labels: finalLabels,
            repeatType,
            repeatDays: repeatType === 'daily' ? [] : repeatDays,
            subtasks
        } as RepeatingTask);
        onOpenChange(false);
    };

    const toggleDay = (day: number) => {
        if (repeatDays.includes(day)) {
            setRepeatDays(repeatDays.filter(d => d !== day));
        } else {
            setRepeatDays([...repeatDays, day]);
        }
    };

    const days = ["S", "M", "T", "W", "T", "F", "S"];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Same mobile full-screen treatment as TaskDialog */}
            <DialogContent className="sm:max-w-[500px] max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:rounded-none max-sm:border-0 max-sm:p-0 bg-popover/95 backdrop-blur-xl border-border text-foreground shadow-2xl flex flex-col">
                <DialogHeader className="max-sm:px-4 max-sm:pt-4 max-sm:pb-2 shrink-0">
                    <DialogTitle className="text-xl font-light tracking-wide text-foreground/90">
                        {initialTask ? "Edit Repeating Task" : "New Repeating Task"}
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4 overflow-y-auto flex-1 max-sm:px-4 max-sm:pb-4">
                    {/* Title */}
                    <div className="grid gap-2">
                        <Label htmlFor="title" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Title
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-ring/30"
                            placeholder="What needs to be done?"
                        />
                    </div>

                    {/* Description */}
                    <div className="grid gap-2">
                        <Label htmlFor="description" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Description
                        </Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-ring/30 min-h-[100px] resize-none"
                            placeholder="Add details..."
                        />
                    </div>

                    {/* Subtasks */}
                    <div className="grid gap-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subtasks</Label>
                        <div className="flex gap-2">
                            <Input
                                value={newSubtask}
                                onChange={(e) => setNewSubtask(e.target.value)}
                                placeholder="Add a subtask..."
                                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 text-xs h-8"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (newSubtask.trim()) {
                                            setSubtasks([...subtasks, { id: crypto.randomUUID(), text: newSubtask.trim(), isComplete: false }]);
                                            setNewSubtask("");
                                        }
                                    }
                                }}
                            />
                            <Button
                                type="button"
                                size="icon"
                                className="h-8 w-8 bg-muted hover:bg-muted border-border"
                                onClick={() => {
                                    if (newSubtask.trim()) {
                                        setSubtasks([...subtasks, { id: crypto.randomUUID(), text: newSubtask.trim(), isComplete: false }]);
                                        setNewSubtask("");
                                    }
                                }}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {subtasks.length > 0 && (
                            <div className="space-y-1 mt-1">
                                {subtasks.map((st) => (
                                    <div key={st.id} className="flex items-center justify-between group bg-muted/50 p-1.5 rounded px-2">
                                        <span className="text-xs text-foreground/80 truncate flex-1">{st.text}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted hover:text-red-400"
                                            onClick={() => setSubtasks(subtasks.filter(s => s.id !== st.id))}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-6">
                        {/* Difficulty — same segmented buttons as TaskDialog */}
                        <div className="grid gap-3">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Difficulty: <span className="text-foreground">{difficulty}</span>
                            </Label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setDifficulty(val)}
                                        className={cn(
                                            "flex-1 h-10 sm:h-8 rounded-md text-sm font-medium transition-all border",
                                            difficulty === val
                                                ? "bg-primary text-primary-foreground border-transparent"
                                                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Repeat Settings */}
                        <div className="grid gap-3">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Repeat
                            </Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={repeatType === 'daily' ? "default" : "outline"}
                                    onClick={() => setRepeatType('daily')}
                                    className={cn("flex-1", repeatType === 'daily' ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-transparent border-border text-foreground hover:bg-muted")}
                                >
                                    Daily
                                </Button>
                                <Button
                                    type="button"
                                    variant={repeatType === 'weekly' ? "default" : "outline"}
                                    onClick={() => setRepeatType('weekly')}
                                    className={cn("flex-1", repeatType === 'weekly' ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-transparent border-border text-foreground hover:bg-muted")}
                                >
                                    Weekly
                                </Button>
                            </div>

                            {repeatType === 'weekly' && (
                                <>
                                    <div className="flex justify-between gap-1 mt-2">
                                        {days.map((day, index) => (
                                            <Button
                                                key={index}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => toggleDay(index)}
                                                aria-pressed={repeatDays.includes(index)}
                                                className={cn(
                                                    "h-9 w-9 sm:h-8 sm:w-8 p-0 rounded-full border-border bg-transparent hover:bg-muted hover:text-foreground transition-all",
                                                    repeatDays.includes(index) && "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                                                )}
                                            >
                                                {day}
                                            </Button>
                                        ))}
                                    </div>
                                    {repeatDays.length === 0 && (
                                        <p className="text-[10px] text-muted-foreground/70 mt-1">Pick at least one day — a weekly task with no days never repeats.</p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid gap-3">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Stats
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            {stats.map((stat) => (
                                <Button
                                    key={stat.statName}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (statTarget.includes(stat.statName)) {
                                            setStatTarget(statTarget.filter((s) => s !== stat.statName));
                                        } else {
                                            setStatTarget([...statTarget, stat.statName]);
                                        }
                                    }}
                                    className={cn(
                                        "h-7 text-xs border-border bg-transparent hover:bg-muted hover:text-foreground transition-all",
                                        statTarget.includes(stat.statName) && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-transparent"
                                    )}
                                >
                                    {stat.statName}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Untimed Toggle */}
                    <div className="flex items-center justify-between border border-border rounded-lg p-3 bg-muted/50">
                        <div className="space-y-0.5">
                            <Label className="text-xs font-medium text-foreground uppercase tracking-wider flex items-center gap-2">
                                <TimerOff className="w-4 h-4" /> Untimed Task
                            </Label>
                            <p className="text-[10px] text-muted-foreground/70">Enter duration manually upon completion</p>
                        </div>
                        <Switch
                            checked={isUntimed}
                            onCheckedChange={setIsUntimed}
                        />
                    </div>

                </div>
                <DialogFooter className="max-sm:px-4 max-sm:pb-4 shrink-0">
                    <Button onClick={handleSubmit} disabled={!isValid} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto h-11 sm:h-9">
                        Save Repeating Task
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
