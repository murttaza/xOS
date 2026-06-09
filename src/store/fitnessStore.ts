import { StateCreator } from 'zustand';
import { api } from '@/api';
import { calculateWorkoutXP, calculateLevelFromXP } from '@/lib/utils';
import { showErrorToast } from '@/components/ui/toast';
import type { AppState } from './index';
import type {
    Exercise, Program, ProgramPhase, ProgramDay, ProgramExercise, ProgramPrinciple,
    UserProgram, WorkoutSession, ExerciseLog, ExerciseSet, BodyMetric,
} from '@/types';

export interface FitnessSlice {
    // Catalog
    exercises: Exercise[];
    programs: Program[];
    programPhases: ProgramPhase[];
    programDays: ProgramDay[];
    programExercises: ProgramExercise[];
    programPrinciples: ProgramPrinciple[];

    // User state
    userPrograms: UserProgram[];
    activeProgram: UserProgram | null;
    workoutSessions: WorkoutSession[];
    currentSession: WorkoutSession | null;
    exerciseLogs: ExerciseLog[];
    allExerciseLogs: ExerciseLog[];
    bodyMetrics: BodyMetric[];

    // UI
    fitnessTab: string;
    fitnessTabHistory: string[];
    setFitnessTab: (tab: string) => void;
    goBackFitnessTab: () => void;
    selectedSessionId: string | null;
    setSelectedSessionId: (id: string | null) => void;
    showProgramPicker: boolean;
    setShowProgramPicker: (show: boolean) => void;

    // Data fetching
    fetchFitnessData: () => Promise<void>;
    fetchProgramData: (programId: string) => Promise<void>;
    fetchSessions: () => Promise<void>;
    fetchSessionDetail: (sessionId: string) => Promise<void>;
    fetchExerciseLogs: (sessionId: string) => Promise<void>;
    fetchAllExerciseLogs: () => Promise<void>;
    fetchBodyMetrics: () => Promise<void>;

    // Actions
    startNewProgram: (programId: string, startedOn: string) => Promise<void>;
    updateProgramStatus: (id: string, status: UserProgram['status']) => Promise<void>;
    ensureWeekSessions: (weekNumber: number) => Promise<void>;
    ensureNextSession: () => Promise<WorkoutSession | null>;
    createSessionForDay: (programDayId: string, date: string) => Promise<WorkoutSession>;
    selectOrCreateSession: (sessionOrVirtual: { id: string; program_day_id: string }) => Promise<WorkoutSession | null>;
    updateSessionStatus: (sessionId: string, status: WorkoutSession['status'], opts?: { effort?: number; notes?: string }) => Promise<void>;
    saveExerciseLog: (log: Omit<ExerciseLog, 'id' | 'created_at' | 'program_exercise' | 'exercise_sets'> & { id?: string }) => Promise<ExerciseLog>;
    saveExerciseSets: (logId: string, sets: Omit<ExerciseSet, 'id' | 'exercise_log_id'>[]) => Promise<void>;
    upsertBodyMetric: (metric: Omit<BodyMetric, 'id' | 'created_at'> & { id?: string }) => Promise<void>;
    createCustomProgram: (opts: { name: string; description?: string; totalWeeks: number; schedulingMode?: 'weekly' | 'sequential'; days: { dayOfWeek: number; name: string; focus: string }[] }) => Promise<void>;

    // Plan management
    updateProgram: (id: string, updates: { name?: string; description?: string; total_weeks?: number; scheduling_mode?: 'weekly' | 'sequential' }) => Promise<void>;
    deleteProgram: (id: string) => Promise<void>;
    deleteUserProgram: (userProgramId: string) => Promise<void>;
    addPhase: (phase: { program_id: string; name: string; week_start: number; week_end: number; rir_guidance: string; description: string; order: number }) => Promise<void>;
    updatePhase: (id: string, updates: { name?: string; week_start?: number; week_end?: number; rir_guidance?: string; description?: string; order?: number }) => Promise<void>;
    deletePhase: (id: string) => Promise<void>;
    addDay: (day: { program_id: string; phase_id: string; day_of_week: number; name: string; focus: string; order: number }) => Promise<void>;
    updateDay: (id: string, updates: { name?: string; focus?: string; day_of_week?: number; order?: number }) => Promise<void>;
    deleteDay: (id: string) => Promise<void>;
    addExercise: (exercise: { program_day_id: string; exercise_id?: string | null; display_name: string; type: string; prescribed_sets: string; prescribed_reps: string; notes?: string; is_loggable: boolean; order: number }) => Promise<void>;
    updateExercise: (id: string, updates: { display_name?: string; prescribed_sets?: string; prescribed_reps?: string; notes?: string; type?: string; is_loggable?: boolean; order?: number }) => Promise<void>;
    deleteExercise: (id: string) => Promise<void>;

    // Computed helpers
    getCurrentWeek: () => number;
    getPhaseForWeek: (week: number) => ProgramPhase | null;
    getDaysForPhase: (phaseId: string) => ProgramDay[];
    getExercisesForDay: (dayId: string) => ProgramExercise[];
    getTodaySession: () => WorkoutSession | null;
    getSessionsForWeek: (week: number) => WorkoutSession[];
    getWeekStartDate: (week: number) => string;
    getSchedulingMode: () => 'weekly' | 'sequential';
    getNextSequentialDay: () => ProgramDay | null;
}

function getLocalDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const _ensureWeekInFlight = new Map<number, Promise<void>>();

/** Wraps a plan mutation: failures toast + log instead of escaping as
 *  unhandled rejections (the refetch inside fn is skipped on failure). */
async function guardPlanOp(label: string, fn: () => Promise<void>): Promise<void> {
    try {
        await fn();
    } catch (err) {
        console.error(`Plan op "${label}" failed:`, err);
        showErrorToast(`Could not ${label}.`);
    }
}

export const createFitnessSlice: StateCreator<AppState, [], [], FitnessSlice> = (set, get) => ({
    exercises: [],
    programs: [],
    programPhases: [],
    programDays: [],
    programExercises: [],
    programPrinciples: [],
    userPrograms: [],
    activeProgram: null,
    workoutSessions: [],
    currentSession: null,
    exerciseLogs: [],
    allExerciseLogs: [],
    bodyMetrics: [],

    fitnessTab: 'home',
    fitnessTabHistory: [],
    setFitnessTab: (tab) => {
        const prev = get().fitnessTab;
        if (prev !== tab) {
            set(s => ({ fitnessTab: tab, fitnessTabHistory: [...s.fitnessTabHistory, prev] }));
        }
    },
    goBackFitnessTab: () => {
        const history = get().fitnessTabHistory;
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        set({ fitnessTab: prev, fitnessTabHistory: history.slice(0, -1) });
    },
    selectedSessionId: null,
    setSelectedSessionId: (id) => set({ selectedSessionId: id }),
    showProgramPicker: false,
    setShowProgramPicker: (show) => set({ showProgramPicker: show }),

    fetchFitnessData: async () => {
        try {
            const [exercises, programs, userPrograms] = await Promise.all([
                api.getExercises(),
                api.getPrograms(),
                api.getUserPrograms(),
            ]);
            const active = userPrograms.find((p: any) => p.status === 'active') || null;
            // Flatten joined program data
            const mapped = userPrograms.map((up: any) => ({
                ...up,
                program: up.programs,
                programs: undefined,
            }));
            set({ exercises, programs, userPrograms: mapped, activeProgram: active ? { ...active, program: (active as any).programs } : null });

            // If there's an active program, fetch its template data + sessions + logs
            if (active) {
                await Promise.all([
                    get().fetchProgramData(active.program_id),
                    get().fetchSessions(),
                    get().fetchBodyMetrics(),
                    get().fetchAllExerciseLogs(),
                ]);
            }
        } catch (err) {
            console.error('Failed to fetch fitness data:', err);
        }
    },

    fetchProgramData: async (programId) => {
        try {
            const data = await api.getProgram(programId);
            set({
                programPhases: data.phases,
                programDays: data.days,
                programExercises: data.exercises,
                programPrinciples: data.principles,
            });
        } catch (err) {
            console.error('Failed to fetch program data:', err);
        }
    },

    fetchSessions: async () => {
        const active = get().activeProgram;
        if (!active) return;
        try {
            const sessions = await api.getSessionsForProgram(active.id);
            const mapped = sessions.map((s: any) => ({
                ...s,
                program_day: s.program_days,
                program_days: undefined,
            }));
            set({ workoutSessions: mapped });
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        }
    },

    fetchSessionDetail: async (sessionId) => {
        try {
            const session = await api.getSession(sessionId);
            const logs = session.exercise_logs || [];
            set({ currentSession: session, exerciseLogs: logs, selectedSessionId: sessionId });
        } catch (err) {
            console.error('Failed to fetch session detail:', err);
        }
    },

    fetchExerciseLogs: async (sessionId) => {
        try {
            const logs = await api.getExerciseLogs(sessionId);
            const mapped = logs.map((l: any) => ({
                ...l,
                program_exercise: l.program_exercises,
                program_exercises: undefined,
            }));
            set({ exerciseLogs: mapped });
        } catch (err) {
            console.error('Failed to fetch exercise logs:', err);
        }
    },

    fetchBodyMetrics: async () => {
        try {
            const metrics = await api.getBodyMetrics();
            set({ bodyMetrics: metrics });
        } catch (err) {
            console.error('Failed to fetch body metrics:', err);
        }
    },

    fetchAllExerciseLogs: async () => {
        const active = get().activeProgram;
        if (!active) {
            set({ allExerciseLogs: [] });
            return;
        }
        try {
            const logs = await api.getAllExerciseLogsForProgram(active.id);
            const mapped = logs.map((l: any) => ({
                ...l,
                program_exercise: l.program_exercises,
                program_exercises: undefined,
                workout_session: l.workout_sessions,
                workout_sessions: undefined,
            }));
            set({ allExerciseLogs: mapped });
        } catch (err) {
            console.error('Failed to fetch all exercise logs:', err);
        }
    },

    startNewProgram: async (programId, startedOn) => {
        try {
            // Pause any existing active programs
            const current = get().userPrograms.filter(p => p.status === 'active');
            for (const p of current) {
                await api.updateUserProgram(p.id, { status: 'paused' });
            }
            await api.startProgram(programId, startedOn);
            // Drop pointers tied to the previous run before refetching
            set({ currentSession: null, selectedSessionId: null, exerciseLogs: [] });
            await get().fetchFitnessData();
        } catch (err) {
            console.error('Failed to start program:', err);
        }
    },

    updateProgramStatus: async (id, status) => {
        try {
            await api.updateUserProgram(id, { status });
            await get().fetchFitnessData();
        } catch (err) {
            console.error('Failed to update program status:', err);
        }
    },

    ensureWeekSessions: async (weekNumber) => {
        // Sequential mode lazily creates sessions one at a time via ensureNextSession.
        if (get().getSchedulingMode() === 'sequential') return;

        // Deduplicate concurrent calls for the same week
        const existing = _ensureWeekInFlight.get(weekNumber);
        if (existing) return existing;

        const work = (async () => {
            try {
                const state = get();
                const active = state.activeProgram;
                if (!active) return;

                const weekStart = state.getWeekStartDate(weekNumber);
                const phase = state.getPhaseForWeek(weekNumber);
                if (!phase) return;

                const phaseDays = state.getDaysForPhase(phase.id);

                // Check if sessions already exist for this week
                const existingSessions = state.workoutSessions.filter(s => {
                    const sDate = new Date(s.scheduled_date + 'T00:00:00');
                    const wStart = new Date(weekStart + 'T00:00:00');
                    const wEnd = new Date(wStart);
                    wEnd.setDate(wEnd.getDate() + 6);
                    return sDate >= wStart && sDate <= wEnd;
                });

                if (existingSessions.length >= phaseDays.length) return;

                // Upsert all days for the week — DB constraint prevents duplicates
                if (phaseDays.length > 0) {
                    await api.createWeekSessions(active.id, phaseDays, weekStart);
                    await get().fetchSessions();
                }
            } finally {
                _ensureWeekInFlight.delete(weekNumber);
            }
        })();

        _ensureWeekInFlight.set(weekNumber, work);
        return work;
    },

    ensureNextSession: async () => {
        const state = get();
        const active = state.activeProgram;
        if (!active) return null;
        if (state.getSchedulingMode() !== 'sequential') return null;
        const next = state.getNextSequentialDay();
        if (!next) return null;
        // If an open session for this day already exists, reuse it.
        const open = state.workoutSessions.find(s =>
            s.program_day_id === next.id && (s.status === 'planned' || s.status === 'in_progress')
        );
        if (open) return open;
        return await get().createSessionForDay(next.id, getLocalDate());
    },

    createSessionForDay: async (programDayId, date) => {
        const active = get().activeProgram;
        if (!active) throw new Error('No active program');
        const session = await api.createSession({
            user_program_id: active.id,
            program_day_id: programDayId,
            scheduled_date: date,
            status: 'planned',
        });
        await get().fetchSessions();
        return session;
    },

    selectOrCreateSession: async (sessionOrVirtual) => {
        if (sessionOrVirtual.id.startsWith('virtual:')) {
            return await get().createSessionForDay(sessionOrVirtual.program_day_id, getLocalDate());
        }
        await get().fetchSessionDetail(sessionOrVirtual.id);
        return get().workoutSessions.find(s => s.id === sessionOrVirtual.id) || null;
    },

    updateSessionStatus: async (sessionId, status, opts) => {
        // Award XP only on the transition INTO completed (re-saving a completed
        // session must not double-award).
        const wasCompleted = get().workoutSessions.find(s => s.id === sessionId)?.status === 'completed';

        const updates: any = { status };
        if (status === 'completed') updates.completed_at = new Date().toISOString();
        if (opts?.effort !== undefined) updates.perceived_effort = opts.effort;
        if (opts?.notes !== undefined) updates.notes = opts.notes;
        try {
            await api.updateSession(sessionId, updates);
        } catch (err) {
            console.error('updateSessionStatus failed:', err);
            showErrorToast('Could not save the workout status.');
            return;
        }
        await get().fetchSessions();
        if (get().selectedSessionId === sessionId) {
            await get().fetchSessionDetail(sessionId);
        }

        // Completing a workout feeds the Fitness stat — same pattern as
        // budgetStore's Finance XP award.
        if (status === 'completed' && !wasCompleted) {
            try {
                await get().fetchStats();
                const fitnessStat = get().stats.find(s => s.statName === 'Fitness');
                if (fitnessStat) {
                    const xpEarned = calculateWorkoutXP(opts?.effort);
                    const { newXP, newLevel } = calculateLevelFromXP(
                        fitnessStat.currentXP + xpEarned,
                        fitnessStat.currentLevel
                    );
                    await api.updateStat({ statName: 'Fitness', currentXP: newXP, currentLevel: newLevel });
                    set((state) => ({
                        stats: state.stats.map(s =>
                            s.statName === 'Fitness' ? { ...s, currentXP: newXP, currentLevel: newLevel } : s
                        ),
                    }));
                }
            } catch (e) {
                console.error('Failed to award workout XP', e);
            }
        }
    },

    saveExerciseLog: async (log) => {
        let result: ExerciseLog;
        try {
            result = await api.upsertExerciseLog(log);
        } catch (err) {
            console.error('saveExerciseLog failed:', err);
            showErrorToast('Could not save the exercise log.');
            throw err;
        }
        // Update local state
        set(state => {
            const logs = [...state.exerciseLogs];
            const idx = logs.findIndex(l => l.id === result.id);
            const mapped = { ...result, program_exercise: (result as any).program_exercises, program_exercises: undefined } as any;
            if (idx >= 0) {
                logs[idx] = mapped;
            } else {
                logs.push(mapped);
            }
            return { exerciseLogs: logs };
        });
        // Refresh cross-session logs so Stats stays current.
        get().fetchAllExerciseLogs();
        return result;
    },

    saveExerciseSets: async (logId, sets) => {
        try {
            await api.upsertExerciseSets(logId, sets);
        } catch (err) {
            console.error('saveExerciseSets failed:', err);
            showErrorToast('Could not save the sets.');
            throw err;
        }
        // Refresh the logs holding these sets so per-set edits don't appear stale.
        const sessionId = get().currentSession?.id ?? get().selectedSessionId;
        if (sessionId) get().fetchExerciseLogs(sessionId);
        get().fetchAllExerciseLogs();
    },

    upsertBodyMetric: async (metric) => {
        try {
            await api.upsertBodyMetric(metric);
        } catch (err) {
            console.error('upsertBodyMetric failed:', err);
            showErrorToast('Could not save the body metric.');
            return;
        }
        await get().fetchBodyMetrics();
    },

    createCustomProgram: async ({ name, description, totalWeeks, schedulingMode, days }) => {
        try {
            // 1. Create the program
            const program = await api.createProgram({
                name,
                description: description || '',
                total_weeks: totalWeeks,
                scheduling_mode: schedulingMode || 'weekly',
            });

            // 2. Create a single phase spanning all weeks
            const phase = await api.createProgramPhase({
                program_id: program.id,
                name: 'Training',
                week_start: 1,
                week_end: totalWeeks,
                rir_guidance: '',
                description: '',
                order: 1,
            });

            // 3. Create program days
            for (let i = 0; i < days.length; i++) {
                await api.createProgramDay({
                    program_id: program.id,
                    phase_id: phase.id,
                    day_of_week: days[i].dayOfWeek,
                    name: days[i].name,
                    focus: days[i].focus,
                    order: i + 1,
                });
            }

            // 4. Start the program
            const today = new Date();
            const day = today.getDay();
            const diff = day === 0 ? 6 : day - 1;
            const monday = new Date(today);
            monday.setDate(today.getDate() - diff);
            const startDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;

            await get().startNewProgram(program.id, startDate);
        } catch (err) {
            console.error('Failed to create custom program:', err);
            throw err;
        }
    },

    // ── Plan Management ─────────────────────────────────────────
    // All plan edits funnel through guardPlanOp so a failed write surfaces a
    // toast instead of an unhandled rejection (and skips the refetch).

    updateProgram: async (id, updates) => guardPlanOp('save plan changes', async () => {
        await api.updateProgram(id, updates);
        await get().fetchProgramData(get().activeProgram?.program_id || id);
        // Refresh programs list too
        const programs = await api.getPrograms();
        set({ programs });
    }),

    deleteProgram: async (id) => guardPlanOp('delete the plan', async () => {
        const wasActiveTpl = get().activeProgram?.program_id === id;
        // Remove FK references first (user_programs has no ON DELETE CASCADE for program_id).
        // workout_sessions, exercise_logs, exercise_sets cascade from user_programs.
        await api.deleteUserProgramsForProgram(id);
        await api.deleteProgram(id);
        if (wasActiveTpl) {
            set({
                activeProgram: null,
                currentSession: null,
                selectedSessionId: null,
                exerciseLogs: [],
                workoutSessions: [],
                showProgramPicker: true,
            });
        }
        await get().fetchFitnessData();
    }),

    deleteUserProgram: async (id) => guardPlanOp('remove the program run', async () => {
        const wasActive = get().activeProgram?.id === id;
        await api.deleteUserProgram(id);
        if (wasActive) {
            set({
                activeProgram: null,
                currentSession: null,
                selectedSessionId: null,
                exerciseLogs: [],
                workoutSessions: [],
                showProgramPicker: true,
            });
        }
        await get().fetchFitnessData();
    }),

    addPhase: async (phase) => guardPlanOp('add the phase', async () => {
        await api.createProgramPhase(phase);
        await get().fetchProgramData(phase.program_id);
    }),

    updatePhase: async (id, updates) => guardPlanOp('save the phase', async () => {
        await api.updateProgramPhase(id, updates);
        const active = get().activeProgram;
        if (active) await get().fetchProgramData(active.program_id);
    }),

    deletePhase: async (id) => guardPlanOp('delete the phase', async () => {
        await api.deleteProgramPhase(id);
        const active = get().activeProgram;
        if (active) await get().fetchProgramData(active.program_id);
    }),

    addDay: async (day) => guardPlanOp('add the day', async () => {
        await api.createProgramDay(day);
        await get().fetchProgramData(day.program_id);
    }),

    updateDay: async (id, updates) => guardPlanOp('save the day', async () => {
        await api.updateProgramDay(id, updates);
        const active = get().activeProgram;
        if (active) await get().fetchProgramData(active.program_id);
    }),

    deleteDay: async (id) => guardPlanOp('delete the day', async () => {
        await api.deleteProgramDay(id);
        const active = get().activeProgram;
        if (active) await get().fetchProgramData(active.program_id);
    }),

    addExercise: async (exercise) => guardPlanOp('add the exercise', async () => {
        await api.createProgramExercise(exercise);
        const active = get().activeProgram;
        if (active) await get().fetchProgramData(active.program_id);
    }),

    updateExercise: async (id, updates) => guardPlanOp('save the exercise', async () => {
        await api.updateProgramExercise(id, updates);
        const active = get().activeProgram;
        if (active) await get().fetchProgramData(active.program_id);
    }),

    deleteExercise: async (id) => guardPlanOp('delete the exercise', async () => {
        await api.deleteProgramExercise(id);
        const active = get().activeProgram;
        if (active) await get().fetchProgramData(active.program_id);
    }),

    // ── Computed Helpers ─────────────────────────────────────────

    getSchedulingMode: () => {
        const state = get();
        const active = state.activeProgram;
        if (!active) return 'weekly';
        const program = state.programs.find(p => p.id === active.program_id);
        return program?.scheduling_mode || 'weekly';
    },

    getCurrentWeek: () => {
        const state = get();
        const active = state.activeProgram;
        if (!active) return 1;
        const program = state.programs.find(p => p.id === active.program_id);
        const totalWeeks = program?.total_weeks || 12;

        if (state.getSchedulingMode() === 'sequential') {
            // Sequential mode: derive week from completed-day count walking phases in order.
            const phases = state.programPhases.slice().sort((a, b) => a.order - b.order);
            let completedRemaining = state.workoutSessions
                .filter(s => s.status === 'completed' || s.status === 'skipped').length;
            for (const p of phases) {
                const phaseDayCount = state.programDays.filter(d => d.phase_id === p.id).length;
                if (phaseDayCount === 0) continue;
                if (completedRemaining < phaseDayCount) {
                    return Math.min(Math.max(p.week_start + Math.floor(completedRemaining / phaseDayCount), 1), totalWeeks);
                }
                completedRemaining -= phaseDayCount;
            }
            return totalWeeks;
        }

        const started = new Date(active.started_on + 'T00:00:00');
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - started.getTime()) / (1000 * 60 * 60 * 24));
        const week = Math.floor(diffDays / 7) + 1;
        return Math.min(Math.max(week, 1), totalWeeks);
    },

    getPhaseForWeek: (week) => {
        return get().programPhases.find(p => week >= p.week_start && week <= p.week_end) || null;
    },

    getDaysForPhase: (phaseId) => {
        return get().programDays.filter(d => d.phase_id === phaseId).sort((a, b) => a.order - b.order);
    },

    getExercisesForDay: (dayId) => {
        return get().programExercises.filter(e => e.program_day_id === dayId).sort((a, b) => a.order - b.order);
    },

    getNextSequentialDay: () => {
        const state = get();
        const phases = state.programPhases.slice().sort((a, b) => a.order - b.order);
        for (const p of phases) {
            const days = state.getDaysForPhase(p.id);
            if (days.length === 0) continue; // empty phase — never Math.min() over []
            // Per-phase: count how many times each day's id appears as completed/skipped.
            const counts: Record<string, number> = {};
            for (const d of days) counts[d.id] = 0;
            for (const s of state.workoutSessions) {
                if (s.status === 'completed' || s.status === 'skipped') {
                    if (counts[s.program_day_id] !== undefined) counts[s.program_day_id]++;
                }
            }
            // Find min count across this phase's days.
            const min = Math.min(...days.map(d => counts[d.id] ?? 0));
            // Cap cycle progression by total_weeks: if min already covers what this
            // phase should run for, advance to the next phase.
            const phaseWeeks = (p.week_end - p.week_start + 1);
            if (min >= phaseWeeks) continue;
            // Return the first day with count === min (the next-up day in this cycle).
            const next = days.find(d => (counts[d.id] ?? 0) === min);
            if (next) return next;
        }
        return null;
    },

    getTodaySession: () => {
        const state = get();
        if (state.getSchedulingMode() === 'sequential') {
            // Return any open (planned/in_progress) session for the next sequential day.
            const next = state.getNextSequentialDay();
            if (!next) return null;
            return state.workoutSessions.find(s =>
                s.program_day_id === next.id && (s.status === 'planned' || s.status === 'in_progress')
            ) || null;
        }
        const today = getLocalDate();
        return state.workoutSessions.find(s => s.scheduled_date === today) || null;
    },

    getSessionsForWeek: (week) => {
        const state = get();

        if (state.getSchedulingMode() === 'sequential') {
            // Sequential: return one cycle's worth of days as either real or virtual sessions.
            const next = state.getNextSequentialDay();
            const phase = next
                ? state.programPhases.find(p => p.id === next.phase_id)
                : state.getPhaseForWeek(state.getCurrentWeek());
            if (!phase) return [];
            const days = state.getDaysForPhase(phase.id);

            // Per-phase: count completed/skipped per day to decide which is the next-up.
            const counts: Record<string, number> = {};
            for (const d of days) counts[d.id] = 0;
            for (const s of state.workoutSessions) {
                if (s.status === 'completed' || s.status === 'skipped') {
                    if (counts[s.program_day_id] !== undefined) counts[s.program_day_id]++;
                }
            }
            const minCount = days.length ? Math.min(...days.map(d => counts[d.id] ?? 0)) : 0;
            // For each day, return the most recent non-final session matching its phase position,
            // or a virtual placeholder for the upcoming cycle.
            return days.map(d => {
                // Existing open (planned/in_progress) for this day in the current cycle?
                const open = state.workoutSessions.find(s =>
                    s.program_day_id === d.id && (s.status === 'planned' || s.status === 'in_progress')
                );
                if (open) return open;
                // Most recent completed/skipped if this day is "done" for the current cycle.
                if ((counts[d.id] ?? 0) > minCount) {
                    const done = state.workoutSessions
                        .filter(s => s.program_day_id === d.id && (s.status === 'completed' || s.status === 'skipped'))
                        .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))[0];
                    if (done) return done;
                }
                // Otherwise virtual placeholder for the upcoming cycle.
                return {
                    id: `virtual:${d.id}`,
                    user_program_id: state.activeProgram?.id || '',
                    program_day_id: d.id,
                    scheduled_date: getLocalDate(),
                    completed_at: null,
                    perceived_effort: null,
                    notes: null,
                    status: 'planned' as const,
                    created_at: '',
                    program_day: d,
                } as WorkoutSession;
            });
        }

        const weekStart = state.getWeekStartDate(week);
        const wStart = new Date(weekStart + 'T00:00:00');
        const wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 6);

        return state.workoutSessions.filter(s => {
            const d = new Date(s.scheduled_date + 'T00:00:00');
            return d >= wStart && d <= wEnd;
        }).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    },

    getWeekStartDate: (week) => {
        const active = get().activeProgram;
        if (!active) return getLocalDate();
        const started = new Date(active.started_on + 'T00:00:00');
        const weekStart = new Date(started);
        weekStart.setDate(started.getDate() + (week - 1) * 7);
        return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    },
});
