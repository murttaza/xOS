import { useMemo, useState } from "react";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pause, Square, Maximize2, ChevronDown, ChevronUp } from "lucide-react";
import { useStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export function ActiveTaskTimer() {
    const tasks = useStore(state => state.tasks);
    const activeTimers = useStore(state => state.activeTimers);
    const isNotesMode = useStore(state => state.isNotesMode);
    const currentSubjectId = useStore(state => state.currentSubjectId);
    const setIsFocusMode = useStore(state => state.setIsFocusMode);
    const stopTaskTimer = useStore(state => state.stopTaskTimer);
    const toggleTaskTimer = useStore(state => state.toggleTaskTimer);
    const [isMinimized, setIsMinimized] = useState(false);

    // Memoize task map for O(1) lookups
    const taskMap = useMemo(() => {
        const map = new Map<number, typeof tasks[0]>();
        tasks.forEach(t => { if (t.id) map.set(t.id, t); });
        return map;
    }, [tasks]);

    const activeTaskIds = Object.keys(activeTimers).map(Number);

    // Hide timer if no active timers OR if a book is open in library mode
    if (activeTaskIds.length === 0 || (isNotesMode && currentSubjectId !== null)) return null;

    // Minimized: tiny floating pill
    if (isMinimized) {
        const firstTaskId = activeTaskIds[0];
        const firstDuration = activeTimers[firstTaskId] || 0;
        return (
            <div
                className={`fixed left-1/2 -translate-x-1/2 z-[100] no-drag pointer-events-none transition-all duration-150 ${isNotesMode ? 'bottom-20' : 'bottom-4'}`}
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="pointer-events-auto"
                >
                    <button
                        onClick={() => setIsMinimized(false)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-border shadow-lg backdrop-blur-2xl hover:border-primary/40 transition-all active:scale-95"
                    >
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft shadow-[0_0_6px_hsl(var(--primary))]" />
                        <span className="text-sm font-bold tabular-nums text-primary">
                            {formatTime(firstDuration)}
                        </span>
                        {activeTaskIds.length > 1 && (
                            <span className="text-[10px] text-muted-foreground">+{activeTaskIds.length - 1}</span>
                        )}
                        <ChevronUp className="h-3 w-3 text-muted-foreground" />
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div
            className={`fixed left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-[100] no-drag w-full max-w-2xl pointer-events-none transition-all duration-150 ${isNotesMode ? 'bottom-20' : 'bottom-6 sm:bottom-8'}`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
            <AnimatePresence mode="popLayout">
                {activeTaskIds.map((taskId) => {
                    const task = taskMap.get(taskId);
                    const duration = activeTimers[taskId] || 0;

                    if (!task) return null;

                    return (
                        <motion.div
                            key={taskId}
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            layout
                            className="pointer-events-auto w-full px-3 sm:px-6"
                        >
                            <div
                                className="glass border border-border shadow-2xl shadow-black/20 backdrop-blur-2xl cursor-pointer group hover:border-primary/40 dark:hover:border-primary/30 transition-all duration-150 rounded-2xl overflow-hidden"
                                onClick={() => setIsFocusMode(true)}
                            >
                                {/* Animated background gradient */}
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />

                                <CardContent className="relative p-3 sm:p-4 sm:pl-6 sm:pr-4 flex items-center justify-between gap-3 sm:gap-8">
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-primary animate-pulse-soft shadow-[0_0_8px_hsl(var(--primary))]" />
                                            <span className="text-[11px] font-bold text-primary uppercase tracking-widest">Active</span>
                                            <span className="text-[11px] text-muted-foreground truncate">• {Array.isArray(task.statTarget) ? task.statTarget.join(", ") : task.statTarget}</span>
                                        </div>
                                        <h3 className="font-bold text-sm sm:text-base truncate leading-tight text-foreground group-hover:text-primary transition-colors">
                                            {task.title}
                                        </h3>
                                    </div>

                                    <div className="text-xl sm:text-4xl font-bold tracking-tighter tabular-nums text-primary drop-shadow-[0_0_15px_hsl(var(--primary)/0.5)] shrink-0">
                                        {formatTime(duration)}
                                    </div>

                                    <div className="flex gap-1 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 sm:h-12 sm:w-12 rounded-full hover:bg-muted transition-all hover:scale-[1.08] active:scale-[0.92]"
                                            onClick={() => setIsMinimized(true)}
                                            title="Minimize timer"
                                        >
                                            <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9 sm:h-12 sm:w-12 rounded-full border-2 border-primary/30 bg-primary/5 hover:bg-primary/15 hover:text-primary hover:border-primary/50 transition-all shadow-[0_0_12px_-3px_hsl(var(--primary)/0.3)] hover:scale-[1.08] active:scale-[0.92]"
                                            onClick={() => toggleTaskTimer(taskId)}
                                        >
                                            <Pause className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 sm:h-12 sm:w-12 rounded-full hover:bg-destructive/20 dark:hover:bg-destructive/15 hover:text-destructive transition-all hover:scale-[1.08] active:scale-[0.92]"
                                            onClick={() => stopTaskTimer(taskId)}
                                        >
                                            <Square className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 sm:h-12 sm:w-12 rounded-full hover:bg-muted transition-all hover:scale-[1.08] active:scale-[0.92] hidden sm:flex"
                                            onClick={() => setIsFocusMode(true)}
                                        >
                                            <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
