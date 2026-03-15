import { useMemo } from "react";
import { useStore } from "@/store";
import { cn, safeJSONParse } from "@/lib/utils";
import { Check, Circle } from "lucide-react";
import { motion } from "framer-motion";

export function HeaderPrayers() {
    const dailyLog = useStore(state => state.dailyLog);
    const togglePrayer = useStore(state => state.togglePrayer);
    const prayers = ["Fajr", "Zuhr", "Asr", "Maghrib", "Isha"];

    const completedPrayers = useMemo(() => {
        return safeJSONParse<Record<string, boolean>>(dailyLog?.prayersCompleted, {});
    }, [dailyLog?.prayersCompleted]);

    return (
        <div className="flex items-center gap-2 bg-secondary/50 rounded-full px-5 py-2 border border-border/50 backdrop-blur-xl shadow-lg shadow-black/5">
            {prayers.map((prayer, index) => {
                const isCompleted = completedPrayers[prayer];
                return (
                    <motion.button
                        key={prayer}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.08, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => togglePrayer(prayer)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150",
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
