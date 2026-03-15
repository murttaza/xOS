import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, Stat, DailyLog, Session, DevItem, RepeatingTask, Subject, Note, Subtask } from './types';
import { api } from './api';
import { safeJSONParse, calculateSessionXP, calculateLevelFromXP, getLocalDateString } from './lib/utils';

// Raw types from DB before parsing JSON fields
interface RawTask extends Omit<Task, 'labels' | 'statTarget' | 'subtasks'> {
    labels: string;
    statTarget: string;
    subtasks: string;
}

interface RawRepeatingTask extends Omit<RepeatingTask, 'labels' | 'statTarget' | 'repeatDays' | 'subtasks'> {
    labels: string;
    statTarget: string;
    repeatDays: string;
    subtasks: string;
}

// Parsing helpers to avoid duplicating JSON deserialization logic
function parseStatTarget(raw: string): string[] {
    let parsed = safeJSONParse(raw, [] as string[]);
    if (typeof parsed === 'string') {
        parsed = [parsed];
    } else if (!Array.isArray(parsed) && parsed) {
        parsed = [String(parsed)];
    }
    return parsed;
}

function parseRawTask(t: RawTask): Task {
    return {
        ...t,
        labels: safeJSONParse(t.labels, []),
        statTarget: parseStatTarget(t.statTarget),
        subtasks: safeJSONParse(t.subtasks, [])
    };
}

function parseRawRepeatingTask(t: RawRepeatingTask): RepeatingTask {
    return {
        ...t,
        labels: safeJSONParse(t.labels, [] as string[]),
        statTarget: parseStatTarget(t.statTarget),
        repeatDays: safeJSONParse(t.repeatDays, [] as number[]),
        subtasks: safeJSONParse(t.subtasks, [] as Subtask[]),
        streak: t.streak || 0
    };
}

interface AppState {
    tasks: Task[];
    stats: Stat[];
    dailyLog: DailyLog | null;
    sessions: Session[];

    fetchTasks: () => Promise<void>;
    fetchStats: () => Promise<void>;
    addStat: (statName: string) => Promise<void>;
    deleteStat: (statName: string) => Promise<void>;
    renameStat: (oldName: string, newName: string) => Promise<void>;
    fetchDailyLog: (date: string) => Promise<void>;
    fetchSessionsRange: (startDate: string, endDate: string) => Promise<void>;

    addTask: (task: Omit<Task, 'id'>) => Promise<void>;
    updateTask: (task: Task) => Promise<void>;
    deleteTask: (id: number) => Promise<void>;

    addSession: (session: Omit<Session, 'id'>) => Promise<void>;
    saveJournalEntry: (date: string, entry: string) => Promise<void>;
    togglePrayer: (prayerName: string) => Promise<void>;

    // Timer state - Multi-tasking support
    activeTimers: Record<number, number>; // taskId -> duration in seconds
    toggleTaskTimer: (taskId: number) => Promise<void>;
    stopTaskTimer: (taskId: number) => Promise<void>;
    incrementTimers: () => void;

    // Pomodoro
    pomodoroTime: number;
    isPomodoroRunning: boolean;
    setPomodoroTime: (time: number) => void;
    setIsPomodoroRunning: (isRunning: boolean) => void;

    isFocusMode: boolean;
    setIsFocusMode: (isFocusMode: boolean) => void;

    isMurtazaMode: boolean;
    setIsMurtazaMode: (isMurtazaMode: boolean) => void;

    isHardcoreMode: boolean;
    setIsHardcoreMode: (isHardcoreMode: boolean) => void;

    isTransitioning: boolean;
    triggerTransition: (action: () => void) => Promise<void>;


    devItems: DevItem[];
    fetchDevItems: () => Promise<void>;
    addDevItem: (text: string) => Promise<void>;
    toggleDevItem: (id: number) => Promise<void>;
    deleteDevItem: (id: number) => Promise<void>;

    osPrefix: string;
    setOsPrefix: (prefix: string) => void;

    repeatingTasks: RepeatingTask[];
    fetchRepeatingTasks: () => Promise<void>;
    addRepeatingTask: (task: Omit<RepeatingTask, 'id'>) => Promise<void>;
    updateRepeatingTask: (task: RepeatingTask) => Promise<void>;
    deleteRepeatingTask: (id: number) => Promise<void>;
    checkMissedTasks: () => Promise<void>;

    // Notes Mode
    isNotesMode: boolean;
    toggleNotesMode: () => void;

    subjects: Subject[];
    currentSubjectId: number | null;
    targetNoteId: number | null;
    notes: Note[];
    searchResults: Note[]; // For global search

    fetchSubjects: () => Promise<void>;
    createSubject: (subject: Omit<Subject, 'id'>) => Promise<void>;
    updateSubject: (subject: Subject) => Promise<void>;
    deleteSubject: (id: number) => Promise<void>;

    openSubject: (id: number, noteId?: number) => Promise<void>;
    closeSubject: () => void;

    fetchNotes: (subjectId: number) => Promise<void>;
    createNote: (note: Omit<Note, 'id'>) => Promise<number>;
    updateNote: (note: Note) => Promise<void>;
    deleteNote: (id: number) => Promise<void>;

    searchNotes: (query: string) => Promise<void>;

    // Year Mode (Habits / Streaks)
    isYearMode: boolean;
    toggleYearMode: () => void;

    streaks: import('./types').Streak[];
    fetchStreaks: () => Promise<void>;
    createStreak: (streak: Omit<import('./types').Streak, 'id'>) => Promise<void>;
    updateStreak: (streak: import('./types').Streak) => Promise<void>;
    deleteStreak: (id: number) => Promise<void>;
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            tasks: [],
            stats: [],
            dailyLog: null,
            sessions: [],
            devItems: [],
            repeatingTasks: [],
            activeTimers: {},
            streaks: [],

            fetchTasks: async () => {
                try {
                    const tasks = await api.getTasks();
                    set({
                        tasks: (tasks as unknown as RawTask[]).map(parseRawTask)
                    });
                } catch (error) {
                    console.error('Failed to fetch tasks:', error);
                }
            },
            fetchStats: async () => {
                try {
                    const stats = await api.getStats();
                    set({ stats });
                } catch (error) {
                    console.error('Failed to fetch stats:', error);
                }
            },
            addStat: async (statName) => {
                await api.addStat(statName);
                get().fetchStats();
            },
            deleteStat: async (statName) => {
                await api.deleteStat(statName);
                get().fetchStats();
            },
            renameStat: async (oldName, newName) => {
                await api.renameStat(oldName, newName);
                get().fetchStats();
                get().fetchTasks(); // Tasks might have been updated
            },
            fetchDailyLog: async (date) => {
                const log = await api.getDailyLog(date);
                set({ dailyLog: log || null });
            },
            fetchSessionsRange: async (startDate, endDate) => {
                const sessions = await api.getSessionsRange(startDate, endDate);
                set({ sessions });
            },

            addTask: async (task) => {
                try {
                    await api.addTask(task);
                    get().fetchTasks();
                } catch (error) {
                    console.error('Failed to add task:', error);
                }
            },
            updateTask: async (task) => {
                // Check if task is being completed
                const originalTask = get().tasks.find(t => t.id === task.id);
                if (originalTask) {
                    if (task.isComplete === 1 && !originalTask.isComplete) {
                        // Task Just Completed
                        task.completedAt = new Date().toISOString();

                        // 1. Check for repeating task streak
                        if (task.repeatingTaskId) {
                            const repeatingTask = get().repeatingTasks.find(rt => rt.id === task.repeatingTaskId);
                            if (repeatingTask) {
                                const newStreak = (repeatingTask.streak || 0) + 1;
                                await api.updateRepeatingTask({ ...repeatingTask, streak: newStreak });
                                get().fetchRepeatingTasks();
                            }
                        }
                    }
                }

                await api.updateTask(task);
                get().fetchTasks();
            },
            deleteTask: async (id) => {
                const state = get();
                // Stop timer if running for this task
                if (state.activeTimers[id] !== undefined) {
                    await state.stopTaskTimer(id);
                }
                await api.deleteTask(id);
                get().fetchTasks();
            },

            addSession: async (session) => {
                await api.addSession(session);

                // Calculate XP and update stats
                const state = get();
                const task = state.tasks.find(t => t.id === session.taskId);
                const newStats = [...state.stats];
                let statsUpdated = false;

                if (task && session.duration_minutes > 0) {
                    const xpEarned = calculateSessionXP(session.duration_minutes, task.difficulty);
                    // Edge case: ensure statTarget is always an array
                    const statTargets = Array.isArray(task.statTarget) ? task.statTarget : (task.statTarget ? [task.statTarget] : []);

                    for (const statName of statTargets) {
                        if (!statName) continue; // Skip empty/null stat names
                        const statIndex = newStats.findIndex(s => s.statName === statName);

                        if (statIndex !== -1) {
                            const stat = newStats[statIndex];
                            const { newXP, newLevel } = calculateLevelFromXP(stat.currentXP + xpEarned, stat.currentLevel);

                            await api.updateStat({
                                statName,
                                currentXP: newXP,
                                currentLevel: newLevel
                            });

                            newStats[statIndex] = {
                                ...stat,
                                currentXP: newXP,
                                currentLevel: newLevel
                            };
                            statsUpdated = true;
                        }
                    }
                }

                // Optimistically update sessions and stats
                set((state) => ({
                    sessions: [...state.sessions, session as Session],
                    stats: statsUpdated ? newStats : state.stats
                }));
            },

            saveJournalEntry: async (date: string, entry: string) => {
                // Use the specific API that preserves other fields (like prayers)
                await api.saveJournalEntry(date, entry);

                // Only update local state if it's still relevant (i.e., user hasn't switched dates)
                const state = get();
                if (state.dailyLog && state.dailyLog.date === date) {
                    set({ dailyLog: { ...state.dailyLog, journalEntry: entry } });
                }
            },

            togglePrayer: async (prayerName: string) => {
                const state = get();
                const today = getLocalDateString();
                let log = state.dailyLog;

                if (!log || log.date !== today) {
                    log = {
                        date: today,
                        journalEntry: "",
                        prayersCompleted: "{}"
                    };
                }

                const prayers = safeJSONParse<Record<string, boolean>>(log.prayersCompleted, {});
                const wasCompleted = prayers[prayerName];
                prayers[prayerName] = !wasCompleted;

                const newStats = [...state.stats];

                // XP Logic for Prayer
                if (!wasCompleted) {
                    const statIndex = newStats.findIndex(s => s.statName === "Religion");
                    if (statIndex !== -1) {
                        const stat = newStats[statIndex];
                        const { newXP, newLevel } = calculateLevelFromXP(stat.currentXP + 500, stat.currentLevel);

                        await api.updateStat({
                            statName: "Religion",
                            currentXP: newXP,
                            currentLevel: newLevel
                        });

                        newStats[statIndex] = {
                            ...stat,
                            currentXP: newXP,
                            currentLevel: newLevel
                        };
                    }
                }

                const newLog = { ...log, prayersCompleted: JSON.stringify(prayers) };
                await api.saveDailyLog(newLog);
                set({
                    dailyLog: newLog,
                    stats: newStats
                });
            },

            toggleTaskTimer: async (taskId: number) => {
                const state = get();

                if (state.activeTimers[taskId] !== undefined) {
                    // Task is running, stop it
                    await state.stopTaskTimer(taskId);
                } else {
                    // Start new task (allow parallel)
                    set((state) => ({
                        activeTimers: { ...state.activeTimers, [taskId]: 0 }
                    }));
                }
            },

            stopTaskTimer: async (taskId: number) => {
                const state = get();
                const duration = state.activeTimers[taskId];

                if (duration === undefined) return;

                // Stop timer immediately in UI
                const newTimers = { ...state.activeTimers };
                delete newTimers[taskId];
                set({ activeTimers: newTimers });

                const durationMinutes = Math.floor(duration / 60);

                if (durationMinutes > 0) {
                    const now = new Date();
                    await state.addSession({
                        taskId: taskId,
                        startTime: new Date(now.getTime() - duration * 1000).toISOString(),
                        endTime: now.toISOString(),
                        duration_minutes: durationMinutes,
                        dateLogged: getLocalDateString(now)
                    });
                }
            },

            incrementTimers: () => set((state) => {
                const newTimers = { ...state.activeTimers };
                let hasChanges = false;
                for (const id in newTimers) {
                    newTimers[id] = newTimers[id] + 1;
                    hasChanges = true;
                }
                return hasChanges ? { activeTimers: newTimers } : {};
            }),

            pomodoroTime: 25 * 60,
            isPomodoroRunning: false,
            setPomodoroTime: (time) => set({ pomodoroTime: time }),
            setIsPomodoroRunning: (isRunning) => set({ isPomodoroRunning: isRunning }),

            isTransitioning: false,
            triggerTransition: async (action) => {
                set({ isTransitioning: true });
                await new Promise(r => setTimeout(r, 300));
                action();
                await new Promise(r => setTimeout(r, 200));
                set({ isTransitioning: false });
            },

            isFocusMode: false,
            setIsFocusMode: (isFocusMode) => {
                get().triggerTransition(() => set({ isFocusMode, isNotesMode: false, isYearMode: false }));
            },

            isMurtazaMode: true,
            setIsMurtazaMode: (isMurtazaMode) => {
                get().triggerTransition(() => set({ isMurtazaMode }));
            },

            isHardcoreMode: false,
            setIsHardcoreMode: (isHardcoreMode) => set({ isHardcoreMode }),


            // Initialize devItems from localStorage for migration, but let persist handle it after
            fetchDevItems: async () => {
                const devItems = await api.getDevItems();
                set({ devItems });
            },
            addDevItem: async (text) => {
                await api.addDevItem(text);
                get().fetchDevItems();
            },
            toggleDevItem: async (id) => {
                const state = get();
                const item = state.devItems.find(i => i.id === id);
                if (item) {
                    await api.toggleDevItem(id, item.isComplete ? 0 : 1);
                    get().fetchDevItems();
                }
            },
            deleteDevItem: async (id) => {
                await api.deleteDevItem(id);
                get().fetchDevItems();
            },

            osPrefix: 'm',
            setOsPrefix: (prefix) => set({ osPrefix: prefix }),

            fetchRepeatingTasks: async () => {
                try {
                    const repeatingTasks = await api.getRepeatingTasks();
                    const today = getLocalDateString();
                    const dayOfWeek = new Date().getDay(); // 0-6
                    let tasksSpawned = false;

                    // Check for tasks to spawn
                    for (const rt of repeatingTasks as unknown as RawRepeatingTask[]) {
                        try {
                            const task = parseRawRepeatingTask(rt);

                            // Logic to determine if we should spawn a task today
                            if (task.isActive && task.lastGeneratedDate !== today) {
                                let shouldSpawn = false;
                                if (task.repeatType === 'daily') {
                                    shouldSpawn = true;
                                } else if (task.repeatType === 'weekly' && Array.isArray(task.repeatDays) && task.repeatDays.includes(dayOfWeek)) {
                                    shouldSpawn = true;
                                }

                                if (shouldSpawn) {
                                    // Reset subtasks for the new instance
                                    const resetSubtasks = task.subtasks?.map(st => ({ ...st, isComplete: false })) || [];

                                    // Spawn task
                                    await api.addTask({
                                        title: task.title,
                                        description: task.description,
                                        difficulty: task.difficulty,
                                        statTarget: task.statTarget,
                                        labels: task.labels || [],
                                        dueDate: today,
                                        isComplete: 0,
                                        repeatingTaskId: task.id,
                                        subtasks: resetSubtasks
                                    });

                                    // Update lastGeneratedDate
                                    await api.updateRepeatingTask({
                                        ...task,
                                        lastGeneratedDate: today
                                    });
                                    tasksSpawned = true;
                                }
                            }
                        } catch (err) {
                            console.error("Error processing repeating task:", rt, err);
                        }
                    }

                    // Re-fetch to get updated list if we spawned anything, or just process the list we have
                    const updatedRepeatingTasks = await api.getRepeatingTasks();

                    set({
                        repeatingTasks: (updatedRepeatingTasks as unknown as RawRepeatingTask[]).map(parseRawRepeatingTask)
                    });

                    // Only refresh main tasks if we actually spawned something
                    if (tasksSpawned) {
                        get().fetchTasks();
                    }
                } catch (error) {
                    console.error("Failed to fetch repeating tasks:", error);
                }
            },

            checkMissedTasks: async () => {
                const { isHardcoreMode, repeatingTasks, tasks } = get();
                const todayStr = getLocalDateString();

                // Hardcore mode: check for missed repeating tasks and apply XP penalties
                if (isHardcoreMode) {
                    for (const rt of repeatingTasks) {
                        // Find tasks spawned by this RT that are due before today and incomplete
                        const spawnedTasks = tasks.filter(t => t.repeatingTaskId === rt.id && t.dueDate && t.dueDate < todayStr && !t.isComplete);

                        for (const missedTask of spawnedTasks) {
                            if (rt.streak && rt.streak > 0) {
                                await api.updateRepeatingTask({ ...rt, streak: 0 });
                            }

                            // Apply XP Penalty (Difficulty * 50)
                            const penalty = missedTask.difficulty * 50;

                            // Deduct from ALL associated stats
                            const targets = Array.isArray(missedTask.statTarget) ? missedTask.statTarget : [missedTask.statTarget];
                            for (const statName of targets) {
                                const stat = get().stats.find(s => s.statName === statName);
                                if (stat) {
                                    const newXP = Math.max(0, stat.currentXP - penalty);
                                    await api.updateStat({ ...stat, currentXP: newXP });
                                }
                            }
                        }
                    }

                    // Refresh stats and repeating tasks after penalties
                    const updatedStats = await api.getStats();
                    const updatedRTs = await api.getRepeatingTasks();
                    set({
                        stats: updatedStats,
                        repeatingTasks: (updatedRTs as unknown as RawRepeatingTask[]).map(parseRawRepeatingTask)
                    });
                }

                // Always sync streaks for new day (not gated behind hardcore mode)
                const streaks = await api.getStreaks() as import('./types').Streak[];
                for (const streak of streaks) {
                    if (streak.isPaused !== 1 && streak.lastUpdated < todayStr) {
                        // Calculate days elapsed safely
                        const t1 = new Date(streak.lastUpdated).getTime();
                        const t2 = new Date(todayStr).getTime();
                        let diffDays = 1;
                        if (!isNaN(t1) && !isNaN(t2) && t2 > t1) {
                            diffDays = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
                        }
                        await api.updateStreak({
                            ...streak,
                            currentStreak: streak.currentStreak + diffDays,
                            lastUpdated: todayStr
                        });
                    }
                }
                get().fetchStreaks();
            },

            addRepeatingTask: async (task) => {
                await api.addRepeatingTask(task);
                get().fetchRepeatingTasks();
            },

            updateRepeatingTask: async (task) => {
                await api.updateRepeatingTask(task);
                get().fetchRepeatingTasks();
            },

            deleteRepeatingTask: async (id) => {
                await api.deleteRepeatingTask(id);
                get().fetchRepeatingTasks();
            },

            // Notes Mode
            isNotesMode: false,
            toggleNotesMode: () => {
                get().triggerTransition(() => set(state => ({ isNotesMode: !state.isNotesMode, isYearMode: false })));
            },

            subjects: [],
            currentSubjectId: null,
            targetNoteId: null,
            notes: [],
            searchResults: [],

            fetchSubjects: async () => {
                const subjects = await api.getSubjects();
                set({ subjects });
            },

            createSubject: async (subject) => {
                // Optimistic update
                const tempId = Date.now(); // Temp ID
                const newSubject = { ...subject, id: tempId } as Subject;
                set(state => ({ subjects: [...state.subjects, newSubject] }));

                await api.createSubject(subject);
                get().fetchSubjects();
            },

            updateSubject: async (subject) => {
                // Optimistic update
                set(state => ({
                    subjects: state.subjects.map(s => s.id === subject.id ? subject : s)
                }));

                await api.updateSubject(subject);
                get().fetchSubjects();
            },

            deleteSubject: async (id) => {
                await api.deleteSubject(id);
                get().fetchSubjects();
            },

            openSubject: async (id, noteId) => {
                set({ currentSubjectId: id, targetNoteId: noteId || null });
                await get().fetchNotes(id);
            },

            closeSubject: () => set({ currentSubjectId: null, notes: [] }), // explicitly clear notes

            fetchNotes: async (subjectId) => {
                const notes = await api.getNotes(subjectId);
                set({ notes });
            },

            createNote: async (note) => {
                const result = await api.createNote(note) as { lastInsertRowid: number };
                if (get().currentSubjectId === note.subjectId) {
                    await get().fetchNotes(note.subjectId);
                }
                return result.lastInsertRowid;
            },

            updateNote: async (note) => {
                await api.updateNote(note);
                if (get().currentSubjectId === note.subjectId) {
                    get().fetchNotes(note.subjectId);
                }
            },

            deleteNote: async (id) => {
                const note = get().notes.find(n => n.id === id);
                if (note) {
                    await api.deleteNote(id);
                    if (get().currentSubjectId === note.subjectId) {
                        get().fetchNotes(note.subjectId);
                    }
                }
            },

            searchNotes: async (query) => {
                if (!query.trim()) {
                    set({ searchResults: [] });
                    return;
                }
                const results = await api.searchNotes(query);
                set({ searchResults: results });
            },

            // Year Mode
            isYearMode: false,
            toggleYearMode: () => {
                get().triggerTransition(() => set((state) => ({ isYearMode: !state.isYearMode, isNotesMode: false })));
            },

            fetchStreaks: async () => {
                const streaks = await api.getStreaks();
                set({ streaks });
            },
            createStreak: async (streak) => {
                await api.createStreak(streak);
                get().fetchStreaks();
            },
            updateStreak: async (streak) => {
                await api.updateStreak(streak);
                get().fetchStreaks();
            },
            deleteStreak: async (id) => {
                await api.deleteStreak(id);
                get().fetchStreaks();
            },
        }),
        {
            name: 'lifeos-storage',
            partialize: (state) => ({
                isMurtazaMode: state.isMurtazaMode,
                isFocusMode: state.isFocusMode,
                isHardcoreMode: state.isHardcoreMode,
                osPrefix: state.osPrefix,
            }),
        }
    )
);
