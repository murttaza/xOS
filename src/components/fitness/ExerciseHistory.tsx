import { useState } from 'react';
import { useStore } from '../../store';
import { Input } from '../ui/input';
import { Search } from 'lucide-react';
import { api } from '../../api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-4">
            <h2 className="text-lg font-bold">Exercise History</h2>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search exercises..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="pl-10 h-10"
                />
            </div>

            {/* If no exercise selected, show list */}
            {!selectedExercise && (
                <div className="space-y-1">
                    {filtered.map(exercise => (
                        <button
                            key={exercise.id}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 active:bg-muted/30 transition-colors text-left"
                            onClick={() => handleSelect(exercise)}
                        >
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-primary uppercase">{exercise.category[0]}</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium">{exercise.name}</p>
                                <p className="text-[10px] text-muted-foreground capitalize">{exercise.category}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Selected exercise detail */}
            {selectedExercise && (
                <div className="space-y-4">
                    <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => { setSelectedExercise(null); setHistory([]); }}
                    >
                        &larr; Back to list
                    </button>

                    <div className="space-y-1">
                        <h3 className="text-base font-bold">{selectedExercise.name}</h3>
                        <p className="text-xs text-muted-foreground capitalize">{selectedExercise.category}</p>
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
                                    <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
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
                                        <div key={log.id} className="flex items-center justify-between border border-border/50 rounded-lg px-3 py-2">
                                            <span className="text-xs text-muted-foreground">
                                                {date ? new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
                                            </span>
                                            <div className="text-right">
                                                <span className="text-sm font-mono font-medium">
                                                    {w > 0 ? `${w} lb x ${r}` : r > 0 ? `${r} reps` : '—'}
                                                </span>
                                                {w > 0 && r > 0 && (
                                                    <span className="text-[10px] text-muted-foreground ml-2">
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
            )}
        </div>
    );
}
