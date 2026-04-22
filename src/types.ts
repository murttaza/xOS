export interface Task {
    id?: number;
    title: string;
    description: string;
    dueDate: string;
    difficulty: number;
    isComplete: number; // 0 or 1
    statTarget: string[];
    labels: string[]; // JSON array
    repeatingTaskId?: number;
    subtasks?: Subtask[];
    completedAt?: string;
    noteId?: number | null;
    time?: string | null;
}

export interface Subtask {
    id: string; // uuid
    text: string;
    isComplete: boolean;
}

export interface RepeatingTask {
    id?: number;
    title: string;
    description: string;
    difficulty: number;
    statTarget: string[];
    labels: string[];
    repeatType: 'daily' | 'weekly';
    repeatDays: number[]; // 0-6 for Sunday-Saturday
    isActive: number; // 0 or 1
    lastGeneratedDate?: string;
    subtasks?: Subtask[];
    streak?: number;
}

export interface Session {
    id?: number;
    taskId: number;
    startTime: string;
    endTime: string;
    duration_minutes: number;
    dateLogged: string;
}

export interface Stat {
    statName: string;
    currentXP: number;
    currentLevel: number;
}

export interface DailyLog {
    date: string;
    journalEntry: string;
    prayersCompleted: string; // JSON
}

export interface DevItem {
    id?: number;
    text: string;
    isComplete: number; // 0 or 1
}

export interface Subject {
    id?: number;
    title: string;
    color: string;
    createdAt?: string;
    orderIndex: number;
}

export interface Note {
    id?: number;
    subjectId: number;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    // Joined fields from search
    subjectTitle?: string;
    subjectColor?: string;
}

export interface Streak {
    id?: number;
    title: string;
    currentStreak: number;
    lastUpdated: string;
    isPaused: number; // 0 or 1
    createdAt?: string;
}

// Passwords (Electron only — local encrypted storage via OS keychain/DPAPI)
export interface PasswordEntry {
    id?: number;
    name: string;                 // Display name (e.g. "Gmail")
    username: string;             // Email/username
    passwordEnc?: string;         // Base64 ciphertext, never exposed to UI
    url?: string;
    notes?: string;
    category?: string;            // Optional group tag
    isPinned: number;             // 0 or 1
    orderIndex?: number;
    createdAt?: string;
    updatedAt?: string;
    lastUsed?: string | null;
}

export interface BudgetCategory {
    id?: number;
    name: string;
    icon: string;
    color: string;
    isIncome: number; // 0 or 1
    parentId?: number | null;
    orderIndex: number;
}

export interface Transaction {
    id?: number;
    amount: number;
    categoryId: number;
    isIncome: number; // 0 or 1
    date: string; // YYYY-MM-DD
    paymentMethod: string;
    notes: string;
    isRecurring: number; // 0 or 1
    recurringRule?: { type: 'monthly' | 'weekly'; dayOfMonth?: number; dayOfWeek?: number };
    createdAt?: string;
    // Joined fields for display
    categoryName?: string;
    categoryColor?: string;
    categoryIcon?: string;
}

export interface BudgetTarget {
    id?: number;
    categoryId: number;
    month: string; // YYYY-MM
    limitAmount: number;
    categoryName?: string;
}

// ── Fitness ──────────────────────────────────────────────────

export interface Exercise {
    id: string; // uuid
    name: string;
    category: string;
    default_unit: string;
}

export interface Program {
    id: string;
    slug: string;
    name: string;
    description: string;
    total_weeks: number;
    created_at: string;
}

export interface ProgramPhase {
    id: string;
    program_id: string;
    name: string;
    week_start: number;
    week_end: number;
    rir_guidance: string;
    description: string;
    order: number;
}

export interface ProgramDay {
    id: string;
    program_id: string;
    phase_id: string;
    day_of_week: number; // 1=Mon ... 7=Sun
    name: string;
    focus: string;
    order: number;
}

export interface ProgramExercise {
    id: string;
    program_day_id: string;
    exercise_id: string | null;
    display_name: string;
    type: string; // strength, conditioning, mobility, core, warmup, finisher
    prescribed_sets: string;
    prescribed_reps: string;
    notes: string | null;
    is_loggable: boolean;
    order: number;
}

export interface ProgramPrinciple {
    id: string;
    program_id: string;
    title: string;
    body: string;
    order: number;
}

export interface UserProgram {
    id: string;
    user_id: string;
    program_id: string;
    started_on: string; // date
    current_week: number;
    status: 'active' | 'paused' | 'completed' | 'abandoned';
    created_at: string;
    // Joined
    program?: Program;
}

export interface WorkoutSession {
    id: string;
    user_program_id: string;
    program_day_id: string;
    scheduled_date: string; // date
    completed_at: string | null;
    perceived_effort: number | null;
    notes: string | null;
    status: 'planned' | 'in_progress' | 'completed' | 'skipped';
    created_at: string;
    // Joined
    program_day?: ProgramDay;
    exercise_logs?: ExerciseLog[];
}

export interface ExerciseLog {
    id: string;
    session_id: string;
    program_exercise_id: string;
    exercise_id: string | null;
    substituted: boolean;
    working_weight: number | null;
    weight_unit: string;
    reps_hit: number | null;
    sets_completed: number | null;
    rir: number | null;
    duration_seconds: number | null;
    notes: string | null;
    is_completed: boolean;
    created_at: string;
    // Joined
    program_exercise?: ProgramExercise;
    exercise_sets?: ExerciseSet[];
}

export interface ExerciseSet {
    id: string;
    exercise_log_id: string;
    set_number: number;
    weight: number | null;
    reps: number | null;
    rir: number | null;
}

export interface BodyMetric {
    id: string;
    user_id: string;
    user_program_id: string | null;
    week_number: number | null;
    date: string;
    body_weight: number | null;
    weight_unit: string;
    rhr: number | null;
    rope_minutes: number | null;
    rope_pace: number | null;
    bench_top_set: string | null;
    squat_top_set: string | null;
    deadlift_top_set: string | null;
    notes: string | null;
    created_at: string;
}
