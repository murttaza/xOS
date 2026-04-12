import { useState } from 'react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dumbbell, Play, Plus, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

const DAY_OPTIONS = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 7, label: 'Sunday' },
];

const SPLIT_PRESETS = [
    {
        label: 'Push / Pull / Legs',
        days: [
            { dayOfWeek: 1, name: 'Push', focus: 'Chest, Shoulders, Triceps' },
            { dayOfWeek: 2, name: 'Pull', focus: 'Back, Biceps, Rear Delts' },
            { dayOfWeek: 3, name: 'Legs', focus: 'Quads, Hamstrings, Glutes, Calves' },
            { dayOfWeek: 4, name: 'Push', focus: 'Chest, Shoulders, Triceps' },
            { dayOfWeek: 5, name: 'Pull', focus: 'Back, Biceps, Rear Delts' },
        ],
    },
    {
        label: 'Upper / Lower',
        days: [
            { dayOfWeek: 1, name: 'Upper A', focus: 'Chest, Back, Shoulders, Arms' },
            { dayOfWeek: 2, name: 'Lower A', focus: 'Quads, Hamstrings, Glutes' },
            { dayOfWeek: 4, name: 'Upper B', focus: 'Chest, Back, Shoulders, Arms' },
            { dayOfWeek: 5, name: 'Lower B', focus: 'Quads, Hamstrings, Glutes' },
        ],
    },
    {
        label: 'Full Body (3x)',
        days: [
            { dayOfWeek: 1, name: 'Full Body A', focus: 'Compound movements' },
            { dayOfWeek: 3, name: 'Full Body B', focus: 'Compound movements' },
            { dayOfWeek: 5, name: 'Full Body C', focus: 'Compound movements' },
        ],
    },
    {
        label: 'Bro Split (5-day)',
        days: [
            { dayOfWeek: 1, name: 'Chest', focus: 'Chest & Triceps' },
            { dayOfWeek: 2, name: 'Back', focus: 'Back & Biceps' },
            { dayOfWeek: 3, name: 'Shoulders', focus: 'Shoulders & Traps' },
            { dayOfWeek: 4, name: 'Legs', focus: 'Quads, Hamstrings, Glutes, Calves' },
            { dayOfWeek: 5, name: 'Arms', focus: 'Biceps, Triceps, Forearms' },
        ],
    },
];

interface DayEntry {
    dayOfWeek: number;
    name: string;
    focus: string;
}

export function ProgramPicker() {
    const programs = useStore(s => s.programs);
    const userPrograms = useStore(s => s.userPrograms);
    const startNewProgram = useStore(s => s.startNewProgram);
    const updateProgramStatus = useStore(s => s.updateProgramStatus);
    const createCustomProgram = useStore(s => s.createCustomProgram);
    const [starting, setStarting] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [step, setStep] = useState<'preset' | 'customize'>(programs.length === 0 ? 'preset' : 'preset');

    // Form state
    const [programName, setProgramName] = useState('');
    const [totalWeeks, setTotalWeeks] = useState(12);
    const [days, setDays] = useState<DayEntry[]>([]);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const handleStart = async (programId: string) => {
        setStarting(true);
        const today = new Date();
        const day = today.getDay();
        const diff = day === 0 ? 6 : day - 1;
        const monday = new Date(today);
        monday.setDate(today.getDate() - diff);
        const startDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
        await startNewProgram(programId, startDate);
        setStarting(false);
    };

    const handleResume = async (userProgramId: string) => {
        await updateProgramStatus(userProgramId, 'active');
    };

    const applyPreset = (preset: typeof SPLIT_PRESETS[0]) => {
        setProgramName(preset.label);
        setDays([...preset.days]);
        setStep('customize');
    };

    const addDay = () => {
        // Find first available day
        const usedDays = new Set(days.map(d => d.dayOfWeek));
        const available = DAY_OPTIONS.find(o => !usedDays.has(o.value));
        if (available) {
            setDays([...days, { dayOfWeek: available.value, name: '', focus: '' }]);
        }
    };

    const removeDay = (index: number) => {
        setDays(days.filter((_, i) => i !== index));
    };

    const updateDay = (index: number, field: keyof DayEntry, value: string | number) => {
        const updated = [...days];
        (updated[index] as any)[field] = value;
        setDays(updated);
    };

    const handleCreate = async () => {
        if (!programName.trim()) {
            setError('Give your program a name');
            return;
        }
        if (days.length === 0) {
            setError('Add at least one training day');
            return;
        }
        if (days.some(d => !d.name.trim())) {
            setError('Every day needs a name');
            return;
        }
        setError('');
        setCreating(true);
        try {
            await createCustomProgram({
                name: programName.trim(),
                totalWeeks,
                days: days.map(d => ({
                    dayOfWeek: d.dayOfWeek,
                    name: d.name.trim(),
                    focus: d.focus.trim(),
                })),
            });
        } catch (err: any) {
            setError(err?.message || 'Failed to create program');
        } finally {
            setCreating(false);
        }
    };

    const pausedPrograms = userPrograms.filter(p => p.status === 'paused');

    // ── Create flow ──────────────────────────────────────────────
    if (showCreate) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md space-y-5"
                >
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowCreate(false); setStep('preset'); setDays([]); setProgramName(''); }}>
                            <X className="h-4 w-4" />
                        </Button>
                        <h2 className="text-xl font-bold">Create Your Split</h2>
                    </div>

                    <AnimatePresence mode="wait">
                        {step === 'preset' && (
                            <motion.div
                                key="preset"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="space-y-3"
                            >
                                <p className="text-sm text-muted-foreground">Pick a template to start from, or build from scratch.</p>
                                {SPLIT_PRESETS.map(preset => (
                                    <button
                                        key={preset.label}
                                        className="w-full flex items-center justify-between border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors text-left group"
                                        onClick={() => applyPreset(preset)}
                                    >
                                        <div>
                                            <p className="text-sm font-semibold">{preset.label}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{preset.days.length} days/week</p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                    </button>
                                ))}
                                <button
                                    className="w-full flex items-center justify-between border border-dashed border-border rounded-xl p-4 hover:bg-muted/30 transition-colors text-left group"
                                    onClick={() => { setStep('customize'); setProgramName(''); setDays([]); }}
                                >
                                    <div className="flex items-center gap-2">
                                        <Plus className="h-4 w-4 text-muted-foreground" />
                                        <p className="text-sm font-medium text-muted-foreground">Build from scratch</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </button>
                            </motion.div>
                        )}

                        {step === 'customize' && (
                            <motion.div
                                key="customize"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="space-y-4"
                            >
                                <button
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                    onClick={() => setStep('preset')}
                                >
                                    ← Back to templates
                                </button>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Program Name</label>
                                    <Input
                                        value={programName}
                                        onChange={e => setProgramName(e.target.value)}
                                        placeholder="e.g. Push Pull Legs"
                                        className="h-10"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Duration (weeks)</label>
                                    <Input
                                        type="number"
                                        value={totalWeeks}
                                        onChange={e => setTotalWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                                        min={1}
                                        max={52}
                                        className="h-10 w-24"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium text-muted-foreground">Training Days</label>
                                        {days.length < 7 && (
                                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addDay}>
                                                <Plus className="h-3 w-3" /> Add Day
                                            </Button>
                                        )}
                                    </div>

                                    {days.length === 0 && (
                                        <div className="text-center py-6 border border-dashed border-border rounded-xl">
                                            <p className="text-sm text-muted-foreground">No training days yet</p>
                                            <Button variant="ghost" size="sm" className="mt-2 text-xs gap-1" onClick={addDay}>
                                                <Plus className="h-3 w-3" /> Add your first day
                                            </Button>
                                        </div>
                                    )}

                                    {days.map((day, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="border border-border rounded-xl p-3 space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <select
                                                    value={day.dayOfWeek}
                                                    onChange={e => updateDay(i, 'dayOfWeek', parseInt(e.target.value))}
                                                    className="text-xs font-medium bg-transparent border border-border rounded-md px-2 py-1.5 text-foreground"
                                                >
                                                    {DAY_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeDay(i)}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <Input
                                                value={day.name}
                                                onChange={e => updateDay(i, 'name', e.target.value)}
                                                placeholder="Day name (e.g. Push, Upper A)"
                                                className="h-8 text-sm"
                                            />
                                            <Input
                                                value={day.focus}
                                                onChange={e => updateDay(i, 'focus', e.target.value)}
                                                placeholder="Focus (e.g. Chest, Shoulders, Triceps)"
                                                className="h-8 text-sm text-muted-foreground"
                                            />
                                        </motion.div>
                                    ))}
                                </div>

                                {error && (
                                    <p className="text-xs text-destructive">{error}</p>
                                )}

                                <Button
                                    className="w-full h-11 text-sm font-semibold"
                                    onClick={handleCreate}
                                    disabled={creating}
                                >
                                    {creating ? 'Creating...' : 'Create & Start Program'}
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        );
    }

    // ── Main picker view ─────────────────────────────────────────
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md space-y-6"
            >
                <div className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Dumbbell className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold">
                        {programs.length === 0 ? 'Set Up Your Training' : 'Start a Program'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {programs.length === 0
                            ? 'Create a workout split to start tracking your sessions, progress and gains.'
                            : 'Choose a training plan to begin tracking your workouts.'}
                    </p>
                </div>

                {/* Create custom program CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Button
                        className={cn(
                            "w-full h-12 text-base font-semibold gap-2",
                            programs.length === 0 && "bg-primary text-primary-foreground"
                        )}
                        variant={programs.length === 0 ? "default" : "outline"}
                        onClick={() => setShowCreate(true)}
                    >
                        <Plus className="h-5 w-5" />
                        Create Custom Split
                    </Button>
                </motion.div>

                {/* Existing programs */}
                {programs.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Available Programs</p>
                        {programs.map(program => (
                            <div key={program.id} className="border border-border rounded-xl p-4 space-y-3">
                                <div>
                                    <h3 className="font-semibold text-base">{program.name}</h3>
                                    <p className="text-xs text-muted-foreground mt-1">{program.description}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{program.total_weeks} weeks</p>
                                </div>
                                <Button
                                    className="w-full"
                                    onClick={() => handleStart(program.id)}
                                    disabled={starting}
                                >
                                    <Play className="h-4 w-4 mr-2" />
                                    Start Program
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {pausedPrograms.length > 0 && (
                    <div className="space-y-3 border-t border-border pt-4">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Paused Programs</p>
                        {pausedPrograms.map(up => (
                            <div key={up.id} className="flex items-center justify-between border border-border rounded-lg p-3">
                                <div>
                                    <p className="text-sm font-medium">{up.program?.name || 'Program'}</p>
                                    <p className="text-xs text-muted-foreground">Week {up.current_week}</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => handleResume(up.id)}>
                                    Resume
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
