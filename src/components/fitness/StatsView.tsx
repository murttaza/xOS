import { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Flame, TrendingUp, TrendingDown, Heart, Skull, Trophy, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Sparkline } from './Sparkline';
import {
    useLoggedExercises,
    useExerciseHistory,
    useMostImprovedLift,
    useFavouriteLifts,
    useLeastLovedLift,
    useVolumePerWeek,
    useCurrentStreak,
    useEstimatedOneRM,
} from '../../hooks/useFitnessStats';

const PR_LIFTS = [
    { key: 'Bench Press', color: '#22c55e' },
    { key: 'Back Squat', color: '#eab308' },
    { key: 'Conventional Deadlift', color: '#ef4444' },
];

export function StatsView() {
    const allExerciseLogs = useStore(s => s.allExerciseLogs);
    const exercises = useStore(s => s.exercises);
    const bodyMetrics = useStore(s => s.bodyMetrics);

    const loggedExercises = useLoggedExercises();
    const mostImproved = useMostImprovedLift();
    const favourites = useFavouriteLifts(3);
    const leastLoved = useLeastLovedLift();
    const streak = useCurrentStreak();
    const [selectedExerciseKey, setSelectedExerciseKey] = useState<string | null>(null);
    const [chartRange, setChartRange] = useState<'4w' | '12w' | 'all'>('12w');
    const [volumeRange, setVolumeRange] = useState<'4w' | '12w' | 'all'>('12w');

    // Default the per-exercise chart to the most recently logged exercise.
    const effectiveSelectedKey = selectedExerciseKey || loggedExercises[0]?.exerciseId || loggedExercises[0]?.programExerciseId || null;
    const exerciseHistory = useExerciseHistory(effectiveSelectedKey, chartRange);
    const oneRM = useEstimatedOneRM(effectiveSelectedKey);

    const volume = useVolumePerWeek(volumeRange);

    // PR lift data — match canonical exercise names to exercise rows.
    const prCards = useMemo(() => PR_LIFTS.map(pr => {
        const exercise = exercises.find(e => e.name === pr.key);
        if (!exercise) return null;
        return { ...pr, exerciseId: exercise.id };
    }).filter(Boolean) as { key: string; color: string; exerciseId: string }[], [exercises]);

    // Body weight chart data.
    const bodyWeight = useMemo(() => {
        return bodyMetrics
            .filter(m => m.body_weight)
            .map(m => ({ date: m.date, value: Number(m.body_weight) }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [bodyMetrics]);

    if (allExerciseLogs.length < 3) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
                <div className="border border-dashed border-border rounded-2xl p-8 text-center space-y-3">
                    <Activity className="h-10 w-10 mx-auto text-muted-foreground/40" />
                    <h2 className="text-base font-bold">Stats unlock with data</h2>
                    <p className="text-sm text-muted-foreground">Log a few workouts and your trends, PRs, and most-improved lifts will appear here.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-4">
            <h2 className="text-lg font-bold">Your Stats</h2>

            {/* Streak banner */}
            {streak > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 border border-orange-500/30 dark:border-orange-400/30 bg-orange-500/10 dark:bg-orange-500/15 rounded-2xl p-4"
                >
                    <Flame className="h-6 w-6 text-orange-500 dark:text-orange-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-base font-bold">{streak}-session streak</p>
                        <p className="text-xs text-muted-foreground">Don't break the chain.</p>
                    </div>
                </motion.div>
            )}

            {/* PR Carousel */}
            {prCards.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Personal Records</p>
                    <div className="flex gap-3 overflow-x-auto snap-x no-scrollbar -mx-4 px-4 pb-1">
                        {prCards.map(pr => (
                            <PRCard key={pr.key} name={pr.key} color={pr.color} exerciseId={pr.exerciseId} />
                        ))}
                    </div>
                </div>
            )}

            {/* Most Improved + Favourite + Least-Loved */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mostImproved && (
                    <div className="border border-border rounded-2xl p-4 space-y-2 sm:col-span-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Most Improved</p>
                                <p className="text-sm font-bold truncate">{mostImproved.name}</p>
                                <p className="text-xs text-muted-foreground">{mostImproved.firstAvg} → {mostImproved.lastAvg} lb avg</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className={cn(
                                    "text-2xl font-bold",
                                    mostImproved.pctGain >= 0 ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400"
                                )}>
                                    {mostImproved.pctGain >= 0 ? '+' : ''}{mostImproved.pctGain}%
                                </span>
                                <Sparkline data={mostImproved.sparkline} color="#22c55e" width={64} height={28} />
                            </div>
                        </div>
                    </div>
                )}

                {favourites[0] && (
                    <div className="border border-border rounded-2xl p-4 space-y-1">
                        <div className="flex items-center gap-2 text-pink-500 dark:text-pink-400">
                            <Heart className="h-3.5 w-3.5" />
                            <p className="text-[10px] uppercase tracking-wider font-semibold">Favourite Lift</p>
                        </div>
                        <p className="text-sm font-bold truncate">{favourites[0].name}</p>
                        <p className="text-xs text-muted-foreground">{favourites[0].count} sessions</p>
                    </div>
                )}

                {leastLoved && (
                    <div className="border border-border rounded-2xl p-4 space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Skull className="h-3.5 w-3.5" />
                            <p className="text-[10px] uppercase tracking-wider font-semibold">Least Loved</p>
                        </div>
                        <p className="text-sm font-bold truncate">{leastLoved.name}</p>
                        <p className="text-xs text-muted-foreground">Skipped {leastLoved.expected - leastLoved.logged}/{leastLoved.expected}</p>
                    </div>
                )}
            </div>

            {/* Per-exercise weight chart */}
            {loggedExercises.length > 0 && (
                <div className="border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Exercise Trend</p>
                            <select
                                value={effectiveSelectedKey || ''}
                                onChange={e => setSelectedExerciseKey(e.target.value)}
                                className="text-sm font-bold bg-transparent border-0 outline-none cursor-pointer truncate w-full -ml-1 [&>option]:bg-popover [&>option]:text-popover-foreground"
                            >
                                {loggedExercises.map(le => (
                                    <option key={le.exerciseId || le.programExerciseId} value={(le.exerciseId || le.programExerciseId) as string}>
                                        {le.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {oneRM && (
                            <div className="text-right shrink-0">
                                <p className="text-[10px] text-muted-foreground">e1RM</p>
                                <p className="text-lg font-bold font-mono">{oneRM} <span className="text-xs text-muted-foreground">lb</span></p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-1.5">
                        {(['4w', '12w', 'all'] as const).map(r => (
                            <button
                                key={r}
                                onClick={() => setChartRange(r)}
                                className={cn(
                                    "h-7 px-3 text-xs rounded-full border transition-colors",
                                    chartRange === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/30"
                                )}
                            >
                                {r === 'all' ? 'All' : r}
                            </button>
                        ))}
                    </div>

                    {exerciseHistory.length > 1 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={exerciseHistory}>
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => new Date(v + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                                <YAxis tick={{ fontSize: 10 }} width={40} domain={['auto', 'auto']} />
                                <Tooltip
                                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                                    labelFormatter={v => new Date(v + 'T00:00:00').toLocaleDateString()}
                                    formatter={(val, name) => [`${val} lb`, String(name) === 'weight' ? 'Working set' : 'e1RM']}
                                />
                                <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
                                <Line type="monotone" dataKey="e1rm" stroke="#a855f7" strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-xs text-muted-foreground text-center py-6">Log this exercise more to see a trend.</p>
                    )}
                </div>
            )}

            {/* Volume per week */}
            {volume.length > 0 && (
                <div className="border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Weekly Volume</p>
                        <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex gap-1.5">
                        {(['4w', '12w', 'all'] as const).map(r => (
                            <button
                                key={r}
                                onClick={() => setVolumeRange(r)}
                                className={cn(
                                    "h-7 px-3 text-xs rounded-full border transition-colors",
                                    volumeRange === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/30"
                                )}
                            >
                                {r === 'all' ? 'All' : r}
                            </button>
                        ))}
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={volume}>
                            <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} tickFormatter={v => new Date(v + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                            <YAxis tick={{ fontSize: 10 }} width={50} />
                            <Tooltip
                                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                                labelFormatter={v => `Week of ${new Date(v + 'T00:00:00').toLocaleDateString()}`}
                                formatter={(val: any) => [`${Math.round(Number(val)).toLocaleString()} lb`, 'Volume']}
                            />
                            <Bar dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Body weight mini-chart */}
            {bodyWeight.length > 1 && (
                <div className="border border-border rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Body Weight</p>
                    <ResponsiveContainer width="100%" height={120}>
                        <LineChart data={bodyWeight}>
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => new Date(v + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                            <YAxis tick={{ fontSize: 9 }} width={32} domain={['auto', 'auto']} />
                            <Tooltip
                                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--popover))' }}
                                labelFormatter={v => new Date(v + 'T00:00:00').toLocaleDateString()}
                            />
                            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Other favourites (#2 and #3) */}
            {favourites.length > 1 && (
                <div className="border border-border rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Top Lifts by Volume of Sessions</p>
                    <div className="space-y-1.5">
                        {favourites.map((f, i) => (
                            <div key={f.exerciseId} className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                                    <span className="truncate">{f.name}</span>
                                </span>
                                <span className="text-xs text-muted-foreground font-mono shrink-0">{f.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function PRCard({ name, color, exerciseId }: { name: string; color: string; exerciseId: string }) {
    const oneRM = useEstimatedOneRM(exerciseId);
    const history = useExerciseHistory(exerciseId, 'all');
    // Trend: compare e1RM 4 weeks ago vs latest.
    const trend = useMemo(() => {
        if (history.length < 2) return null;
        const latest = history[history.length - 1].e1rm;
        if (!latest) return null;
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        const cutoffStr = fourWeeksAgo.toISOString().slice(0, 10);
        const past = [...history].reverse().find(h => h.date <= cutoffStr);
        if (!past?.e1rm) return null;
        return Math.round((latest - past.e1rm) * 10) / 10;
    }, [history]);

    return (
        <div className="min-w-[220px] snap-start border border-border rounded-2xl p-4 space-y-2 shrink-0">
            <p className="text-xs font-semibold truncate">{name}</p>
            {oneRM ? (
                <>
                    <p className="text-2xl font-bold font-mono" style={{ color }}>
                        {oneRM} <span className="text-sm text-muted-foreground font-sans">lb</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">e1RM (Epley)</p>
                    {trend !== null && (
                        <div className={cn(
                            "flex items-center gap-1 text-xs font-medium",
                            trend > 0 ? "text-green-500 dark:text-green-400" : trend < 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground"
                        )}>
                            {trend > 0 ? <TrendingUp className="h-3 w-3" /> : trend < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                            <span>{trend > 0 ? '+' : ''}{trend} lb · 4w</span>
                        </div>
                    )}
                </>
            ) : (
                <p className="text-xs text-muted-foreground py-2">No data yet — log this lift to see your e1RM.</p>
            )}
        </div>
    );
}
