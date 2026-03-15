import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
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
            setStatTarget(["Fitness"]);
            setRepeatType('daily');
            setRepeatDays([]);
            setSubtasks([]);
            setIsUntimed(false);
            setExistingLabels([]);
        }
    }, [initialTask, open]);

    const handleSubmit = () => {
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
            <DialogContent className="sm:max-w-[500px] bg-black/80 backdrop-blur-xl border-white/10 text-white shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-light tracking-wide text-white/90">
                        {initialTask ? "Edit Repeating Task" : "New Repeating Task"}
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    {/* Title */}
                    <div className="grid gap-2">
                        <Label htmlFor="title" className="text-xs font-medium text-white/60 uppercase tracking-wider">
                            Title
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/20"
                            placeholder="What needs to be done?"
                        />
                    </div>

                    {/* Description */}
                    <div className="grid gap-2">
                        <Label htmlFor="description" className="text-xs font-medium text-white/60 uppercase tracking-wider">
                            Description
                        </Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/20 min-h-[100px] resize-none"
                            placeholder="Add details..."
                        />
                    </div>

                    {/* Subtasks */}
                    <div className="grid gap-2">
                        <Label className="text-xs font-medium text-white/60 uppercase tracking-wider">Subtasks</Label>
                        <div className="flex gap-2">
                            <Input
                                value={newSubtask}
                                onChange={(e) => setNewSubtask(e.target.value)}
                                placeholder="Add a subtask..."
                                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-xs h-8"
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
                                className="h-8 w-8 bg-white/10 hover:bg-white/20 border-white/10"
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
                                    <div key={st.id} className="flex items-center justify-between group bg-white/5 p-1.5 rounded px-2">
                                        <span className="text-xs text-white/80 truncate flex-1">{st.text}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 hover:text-red-400"
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
                        {/* Difficulty */}
                        <div className="grid gap-3">
                            <Label className="text-xs font-medium text-white/60 uppercase tracking-wider">
                                Difficulty: <span className="text-white">{difficulty}</span>
                            </Label>
                            <Slider
                                min={1}
                                max={5}
                                step={1}
                                value={[difficulty]}
                                onValueChange={(vals) => setDifficulty(vals[0])}
                                className="py-2"
                            />
                        </div>

                        {/* Repeat Settings */}
                        <div className="grid gap-3">
                            <Label className="text-xs font-medium text-white/60 uppercase tracking-wider">
                                Repeat
                            </Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={repeatType === 'daily' ? "default" : "outline"}
                                    onClick={() => setRepeatType('daily')}
                                    className={cn("flex-1", repeatType === 'daily' ? "bg-white text-black hover:bg-white/90" : "bg-transparent border-white/10 text-white hover:bg-white/10")}
                                >
                                    Daily
                                </Button>
                                <Button
                                    type="button"
                                    variant={repeatType === 'weekly' ? "default" : "outline"}
                                    onClick={() => setRepeatType('weekly')}
                                    className={cn("flex-1", repeatType === 'weekly' ? "bg-white text-black hover:bg-white/90" : "bg-transparent border-white/10 text-white hover:bg-white/10")}
                                >
                                    Weekly
                                </Button>
                            </div>

                            {repeatType === 'weekly' && (
                                <div className="flex justify-between gap-1 mt-2">
                                    {days.map((day, index) => (
                                        <Button
                                            key={index}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleDay(index)}
                                            className={cn(
                                                "h-8 w-8 p-0 rounded-full border-white/10 bg-transparent hover:bg-white/10 hover:text-white transition-all",
                                                repeatDays.includes(index) && "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                                            )}
                                        >
                                            {day}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid gap-3">
                        <Label className="text-xs font-medium text-white/60 uppercase tracking-wider">
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
                                        "h-7 text-xs border-white/10 bg-transparent hover:bg-white/10 hover:text-white transition-all",
                                        statTarget.includes(stat.statName) && "bg-white text-black hover:bg-white/90 hover:text-black border-transparent"
                                    )}
                                >
                                    {stat.statName}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Untimed Toggle */}
                    <div className="flex items-center justify-between border border-white/10 rounded-lg p-3 bg-white/5">
                        <div className="space-y-0.5">
                            <Label className="text-xs font-medium text-white uppercase tracking-wider flex items-center gap-2">
                                <TimerOff className="w-4 h-4" /> Untimed Task
                            </Label>
                            <p className="text-[10px] text-white/50">Enter duration manually upon completion</p>
                        </div>
                        <Switch
                            checked={isUntimed}
                            onCheckedChange={setIsUntimed}
                        />
                    </div>

                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} className="bg-white text-black hover:bg-white/90 w-full sm:w-auto">
                        Save Repeating Task
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
