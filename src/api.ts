import { Task, Session, Stat, DailyLog, DevItem, RepeatingTask, Subject, Note, Streak } from './types';
import { IpcChannels } from './shared/ipc-types';

export const api = {
    getTasks: () => window.ipcRenderer.invoke(IpcChannels.GetTasks) as Promise<Task[]>,
    addTask: (task: Omit<Task, 'id'>) => window.ipcRenderer.invoke(IpcChannels.AddTask, task),
    updateTask: (task: Task) => window.ipcRenderer.invoke(IpcChannels.UpdateTask, task),
    deleteTask: (id: number) => window.ipcRenderer.invoke(IpcChannels.DeleteTask, id),
    batchAddTasks: (tasks: Omit<Task, 'id'>[]) => window.ipcRenderer.invoke(IpcChannels.BatchAddTasks, tasks),

    addSession: (session: Omit<Session, 'id'>) => window.ipcRenderer.invoke(IpcChannels.AddSession, session),
    getSessionsByDate: (date: string) => window.ipcRenderer.invoke(IpcChannels.GetSessionsByDate, date) as Promise<Session[]>,
    getSessionsRange: (startDate: string, endDate: string) => window.ipcRenderer.invoke(IpcChannels.GetSessionsRange, { startDate, endDate }) as Promise<Session[]>,
    getSessionsByTask: (taskId: number) => window.ipcRenderer.invoke(IpcChannels.GetSessionsByTask, taskId) as Promise<Session[]>,

    getStats: () => window.ipcRenderer.invoke(IpcChannels.GetStats) as Promise<Stat[]>,
    updateStat: (stat: Stat) => window.ipcRenderer.invoke(IpcChannels.UpdateStat, stat),
    addStat: (statName: string) => window.ipcRenderer.invoke(IpcChannels.AddStat, statName),
    deleteStat: (statName: string) => window.ipcRenderer.invoke(IpcChannels.DeleteStat, statName),
    renameStat: (oldName: string, newName: string) => window.ipcRenderer.invoke(IpcChannels.RenameStat, { oldName, newName }),

    getDailyLog: (date: string) => window.ipcRenderer.invoke(IpcChannels.GetDailyLog, date) as Promise<DailyLog | undefined>,
    saveDailyLog: (log: DailyLog) => window.ipcRenderer.invoke(IpcChannels.SaveDailyLog, log),
    saveJournalEntry: (date: string, entry: string) => window.ipcRenderer.invoke(IpcChannels.SaveJournalEntry, { date, entry }),

    getDevItems: () => window.ipcRenderer.invoke(IpcChannels.GetDevItems) as Promise<DevItem[]>,
    addDevItem: (text: string) => window.ipcRenderer.invoke(IpcChannels.AddDevItem, text),
    toggleDevItem: (id: number, isComplete: number) => window.ipcRenderer.invoke(IpcChannels.ToggleDevItem, { id, isComplete }),
    deleteDevItem: (id: number) => window.ipcRenderer.invoke(IpcChannels.DeleteDevItem, id),

    getRepeatingTasks: () => window.ipcRenderer.invoke(IpcChannels.GetRepeatingTasks) as Promise<RepeatingTask[]>,
    addRepeatingTask: (task: Omit<RepeatingTask, 'id'>) => window.ipcRenderer.invoke(IpcChannels.AddRepeatingTask, task),
    updateRepeatingTask: (task: RepeatingTask) => window.ipcRenderer.invoke(IpcChannels.UpdateRepeatingTask, task),
    deleteRepeatingTask: (id: number) => window.ipcRenderer.invoke(IpcChannels.DeleteRepeatingTask, id),

    // Notes Mode
    getSubjects: () => window.ipcRenderer.invoke(IpcChannels.GetSubjects) as Promise<Subject[]>,
    createSubject: (subject: Omit<Subject, 'id'>) => window.ipcRenderer.invoke(IpcChannels.CreateSubject, subject),
    updateSubject: (subject: Subject) => window.ipcRenderer.invoke(IpcChannels.UpdateSubject, subject),
    deleteSubject: (id: number) => window.ipcRenderer.invoke(IpcChannels.DeleteSubject, id),

    getNotes: (subjectId: number) => window.ipcRenderer.invoke(IpcChannels.GetNotes, subjectId) as Promise<Note[]>,
    getNote: (id: number) => window.ipcRenderer.invoke(IpcChannels.GetNote, id) as Promise<Note | undefined>,
    createNote: (note: Omit<Note, 'id'>) => window.ipcRenderer.invoke(IpcChannels.CreateNote, note),
    updateNote: (note: Note) => window.ipcRenderer.invoke(IpcChannels.UpdateNote, note),
    deleteNote: (id: number) => window.ipcRenderer.invoke(IpcChannels.DeleteNote, id),
    searchNotes: (query: string) => window.ipcRenderer.invoke(IpcChannels.SearchNotes, query) as Promise<Note[]>,

    // Streaks
    getStreaks: () => window.ipcRenderer.invoke(IpcChannels.GetStreaks) as Promise<Streak[]>,
    createStreak: (streak: Omit<Streak, 'id'>) => window.ipcRenderer.invoke(IpcChannels.CreateStreak, streak),
    updateStreak: (streak: Streak) => window.ipcRenderer.invoke(IpcChannels.UpdateStreak, streak),
    deleteStreak: (id: number) => window.ipcRenderer.invoke(IpcChannels.DeleteStreak, id),

    // Export
    exportAllData: () => window.ipcRenderer.invoke(IpcChannels.ExportAllData) as Promise<any>,
};
