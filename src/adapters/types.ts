import type { Task, Session, Stat, DailyLog, DevItem, RepeatingTask, Subject, Note, Streak, BudgetCategory, Transaction, BudgetTarget, Exercise, Program, ProgramPhase, ProgramDay, ProgramExercise, ProgramPrinciple, UserProgram, WorkoutSession, ExerciseLog, ExerciseSet, BodyMetric } from '../types';

export interface ApiBackend {
    // Tasks
    getTasks: () => Promise<Task[]>;
    addTask: (task: Omit<Task, 'id'>) => Promise<unknown>;
    updateTask: (task: Task) => Promise<unknown>;
    deleteTask: (id: number) => Promise<unknown>;
    batchAddTasks: (tasks: Omit<Task, 'id'>[]) => Promise<unknown>;

    // Sessions
    addSession: (session: Omit<Session, 'id'>) => Promise<unknown>;
    getSessionsByDate: (date: string) => Promise<Session[]>;
    getSessionsRange: (startDate: string, endDate: string) => Promise<Session[]>;
    getSessionsByTask: (taskId: number) => Promise<Session[]>;

    // Stats
    getStats: () => Promise<Stat[]>;
    updateStat: (stat: Stat) => Promise<unknown>;
    addStat: (statName: string) => Promise<unknown>;
    deleteStat: (statName: string) => Promise<unknown>;
    renameStat: (oldName: string, newName: string) => Promise<unknown>;

    // Daily Log
    getDailyLog: (date: string) => Promise<DailyLog | undefined>;
    saveDailyLog: (log: DailyLog) => Promise<unknown>;
    saveJournalEntry: (date: string, entry: string) => Promise<unknown>;

    // Dev Items
    getDevItems: () => Promise<DevItem[]>;
    addDevItem: (text: string) => Promise<unknown>;
    toggleDevItem: (id: number, isComplete: number) => Promise<unknown>;
    deleteDevItem: (id: number) => Promise<unknown>;

    // Repeating Tasks
    getRepeatingTasks: () => Promise<RepeatingTask[]>;
    addRepeatingTask: (task: Omit<RepeatingTask, 'id'>) => Promise<unknown>;
    updateRepeatingTask: (task: RepeatingTask) => Promise<unknown>;
    deleteRepeatingTask: (id: number) => Promise<unknown>;

    // Subjects
    getSubjects: () => Promise<Subject[]>;
    createSubject: (subject: Omit<Subject, 'id'>) => Promise<unknown>;
    updateSubject: (subject: Subject) => Promise<unknown>;
    deleteSubject: (id: number) => Promise<unknown>;

    // Notes
    getNotes: (subjectId: number) => Promise<Note[]>;
    getNote: (id: number) => Promise<Note | undefined>;
    createNote: (note: Omit<Note, 'id'>) => Promise<{ id: number }>;
    updateNote: (note: Note) => Promise<unknown>;
    deleteNote: (id: number) => Promise<unknown>;
    searchNotes: (query: string) => Promise<Note[]>;

    // Streaks
    getStreaks: () => Promise<Streak[]>;
    createStreak: (streak: Omit<Streak, 'id'>) => Promise<unknown>;
    updateStreak: (streak: Streak) => Promise<unknown>;
    deleteStreak: (id: number) => Promise<unknown>;

    // Active Timers (cross-device sync)
    getActiveTimers: () => Promise<{ taskId: number; startTime: string }[]>;
    setActiveTimer: (taskId: number, startTime: string) => Promise<unknown>;
    removeActiveTimer: (taskId: number) => Promise<unknown>;
    sessionExistsForTimer: (taskId: number, startTime: string) => Promise<boolean>;

    // Budget Categories
    getBudgetCategories: () => Promise<BudgetCategory[]>;
    createBudgetCategory: (category: Omit<BudgetCategory, 'id'>) => Promise<unknown>;
    updateBudgetCategory: (category: BudgetCategory) => Promise<unknown>;
    deleteBudgetCategory: (id: number) => Promise<unknown>;

    // Budget Transactions
    getTransactions: (month: string) => Promise<Transaction[]>;
    addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<unknown>;
    updateTransaction: (tx: Transaction) => Promise<unknown>;
    deleteTransaction: (id: number) => Promise<unknown>;

    // Budget Targets
    getBudgetTargets: (month: string) => Promise<BudgetTarget[]>;
    setBudgetTarget: (target: Omit<BudgetTarget, 'id'>) => Promise<unknown>;
    deleteBudgetTarget: (id: number) => Promise<unknown>;

    // Export
    exportAllData: () => Promise<unknown>;

    // ── Fitness ──────────────────────────────────────────────────

    // Catalog
    getExercises: () => Promise<Exercise[]>;
    getPrograms: () => Promise<Program[]>;
    getProgram: (id: string) => Promise<{ program: Program; phases: ProgramPhase[]; days: ProgramDay[]; exercises: ProgramExercise[]; principles: ProgramPrinciple[] }>;
    createProgram: (program: Pick<Program, 'name' | 'description' | 'total_weeks'> & { slug?: string }) => Promise<Program>;
    createProgramPhase: (phase: Pick<ProgramPhase, 'program_id' | 'name' | 'week_start' | 'week_end' | 'rir_guidance' | 'description' | 'order'>) => Promise<ProgramPhase>;
    createProgramDay: (day: Pick<ProgramDay, 'program_id' | 'phase_id' | 'day_of_week' | 'name' | 'focus' | 'order'>) => Promise<ProgramDay>;
    updateProgram: (id: string, updates: Partial<Pick<Program, 'name' | 'description' | 'total_weeks'>>) => Promise<Program>;
    deleteProgram: (id: string) => Promise<unknown>;
    updateProgramPhase: (id: string, updates: Partial<Pick<ProgramPhase, 'name' | 'week_start' | 'week_end' | 'rir_guidance' | 'description' | 'order'>>) => Promise<ProgramPhase>;
    deleteProgramPhase: (id: string) => Promise<unknown>;
    updateProgramDay: (id: string, updates: Partial<Pick<ProgramDay, 'name' | 'focus' | 'day_of_week' | 'order'>>) => Promise<ProgramDay>;
    deleteProgramDay: (id: string) => Promise<unknown>;
    createProgramExercise: (exercise: Pick<ProgramExercise, 'program_day_id' | 'display_name' | 'type' | 'prescribed_sets' | 'prescribed_reps' | 'is_loggable' | 'order'> & { exercise_id?: string | null; notes?: string }) => Promise<ProgramExercise>;
    updateProgramExercise: (id: string, updates: Partial<Pick<ProgramExercise, 'display_name' | 'prescribed_sets' | 'prescribed_reps' | 'notes' | 'type' | 'is_loggable' | 'order'>>) => Promise<ProgramExercise>;
    deleteProgramExercise: (id: string) => Promise<unknown>;

    // User Programs
    getUserPrograms: () => Promise<UserProgram[]>;
    startProgram: (programId: string, startedOn: string) => Promise<UserProgram>;
    updateUserProgram: (id: string, updates: Partial<Pick<UserProgram, 'status' | 'current_week'>>) => Promise<unknown>;

    // Workout Sessions
    getSessionsForProgram: (userProgramId: string) => Promise<WorkoutSession[]>;
    getSession: (id: string) => Promise<WorkoutSession>;
    createSession: (session: Pick<WorkoutSession, 'user_program_id' | 'program_day_id' | 'scheduled_date' | 'status'>) => Promise<WorkoutSession>;
    updateSession: (id: string, updates: Partial<Pick<WorkoutSession, 'completed_at' | 'perceived_effort' | 'notes' | 'status'>>) => Promise<unknown>;
    createWeekSessions: (userProgramId: string, programDays: ProgramDay[], weekStartDate: string) => Promise<WorkoutSession[]>;

    // Exercise Logs
    getExerciseLogs: (sessionId: string) => Promise<ExerciseLog[]>;
    upsertExerciseLog: (log: Omit<ExerciseLog, 'id' | 'created_at' | 'program_exercise' | 'exercise_sets'> & { id?: string }) => Promise<ExerciseLog>;
    deleteExerciseLog: (id: string) => Promise<unknown>;

    // Exercise Sets (per-set expansion)
    getExerciseSets: (logId: string) => Promise<ExerciseSet[]>;
    upsertExerciseSets: (logId: string, sets: Omit<ExerciseSet, 'id' | 'exercise_log_id'>[]) => Promise<ExerciseSet[]>;

    // Body Metrics
    getBodyMetrics: (userId?: string) => Promise<BodyMetric[]>;
    upsertBodyMetric: (metric: Omit<BodyMetric, 'id' | 'created_at'> & { id?: string }) => Promise<BodyMetric>;

    // Exercise History (cross-session)
    getExerciseHistory: (exerciseId: string) => Promise<ExerciseLog[]>;
}
