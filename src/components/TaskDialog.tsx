import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Task, Subtask, Note } from "@/types";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, X, TimerOff } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { api } from "@/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (task: Omit<Task, "id"> | Task) => void;
    initialTask?: Task | null;
}

import { useStore } from "@/store";

export function TaskDialog({ open, onOpenChange, onSubmit, initialTask }: TaskDialogProps) {
    const stats = useStore(state => state.stats);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [difficulty, setDifficulty] = useState(1);
    const [statTarget, setStatTarget] = useState<string[]>(["Fitness"]);
    const [subtasks, setSubtasks] = useState<Subtask[]>([]);
    const [newSubtask, setNewSubtask] = useState("");
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [isUntimed, setIsUntimed] = useState(false);
    const [existingLabels, setExistingLabels] = useState<string[]>([]);
    const [allNotes, setAllNotes] = useState<Note[]>([]);
    const [noteId, setNoteId] = useState<number | null>(null);
    const [time, setTime] = useState<string>("");

    useEffect(() => {
        if (open) {
            api.searchNotes("").then(notes => setAllNotes(notes)).catch(() => {});
        }
    }, [open]);

    useEffect(() => {
        if (initialTask) {
            setTitle(initialTask.title);
            setDescription(initialTask.description);
            setDifficulty(initialTask.difficulty);
            setStatTarget(initialTask.statTarget || ["Fitness"]);
            setSubtasks(initialTask.subtasks || []);
            setExistingLabels(initialTask.labels || []);
            setIsUntimed(initialTask.labels?.includes("untimed") || false);
            if (initialTask.dueDate) {
                const parsedDate = new Date(initialTask.dueDate);
                if (!isNaN(parsedDate.getTime())) {
                    setDate(parsedDate);
                } else {
                    setDate(undefined);
                }
            } else {
                setDate(undefined);
            }
            setNoteId(initialTask.noteId || null);
            setTime(initialTask.time || "");
        } else {
            setTitle("");
            setDescription("");
            setDifficulty(1);
            setStatTarget(["Fitness"]);
            setSubtasks([]);
            setDate(undefined);
            setIsUntimed(false);
            setExistingLabels([]);
            setNoteId(null);
            setTime("");
        }
    }, [initialTask, open]);

    const handleSubmit = () => {
        // Construct labels: keep existing ones but filter out "untimed", then add it back if isUntimed is true
        const otherLabels = existingLabels.filter(l => l !== "untimed");
        const finalLabels = isUntimed ? [...otherLabels, "untimed"] : otherLabels;

        onSubmit({
            ...(initialTask ? { id: initialTask.id, isComplete: initialTask.isComplete } : { isComplete: 0 }),
            title,
            description,
            difficulty,
            statTarget,
            dueDate: date ? format(date, "yyyy-MM-dd") : "",
            labels: finalLabels,
            subtasks,
            noteId,
            time
        } as Task);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:rounded-none max-sm:border-0 max-sm:p-0 bg-popover/95 backdrop-blur-xl border-border text-foreground shadow-2xl flex flex-col">
                <DialogHeader className="max-sm:px-4 max-sm:pt-4 max-sm:pb-2 shrink-0">
                    <DialogTitle className="text-xl font-light tracking-wide text-foreground/90">
                        {initialTask ? "Edit Task" : "New Task"}
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-5 sm:gap-6 py-3 sm:py-4 overflow-y-auto flex-1 max-sm:px-4 max-sm:pb-4">
                    {/* Title */}
                    <div className="grid gap-2">
                        <Label htmlFor="title" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Title
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-ring/30 h-10 sm:h-9 text-base sm:text-sm"
                            placeholder="What needs to be done?"
                            spellCheck={true}
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
                            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-ring/30 min-h-[80px] sm:min-h-[100px] resize-none text-base sm:text-sm"
                            placeholder="Add details..."
                            spellCheck={true}
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
                                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 text-sm sm:text-xs h-10 sm:h-8"
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
                                className="h-10 w-10 sm:h-8 sm:w-8 bg-muted hover:bg-muted border-border shrink-0"
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
                                    <div key={st.id} className="flex items-center justify-between group bg-muted/50 p-2 sm:p-1.5 rounded px-2">
                                        <span className="text-sm sm:text-xs text-foreground/80 truncate flex-1">{st.text}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 sm:h-5 sm:w-5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-muted hover:text-red-400 shrink-0"
                                            onClick={() => setSubtasks(subtasks.filter(s => s.id !== st.id))}
                                        >
                                            <X className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Difficulty */}
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

                    {/* Due Date & Time row */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-6">
                        {/* Due Date */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Due Date
                            </Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal bg-muted/50 border-border text-foreground hover:bg-muted hover:text-foreground h-10 sm:h-9 text-sm",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50 shrink-0" />
                                        <span className="truncate">{date ? format(date, "MMM d") : "Pick date"}</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-popover/95 backdrop-blur-xl border-border text-foreground min-w-[280px] sm:min-w-[320px]" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        initialFocus
                                        className="bg-transparent text-foreground [&_.group\/day]:!bg-transparent [&_button[data-selected-single=true]]:!bg-primary [&_button[data-selected-single=true]]:!text-primary-foreground"
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Time */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Time
                            </Label>
                            <Input
                                type="time"
                                value={time || ""}
                                onChange={(e) => setTime(e.target.value)}
                                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 h-10 sm:h-9 w-full"
                            />
                        </div>
                    </div>

                    {/* Note Link */}
                    <div className="grid gap-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Link to Note
                        </Label>
                        <Select
                            value={noteId ? String(noteId) : "none"}
                            onValueChange={(val) => setNoteId(val === "none" ? null : Number(val))}
                        >
                            <SelectTrigger className="bg-muted/50 border-border text-foreground h-10 sm:h-9">
                                <SelectValue placeholder="Select a note..." />
                            </SelectTrigger>
                            <SelectContent className="bg-popover/95 border-border text-foreground backdrop-blur-xl max-h-48 overflow-y-auto">
                                <SelectItem value="none" className="text-muted-foreground/60">None</SelectItem>
                                {allNotes.map(n => (
                                    <SelectItem key={n.id} value={String(n.id)}>
                                        {n.title || "Untitled Note"} <span className="text-xs text-muted-foreground/60 ml-2">({n.subjectTitle})</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                                        "h-9 sm:h-7 px-3 sm:px-2 text-sm sm:text-xs border-border/50 bg-transparent hover:bg-muted hover:text-foreground transition-all",
                                        statTarget.includes(stat.statName) && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-transparent"
                                    )}
                                >
                                    {stat.statName}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Untimed Toggle */}
                    <div className="flex items-center justify-between border border-border rounded-lg p-3 sm:p-3 bg-muted/50">
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
                    <Button onClick={handleSubmit} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto h-11 sm:h-9 text-base sm:text-sm">
                        Save Task
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
