import { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { Input } from '../ui/input';
import { Search, ChevronRight, ArrowLeft } from 'lucide-react';
import { api } from '../../api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getStatColor } from '../../lib/utils';
import type { Exercise, ExerciseLog } from '../../types';

export function ExerciseHistory() {
    const exercises = useStore(s => s.exercises);
    const [query, setQuery] = useState('');
    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
    const [history, setHistory] = useState<ExerciseLog[]>([]);
    const [loading, setLoading] = useState(false);

    const filtered = query.length > 0
        ? exercises.filter(e => e.name.toLowerCase().includes(query.toLowerCase()))
        : exercises;

    // Group filtered exercises by category
    const grouped = useMemo(() => {
        const groups: Record<string, Exercise[]> = {};
        for (const ex of filtered) {
            const cat = ex.category || 'other';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(ex);
        }
        // Sort categories alphabetically
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [filtered]);

    const handleSelect = async (exercise: Exercise) => {
        setSelectedExercise(exercise);
        setLoading(true);
        try {
            const logs = await api.getExerciseHistory(exercise.id);
            setHistory(logs);
        } catch (err) {
            console.error('Failed to load history:', err);
        }
        setLoading(false);
    };

    const chartData = history
        .filter(l => l.working_weight && (l as any).workout_sessions?.scheduled_date)
        .sort((a, b) => ((a as any).workout_sessions?.scheduled_date || '').localeCompare((b as any).workout_sessions?.scheduled_date || ''))
        .map(l => ({
            date: (l as any).workout_sessions?.scheduled_date || '',
            weight: Number(l.working_weight) || 0,
            reps: l.reps_hit || 0,
        }));

    // Estimated 1RM (Brzycki formula)
    const est1RM = (weight: number, reps: number) =>
        reps <= 0 || reps > 30 ? weight : Math.round(weight * (36 / (37 - reps)));

    // Detail view
    if (selectedExercise) {
        const catColor = getStatColor(selectedExercise.category);
        return (
            <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-4">
                <button
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => { setSelectedExercise(null); setHistory([]); }}
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to exercises
                </button>

                <div className="flex items-center gap-3">
                    <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-white uppercase"
                        style={{ backgroundColor: `rgb(${catColor.rgb})` }}
                    >
                        {selectedExercise.category.slice(0, 2)}
                    </div>
                    <div>
                        <h3 className="text-base font-bold">{selectedExercise.name}</h3>
                        <p className="text-xs text-muted-foreground capitalize">{selectedExercise.category}</p>
                    </div>
                </div>

                {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

                {!loading && chartData.length > 1 && (
                    <div className="border border-border rounded-xl p-4">
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">Weight Over Time</h4>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData}>
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={v => new Date(v + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                />
                                <YAxis tick={{ fontSize: 10 }} width={40} />
                                <Tooltip
                                    contentStyle={{ fontSize: 12, borderRadius: 8, backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', border: '1px solid hsl(var(--border))' }}
                                />
                                <Line type="monotone" dataKey="weight" stroke={`rgb(${catColor.rgb})`} strokeWidth={2} dot={{ r: 3, fill: `rgb(${catColor.rgb})` }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Session history */}
                {!loading && history.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Session Log</h4>
                        {history
                            .sort((a, b) => ((b as any).workout_sessions?.scheduled_date || '').localeCompare((a as any).workout_sessions?.scheduled_date || ''))
                            .map(log => {
                                const date = (log as any).workout_sessions?.scheduled_date;
                                const w = Number(log.working_weight) || 0;
                                const r = log.reps_hit || 0;
                                return (
                                    <div key={log.id} className="flex items-center justify-between border border-border/50 rounded-lg px-3 py-2.5">
                                        <span className="text-xs text-muted-foreground">
                                            {date ? new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {w > 0 && (
                                                <span
                                                    className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md"
                                                    style={{ backgroundColor: `rgba(${catColor.rgb}, 0.12)`, color: `rgb(${catColor.rgb})` }}
                                                >
                                                    {w} lb &times; {r}
                                                </span>
                                            )}
                                            {!w && r > 0 && (
                                                <span className="text-sm font-mono font-medium">{r} reps</span>
                                            )}
                                            {w > 0 && r > 0 && (
                                                <span className="text-[10px] text-muted-foreground">
                                                    ~{est1RM(w, r)} e1RM
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}

                {!loading && history.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No history for this exercise yet.
                    </p>
                )}
            </div>
        );
    }

    // List view — grouped by category
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-4">
            <h2 className="text-lg font-bold">Exercise History</h2>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search exercises..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="pl-10 h-10"
                />
            </div>

            {/* Grouped list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                {grouped.map(([category, exs]) => {
                    const catColor = getStatColor(category);
                    return (
                        <div key={category} className="space-y-1">
                            {/* Category header */}
                            <div className="flex items-center gap-2 px-1 mb-2">
                                <span
                                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: `rgb(${catColor.rgb})` }}
                                >
                                    {category}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{exs.length}</span>
                            </div>

                            {/* Exercise rows */}
                            {exs.map(exercise => (
                                <button
                                    key={exercise.id}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 active:bg-muted/30 transition-colors text-left group"
                                    onClick={() => handleSelect(exercise)}
                                >
                                    <div
                                        className="h-2 w-2 rounded-full shrink-0"
                                        style={{ backgroundColor: `rgb(${catColor.rgb})` }}
                                    />
                                    <p className="text-sm font-medium flex-1">{exercise.name}</p>
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                                </button>
                            ))}
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                    No exercises found.
                </p>
            )}
        </div>
    );
}
