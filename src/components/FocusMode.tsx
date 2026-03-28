import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Minimize2, RotateCcw } from "lucide-react";
import { useStore } from "@/store";
import { motion } from "framer-motion";
import { WindowControls } from "@/components/WindowControls";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { ModeToggle } from "@/components/ModeToggle";
import { useTheme } from "@/components/ThemeProvider";
import { useWindowFocus } from "@/hooks/useWindowFocus";
import { useShallow } from 'zustand/react/shallow';
import { cn } from "@/lib/utils";
import { isElectron } from "@/lib/platform";

const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export function FocusMode() {
    const { theme } = useTheme();
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const {
        stopTaskTimer, setIsFocusMode, toggleTaskTimer,
        setPomodoroTime, setIsPomodoroRunning,
    } = useStore(useShallow(state => ({
        stopTaskTimer: state.stopTaskTimer,
        setIsFocusMode: state.setIsFocusMode,
        toggleTaskTimer: state.toggleTaskTimer,
        setPomodoroTime: state.setPomodoroTime,
        setIsPomodoroRunning: state.setIsPomodoroRunning,
    })));

    const tasks = useStore(state => state.tasks);
    const activeTimers = useStore(state => state.activeTimers);
    const pomodoroTime = useStore(state => state.pomodoroTime);
    const isPomodoroRunning = useStore(state => state.isPomodoroRunning);
    const isMurtazaMode = useStore(state => state.isMurtazaMode);

    const isWindowFocused = useWindowFocus();

    const activeTaskIds = Object.keys(activeTimers).map(Number);
    const activeTaskId = activeTaskIds.length > 0 ? activeTaskIds[0] : null;
    const activeTask = tasks.find(t => t.id === activeTaskId);
    const textDuration = activeTaskId ? activeTimers[activeTaskId] : 0;

    // Use ref to access current time without triggering effect re-runs
    const pomodoroTimeRef = useRef(pomodoroTime);
    pomodoroTimeRef.current = pomodoroTime;

    // Track the initial duration for accurate progress display
    const pomodoroDurationRef = useRef(25 * 60);

    // Pomodoro presets in minutes
    const POMODORO_PRESETS = [15, 25, 50];

    // Pomodoro timer countdown - optimized to not recreate interval every second
    useEffect(() => {
        if (!isPomodoroRunning) return;

        const interval = setInterval(() => {
            const currentTime = pomodoroTimeRef.current;
            if (currentTime > 0) {
                setPomodoroTime(currentTime - 1);
            } else {
                setIsPomodoroRunning(false);
                // Notification when Pomodoro ends
                try {
                    if (Notification.permission === 'granted') {
                        new Notification('Pomodoro Complete', {
                            body: 'Time for a break!',
                            silent: false
                        });
                    } else if (Notification.permission !== 'denied') {
                        Notification.requestPermission();
                    }
                    // Play a subtle audio ping
                    const audioCtx = new AudioContext();
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.frequency.value = 800;
                    osc.type = 'sine';
                    gain.gain.value = 0.15;
                    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
                    osc.start();
                    osc.stop(audioCtx.currentTime + 1.5);
                } catch (e) {
                    // Audio context may fail in some environments
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isPomodoroRunning, setPomodoroTime, setIsPomodoroRunning]);

    const handleStop = async () => {
        if (activeTaskId) {
            await stopTaskTimer(activeTaskId);
        }
        setIsFocusMode(false);
    };

    const handleResetPomodoro = () => {
        setIsPomodoroRunning(false);
        setPomodoroTime(25 * 60);
    };

    const handleSetPreset = (minutes: number) => {
        setIsPomodoroRunning(false);
        setPomodoroTime(minutes * 60);
        pomodoroDurationRef.current = minutes * 60;
    };

    if (!activeTask) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
                <h1 className="text-4xl font-bold mb-4">No Active Task</h1>
                <Button onClick={() => setIsFocusMode(false)}>Exit Focus Mode</Button>
            </div>
        );
    }

    if (!isPomodoroRunning && pomodoroTime > 0 && pomodoroTime !== pomodoroDurationRef.current) {
        // Update duration ref when a new preset is selected
        const matchingPreset = POMODORO_PRESETS.find(p => p * 60 === pomodoroTime);
        if (matchingPreset) pomodoroDurationRef.current = matchingPreset * 60;
    }
    const pomodoroProgress = Math.max(0, ((pomodoroDurationRef.current - pomodoroTime) / pomodoroDurationRef.current) * 100);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
                "fixed inset-0 z-50 text-foreground flex flex-col transition-colors duration-150 drag p-4 sm:p-8 lg:p-12",
                isDark ? "dark" : "",
                isMurtazaMode && isElectron ? "bg-transparent" : isDark ? "bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" : "bg-stone-100"
            )}
        >
            {/* Top Toolbar */}
            <div className="absolute left-0 right-0 px-4 sm:px-6 flex justify-between items-start z-50 no-drag pointer-events-none" style={{ top: 'max(env(safe-area-inset-top, 0px), 16px)' }}>
                {/* Left: Exit button */}
                <div className="pointer-events-auto bg-black/5 dark:bg-black/20 backdrop-blur-md border border-black/5 dark:border-white/5 rounded-full p-1.5 flex items-center gap-1 hover:bg-black/10 dark:hover:bg-black/40 transition-all duration-150 shadow-sm">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsFocusMode(false)}
                        className="h-9 w-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground"
                        title="Exit Focus Mode"
                    >
                        <Minimize2 className="h-4 w-4" />
                    </Button>
                </div>

                {/* Right: Window Controls + Theme toggle */}
                <div className="pointer-events-auto flex items-center gap-3">
                    <div className="bg-black/5 dark:bg-black/20 backdrop-blur-md border border-black/5 dark:border-white/5 rounded-full p-1.5 flex items-center gap-1 hover:bg-black/10 dark:hover:bg-black/40 transition-all duration-150 shadow-sm">
                        <ModeToggle />
                        {isElectron && <><div className="w-px h-5 bg-black/10 dark:bg-white/10 mx-1" /><WindowControls /></>}
                    </div>
                </div>
            </div>

            {/* Main content area - session timer (always centered) */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 z-10">
                <div className="text-center space-y-4 sm:space-y-8">
                    <div className="space-y-1 sm:space-y-3">
                        <h2 className="text-xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50 pb-1 sm:pb-2 max-w-3xl mx-auto">{activeTask.title}</h2>
                        <p className="text-sm sm:text-xl text-muted-foreground font-light">{Array.isArray(activeTask.statTarget) ? activeTask.statTarget.join(", ") : activeTask.statTarget} • Difficulty: {activeTask.difficulty}</p>
                    </div>

                    <div className={`text-[5rem] sm:text-[8rem] lg:text-[15rem] font-bold leading-none tracking-tighter tabular-nums text-primary drop-shadow-[0_0_30px_rgba(var(--primary),0.4)] ${isMurtazaMode && isElectron ? 'border border-border rounded-3xl px-8 sm:px-12 py-3 sm:py-4 bg-background/20 backdrop-blur-sm' : ''}`}>
                        {formatTime(textDuration)}
                    </div>

                    <div className="flex gap-4 sm:gap-8 justify-center no-drag">
                        <Button
                            variant="outline"
                            size="lg"
                            className="h-16 w-16 sm:h-24 sm:w-24 lg:h-32 lg:w-32 rounded-full border-2 border-primary/20 hover:bg-primary/10 hover:border-primary/50 transition-all duration-150"
                            onClick={() => toggleTaskTimer(activeTaskId!)}
                        >
                            <Pause className="h-6 w-6 sm:h-10 sm:w-10 lg:h-12 lg:w-12" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="lg"
                            className="h-16 w-16 sm:h-24 sm:w-24 lg:h-32 lg:w-32 rounded-full hover:bg-destructive/20 hover:text-destructive transition-all duration-150"
                            onClick={handleStop}
                        >
                            <Square className="h-6 w-6 sm:h-10 sm:w-10 lg:h-12 lg:w-12" />
                        </Button>
                    </div>
                </div>
            </div>


            {/* Audio Visualizer - Vertical on Left - Centered Vertically */}
            <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="hidden lg:flex absolute left-0 top-24 bottom-24 w-64 no-drag items-center bg-gradient-to-r from-background to-transparent z-0"
            >
                <div className="w-full h-full opacity-60 hover:opacity-100 transition-opacity duration-150">
                    <AudioVisualizer
                        isActive={true}
                        barCount={80}
                        orientation="vertical"
                        className="h-full w-full"
                        isWindowFocused={isWindowFocused}
                    />
                </div>
            </motion.div>

            {/* Pomodoro bar at bottom (always visible) */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="w-full p-3 pb-4 sm:p-6 sm:pb-8"
            >
                <div className={`max-w-2xl mx-auto rounded-2xl p-3 sm:p-4 border border-border backdrop-blur-xl ${isMurtazaMode ? 'bg-background/20' : 'glass'}`}>
                    {/* Row 1: timer + progress bar */}
                    <div className="flex items-center gap-3 sm:gap-6">
                        <motion.div
                            className="text-2xl sm:text-3xl font-bold tracking-tighter tabular-nums text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)] shrink-0"
                            animate={{ scale: isPomodoroRunning ? [1, 1.015, 1] : 1 }}
                            transition={{ duration: 1, repeat: isPomodoroRunning ? Infinity : 0 }}
                        >
                            {formatTime(pomodoroTime)}
                        </motion.div>

                        <div className="flex-1 relative">
                            <div className="h-2 w-full bg-secondary/50 dark:bg-secondary/30 rounded-full border border-border overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-primary via-primary to-primary/80 rounded-full shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pomodoroProgress}%` }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                            </div>
                            <div className="absolute -top-5 right-0 text-[10px] font-mono text-muted-foreground">
                                {Math.round(pomodoroProgress)}%
                            </div>
                        </div>

                        {/* Play/pause always visible */}
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border-2 border-primary/30 hover:bg-primary/10 hover:border-primary/60 transition-all shadow-[0_0_10px_-3px_hsl(var(--primary)/0.3)] hover:scale-105 active:scale-95 shrink-0 no-drag"
                            onClick={() => setIsPomodoroRunning(!isPomodoroRunning)}
                        >
                            {isPomodoroRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                        </Button>
                    </div>

                    {/* Row 2: preset buttons + reset */}
                    <div className="flex items-center gap-1 mt-2 no-drag">
                        {POMODORO_PRESETS.map(preset => {
                            const isActive = !isPomodoroRunning && pomodoroTime === preset * 60;
                            return (
                                <Button
                                    key={preset}
                                    variant="ghost"
                                    size="sm"
                                    className={`h-7 px-2.5 rounded-full text-xs font-mono transition-all ${
                                        isActive
                                            ? 'bg-primary/20 text-primary border border-primary/30'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                    onClick={() => handleSetPreset(preset)}
                                >
                                    {preset}m
                                </Button>
                            );
                        })}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all hover:scale-105 active:scale-95 ml-auto"
                            onClick={handleResetPomodoro}
                        >
                            <RotateCcw className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </motion.div>
        </motion.div >
    );
}
