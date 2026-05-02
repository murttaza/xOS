import { StateCreator } from 'zustand';
import { Task, RepeatingTask, Subtask } from '@/types';
import { api } from '@/api';
import { safeJSONParse, getLocalDateString } from '@/lib/utils';
import { showErrorToast } from '@/components/ui/toast';
import type { AppState } from './index';

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

// Parsing helpers
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

export interface TaskSlice {
    tasks: Task[];
    repeatingTasks: RepeatingTask[];

    fetchTasks: () => Promise<void>;
    addTask: (task: Omit<Task, 'id'>) => Promise<void>;
    updateTask: (task: Task) => Promise<void>;
    deleteTask: (id: number) => Promise<void>;

    fetchRepeatingTasks: () => Promise<void>;
    addRepeatingTask: (task: Omit<RepeatingTask, 'id'>) => Promise<void>;
    updateRepeatingTask: (task: RepeatingTask) => Promise<void>;
    deleteRepeatingTask: (id: number) => Promise<void>;
    checkMissedTasks: () => Promise<void>;
}

export const createTaskSlice: StateCreator<AppState, [], [], TaskSlice> = (set, get) => ({
    tasks: [],
    repeatingTasks: [],

    fetchTasks: async () => {
        try {
            const tasks = await api.getTasks();
            set({
                tasks: (tasks as unknown as RawTask[]).map(parseRawTask)
            });
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
            showErrorToast('Failed to load tasks. Check your connection.');
        }
    },

    addTask: async (task) => {
        try {
            await api.addTask(task);
            get().fetchTasks();
        } catch (error) {
            console.error('Failed to add task:', error);
            showErrorToast('Failed to save task.');
        }
    },

    updateTask: async (task) => {
        // Check if task is being completed or uncompleted
        const originalTask = get().tasks.find(t => t.id === task.id);
        if (originalTask) {
            if (task.isComplete === 1 && !originalTask.isComplete) {
                // Task just completed
                task.completedAt = new Date().toISOString();

                // Auto-stop the timer first (this creates the session + awards XP)
                // so we don't double-award when the timer eventually fires separately
                if (get().activeTimers[task.id!] !== undefined) {
                    await get().stopTaskTimer(task.id!);
                }

                // Check for repeating task streak
                if (task.repeatingTaskId) {
                    const repeatingTask = get().repeatingTasks.find(rt => rt.id === task.repeatingTaskId);
                    if (repeatingTask) {
                        const newStreak = (repeatingTask.streak || 0) + 1;
                        await api.updateRepeatingTask({ ...repeatingTask, streak: newStreak });
                        get().fetchRepeatingTasks();
                    }
                }
            } else if (task.isComplete === 0 && originalTask.isComplete) {
                // Task being uncompleted — clear completedAt
                task.completedAt = undefined as any;
            }
        }

        await api.updateTask(task);
        get().fetchTasks();
    },

    deleteTask: async (id) => {
        const state = get();
        const task = state.tasks.find(t => t.id === id);

        // Stop timer if running for this task
        if (state.activeTimers[id] !== undefined) {
            await state.stopTaskTimer(id);
        }

        // If trashing an incomplete spawned repeating task, reset that streak.
        // Completed instances should leave the streak alone.
        if (task && !task.isComplete && task.repeatingTaskId) {
            const rt = state.repeatingTasks.find(r => r.id === task.repeatingTaskId);
            if (rt && (rt.streak ?? 0) > 0) {
                await api.updateRepeatingTask({ ...rt, streak: 0 });
                get().fetchRepeatingTasks();
            }
        }

        await api.deleteTask(id);
        get().fetchTasks();
    },

    fetchRepeatingTasks: async () => {
        try {
            const repeatingTasks = await api.getRepeatingTasks();
            const today = getLocalDateString();
            const dayOfWeek = new Date().getDay(); // 0-6

            // Collect all tasks that need spawning into a batch
            const tasksToSpawn: Omit<Task, 'id'>[] = [];
            const repeatingTasksToUpdate: RepeatingTask[] = [];

            // Fetch current tasks to check for duplicates (prevents re-spawn if
            // lastGeneratedDate update failed on a previous run)
            const existingTasks = get().tasks;

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

                        // Guard: don't spawn if a task from this RT already exists for today
                        if (shouldSpawn && existingTasks.some(t => t.repeatingTaskId === task.id && t.dueDate === today)) {
                            // Task already exists — just update lastGeneratedDate
                            repeatingTasksToUpdate.push({ ...task, lastGeneratedDate: today });
                            shouldSpawn = false;
                        }

                        if (shouldSpawn) {
                            // Reset subtasks for the new instance
                            const resetSubtasks = task.subtasks?.map(st => ({ ...st, isComplete: false })) || [];

                            tasksToSpawn.push({
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

                            repeatingTasksToUpdate.push({
                                ...task,
                                lastGeneratedDate: today
                            });
                        }
                    }
                } catch (err) {
                    console.error("Error processing repeating task:", rt, err);
                }
            }

            // Batch-insert all spawned tasks in a single IPC call / DB transaction
            if (tasksToSpawn.length > 0) {
                await api.batchAddTasks(tasksToSpawn);

                // Update lastGeneratedDate for each repeating task that spawned
                await Promise.all(
                    repeatingTasksToUpdate.map(rt => api.updateRepeatingTask(rt))
                );
            }

            // Re-fetch to get updated list
            const updatedRepeatingTasks = await api.getRepeatingTasks();

            set({
                repeatingTasks: (updatedRepeatingTasks as unknown as RawRepeatingTask[]).map(parseRawRepeatingTask)
            });

            // Only refresh main tasks if we actually spawned something
            if (tasksToSpawn.length > 0) {
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

                    // Apply level-scaled XP penalty
                    const targets = Array.isArray(missedTask.statTarget) ? missedTask.statTarget : [missedTask.statTarget];
                    for (const statName of targets) {
                        const stat = get().stats.find(s => s.statName === statName);
                        if (stat) {
                            const { calculatePenalty } = await import('@/lib/utils');
                            const penalty = calculatePenalty(missedTask.difficulty, stat.currentLevel);
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
        const streaks = await api.getStreaks() as import('@/types').Streak[];
        for (const streak of streaks) {
            if (streak.isPaused !== 1 && streak.lastUpdated < todayStr) {
                // Calculate days elapsed safely
                const t1 = new Date(streak.lastUpdated).getTime();
                const t2 = new Date(todayStr).getTime();
                let diffDays = 1;
                if (!isNaN(t1) && !isNaN(t2) && t2 > t1) {
                    diffDays = Math.floor((t2 - t1) / (1000 * 60 * 60 * 24));
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
});
