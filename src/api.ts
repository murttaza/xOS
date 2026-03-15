import { Task, Session, Stat, DailyLog, DevItem, RepeatingTask, Subject, Note, Streak } from './types';

export const api = {
    getTasks: () => window.ipcRenderer.invoke('get-tasks') as Promise<Task[]>,
    addTask: (task: Omit<Task, 'id'>) => window.ipcRenderer.invoke('add-task', task),
    updateTask: (task: Task) => window.ipcRenderer.invoke('update-task', task),
    deleteTask: (id: number) => window.ipcRenderer.invoke('delete-task', id),

    addSession: (session: Omit<Session, 'id'>) => window.ipcRenderer.invoke('add-session', session),
    getSessionsByDate: (date: string) => window.ipcRenderer.invoke('get-sessions-by-date', date) as Promise<Session[]>,
    getSessionsRange: (startDate: string, endDate: string) => window.ipcRenderer.invoke('get-sessions-range', { startDate, endDate }) as Promise<Session[]>,
    getSessionsByTask: (taskId: number) => window.ipcRenderer.invoke('get-sessions-by-task', taskId) as Promise<Session[]>,

    getStats: () => window.ipcRenderer.invoke('get-stats') as Promise<Stat[]>,
    updateStat: (stat: Stat) => window.ipcRenderer.invoke('update-stat', stat),
    addStat: (statName: string) => window.ipcRenderer.invoke('add-stat', statName),
    deleteStat: (statName: string) => window.ipcRenderer.invoke('delete-stat', statName),
    renameStat: (oldName: string, newName: string) => window.ipcRenderer.invoke('rename-stat', { oldName, newName }),

    getDailyLog: (date: string) => window.ipcRenderer.invoke('get-daily-log', date) as Promise<DailyLog | undefined>,
    saveDailyLog: (log: DailyLog) => window.ipcRenderer.invoke('save-daily-log', log),
    saveJournalEntry: (date: string, entry: string) => window.ipcRenderer.invoke('save-journal-entry', { date, entry }),

    getDevItems: () => window.ipcRenderer.invoke('get-dev-items') as Promise<DevItem[]>,
    addDevItem: (text: string) => window.ipcRenderer.invoke('add-dev-item', text),
    toggleDevItem: (id: number, isComplete: number) => window.ipcRenderer.invoke('toggle-dev-item', { id, isComplete }),
    deleteDevItem: (id: number) => window.ipcRenderer.invoke('delete-dev-item', id),

    getRepeatingTasks: () => window.ipcRenderer.invoke('get-repeating-tasks') as Promise<RepeatingTask[]>,
    addRepeatingTask: (task: Omit<RepeatingTask, 'id'>) => window.ipcRenderer.invoke('add-repeating-task', task),
    updateRepeatingTask: (task: RepeatingTask) => window.ipcRenderer.invoke('update-repeating-task', task),
    deleteRepeatingTask: (id: number) => window.ipcRenderer.invoke('delete-repeating-task', id),

    // Notes Mode
    getSubjects: () => window.ipcRenderer.invoke('get-subjects') as Promise<Subject[]>,
    createSubject: (subject: Omit<Subject, 'id'>) => window.ipcRenderer.invoke('create-subject', subject),
    updateSubject: (subject: Subject) => window.ipcRenderer.invoke('update-subject', subject),
    deleteSubject: (id: number) => window.ipcRenderer.invoke('delete-subject', id),

    getNotes: (subjectId: number) => window.ipcRenderer.invoke('get-notes', subjectId) as Promise<Note[]>,
    getNote: (id: number) => window.ipcRenderer.invoke('get-note', id) as Promise<Note | undefined>,
    createNote: (note: Omit<Note, 'id'>) => window.ipcRenderer.invoke('create-note', note),
    updateNote: (note: Note) => window.ipcRenderer.invoke('update-note', note),
    deleteNote: (id: number) => window.ipcRenderer.invoke('delete-note', id),
    searchNotes: (query: string) => window.ipcRenderer.invoke('search-notes', query) as Promise<Note[]>,

    // Streaks
    getStreaks: () => window.ipcRenderer.invoke('get-streaks') as Promise<Streak[]>,
    createStreak: (streak: Omit<Streak, 'id'>) => window.ipcRenderer.invoke('create-streak', streak),
    updateStreak: (streak: Streak) => window.ipcRenderer.invoke('update-streak', streak),
    deleteStreak: (id: number) => window.ipcRenderer.invoke('delete-streak', id),

    // Export
    exportAllData: () => window.ipcRenderer.invoke('export-all-data') as Promise<any>,
};
