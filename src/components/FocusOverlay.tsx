
import { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { Square, CheckCircle, Timer } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from "date-fns";
import { Button } from './ui/button';

export function FocusOverlay() {
    const [isHovered, setIsHovered] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const tasks = useStore(state => state.tasks);
    const activeTimers = useStore(state => state.activeTimers);
    const toggleTaskTimer = useStore(state => state.toggleTaskTimer);
    const stopTaskTimer = useStore(state => state.stopTaskTimer);
    const updateTask = useStore(state => state.updateTask);
    const setIsMurtazaMode = useStore(state => state.setIsMurtazaMode);

    // Use the first active timer for display if multiple are running, or none
    const activeTaskIds = Object.keys(activeTimers).map(Number);
    const activeTaskId = activeTaskIds.length > 0 ? activeTaskIds[0] : null;

    // Memoize active task lookup
    const activeTask = useMemo(() => tasks.find(t => t.id === activeTaskId), [tasks, activeTaskId]);
    const currentSessionDuration = activeTaskId ? activeTimers[activeTaskId] : 0;

    // Memoize available tasks to avoid recalculating on every render
    const availableTasks = useMemo(() => tasks.filter(t => !t.isComplete), [tasks]);

    useEffect(() => {
        if (!window.ipcRenderer) return;
        if (isHovered) {
            window.ipcRenderer.send('set-ignore-mouse-events', false);
        } else {
            window.ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
        }
    }, [isHovered]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleDoubleClick = () => {
        setIsMurtazaMode(false);
    };

    return (
        <div className="fixed inset-0 pointer-events-none flex justify-center items-start pt-4 z-[9999]">
            <motion.div
                ref={containerRef}
                className="pointer-events-auto"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onDoubleClick={handleDoubleClick}
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                layout
            >
                <div className="relative group flex flex-col items-center">
                    <AnimatePresence mode="wait">
                        {activeTask ? (
                            /* STATE 3: RUNNING */
                            <motion.div
                                key="running"
                                initial={{ opacity: 0, scale: 0.9, width: 'auto' }}
                                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className={cn(
                                    "flex items-center gap-4 px-4 py-2 rounded-full backdrop-blur-xl transition-all duration-150 border border-white/10 shadow-2xl overflow-hidden",
                                    isHovered ? "bg-black/95" : "bg-black/40"
                                )}
                                layout
                            >
                                <span className={cn(
                                    "font-mono text-xl font-bold tabular-nums tracking-wider min-w-[60px] text-center transition-all duration-150",
                                    isHovered ? "text-primary opacity-100" : "text-primary/30 blur-[0.5px]"
                                )}>
                                    {formatTime(currentSessionDuration)}
                                </span>

                                <div className={cn("h-4 w-[1px] bg-white/10 transition-opacity duration-150", !isHovered && "opacity-20")} />

                                <div className={cn("flex items-center gap-3 transition-all duration-150", isHovered ? "opacity-100" : "opacity-40 blur-[0.5px]")}>
                                    <span className="text-sm font-medium text-white/90 max-w-[200px] truncate select-none">
                                        {activeTask.title}
                                    </span>

                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            className="h-8 w-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/20"
                                            onClick={(e) => { e.stopPropagation(); if (activeTaskId) stopTaskTimer(activeTaskId); }}
                                            title="Stop Timer"
                                        >
                                            <Square className="h-3 w-3 fill-current" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            className="h-8 w-8 rounded-full bg-green-500/10 hover:bg-green-500/20 text-green-500 hover:text-green-400 border border-green-500/20"
                                            onClick={(e) => { e.stopPropagation(); updateTask({ ...activeTask, isComplete: 1 }); if (activeTaskId) stopTaskTimer(activeTaskId); }}
                                            title="Complete Task"
                                        >
                                            <CheckCircle className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            /* STATE 1 & 2: IDLE / SELECTOR */
                            <motion.div
                                key="idle"
                                className={cn(
                                    "flex flex-col rounded-3xl backdrop-blur-xl transition-all duration-150 border border-white/10 shadow-2xl overflow-hidden origin-top",
                                    isHovered ? "bg-black/95" : "bg-black/40"
                                )}
                                initial={{ width: 320, height: 'auto' }}
                                animate={{
                                    width: 320,
                                    padding: isHovered ? "12px 16px" : "8px 24px"
                                }}
                                layout
                            >
                                <div className={cn("relative flex items-center justify-between w-full cursor-pointer select-none h-6", isHovered && "mb-2")}>
                                    {/* Left: Version */}
                                    <AnimatePresence>
                                        {isHovered && (
                                            <motion.span
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 0.5, x: 0 }}
                                                exit={{ opacity: 0, x: -10 }}
                                                className="text-[10px] font-mono text-muted-foreground"
                                            >
                                                v{(__APP_VERSION__ || '5.0.0').split('.')[0]}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>

                                    {/* Center: Title */}
                                    <span className={cn(
                                        "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-bold transition-all duration-150",
                                        isHovered ? "text-primary opacity-100" : "text-primary/30 blur-[0.5px]"
                                    )}>
                                        مرتضیٰ
                                    </span>

                                    {/* Right: mOS */}
                                    <AnimatePresence>
                                        {isHovered && (
                                            <motion.span
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 0.5, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                                className="text-[10px] font-mono text-muted-foreground"
                                            >
                                                mOS
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <AnimatePresence>
                                    {isHovered && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="w-full"
                                        >
                                            <div className="h-[1px] w-full bg-white/5 mb-3" />
                                            <div className="text-[10px] font-semibold text-muted-foreground mb-2 px-1 uppercase tracking-wider flex items-center gap-1">
                                                <Timer className="w-3 h-3" />
                                                Select Task
                                            </div>
                                            <div className="h-[240px] w-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                                                <div className="flex flex-col gap-1 p-1">
                                                    {availableTasks.length > 0 ? availableTasks.map(task => (
                                                        <motion.button
                                                            layout
                                                            key={task.id}
                                                            onClick={() => { if (task.id) { toggleTaskTimer(task.id); setIsHovered(false); } }}
                                                            className="relative text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-sm text-white/90 transition-colors border border-transparent hover:border-white/5 w-full flex items-center gap-3 group overflow-hidden"
                                                            whileHover={{ scale: 1.02 }}
                                                            whileTap={{ scale: 0.98 }}
                                                        >
                                                            <div className={cn("w-1 h-8 rounded-full absolute left-0 top-1/2 -translate-y-1/2 transition-colors",
                                                                task.difficulty > 3 ? 'bg-red-500' : 'bg-primary/50 group-hover:bg-primary')} />

                                                            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                                                <span className="truncate font-medium">{task.title}</span>
                                                                {task.dueDate && (
                                                                    <span className="text-[10px] text-muted-foreground opacity-70">
                                                                        {format(new Date(task.dueDate), "MMM d")}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {task.difficulty && (
                                                                <span className="text-[10px] text-muted-foreground opacity-50 bg-black/20 px-1.5 py-0.5 rounded border border-white/5 flex-shrink-0">
                                                                    Lvl {task.difficulty}
                                                                </span>
                                                            )}
                                                        </motion.button>
                                                    )) : (
                                                        <div className="text-sm text-muted-foreground p-4 text-center italic">No tasks available</div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
