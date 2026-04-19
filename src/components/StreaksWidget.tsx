import { useEffect, useState, memo } from 'react';
import { useStore } from '@/store';
import { Streak } from '@/types';
import { Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

function useStreakDays(streak: Streak, now: Date) {
    const start = streak.createdAt ? new Date(streak.createdAt) : new Date(streak.lastUpdated || new Date());
    const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const effectiveNow = streak.isPaused ? new Date(streak.lastUpdated || new Date()) : now;
    const effectiveNowMidnight = new Date(effectiveNow.getFullYear(), effectiveNow.getMonth(), effectiveNow.getDate());
    return Math.max(0, Math.round((effectiveNowMidnight.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24)));
}

function getHeatColor(days: number) {
    if (days >= 30) return { text: "text-red-400", bg: "bg-red-400", border: "border-red-400/20", badgeBg: "bg-red-400/10", glow: "shadow-[0_0_8px_rgba(248,113,113,0.3)]" };
    if (days >= 7) return { text: "text-rose-500", bg: "bg-rose-500", border: "border-rose-500/20", badgeBg: "bg-rose-500/10", glow: "shadow-[0_0_6px_rgba(244,63,94,0.2)]" };
    return { text: "text-muted-foreground", bg: "bg-muted-foreground/30", border: "border-border/40", badgeBg: "bg-muted/50", glow: "" };
}

// Single streak - hero layout, fills the block
const StreakHero = memo(function StreakHero({ streak, now }: { streak: Streak; now: Date }) {
    const days = useStreakDays(streak, now);
    const heat = getHeatColor(days);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "lg:flex-1 flex flex-col items-center justify-center text-center rounded-xl border border-border/30 p-4 relative overflow-hidden",
                streak.isPaused && "opacity-40"
            )}
        >
            <div className={cn("absolute inset-0 opacity-[0.03] rounded-xl", heat.bg)} />
            {streak.isPaused ? <Pause className="h-4 w-4 text-muted-foreground mb-1" /> : null}
            <span className="text-3xl font-black tabular-nums tracking-tighter leading-none text-foreground">{days}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">days</span>
            <span className="text-sm font-medium text-foreground/90 mt-2">{streak.title}</span>
        </motion.div>
    );
});

// Two streaks - split layout, each takes half
const StreakHalf = memo(function StreakHalf({ streak, now }: { streak: Streak; now: Date }) {
    const days = useStreakDays(streak, now);
    const heat = getHeatColor(days);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "lg:flex-1 flex flex-col items-center justify-center text-center rounded-xl border border-border/30 p-3 relative overflow-hidden",
                streak.isPaused && "opacity-40"
            )}
        >
            <div className={cn("absolute inset-0 opacity-[0.03] rounded-xl", heat.bg)} />
            {streak.isPaused ? <Pause className="h-3 w-3 text-muted-foreground mb-0.5" /> : null}
            <span className="text-2xl font-black tabular-nums tracking-tighter leading-none text-foreground">{days}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">days</span>
            <span className="text-xs font-medium text-foreground/90 mt-1.5 truncate max-w-full">{streak.title}</span>
        </motion.div>
    );
});

// Three streaks - thirds layout
const StreakThird = memo(function StreakThird({ streak, now }: { streak: Streak; now: Date }) {
    const days = useStreakDays(streak, now);
    const heat = getHeatColor(days);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "lg:flex-1 flex flex-col items-center justify-center text-center rounded-lg border border-border/30 p-2 relative overflow-hidden",
                streak.isPaused && "opacity-40"
            )}
        >
            <div className={cn("absolute inset-0 opacity-[0.03] rounded-lg", heat.bg)} />
            <span className="text-xl font-black tabular-nums tracking-tighter leading-none text-foreground">{days}</span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">days</span>
            <span className="text-[11px] font-medium text-foreground/90 mt-1 truncate max-w-full">{streak.title}</span>
        </motion.div>
    );
});

// 4+ streaks - compact row layout
const StreakRow = memo(function StreakRow({ streak, now, index }: { streak: Streak; now: Date; index: number }) {
    const days = useStreakDays(streak, now);
    const heat = getHeatColor(days);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.03 }}
            className={cn(
                "flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/40 hover:bg-background/80 hover:border-border transition-all",
                streak.isPaused && "opacity-40"
            )}
        >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {streak.isPaused ? (
                    <Pause className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                    <div className={cn("h-7 w-1 rounded-full shrink-0", heat.bg, heat.glow)} />
                )}
                <span className="text-sm font-medium text-foreground/80 truncate">{streak.title}</span>
            </div>
            <span className={cn("text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full shrink-0 border", heat.badgeBg, heat.text, heat.border)}>
                {days}d
            </span>
        </motion.div>
    );
});

export function StreaksWidget() {
    const streaks = useStore(s => s.streaks);
    const fetchStreaks = useStore(s => s.fetchStreaks);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        fetchStreaks();
    }, [fetchStreaks]);

    useEffect(() => {
        const hasActive = streaks.some(s => !s.isPaused);
        if (!hasActive) return;
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, [streaks]);

    if (streaks.length === 0) return null;

    const sorted = [...streaks].sort((a, b) => {
        if (a.isPaused !== b.isPaused) return a.isPaused ? 1 : -1;
        return 0;
    });

    const count = sorted.length;

    // 1 streak: hero
    if (count === 1) {
        return <StreakHero streak={sorted[0]} now={now} />;
    }

    // 2 streaks: split halves
    if (count === 2) {
        return (
            <div className="flex gap-1.5 lg:flex-1">
                {sorted.map(s => <StreakHalf key={s.id} streak={s} now={now} />)}
            </div>
        );
    }

    // 3 streaks: thirds
    if (count === 3) {
        return (
            <div className="flex gap-1.5 lg:flex-1">
                {sorted.map(s => <StreakThird key={s.id} streak={s} now={now} />)}
            </div>
        );
    }

    // 4+ streaks: compact rows
    return (
        <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
                {sorted.map((streak, i) => (
                    <StreakRow key={streak.id} streak={streak} now={now} index={i} />
                ))}
            </AnimatePresence>
        </div>
    );
}
