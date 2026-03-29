import type { Task, Session, Stat, DailyLog, DevItem, RepeatingTask, Subject, Note, Streak, BudgetCategory, Transaction, BudgetTarget } from '../types';

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
}
