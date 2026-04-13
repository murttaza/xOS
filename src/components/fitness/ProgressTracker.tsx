import { useState } from 'react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { motion } from 'framer-motion';
import { Plus, Save, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { BodyMetric } from '../../types';

const PEAK_BENCH = 280;
const PEAK_SQUAT = 405;
const PEAK_DEADLIFT = 495;
const PEAK_WEIGHT = 180;

function parseTopSet(val: string | null): number | null {
    if (!val) return null;
    const match = val.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

export function ProgressTracker() {
    const bodyMetrics = useStore(s => s.bodyMetrics);
    const activeProgram = useStore(s => s.activeProgram);
    const upsertBodyMetric = useStore(s => s.upsertBodyMetric);
    const getCurrentWeek = useStore(s => s.getCurrentWeek);

    const [editing, setEditing] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState<Partial<BodyMetric>>({});
    const currentWeek = getCurrentWeek();

    const sortedMetrics = [...bodyMetrics].sort((a, b) => a.date.localeCompare(b.date));

    const handleSave = async () => {
        if (!form.date) return;
        await upsertBodyMetric({
            id: editing || undefined,
            user_program_id: activeProgram?.id || null,
            week_number: form.week_number || currentWeek,
            date: form.date,
            body_weight: form.body_weight || null,
            weight_unit: 'lb',
            rhr: form.rhr || null,
            rope_minutes: form.rope_minutes || null,
            rope_pace: form.rope_pace || null,
            bench_top_set: form.bench_top_set || null,
            squat_top_set: form.squat_top_set || null,
            deadlift_top_set: form.deadlift_top_set || null,
            notes: form.notes || null,
        } as any);
        setEditing(null);
        setAdding(false);
        setForm({});
    };

    const handleEdit = (m: BodyMetric) => {
        setEditing(m.id);
        setForm(m);
        setAdding(true);
    };

    const handleAdd = () => {
        const today = new Date();
        setForm({
            date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
            week_number: currentWeek,
            weight_unit: 'lb',
        });
        setAdding(true);
        setEditing(null);
    };

    // Chart data
    const weightData = sortedMetrics.filter(m => m.body_weight).map(m => ({
        date: m.date,
        week: m.week_number || 0,
        value: Number(m.body_weight),
    }));

    const benchData = sortedMetrics.filter(m => m.bench_top_set).map(m => ({
        date: m.date,
        value: parseTopSet(m.bench_top_set) || 0,
    }));

    const squatData = sortedMetrics.filter(m => m.squat_top_set).map(m => ({
        date: m.date,
        value: parseTopSet(m.squat_top_set) || 0,
    }));

    const deadliftData = sortedMetrics.filter(m => m.deadlift_top_set).map(m => ({
        date: m.date,
        value: parseTopSet(m.deadlift_top_set) || 0,
    }));

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Progress Tracker</h2>
                <Button size="sm" onClick={handleAdd} className="h-8">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Log Week
                </Button>
            </div>

            {/* Add/Edit form */}
            {adding && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="border border-border rounded-xl p-4 space-y-3"
                >
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">{editing ? 'Edit' : 'Log'} Week {form.week_number}</h3>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setAdding(false); setForm({}); }}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">Date</label>
                            <Input type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">Week #</label>
                            <Input type="number" value={form.week_number || ''} onChange={e => setForm({ ...form, week_number: parseInt(e.target.value) || 0 })} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">Body Weight (lb)</label>
                            <Input type="number" inputMode="decimal" value={form.body_weight ?? ''} onChange={e => setForm({ ...form, body_weight: parseFloat(e.target.value) || null })} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">RHR (bpm)</label>
                            <Input type="number" inputMode="numeric" value={form.rhr ?? ''} onChange={e => setForm({ ...form, rhr: parseInt(e.target.value) || null })} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">Rope (min)</label>
                            <Input type="number" inputMode="decimal" value={form.rope_minutes ?? ''} onChange={e => setForm({ ...form, rope_minutes: parseFloat(e.target.value) || null })} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">Rope pace (/min)</label>
                            <Input type="number" inputMode="numeric" value={form.rope_pace ?? ''} onChange={e => setForm({ ...form, rope_pace: parseInt(e.target.value) || null })} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">Bench top set</label>
                            <Input placeholder="e.g. 185x8" value={form.bench_top_set ?? ''} onChange={e => setForm({ ...form, bench_top_set: e.target.value })} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">Squat top set</label>
                            <Input placeholder="e.g. 225x6" value={form.squat_top_set ?? ''} onChange={e => setForm({ ...form, squat_top_set: e.target.value })} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-medium">Deadlift top set</label>
                            <Input placeholder="e.g. 275x5" value={form.deadlift_top_set ?? ''} onChange={e => setForm({ ...form, deadlift_top_set: e.target.value })} className="h-9 text-sm" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground font-medium">Notes</label>
                        <textarea
                            value={form.notes || ''}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                            placeholder="How the week felt..."
                            className="w-full h-16 border border-border rounded-lg p-2 bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    <Button onClick={handleSave} className="w-full h-9">
                        <Save className="h-3.5 w-3.5 mr-1" /> Save
                    </Button>
                </motion.div>
            )}

            {/* Metrics — cards on mobile, table on desktop */}
            {sortedMetrics.length > 0 && (
                <>
                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-2">
                        {sortedMetrics.map(m => (
                            <button
                                key={m.id}
                                className="w-full border border-border rounded-xl p-3 text-left hover:bg-muted/20 active:bg-muted/20 transition-colors space-y-1.5"
                                onClick={() => handleEdit(m)}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold">Week {m.week_number || '—'}</span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {new Date(m.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                                    {m.body_weight && <span className="font-mono">{m.body_weight} lb</span>}
                                    {m.rhr && <span className="font-mono">RHR {m.rhr}</span>}
                                    {m.rope_minutes && <span className="font-mono">Rope {m.rope_minutes}m</span>}
                                    {m.bench_top_set && <span className="font-mono">B: {m.bench_top_set}</span>}
                                    {m.squat_top_set && <span className="font-mono">S: {m.squat_top_set}</span>}
                                    {m.deadlift_top_set && <span className="font-mono">D: {m.deadlift_top_set}</span>}
                                </div>
                                {m.notes && <p className="text-[10px] text-muted-foreground truncate">{m.notes}</p>}
                            </button>
                        ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto -mx-4 px-4">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-border text-muted-foreground">
                                    <th className="text-left py-2 font-medium">Wk</th>
                                    <th className="text-left py-2 font-medium">Date</th>
                                    <th className="text-right py-2 font-medium">Weight</th>
                                    <th className="text-right py-2 font-medium">RHR</th>
                                    <th className="text-right py-2 font-medium">Bench</th>
                                    <th className="text-right py-2 font-medium">Squat</th>
                                    <th className="text-right py-2 font-medium">DL</th>
                                    <th className="text-right py-2 font-medium">Rope</th>
                                    <th className="text-left py-2 font-medium">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedMetrics.map(m => (
                                    <tr
                                        key={m.id}
                                        className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors"
                                        onClick={() => handleEdit(m)}
                                    >
                                        <td className="py-2 font-medium">{m.week_number || '—'}</td>
                                        <td className="py-2 text-muted-foreground">{new Date(m.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                                        <td className="py-2 text-right font-mono">{m.body_weight || '—'}</td>
                                        <td className="py-2 text-right font-mono">{m.rhr || '—'}</td>
                                        <td className="py-2 text-right font-mono">{m.bench_top_set || '—'}</td>
                                        <td className="py-2 text-right font-mono">{m.squat_top_set || '—'}</td>
                                        <td className="py-2 text-right font-mono">{m.deadlift_top_set || '—'}</td>
                                        <td className="py-2 text-right font-mono">{m.rope_minutes ? `${m.rope_minutes}m` : '—'}</td>
                                        <td className="py-2 text-muted-foreground truncate max-w-[100px]">{m.notes || ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Charts */}
            {weightData.length > 1 && (
                <div className="space-y-6">
                    <ChartCard title="Body Weight (lb)" data={weightData} color="#3b82f6" peakLine={PEAK_WEIGHT} peakLabel="Peak (180)" />
                    {benchData.length > 1 && <ChartCard title="Bench Top Set" data={benchData} color="#22c55e" peakLine={PEAK_BENCH} peakLabel="Peak (280)" />}
                    {squatData.length > 1 && <ChartCard title="Squat Top Set" data={squatData} color="#eab308" peakLine={PEAK_SQUAT} peakLabel="Peak (405)" />}
                    {deadliftData.length > 1 && <ChartCard title="Deadlift Top Set" data={deadliftData} color="#ef4444" peakLine={PEAK_DEADLIFT} peakLabel="Peak (495)" />}
                </div>
            )}

            {sortedMetrics.length === 0 && !adding && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                    No metrics logged yet. Tap "Log Week" to start tracking.
                </div>
            )}
        </div>
    );
}

function ChartCard({ title, data, color, peakLine, peakLabel }: {
    title: string;
    data: { date: string; value: number }[];
    color: string;
    peakLine?: number;
    peakLabel?: string;
}) {
    return (
        <div className="border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data}>
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={v => new Date(v + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis tick={{ fontSize: 10 }} width={40} domain={['auto', 'auto']} />
                    <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                        labelFormatter={v => new Date(v + 'T00:00:00').toLocaleDateString()}
                    />
                    {peakLine && (
                        <ReferenceLine
                            y={peakLine}
                            stroke={color}
                            strokeDasharray="6 4"
                            strokeOpacity={0.4}
                            label={{ value: peakLabel, fontSize: 10, fill: color, opacity: 0.6 }}
                        />
                    )}
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2}
                        dot={{ r: 3, fill: color }}
                        activeDot={{ r: 5 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
