import { useMemo } from "react";
import { useStore } from "@/store";
import { cn, safeJSONParse } from "@/lib/utils";
import { Check, Circle } from "lucide-react";
import { motion } from "framer-motion";

export function HeaderPrayers({ compact = false }: { compact?: boolean }) {
    // todayLog, not dailyLog: browsing past dates in the calendar must never
    // change what these pills show or toggle.
    const todayLog = useStore(state => state.todayLog);
    const togglePrayer = useStore(state => state.togglePrayer);
    const prayers = ["Fajr", "Zuhr", "Asr", "Maghrib", "Isha"];

    const completedPrayers = useMemo(() => {
        return safeJSONParse<Record<string, boolean>>(todayLog?.prayersCompleted, {});
    }, [todayLog?.prayersCompleted]);

    return (
        <div className={cn(
            "flex items-center bg-secondary/50 rounded-full border border-border/50 backdrop-blur-xl shadow-lg shadow-black/5",
            compact ? "gap-0.5 px-2 py-1 max-w-full overflow-x-auto no-scrollbar" : "gap-2 px-5 py-2"
        )}>
            {prayers.map((prayer, index) => {
                const isCompleted = completedPrayers[prayer];
                return (
                    <motion.button
                        key={prayer}
                        initial={{ opacity: 0, scale: 0.8 }}
                        // Delay only the mount stagger — as a top-level transition
                        // it would also delay tap/hover feedback by up to 200ms.
                        animate={{ opacity: 1, scale: 1, transition: { delay: index * 0.05 } }}
                        // No y-lift in compact mode — inside an overflow-x-auto
                        // container the vertical translate would clip/jiggle.
                        whileHover={compact ? { scale: 1.05 } : { scale: 1.08, y: -2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => togglePrayer(prayer)}
                        aria-label={`${prayer} — ${isCompleted ? 'completed, tap to unmark' : 'not completed, tap to mark'}`}
                        aria-pressed={isCompleted}
                        className={cn(
                            "flex items-center gap-1.5 rounded-full text-xs font-semibold transition-colors duration-75 shrink-0",
                            compact ? "px-2.5 py-1.5" : "px-3 py-1.5",
                            isCompleted
                                ? "bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 dark:from-primary/20 dark:to-primary/30 text-emerald-600 dark:text-primary hover:from-emerald-500/30 hover:to-emerald-600/30 dark:hover:from-primary/30 dark:hover:to-primary/40 shadow-[0_0_15px_-3px_hsl(var(--primary)/0.3)]"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        )}
                    >
                        {isCompleted ? (
                            <Check className="w-3.5 h-3.5 drop-shadow-[0_0_3px_currentColor]" />
                        ) : (
                            <Circle className="w-3.5 h-3.5" />
                        )}
                        <span className="tracking-wide">{prayer}</span>
                    </motion.button>
                );
            })}
        </div>
    );
}
