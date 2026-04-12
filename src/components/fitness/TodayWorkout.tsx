import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, SkipForward, MessageSquare, Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ExerciseLog, ProgramExercise, ExerciseSet } from '../../types';

function parseIntSafe(val: string): number | null {
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
}

function parseFloatSafe(val: string): number | null {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
}

function parsePrescribedSets(prescribed: string): number {
    const n = parseInt(prescribed, 10);
    return isNaN(n) ? 3 : n;
}

interface ExerciseRowProps {
    exercise: ProgramExercise;
    log: ExerciseLog | undefined;
    previousLog: ExerciseLog | undefined;
    sessionId: string;
    onSave: (log: Omit<ExerciseLog, 'id' | 'created_at' | 'program_exercise' | 'exercise_sets'> & { id?: string }) => Promise<ExerciseLog>;
    onSaveSets: (logId: string, sets: Omit<ExerciseSet, 'id' | 'exercise_log_id'>[]) => Promise<void>;
}

function ExerciseRow({ exercise, log, previousLog, sessionId, onSave, onSaveSets }: ExerciseRowProps) {
    const [expanded, setExpanded] = useState(false);
    const [showPerSet, setShowPerSet] = useState(false);
    const [weight, setWeight] = useState(log?.working_weight?.toString() || '');
    const [reps, setReps] = useState(log?.reps_hit?.toString() || '');
    const [setsCount, setSetsCount] = useState(log?.sets_completed?.toString() || exercise.prescribed_sets || '3');
    const [rir, setRir] = useState(log?.rir?.toString() || '');
    const [completed, setCompleted] = useState(log?.is_completed || false);
    const [sets, setSets] = useState<{ weight: string; reps: string; rir: string }[]>([]);
    const [saving, setSaving] = useState(false);

    const numSets = parsePrescribedSets(exercise.prescribed_sets);

    useEffect(() => {
        if (log) {
            setWeight(log.working_weight?.toString() || '');
            setReps(log.reps_hit?.toString() || '');
            setSetsCount(log.sets_completed?.toString() || exercise.prescribed_sets || '3');
            setRir(log.rir?.toString() || '');
            setCompleted(log.is_completed || false);
        }
    }, [log?.id]);

    useEffect(() => {
        if (showPerSet && sets.length === 0) {
            const defaultSets = Array.from({ length: numSets }, () => ({
                weight: weight || '',
                reps: reps || '',
                rir: '',
            }));
            setSets(defaultSets);
        }
    }, [showPerSet]);

    const ghostWeight = previousLog?.working_weight;
    const ghostReps = previousLog?.reps_hit;

    const handleSave = useCallback(async () => {
        if (saving) return;
        setSaving(true);
        try {
            const result = await onSave({
                id: log?.id,
                session_id: sessionId,
                program_exercise_id: exercise.id,
                exercise_id: exercise.exercise_id,
                substituted: false,
                working_weight: parseFloatSafe(weight),
                weight_unit: 'lb',
                reps_hit: parseIntSafe(reps),
                sets_completed: parseIntSafe(setsCount),
                rir: parseIntSafe(rir),
                duration_seconds: null,
                notes: null,
                is_completed: true,
            });
            setCompleted(true);

            if (showPerSet && result.id) {
                await onSaveSets(result.id, sets.map((s, i) => ({
                    set_number: i + 1,
                    weight: parseFloatSafe(s.weight),
                    reps: parseIntSafe(s.reps),
                    rir: parseIntSafe(s.rir),
                })));
            }
        } catch (err) {
            console.error('Failed to save exercise log:', err);
        } finally {
            setSaving(false);
        }
    }, [weight, reps, setsCount, rir, sets, showPerSet, log?.id, saving]);

    // Non-loggable exercises (warmups, finishers, mobility)
    if (!exercise.is_loggable) {
        return (
            <div className={cn(
                "border border-border/50 rounded-xl p-3 flex items-center gap-3 transition-all",
                completed && "bg-muted/30 border-green-500/20 dark:border-green-400/20"
            )}>
                <button
                    className={cn(
                        "h-8 w-8 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                        completed
                            ? "bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600"
                            : "border-muted-foreground/30 hover:border-primary active:border-primary"
                    )}
                    onClick={async () => {
                        setCompleted(!completed);
                        await onSave({
                            id: log?.id,
                            session_id: sessionId,
                            program_exercise_id: exercise.id,
                            exercise_id: exercise.exercise_id,
                            substituted: false,
                            working_weight: null,
                            weight_unit: 'lb',
                            reps_hit: null,
                            sets_completed: null,
                            rir: null,
                            duration_seconds: null,
                            notes: null,
                            is_completed: !completed,
                        });
                    }}
                >
                    {completed && <Check className="h-4 w-4 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                    <p className={cn("text-sm", completed && "text-muted-foreground line-through")}>{exercise.display_name}</p>
                    {exercise.prescribed_reps && (
                        <p className="text-[10px] text-muted-foreground">{exercise.prescribed_reps}</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "border rounded-xl transition-all overflow-hidden",
            completed ? "border-green-500/30 dark:border-green-400/30 bg-green-500/5 dark:bg-green-500/10" : "border-border"
        )}>
            {/* Header - tap to expand */}
            <button
                className="w-full flex items-center gap-3 p-3 text-left active:bg-muted/20"
                onClick={() => setExpanded(!expanded)}
            >
                <div className={cn(
                    "h-8 w-8 rounded-md border-2 flex items-center justify-center shrink-0",
                    completed ? "bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600" : "border-muted-foreground/30"
                )}>
                    {completed && <Check className="h-4 w-4 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{exercise.display_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                        {exercise.prescribed_sets} &times; {exercise.prescribed_reps}
                        {exercise.notes && <> &middot; {exercise.notes}</>}
                    </p>
                </div>
                {completed && weight && (
                    <span className="text-xs font-mono text-green-600 dark:text-green-400 shrink-0">
                        {weight}lb &times; {reps}
                    </span>
                )}
                {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            </button>

            {/* Expanded editor */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
                            {/* Quick input row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground font-medium">Weight</label>
                                    <Input
                                        type="number"
                                        inputMode="decimal"
                                        placeholder={ghostWeight ? String(ghostWeight) : '0'}
                                        value={weight}
                                        onChange={e => setWeight(e.target.value)}
                                        className="h-10 text-center text-base font-mono tabular-nums"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground font-medium">Reps</label>
                                    <Input
                                        type="number"
                                        inputMode="numeric"
                                        placeholder={ghostReps ? String(ghostReps) : '0'}
                                        value={reps}
                                        onChange={e => setReps(e.target.value)}
                                        className="h-10 text-center text-base font-mono tabular-nums"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground font-medium">Sets</label>
                                    <Input
                                        type="number"
                                        inputMode="numeric"
                                        value={setsCount}
                                        onChange={e => setSetsCount(e.target.value)}
                                        className="h-10 text-center text-base font-mono tabular-nums"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground font-medium">RIR</label>
                                    <Input
                                        type="number"
                                        inputMode="numeric"
                                        placeholder="—"
                                        value={rir}
                                        onChange={e => setRir(e.target.value)}
                                        className="h-10 text-center text-base font-mono tabular-nums"
                                    />
                                </div>
                            </div>

                            {/* Ghost text hint */}
                            {ghostWeight && !weight && (
                                <p className="text-[10px] text-muted-foreground/60 -mt-1">
                                    Last: {ghostWeight}lb &times; {ghostReps}
                                </p>
                            )}

                            {/* Per-set expansion */}
                            {!showPerSet && (
                                <button
                                    className="text-xs text-primary hover:underline"
                                    onClick={() => setShowPerSet(true)}
                                >
                                    Expand to per-set logging
                                </button>
                            )}

                            {showPerSet && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-[2rem_1fr_1fr] sm:grid-cols-[2rem_1fr_1fr_1fr] gap-2 text-[10px] text-muted-foreground font-medium">
                                        <span></span>
                                        <span>Weight</span>
                                        <span>Reps</span>
                                        <span className="hidden sm:block">RIR</span>
                                    </div>
                                    {sets.map((s, i) => (
                                        <div key={i} className="grid grid-cols-[2rem_1fr_1fr] sm:grid-cols-[2rem_1fr_1fr_1fr] gap-2 items-center">
                                            <span className="text-xs text-muted-foreground text-center">{i + 1}</span>
                                            <Input
                                                type="number"
                                                inputMode="decimal"
                                                value={s.weight}
                                                onChange={e => {
                                                    const updated = [...sets];
                                                    updated[i] = { ...updated[i], weight: e.target.value };
                                                    setSets(updated);
                                                }}
                                                className="h-9 text-center text-sm font-mono"
                                            />
                                            <Input
                                                type="number"
                                                inputMode="numeric"
                                                value={s.reps}
                                                onChange={e => {
                                                    const updated = [...sets];
                                                    updated[i] = { ...updated[i], reps: e.target.value };
                                                    setSets(updated);
                                                }}
                                                className="h-9 text-center text-sm font-mono"
                                            />
                                            <Input
                                                type="number"
                                                inputMode="numeric"
                                                value={s.rir}
                                                onChange={e => {
                                                    const updated = [...sets];
                                                    updated[i] = { ...updated[i], rir: e.target.value };
                                                    setSets(updated);
                                                }}
                                                className="h-9 text-center text-sm font-mono hidden sm:block"
                                            />
                                        </div>
                                    ))}
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={() => setSets([...sets, { weight: weight || '', reps: '', rir: '' }])}
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> Add Set
                                        </Button>
                                        {sets.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs text-destructive"
                                                onClick={() => setSets(sets.slice(0, -1))}
                                            >
                                                <Minus className="h-3 w-3 mr-1" /> Remove
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Save button */}
                            <Button
                                className="w-full h-10"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                <Check className="h-4 w-4 mr-2" />
                                {saving ? 'Saving...' : completed ? 'Update' : 'Log Exercise'}
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function TodayWorkout() {
    const sessions = useStore(s => s.workoutSessions);
    const exerciseLogs = useStore(s => s.exerciseLogs);
    const selectedSessionId = useStore(s => s.selectedSessionId);
    const currentSession = useStore(s => s.currentSession);
    const programDays = useStore(s => s.programDays);
    const getCurrentWeek = useStore(s => s.getCurrentWeek);
    const getPhaseForWeek = useStore(s => s.getPhaseForWeek);
    const getExercisesForDay = useStore(s => s.getExercisesForDay);
    const ensureWeekSessions = useStore(s => s.ensureWeekSessions);
    const fetchSessionDetail = useStore(s => s.fetchSessionDetail);
    const saveExerciseLog = useStore(s => s.saveExerciseLog);
    const saveExerciseSets = useStore(s => s.saveExerciseSets);
    const updateSessionStatus = useStore(s => s.updateSessionStatus);
    const setFitnessTab = useStore(s => s.setFitnessTab);

    const [notes, setNotes] = useState('');
    const [effort, setEffort] = useState<number>(0);
    const [showNotes, setShowNotes] = useState(false);

    const currentWeek = getCurrentWeek();
    const currentPhase = getPhaseForWeek(currentWeek);

    useEffect(() => {
        ensureWeekSessions(currentWeek);
    }, [currentWeek, ensureWeekSessions]);

    // If no session selected, find today's
    useEffect(() => {
        if (!selectedSessionId) {
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const todaySession = sessions.find(s => s.scheduled_date === todayStr);
            if (todaySession) {
                fetchSessionDetail(todaySession.id);
            }
        }
    }, [sessions, selectedSessionId, fetchSessionDetail]);

    useEffect(() => {
        if (currentSession) {
            setNotes(currentSession.notes || '');
            setEffort(currentSession.perceived_effort || 0);
        }
    }, [currentSession?.id]);

    const session = currentSession;
    const dayExercises = session?.program_day_id ? getExercisesForDay(session.program_day_id) : [];
    const programDay = session?.program_day || programDays.find(d => d.id === session?.program_day_id);

    // Previous session with same program_day_id is used for ghost text (future enhancement)

    const handleComplete = async () => {
        if (!session) return;
        await updateSessionStatus(session.id, 'completed', {
            effort: effort || undefined,
            notes: notes || undefined,
        });
    };

    const handleSkip = async () => {
        if (!session) return;
        await updateSessionStatus(session.id, 'skipped', { notes: notes || undefined });
    };

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center space-y-4">
                <p className="text-muted-foreground">No workout scheduled for today.</p>
                <Button variant="outline" onClick={() => setFitnessTab('week')}>
                    View Week
                </Button>
            </div>
        );
    }

    const isCompleted = session.status === 'completed';
    const isSkipped = session.status === 'skipped';
    const allLogged = dayExercises
        .filter(e => e.is_loggable)
        .every(e => exerciseLogs.some(l => l.program_exercise_id === e.id && l.is_completed));

    return (
        <div className="max-w-lg mx-auto pb-4">
            {/* Day header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border/30 px-4 py-3">
                <h2 className="text-base font-bold">{programDay?.name || 'Workout'}</h2>
                <p className="text-xs text-muted-foreground">
                    {currentPhase?.name && <>{currentPhase.name}, </>}
                    Week {currentWeek}
                    {' '}
                    &middot; {new Date(session.scheduled_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
                {isCompleted && (
                    <div className="mt-1 flex items-center gap-1 text-green-600 dark:text-green-400">
                        <Check className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Completed</span>
                    </div>
                )}
                {isSkipped && (
                    <div className="mt-1 flex items-center gap-1 text-red-600 dark:text-red-400">
                        <SkipForward className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Skipped</span>
                    </div>
                )}
            </div>

            {/* Exercise list */}
            <div className="px-3 py-3 space-y-2">
                {dayExercises.map(exercise => {
                    const log = exerciseLogs.find(l => l.program_exercise_id === exercise.id);
                    return (
                        <ExerciseRow
                            key={exercise.id}
                            exercise={exercise}
                            log={log}
                            previousLog={undefined}
                            sessionId={session.id}
                            onSave={saveExerciseLog}
                            onSaveSets={saveExerciseSets}
                        />
                    );
                })}
            </div>

            {/* Notes & effort */}
            {!isCompleted && !isSkipped && (
                <div className="px-3 space-y-3">
                    <button
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowNotes(!showNotes)}
                    >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Notes & Effort
                        {showNotes ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {showNotes && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="space-y-3"
                        >
                            <textarea
                                placeholder="Session notes..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full h-20 border border-border rounded-lg p-3 bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Perceived Effort (RPE 1-10)</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                                        <button
                                            key={n}
                                            className={cn(
                                                "h-9 w-9 rounded-lg text-xs font-medium border transition-all",
                                                effort === n
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "border-border hover:border-primary/50 active:border-primary/50"
                                            )}
                                            onClick={() => setEffort(effort === n ? 0 : n)}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}

            {/* Bottom actions */}
            {!isCompleted && !isSkipped && (
                <div className="sticky bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur-lg border-t border-border/50 z-10"
                    style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
                >
                    <div className="max-w-lg mx-auto flex gap-2">
                        <Button
                            variant="outline"
                            className="h-12 px-4"
                            onClick={handleSkip}
                        >
                            <SkipForward className="h-4 w-4 mr-1" />
                            Skip
                        </Button>
                        <Button
                            className="flex-1 h-12 text-base font-semibold"
                            onClick={handleComplete}
                            disabled={!allLogged}
                        >
                            <Check className="h-5 w-5 mr-2" />
                            Complete Session
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
