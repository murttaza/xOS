import type { ApiBackend } from './types';
import { IpcChannels } from '../shared/ipc-types';

// IPC invoke returns Promise<any> at runtime; cast to satisfy the typed interface
export const electronBackend: ApiBackend = {
    // Tasks
    getTasks: () => window.ipcRenderer.invoke(IpcChannels.GetTasks),
    addTask: (task) => window.ipcRenderer.invoke(IpcChannels.AddTask, task),
    updateTask: (task) => window.ipcRenderer.invoke(IpcChannels.UpdateTask, task),
    deleteTask: (id) => window.ipcRenderer.invoke(IpcChannels.DeleteTask, id),
    batchAddTasks: (tasks) => window.ipcRenderer.invoke(IpcChannels.BatchAddTasks, tasks),

    // Sessions
    addSession: (session) => window.ipcRenderer.invoke(IpcChannels.AddSession, session),
    getSessionsByDate: (date) => window.ipcRenderer.invoke(IpcChannels.GetSessionsByDate, date),
    getSessionsRange: (startDate, endDate) => window.ipcRenderer.invoke(IpcChannels.GetSessionsRange, { startDate, endDate }),
    getSessionsByTask: (taskId) => window.ipcRenderer.invoke(IpcChannels.GetSessionsByTask, taskId),

    // Stats
    getStats: () => window.ipcRenderer.invoke(IpcChannels.GetStats),
    updateStat: (stat) => window.ipcRenderer.invoke(IpcChannels.UpdateStat, stat),
    addStat: (statName) => window.ipcRenderer.invoke(IpcChannels.AddStat, statName),
    deleteStat: (statName) => window.ipcRenderer.invoke(IpcChannels.DeleteStat, statName),
    renameStat: (oldName, newName) => window.ipcRenderer.invoke(IpcChannels.RenameStat, { oldName, newName }),

    // Daily Log
    getDailyLog: (date) => window.ipcRenderer.invoke(IpcChannels.GetDailyLog, date),
    saveDailyLog: (log) => window.ipcRenderer.invoke(IpcChannels.SaveDailyLog, log),
    saveJournalEntry: (date, entry) => window.ipcRenderer.invoke(IpcChannels.SaveJournalEntry, { date, entry }),

    // Dev Items
    getDevItems: () => window.ipcRenderer.invoke(IpcChannels.GetDevItems),
    addDevItem: (text) => window.ipcRenderer.invoke(IpcChannels.AddDevItem, text),
    toggleDevItem: (id, isComplete) => window.ipcRenderer.invoke(IpcChannels.ToggleDevItem, { id, isComplete }),
    deleteDevItem: (id) => window.ipcRenderer.invoke(IpcChannels.DeleteDevItem, id),

    // Repeating Tasks
    getRepeatingTasks: () => window.ipcRenderer.invoke(IpcChannels.GetRepeatingTasks),
    addRepeatingTask: (task) => window.ipcRenderer.invoke(IpcChannels.AddRepeatingTask, task),
    updateRepeatingTask: (task) => window.ipcRenderer.invoke(IpcChannels.UpdateRepeatingTask, task),
    deleteRepeatingTask: (id) => window.ipcRenderer.invoke(IpcChannels.DeleteRepeatingTask, id),

    // Subjects
    getSubjects: () => window.ipcRenderer.invoke(IpcChannels.GetSubjects),
    createSubject: (subject) => window.ipcRenderer.invoke(IpcChannels.CreateSubject, subject),
    updateSubject: (subject) => window.ipcRenderer.invoke(IpcChannels.UpdateSubject, subject),
    deleteSubject: (id) => window.ipcRenderer.invoke(IpcChannels.DeleteSubject, id),

    // Notes
    getNotes: (subjectId) => window.ipcRenderer.invoke(IpcChannels.GetNotes, subjectId),
    getNote: (id) => window.ipcRenderer.invoke(IpcChannels.GetNote, id),
    createNote: (note) =>
        window.ipcRenderer.invoke(IpcChannels.CreateNote, note)
            .then((r: any) => ({ id: r.lastInsertRowid as number })),
    updateNote: (note) => window.ipcRenderer.invoke(IpcChannels.UpdateNote, note),
    deleteNote: (id) => window.ipcRenderer.invoke(IpcChannels.DeleteNote, id),
    searchNotes: (query) => window.ipcRenderer.invoke(IpcChannels.SearchNotes, query),

    // Streaks
    getStreaks: () => window.ipcRenderer.invoke(IpcChannels.GetStreaks),
    createStreak: (streak) => window.ipcRenderer.invoke(IpcChannels.CreateStreak, streak),
    updateStreak: (streak) => window.ipcRenderer.invoke(IpcChannels.UpdateStreak, streak),
    deleteStreak: (id) => window.ipcRenderer.invoke(IpcChannels.DeleteStreak, id),

    // Active Timers (not used in Electron since it also uses Supabase now, but satisfies interface)
    getActiveTimers: async () => [],
    setActiveTimer: async () => {},
    removeActiveTimer: async () => {},
    sessionExistsForTimer: async () => false,

    // Budget (not used in Electron — Supabase is the backend)
    getBudgetCategories: async () => [],
    createBudgetCategory: async () => {},
    updateBudgetCategory: async () => {},
    deleteBudgetCategory: async () => {},
    getTransactions: async () => [],
    addTransaction: async () => {},
    updateTransaction: async () => {},
    deleteTransaction: async () => {},
    getBudgetTargets: async () => [],
    setBudgetTarget: async () => {},
    deleteBudgetTarget: async () => {},

    // Export
    exportAllData: () => window.ipcRenderer.invoke(IpcChannels.ExportAllData),

    // Fitness — Electron uses Supabase for fitness (no local SQLite)
    getExercises: async () => [],
    getPrograms: async () => [],
    getProgram: async () => ({ program: {} as any, phases: [], days: [], exercises: [], principles: [] }),
    createProgram: async () => ({} as any),
    createProgramPhase: async () => ({} as any),
    createProgramDay: async () => ({} as any),
    getUserPrograms: async () => [],
    startProgram: async () => ({} as any),
    updateUserProgram: async () => {},
    getSessionsForProgram: async () => [],
    getSession: async () => ({} as any),
    createSession: async () => ({} as any),
    updateSession: async () => {},
    createWeekSessions: async () => [],
    getExerciseLogs: async () => [],
    upsertExerciseLog: async () => ({} as any),
    deleteExerciseLog: async () => {},
    getExerciseSets: async () => [],
    upsertExerciseSets: async () => [],
    getBodyMetrics: async () => [],
    upsertBodyMetric: async () => ({} as any),
    getExerciseHistory: async () => [],
} as ApiBackend;
