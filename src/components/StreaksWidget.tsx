import { useEffect, useState, useMemo, memo } from 'react';
import { useStore } from '@/store';
import { Streak } from '@/types';
import { Pause, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Synthetic streak source — either a manual streak entry, or a repeating task with a streak count.
type StreakLike =
    | { kind: 'manual'; streak: Streak }
    | { kind: 'repeating'; id: number; title: string; days: number };

function computeStreakDays(streak: Streak, now: Date) {
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

// Resolve a StreakLike into the values used for rendering
function resolve(item: StreakLike, now: Date): { days: number; title: string; isPaused: boolean; isRepeating: boolean } {
    if (item.kind === 'manual') {
        return {
            days: computeStreakDays(item.streak, now),
            title: item.streak.title,
            isPaused: !!item.streak.isPaused,
            isRepeating: false,
        };
    }
    return { days: item.days, title: item.title, isPaused: false, isRepeating: true };
}

// Single streak - hero layout, fills the block
const StreakHero = memo(function StreakHero({ item, now }: { item: StreakLike; now: Date }) {
    const { days, title, isPaused, isRepeating } = resolve(item, now);
    const heat = getHeatColor(days);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "lg:flex-1 flex flex-col items-center justify-center text-center rounded-xl border border-border/30 p-4 relative overflow-hidden",
                isPaused && "opacity-40"
            )}
        >
            <div className={cn("absolute inset-0 opacity-[0.03] rounded-xl", heat.bg)} />
            {isPaused ? <Pause className="h-4 w-4 text-muted-foreground mb-1" /> : null}
            <span className="text-3xl font-black tabular-nums tracking-tighter leading-none text-foreground">{days}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">days</span>
            <span className="text-sm font-medium text-foreground/90 mt-2 flex items-center gap-1.5">
                {isRepeating && <Repeat className="h-3 w-3 text-muted-foreground" />}
                {title}
            </span>
        </motion.div>
    );
});

// Two streaks - split layout, each takes half
const StreakHalf = memo(function StreakHalf({ item, now }: { item: StreakLike; now: Date }) {
    const { days, title, isPaused, isRepeating } = resolve(item, now);
    const heat = getHeatColor(days);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "lg:flex-1 flex flex-col items-center justify-center text-center rounded-xl border border-border/30 p-3 relative overflow-hidden",
                isPaused && "opacity-40"
            )}
        >
            <div className={cn("absolute inset-0 opacity-[0.03] rounded-xl", heat.bg)} />
            {isPaused ? <Pause className="h-3 w-3 text-muted-foreground mb-0.5" /> : null}
            <span className="text-2xl font-black tabular-nums tracking-tighter leading-none text-foreground">{days}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">days</span>
            <span className="text-xs font-medium text-foreground/90 mt-1.5 truncate max-w-full flex items-center gap-1">
                {isRepeating && <Repeat className="h-2.5 w-2.5 text-muted-foreground shrink-0" />}
                <span className="truncate">{title}</span>
            </span>
        </motion.div>
    );
});

// Three streaks - thirds layout
const StreakThird = memo(function StreakThird({ item, now }: { item: StreakLike; now: Date }) {
    const { days, title, isPaused, isRepeating } = resolve(item, now);
    const heat = getHeatColor(days);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "lg:flex-1 flex flex-col items-center justify-center text-center rounded-lg border border-border/30 p-2 relative overflow-hidden",
                isPaused && "opacity-40"
            )}
        >
            <div className={cn("absolute inset-0 opacity-[0.03] rounded-lg", heat.bg)} />
            <span className="text-xl font-black tabular-nums tracking-tighter leading-none text-foreground">{days}</span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">days</span>
            <span className="text-[11px] font-medium text-foreground/90 mt-1 truncate max-w-full flex items-center gap-1">
                {isRepeating && <Repeat className="h-2.5 w-2.5 text-muted-foreground shrink-0" />}
                <span className="truncate">{title}</span>
            </span>
        </motion.div>
    );
});

// 4+ streaks - compact row layout
const StreakRow = memo(function StreakRow({ item, now, index }: { item: StreakLike; now: Date; index: number }) {
    const { days, title, isPaused, isRepeating } = resolve(item, now);
    const heat = getHeatColor(days);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.03 }}
            className={cn(
                "flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/40 hover:bg-background/80 hover:border-border transition-all",
                isPaused && "opacity-40"
            )}
        >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {isPaused ? (
                    <Pause className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                    <div className={cn("h-7 w-1 rounded-full shrink-0", heat.bg, heat.glow)} />
                )}
                {isRepeating && <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />}
                <span className="text-sm font-medium text-foreground/80 truncate">{title}</span>
            </div>
            <span className={cn("text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full shrink-0 border", heat.badgeBg, heat.text, heat.border)}>
                {days}d
            </span>
        </motion.div>
    );
});

function keyFor(item: StreakLike): string {
    return item.kind === 'manual' ? `m-${item.streak.id}` : `r-${item.id}`;
}

export function StreaksWidget() {
    const streaks = useStore(s => s.streaks);
    const repeatingTasks = useStore(s => s.repeatingTasks);
    const fetchStreaks = useStore(s => s.fetchStreaks);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        fetchStreaks();
    }, [fetchStreaks]);

    // Combined list: manual streaks + repeating tasks with an active streak
    const items = useMemo<StreakLike[]>(() => {
        const manual: StreakLike[] = streaks.map(s => ({ kind: 'manual' as const, streak: s }));
        const repeating: StreakLike[] = repeatingTasks
            .filter(rt => rt.isActive && (rt.streak ?? 0) > 0 && rt.id != null)
            .map(rt => ({ kind: 'repeating' as const, id: rt.id!, title: rt.title, days: rt.streak ?? 0 }));
        // Repeating goes after manual streaks; within each, sort paused last (manual only)
        const sortedManual = [...manual].sort((a, b) => {
            const ap = a.kind === 'manual' && a.streak.isPaused ? 1 : 0;
            const bp = b.kind === 'manual' && b.streak.isPaused ? 1 : 0;
            return ap - bp;
        });
        // Sort repeating by days desc so longest streak surfaces first
        const sortedRepeating = [...repeating].sort((a, b) => {
            const ad = a.kind === 'repeating' ? a.days : 0;
            const bd = b.kind === 'repeating' ? b.days : 0;
            return bd - ad;
        });
        return [...sortedManual, ...sortedRepeating];
    }, [streaks, repeatingTasks]);

    useEffect(() => {
        const hasActive = items.some(i => i.kind === 'manual' ? !i.streak.isPaused : true);
        if (!hasActive) return;
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, [items]);

    if (items.length === 0) return null;

    const count = items.length;

    // 1 streak: hero
    if (count === 1) {
        return <StreakHero item={items[0]} now={now} />;
    }

    // 2 streaks: split halves
    if (count === 2) {
        return (
            <div className="flex gap-1.5 lg:flex-1">
                {items.map(i => <StreakHalf key={keyFor(i)} item={i} now={now} />)}
            </div>
        );
    }

    // 3 streaks: thirds
    if (count === 3) {
        return (
            <div className="flex gap-1.5 lg:flex-1">
                {items.map(i => <StreakThird key={keyFor(i)} item={i} now={now} />)}
            </div>
        );
    }

    // 4+ streaks: compact rows
    return (
        <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
                {items.map((item, i) => (
                    <StreakRow key={keyFor(item)} item={item} now={now} index={i} />
                ))}
            </AnimatePresence>
        </div>
    );
}
