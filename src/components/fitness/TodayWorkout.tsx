import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, SkipForward, MessageSquare, Minus, Plus, Timer, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { showConfirm } from '../ui/confirm-dialog';
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

// ── Rest timer ─────────────────────────────────────────────────
// Wall-clock anchored (endsAt), so background throttling on phones can't
// stall it. Starts when an exercise is logged; beep + vibrate are best-effort
// (iOS may block audio without a fresh gesture — the visual is the contract).
const REST_DEFAULT_SECONDS = 150;

function RestTimer({ endsAt, onDismiss, onExtend }: { endsAt: number; onDismiss: () => void; onExtend: () => void }) {
    const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    const firedRef = useRef(false);

    useEffect(() => {
        firedRef.current = false;
        const tick = () => {
            const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
            setRemaining(left);
            if (left <= 0 && !firedRef.current) {
                firedRef.current = true;
                try { navigator.vibrate?.(200); } catch { /* unsupported */ }
                try {
                    const ctx = new AudioContext();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.frequency.value = 880; osc.type = 'sine';
                    gain.gain.value = 0.12;
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
                    osc.start(); osc.stop(ctx.currentTime + 0.8);
                    osc.onended = () => ctx.close();
                } catch { /* audio blocked without a gesture — fine */ }
            }
        };
        tick();
        const interval = setInterval(tick, 500);
        return () => clearInterval(interval);
    }, [endsAt]);

    const done = remaining <= 0;
    const mm = Math.floor(remaining / 60);
    const ss = remaining % 60;

    return (
        <div className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
            done ? "border-green-500/40 bg-green-500/10" : "border-primary/30 bg-primary/5"
        )}>
            <Timer className={cn("h-3.5 w-3.5 shrink-0", done ? "text-green-600 dark:text-green-400" : "text-primary")} />
            <span className={cn("text-sm font-mono font-semibold tabular-nums", done ? "text-green-600 dark:text-green-400" : "text-primary")}>
                {done ? 'Rest done' : `${mm}:${String(ss).padStart(2, '0')}`}
            </span>
            {!done && (
                <button
                    type="button"
                    onClick={onExtend}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-full hover:bg-muted transition-colors"
                    aria-label="Add 30 seconds of rest"
                >
                    +30s
                </button>
            )}
            <button
                type="button"
                onClick={onDismiss}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted transition-colors"
                aria-label="Dismiss rest timer"
            >
                <X className="h-3 w-3" />
            </button>
        </div>
    );
}

interface ExerciseRowProps {
    exercise: ProgramExercise;
    log: ExerciseLog | undefined;
    previousLog: ExerciseLog | undefined;
    sessionId: string;
    weightUnit: 'lb' | 'kg';
    onSave: (log: Omit<ExerciseLog, 'id' | 'created_at' | 'program_exercise' | 'exercise_sets'> & { id?: string }) => Promise<ExerciseLog>;
    onSaveSets: (logId: string, sets: Omit<ExerciseSet, 'id' | 'exercise_log_id'>[]) => Promise<void>;
    /** Fires after a successful loggable save — used to start the rest timer. */
    onLogged?: () => void;
}

function ExerciseRow({ exercise, log, previousLog, sessionId, weightUnit, onSave, onSaveSets, onLogged }: ExerciseRowProps) {
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
                weight_unit: weightUnit,
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
            onLogged?.();
        } catch (err) {
            // The store already toasts the failure — this is just for the console.
            console.error('Failed to save exercise log:', err);
        } finally {
            setSaving(false);
        }
    }, [weight, reps, setsCount, rir, sets, showPerSet, log?.id, saving, weightUnit, onLogged]);

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
                    aria-label={`${exercise.display_name} — ${completed ? 'done, tap to unmark' : 'tap to mark done'}`}
                    onClick={async () => {
                        setCompleted(!completed);
                        await onSave({
                            id: log?.id,
                            session_id: sessionId,
                            program_exercise_id: exercise.id,
                            exercise_id: exercise.exercise_id,
                            substituted: false,
                            working_weight: null,
                            weight_unit: weightUnit,
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
                        {weight}{weightUnit} &times; {reps}
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

                            {/* Last-session hint — placeholders above carry the same numbers */}
                            {ghostWeight != null && (
                                <p className="text-[10px] text-muted-foreground/60 -mt-1">
                                    Last session: {ghostWeight}{weightUnit}{ghostReps ? <> &times; {ghostReps}</> : null}
                                    {previousLog?.rir != null && <> @ RIR {previousLog.rir}</>}
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
                                    {/* RIR stays visible on phones — that's the device sets are logged on */}
                                    <div className="grid grid-cols-[2rem_1fr_1fr_1fr] gap-2 text-[10px] text-muted-foreground font-medium">
                                        <span></span>
                                        <span>Weight</span>
                                        <span>Reps</span>
                                        <span>RIR</span>
                                    </div>
                                    {sets.map((s, i) => (
                                        <div key={i} className="grid grid-cols-[2rem_1fr_1fr_1fr] gap-2 items-center">
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
                                                className="h-9 text-center text-sm font-mono"
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
    const allExerciseLogs = useStore(s => s.allExerciseLogs);
    const fetchAllExerciseLogs = useStore(s => s.fetchAllExerciseLogs);
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
    const weightUnit = useStore(s => s.weightUnit);

    const [notes, setNotes] = useState('');
    const [effort, setEffort] = useState<number>(0);
    const [showNotes, setShowNotes] = useState(false);
    const [restEndsAt, setRestEndsAt] = useState<number | null>(null);

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

    // Ghost text: latest completed log per exercise from any EARLIER session,
    // so the placeholders show what you lifted last time.
    useEffect(() => {
        if (allExerciseLogs.length === 0) fetchAllExerciseLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const previousLogs = useMemo(() => {
        const map = new Map<string, ExerciseLog>();
        if (!session?.scheduled_date) return map;
        for (const log of allExerciseLogs) {
            if (!log.is_completed || log.session_id === session.id) continue;
            const logDate = (log as any).workout_session?.scheduled_date as string | undefined;
            if (!logDate || logDate >= session.scheduled_date) continue;
            if (log.working_weight == null && log.reps_hit == null) continue;
            const existing = map.get(log.program_exercise_id);
            const existingDate = existing ? ((existing as any).workout_session?.scheduled_date as string) : '';
            if (!existing || logDate > existingDate) map.set(log.program_exercise_id, log);
        }
        return map;
    }, [allExerciseLogs, session?.id, session?.scheduled_date]);

    const handleExerciseLogged = useCallback(() => {
        setRestEndsAt(Date.now() + REST_DEFAULT_SECONDS * 1000);
    }, []);

    const loggableExercises = dayExercises.filter(e => e.is_loggable);
    const unloggedCount = loggableExercises.filter(
        e => !exerciseLogs.some(l => l.program_exercise_id === e.id && l.is_completed)
    ).length;

    const handleComplete = async () => {
        if (!session) return;
        if (unloggedCount > 0) {
            const ok = await showConfirm({
                title: 'Complete with unlogged exercises?',
                message: `${unloggedCount} of ${loggableExercises.length} exercises ${unloggedCount === 1 ? 'is' : 'are'} not logged. Complete the session anyway?`,
                confirmLabel: 'Complete anyway',
            });
            if (!ok) return;
        }
        setRestEndsAt(null);
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
                            previousLog={previousLogs.get(exercise.id)}
                            sessionId={session.id}
                            weightUnit={weightUnit}
                            onSave={saveExerciseLog}
                            onSaveSets={saveExerciseSets}
                            onLogged={exercise.is_loggable ? handleExerciseLogged : undefined}
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
                    <div className="max-w-lg mx-auto space-y-2">
                        {restEndsAt !== null && (
                            <div className="flex justify-center">
                                <RestTimer
                                    endsAt={restEndsAt}
                                    onDismiss={() => setRestEndsAt(null)}
                                    onExtend={() => setRestEndsAt(prev => (prev ?? Date.now()) + 30_000)}
                                />
                            </div>
                        )}
                        {unloggedCount > 0 && (
                            <p className="text-center text-[10px] text-muted-foreground">
                                {unloggedCount} exercise{unloggedCount === 1 ? '' : 's'} left to log
                            </p>
                        )}
                        <div className="flex gap-2">
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
                            >
                                <Check className="h-5 w-5 mr-2" />
                                Complete Session
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
