import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";
import { useStore } from "@/store";
import { motion } from "framer-motion";

export function PomodoroBlock() {
    const pomodoroTime = useStore(state => state.pomodoroTime);
    const isPomodoroRunning = useStore(state => state.isPomodoroRunning);
    const setPomodoroTime = useStore(state => state.setPomodoroTime);
    const setIsPomodoroRunning = useStore(state => state.setIsPomodoroRunning);

    // Use refs to access current values without triggering effect re-runs
    const pomodoroTimeRef = useRef(pomodoroTime);
    pomodoroTimeRef.current = pomodoroTime;

    useEffect(() => {
        if (!isPomodoroRunning) return;

        const interval = setInterval(() => {
            const currentTime = pomodoroTimeRef.current;
            if (currentTime > 0) {
                setPomodoroTime(currentTime - 1);
            } else {
                setIsPomodoroRunning(false);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isPomodoroRunning, setPomodoroTime, setIsPomodoroRunning]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleReset = () => {
        setIsPomodoroRunning(false);
        setPomodoroTime(25 * 60);
    };

    const progress = ((25 * 60 - pomodoroTime) / (25 * 60)) * 100;

    return (
        <div className="px-6 py-4 flex flex-col gap-3">
            {/* Timer and controls in compact row */}
            <div className="flex items-center justify-between gap-3">
                <motion.div
                    className="text-3xl font-bold tracking-tighter tabular-nums text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                    animate={{
                        scale: isPomodoroRunning ? [1, 1.015, 1] : 1
                    }}
                    transition={{
                        duration: 1,
                        repeat: isPomodoroRunning ? Infinity : 0
                    }}
                >
                    {formatTime(pomodoroTime)}
                </motion.div>

                <div className="flex gap-2">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-full border-2 border-primary/30 hover:bg-primary/10 hover:border-primary/60 transition-all shadow-[0_0_10px_-3px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_15px_-3px_hsl(var(--primary)/0.5)]"
                            onClick={() => setIsPomodoroRunning(!isPomodoroRunning)}
                        >
                            {isPomodoroRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                        </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
                            onClick={handleReset}
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                    </motion.div>
                </div>
            </div>

            {/* Thin horizontal progress bar */}
            <div className="relative w-full">
                {/* Background track */}
                <div className="h-2 w-full bg-secondary/50 dark:bg-secondary/30 rounded-full border border-border/50 overflow-hidden">
                    {/* Animated progress fill */}
                    <motion.div
                        className="h-full bg-gradient-to-r from-primary via-primary to-primary/80 rounded-full shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>

                {/* Progress percentage label */}
                <div className="absolute -top-5 right-0 text-[10px] font-mono text-muted-foreground">
                    {Math.round(progress)}%
                </div>
            </div>
        </div>
    );
}
