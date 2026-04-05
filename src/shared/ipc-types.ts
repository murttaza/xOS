import type { Task, Session, Stat, DailyLog, DevItem, RepeatingTask, Subject, Note, Streak } from '../types';

/**
 * All IPC channel names used between renderer and main process.
 * Both sides import from here to keep channel strings in sync.
 */
export const IpcChannels = {
  // Tasks
  GetTasks: 'get-tasks',
  AddTask: 'add-task',
  UpdateTask: 'update-task',
  DeleteTask: 'delete-task',
  BatchAddTasks: 'batch-add-tasks',

  // Sessions
  AddSession: 'add-session',
  GetSessionsByDate: 'get-sessions-by-date',
  GetSessionsRange: 'get-sessions-range',
  GetSessionsByTask: 'get-sessions-by-task',

  // Stats
  GetStats: 'get-stats',
  UpdateStat: 'update-stat',
  AddStat: 'add-stat',
  DeleteStat: 'delete-stat',
  RenameStat: 'rename-stat',

  // Daily Log
  GetDailyLog: 'get-daily-log',
  SaveDailyLog: 'save-daily-log',
  SaveJournalEntry: 'save-journal-entry',

  // Dev Items
  GetDevItems: 'get-dev-items',
  AddDevItem: 'add-dev-item',
  ToggleDevItem: 'toggle-dev-item',
  DeleteDevItem: 'delete-dev-item',

  // Repeating Tasks
  GetRepeatingTasks: 'get-repeating-tasks',
  AddRepeatingTask: 'add-repeating-task',
  UpdateRepeatingTask: 'update-repeating-task',
  DeleteRepeatingTask: 'delete-repeating-task',

  // Notes Mode - Subjects
  GetSubjects: 'get-subjects',
  CreateSubject: 'create-subject',
  UpdateSubject: 'update-subject',
  DeleteSubject: 'delete-subject',

  // Notes Mode - Notes
  GetNotes: 'get-notes',
  GetNote: 'get-note',
  CreateNote: 'create-note',
  UpdateNote: 'update-note',
  DeleteNote: 'delete-note',
  SearchNotes: 'search-notes',

  // Streaks
  GetStreaks: 'get-streaks',
  CreateStreak: 'create-streak',
  UpdateStreak: 'update-streak',
  DeleteStreak: 'delete-streak',

  // Export
  ExportAllData: 'export-all-data',

  // Multi-window coordination
  DataChanged: 'data-changed',
  RequestAppState: 'request-app-state',
  AppStateResponse: 'app-state-response',
  OpenFullApp: 'open-full-app',

  // Command Palette
  TogglePalette: 'toggle-palette',

  // Auto-Launch
  SetAutoLaunch: 'set-auto-launch',
  GetAutoLaunch: 'get-auto-launch',

  // Idle Detection
  IdleTimerPaused: 'idle:timer-paused',
  IdleReturnPrompt: 'idle:return-prompt',
  IdleReturnResponse: 'idle:return-response',

  // Notifications
  SetNotificationPrefs: 'set-notification-prefs',
  GetNotificationPrefs: 'get-notification-prefs',
} as const;

/** Union of all IPC channel name strings */
export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels];

// ── Request argument types ──────────────────────────────────────────

export type RenameStatArgs = { oldName: string; newName: string };
export type GetSessionsRangeArgs = { startDate: string; endDate: string };
export type SaveJournalEntryArgs = { date: string; entry: string };
export type ToggleDevItemArgs = { id: number; isComplete: number };

// ── Per-channel handler signatures ──────────────────────────────────

/**
 * Maps every IPC channel to its (args → return) function signature.
 * `args` is what the renderer sends; the return type is what the
 * handler resolves with.
 */
export interface IpcHandlerMap {
  // Tasks
  [IpcChannels.GetTasks]: () => Task[];
  [IpcChannels.AddTask]: (task: Omit<Task, 'id'>) => unknown;
  [IpcChannels.UpdateTask]: (task: Task) => unknown;
  [IpcChannels.DeleteTask]: (id: number) => unknown;
  [IpcChannels.BatchAddTasks]: (tasks: Omit<Task, 'id'>[]) => unknown;

  // Sessions
  [IpcChannels.AddSession]: (session: Omit<Session, 'id'>) => unknown;
  [IpcChannels.GetSessionsByDate]: (date: string) => Session[];
  [IpcChannels.GetSessionsRange]: (args: GetSessionsRangeArgs) => Session[];
  [IpcChannels.GetSessionsByTask]: (taskId: number) => Session[];

  // Stats
  [IpcChannels.GetStats]: () => Stat[];
  [IpcChannels.UpdateStat]: (stat: Stat) => unknown;
  [IpcChannels.AddStat]: (statName: string) => unknown;
  [IpcChannels.DeleteStat]: (statName: string) => unknown;
  [IpcChannels.RenameStat]: (args: RenameStatArgs) => unknown;

  // Daily Log
  [IpcChannels.GetDailyLog]: (date: string) => DailyLog | undefined;
  [IpcChannels.SaveDailyLog]: (log: DailyLog) => unknown;
  [IpcChannels.SaveJournalEntry]: (args: SaveJournalEntryArgs) => unknown;

  // Dev Items
  [IpcChannels.GetDevItems]: () => DevItem[];
  [IpcChannels.AddDevItem]: (text: string) => unknown;
  [IpcChannels.ToggleDevItem]: (args: ToggleDevItemArgs) => unknown;
  [IpcChannels.DeleteDevItem]: (id: number) => unknown;

  // Repeating Tasks
  [IpcChannels.GetRepeatingTasks]: () => RepeatingTask[];
  [IpcChannels.AddRepeatingTask]: (task: Omit<RepeatingTask, 'id'>) => unknown;
  [IpcChannels.UpdateRepeatingTask]: (task: RepeatingTask) => unknown;
  [IpcChannels.DeleteRepeatingTask]: (id: number) => unknown;

  // Subjects
  [IpcChannels.GetSubjects]: () => Subject[];
  [IpcChannels.CreateSubject]: (subject: Omit<Subject, 'id'>) => unknown;
  [IpcChannels.UpdateSubject]: (subject: Subject) => unknown;
  [IpcChannels.DeleteSubject]: (id: number) => unknown;

  // Notes
  [IpcChannels.GetNotes]: (subjectId: number) => Note[];
  [IpcChannels.GetNote]: (id: number) => Note | undefined;
  [IpcChannels.CreateNote]: (note: Omit<Note, 'id'>) => unknown;
  [IpcChannels.UpdateNote]: (note: Note) => unknown;
  [IpcChannels.DeleteNote]: (id: number) => unknown;
  [IpcChannels.SearchNotes]: (query: string) => Note[];

  // Streaks
  [IpcChannels.GetStreaks]: () => Streak[];
  [IpcChannels.CreateStreak]: (streak: Omit<Streak, 'id'>) => unknown;
  [IpcChannels.UpdateStreak]: (streak: Streak) => unknown;
  [IpcChannels.DeleteStreak]: (id: number) => unknown;

  // Export
  [IpcChannels.ExportAllData]: () => unknown;
}
