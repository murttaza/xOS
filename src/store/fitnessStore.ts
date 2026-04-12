import { StateCreator } from 'zustand';
import { api } from '@/api';
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
    bodyMetrics: BodyMetric[];

    // UI
    fitnessTab: string;
    setFitnessTab: (tab: string) => void;
    selectedSessionId: string | null;
    setSelectedSessionId: (id: string | null) => void;

    // Data fetching
    fetchFitnessData: () => Promise<void>;
    fetchProgramData: (programId: string) => Promise<void>;
    fetchSessions: () => Promise<void>;
    fetchSessionDetail: (sessionId: string) => Promise<void>;
    fetchExerciseLogs: (sessionId: string) => Promise<void>;
    fetchBodyMetrics: () => Promise<void>;

    // Actions
    startNewProgram: (programId: string, startedOn: string) => Promise<void>;
    updateProgramStatus: (id: string, status: UserProgram['status']) => Promise<void>;
    ensureWeekSessions: (weekNumber: number) => Promise<void>;
    createSessionForDay: (programDayId: string, date: string) => Promise<WorkoutSession>;
    updateSessionStatus: (sessionId: string, status: WorkoutSession['status'], opts?: { effort?: number; notes?: string }) => Promise<void>;
    saveExerciseLog: (log: Omit<ExerciseLog, 'id' | 'created_at' | 'program_exercise' | 'exercise_sets'> & { id?: string }) => Promise<ExerciseLog>;
    saveExerciseSets: (logId: string, sets: Omit<ExerciseSet, 'id' | 'exercise_log_id'>[]) => Promise<void>;
    upsertBodyMetric: (metric: Omit<BodyMetric, 'id' | 'created_at'> & { id?: string }) => Promise<void>;
    createCustomProgram: (opts: { name: string; description?: string; totalWeeks: number; days: { dayOfWeek: number; name: string; focus: string }[] }) => Promise<void>;

    // Computed helpers
    getCurrentWeek: () => number;
    getPhaseForWeek: (week: number) => ProgramPhase | null;
    getDaysForPhase: (phaseId: string) => ProgramDay[];
    getExercisesForDay: (dayId: string) => ProgramExercise[];
    getTodaySession: () => WorkoutSession | null;
    getSessionsForWeek: (week: number) => WorkoutSession[];
    getWeekStartDate: (week: number) => string;
}

function getLocalDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    bodyMetrics: [],

    fitnessTab: 'home',
    setFitnessTab: (tab) => set({ fitnessTab: tab }),
    selectedSessionId: null,
    setSelectedSessionId: (id) => set({ selectedSessionId: id }),

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

            // If there's an active program, fetch its template data + sessions
            if (active) {
                await Promise.all([
                    get().fetchProgramData(active.program_id),
                    get().fetchSessions(),
                    get().fetchBodyMetrics(),
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

    startNewProgram: async (programId, startedOn) => {
        try {
            // Pause any existing active programs
            const current = get().userPrograms.filter(p => p.status === 'active');
            for (const p of current) {
                await api.updateUserProgram(p.id, { status: 'paused' });
            }
            await api.startProgram(programId, startedOn);
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
        const state = get();
        const active = state.activeProgram;
        if (!active) return;

        const weekStart = state.getWeekStartDate(weekNumber);
        const phase = state.getPhaseForWeek(weekNumber);
        if (!phase) return;

        const phaseDays = state.getDaysForPhase(phase.id);

        // Check if sessions already exist for this week
        const existingSessions = state.workoutSessions.filter(s => {
            const sDate = new Date(s.scheduled_date);
            const wStart = new Date(weekStart);
            const wEnd = new Date(wStart);
            wEnd.setDate(wEnd.getDate() + 6);
            return sDate >= wStart && sDate <= wEnd;
        });

        if (existingSessions.length >= phaseDays.length) return;

        // Create sessions for missing days only
        const existingDayIds = new Set(existingSessions.map(s => s.program_day_id));
        const missingDays = phaseDays.filter(d => !existingDayIds.has(d.id));

        if (missingDays.length > 0) {
            await api.createWeekSessions(active.id, missingDays, weekStart);
            await state.fetchSessions();
        }
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

    updateSessionStatus: async (sessionId, status, opts) => {
        const updates: any = { status };
        if (status === 'completed') updates.completed_at = new Date().toISOString();
        if (opts?.effort !== undefined) updates.perceived_effort = opts.effort;
        if (opts?.notes !== undefined) updates.notes = opts.notes;
        await api.updateSession(sessionId, updates);
        await get().fetchSessions();
        if (get().selectedSessionId === sessionId) {
            await get().fetchSessionDetail(sessionId);
        }
    },

    saveExerciseLog: async (log) => {
        const result = await api.upsertExerciseLog(log);
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
        return result;
    },

    saveExerciseSets: async (logId, sets) => {
        await api.upsertExerciseSets(logId, sets);
    },

    upsertBodyMetric: async (metric) => {
        await api.upsertBodyMetric(metric);
        await get().fetchBodyMetrics();
    },

    createCustomProgram: async ({ name, description, totalWeeks, days }) => {
        try {
            // 1. Create the program
            const program = await api.createProgram({ name, description: description || '', total_weeks: totalWeeks });

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

    // ── Computed Helpers ─────────────────────────────────────────

    getCurrentWeek: () => {
        const active = get().activeProgram;
        if (!active) return 1;
        const started = new Date(active.started_on + 'T00:00:00');
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - started.getTime()) / (1000 * 60 * 60 * 24));
        const week = Math.floor(diffDays / 7) + 1;
        const program = get().programs.find(p => p.id === active.program_id);
        return Math.min(Math.max(week, 1), program?.total_weeks || 12);
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

    getTodaySession: () => {
        const today = getLocalDate();
        return get().workoutSessions.find(s => s.scheduled_date === today) || null;
    },

    getSessionsForWeek: (week) => {
        const state = get();
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
