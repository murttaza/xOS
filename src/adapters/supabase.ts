import type { ApiBackend } from './types';
import { supabase } from '../lib/supabase';

function throwOnError<T>(result: { data: T; error: any }): T {
    if (result.error) throw result.error;
    return result.data;
}

// Retry wrapper for critical writes — retries once after 1s on network failure
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } catch (err) {
        if (err instanceof TypeError) { // TypeError = network failure (fetch)
            await new Promise(r => setTimeout(r, 1000));
            return fn();
        }
        throw err;
    }
}

// Lightweight offline queue — queues writes when offline, flushes on reconnect
const offlineQueue: (() => Promise<unknown>)[] = [];

function enqueueIfOffline(fn: () => Promise<unknown>): boolean {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        offlineQueue.push(fn);
        return true;
    }
    return false;
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
        while (offlineQueue.length > 0) {
            const op = offlineQueue.shift()!;
            try { await op(); } catch { /* best-effort */ }
        }
    });
}

export const supabaseBackend: ApiBackend = {
    // ── Tasks ──────────────────────────────────────────────────
    getTasks: async () => {
        return throwOnError(await supabase.from('tasks').select('*'));
    },

    addTask: async (task) => {
        return throwOnError(await supabase.from('tasks').insert({
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            difficulty: task.difficulty,
            isComplete: task.isComplete ?? 0,
            statTarget: task.statTarget,
            labels: task.labels,
            repeatingTaskId: task.repeatingTaskId || null,
            subtasks: task.subtasks || [],
            noteId: task.noteId || null,
            time: task.time || null,
        }));
    },

    updateTask: async (task) => {
        return throwOnError(await supabase.from('tasks').update({
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            difficulty: task.difficulty,
            isComplete: task.isComplete,
            statTarget: task.statTarget,
            labels: task.labels,
            subtasks: task.subtasks || [],
            completedAt: task.completedAt || null,
            noteId: task.noteId || null,
            time: task.time || null,
        }).eq('id', task.id!));
    },

    deleteTask: async (id) => {
        return throwOnError(await supabase.from('tasks').delete().eq('id', id));
    },

    batchAddTasks: async (tasks) => {
        return throwOnError(await supabase.from('tasks').insert(
            tasks.map(task => ({
                title: task.title,
                description: task.description,
                dueDate: task.dueDate,
                difficulty: task.difficulty,
                isComplete: task.isComplete ?? 0,
                statTarget: task.statTarget,
                labels: task.labels,
                repeatingTaskId: task.repeatingTaskId || null,
                subtasks: task.subtasks || [],
                noteId: task.noteId || null,
                time: task.time || null,
            }))
        ));
    },

    // ── Sessions ───────────────────────────────────────────────
    addSession: async (session) => {
        const doInsert = async () => throwOnError(await supabase.from('sessions').insert({
            taskId: session.taskId,
            startTime: session.startTime,
            endTime: session.endTime,
            duration_minutes: session.duration_minutes,
            dateLogged: session.dateLogged,
        }));
        if (enqueueIfOffline(doInsert)) return;
        return withRetry(doInsert);
    },

    getSessionsByDate: async (date) => {
        return throwOnError(await supabase.from('sessions').select('*').eq('dateLogged', date));
    },

    getSessionsRange: async (startDate, endDate) => {
        return throwOnError(
            await supabase.from('sessions').select('*')
                .gte('dateLogged', startDate)
                .lte('dateLogged', endDate)
        );
    },

    getSessionsByTask: async (taskId) => {
        return throwOnError(
            await supabase.from('sessions').select('*')
                .eq('taskId', taskId)
                .order('startTime', { ascending: false })
        );
    },

    // ── Stats ──────────────────────────────────────────────────
    getStats: async () => {
        return throwOnError(await supabase.from('stats').select('*'));
    },

    updateStat: async (stat) => {
        return throwOnError(
            await supabase.from('stats').update({
                currentXP: stat.currentXP,
                currentLevel: stat.currentLevel,
            }).eq('statName', stat.statName)
        );
    },

    addStat: async (statName) => {
        return throwOnError(await supabase.from('stats').insert({ statName }));
    },

    deleteStat: async (statName) => {
        return throwOnError(await supabase.from('stats').delete().eq('statName', statName));
    },

    renameStat: async (oldName, newName) => {
        return throwOnError(await supabase.rpc('rename_stat', { old_name: oldName, new_name: newName }));
    },

    // ── Daily Log ──────────────────────────────────────────────
    getDailyLog: async (date) => {
        const { data } = await supabase.from('daily_logs').select('*').eq('date', date).maybeSingle();
        return data ?? undefined;
    },

    saveDailyLog: async (log) => {
        return throwOnError(
            await supabase.from('daily_logs').upsert({
                date: log.date,
                journalEntry: log.journalEntry,
                prayersCompleted: log.prayersCompleted,
            })
        );
    },

    saveJournalEntry: async (date, entry) => {
        // Upsert: update journal entry, create row with empty prayers if missing
        const { data: existing } = await supabase.from('daily_logs').select('date').eq('date', date).maybeSingle();
        if (existing) {
            return throwOnError(
                await supabase.from('daily_logs').update({ journalEntry: entry }).eq('date', date)
            );
        } else {
            return throwOnError(
                await supabase.from('daily_logs').insert({ date, journalEntry: entry, prayersCompleted: {} })
            );
        }
    },

    // ── Dev Items ──────────────────────────────────────────────
    getDevItems: async () => {
        return throwOnError(await supabase.from('dev_items').select('*'));
    },

    addDevItem: async (text) => {
        return throwOnError(await supabase.from('dev_items').insert({ text }));
    },

    toggleDevItem: async (id, isComplete) => {
        return throwOnError(
            await supabase.from('dev_items').update({ isComplete }).eq('id', id)
        );
    },

    deleteDevItem: async (id) => {
        return throwOnError(await supabase.from('dev_items').delete().eq('id', id));
    },

    // ── Repeating Tasks ────────────────────────────────────────
    getRepeatingTasks: async () => {
        return throwOnError(await supabase.from('repeating_tasks').select('*'));
    },

    addRepeatingTask: async (task) => {
        return throwOnError(await supabase.from('repeating_tasks').insert({
            title: task.title,
            description: task.description,
            difficulty: task.difficulty,
            statTarget: task.statTarget,
            labels: task.labels,
            repeatType: task.repeatType,
            repeatDays: task.repeatDays,
            isActive: task.isActive,
            lastGeneratedDate: task.lastGeneratedDate || null,
            subtasks: task.subtasks || [],
            streak: task.streak || 0,
        }));
    },

    updateRepeatingTask: async (task) => {
        return throwOnError(await supabase.from('repeating_tasks').update({
            title: task.title,
            description: task.description,
            difficulty: task.difficulty,
            statTarget: task.statTarget,
            labels: task.labels,
            repeatType: task.repeatType,
            repeatDays: task.repeatDays,
            isActive: task.isActive,
            lastGeneratedDate: task.lastGeneratedDate || null,
            subtasks: task.subtasks || [],
            streak: task.streak || 0,
        }).eq('id', task.id!));
    },

    deleteRepeatingTask: async (id) => {
        return throwOnError(await supabase.from('repeating_tasks').delete().eq('id', id));
    },

    // ── Subjects ───────────────────────────────────────────────
    getSubjects: async () => {
        return throwOnError(
            await supabase.from('subjects').select('*').order('orderIndex').order('id')
        );
    },

    createSubject: async (subject) => {
        return throwOnError(await supabase.from('subjects').insert({
            title: subject.title,
            color: subject.color,
            createdAt: new Date().toISOString(),
            orderIndex: subject.orderIndex,
        }));
    },

    updateSubject: async (subject) => {
        return throwOnError(
            await supabase.from('subjects').update({
                title: subject.title,
                color: subject.color,
            }).eq('id', subject.id!)
        );
    },

    deleteSubject: async (id) => {
        // Also delete associated notes (Supabase doesn't have ON DELETE CASCADE by default)
        const notesResult = await supabase.from('notes').delete().eq('subjectId', id);
        if (notesResult.error) {
            console.error('Failed to delete notes for subject', id, notesResult.error);
        }
        return throwOnError(await supabase.from('subjects').delete().eq('id', id));
    },

    // ── Notes ──────────────────────────────────────────────────
    getNotes: async (subjectId) => {
        return throwOnError(
            await supabase.from('notes').select('*')
                .eq('subjectId', subjectId)
                .order('updatedAt', { ascending: false })
        );
    },

    getNote: async (id) => {
        const { data: note } = await supabase
            .from('notes')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (!note) return undefined;

        const { data: subject } = await supabase
            .from('subjects')
            .select('title, color')
            .eq('id', (note as any).subjectId)
            .maybeSingle();

        return { ...note, subjectTitle: subject?.title, subjectColor: subject?.color } as any;
    },

    createNote: async (note) => {
        const now = new Date().toISOString();
        const result = throwOnError(
            await supabase.from('notes').insert({
                subjectId: note.subjectId,
                title: note.title,
                content: note.content,
                createdAt: now,
                updatedAt: now,
            }).select('id').single()
        );
        return { id: result!.id };
    },

    updateNote: async (note) => {
        return throwOnError(
            await supabase.from('notes').update({
                title: note.title,
                content: note.content,
                updatedAt: new Date().toISOString(),
            }).eq('id', note.id!)
        );
    },

    deleteNote: async (id) => {
        return throwOnError(await supabase.from('notes').delete().eq('id', id));
    },

    searchNotes: async (query) => {
        // Escape special PostgREST filter characters to prevent malformed queries
        const escaped = query.replace(/[%_\\]/g, c => `\\${c}`);
        const pattern = `%${escaped}%`;
        // Use chained ilike filters joined with .or() to avoid string interpolation issues
        const { data: notes, error } = await supabase
            .from('notes')
            .select('*, subjects(title, color)')
            .or(`title.ilike.${pattern},content.ilike.${pattern}`)
            .order('updatedAt', { ascending: false });

        if (error) throw error;
        if (!notes || notes.length === 0) return [];

        return notes.map((note: any) => ({
            ...note,
            subjectTitle: note.subjects?.title,
            subjectColor: note.subjects?.color,
            subjects: undefined, // Remove nested object from result
        }));
    },

    // ── Streaks ────────────────────────────────────────────────
    getStreaks: async () => {
        return throwOnError(
            await supabase.from('streaks').select('*').order('id')
        );
    },

    createStreak: async (streak) => {
        const now = new Date().toISOString();
        return throwOnError(await supabase.from('streaks').insert({
            title: streak.title,
            currentStreak: streak.currentStreak,
            lastUpdated: streak.lastUpdated || now,
            isPaused: streak.isPaused,
            createdAt: streak.createdAt || now,
        }));
    },

    updateStreak: async (streak) => {
        return throwOnError(
            await supabase.from('streaks').update({
                title: streak.title,
                currentStreak: streak.currentStreak,
                lastUpdated: streak.lastUpdated,
                isPaused: streak.isPaused,
                createdAt: streak.createdAt,
            }).eq('id', streak.id!)
        );
    },

    deleteStreak: async (id) => {
        return throwOnError(await supabase.from('streaks').delete().eq('id', id));
    },

    // ── Active Timers (cross-device sync) ────────────────────────
    getActiveTimers: async () => {
        const { data } = await supabase.from('active_timers').select('taskId, startTime');
        return (data || []) as { taskId: number; startTime: string }[];
    },

    setActiveTimer: async (taskId, startTime) => {
        const doUpsert = async () => throwOnError(
            await supabase.from('active_timers').upsert({ taskId, startTime }, { onConflict: 'taskId,user_id' })
        );
        if (enqueueIfOffline(doUpsert)) return;
        return withRetry(doUpsert);
    },

    removeActiveTimer: async (taskId) => {
        const doDelete = async () => throwOnError(
            await supabase.from('active_timers').delete().eq('taskId', taskId)
        );
        if (enqueueIfOffline(doDelete)) return;
        return withRetry(doDelete);
    },

    sessionExistsForTimer: async (taskId, startTime) => {
        const { data } = await supabase.from('sessions')
            .select('id')
            .eq('taskId', taskId)
            .eq('startTime', startTime)
            .limit(1);
        return (data?.length ?? 0) > 0;
    },

    // ── Budget Categories ─────────────────────────────────────────
    getBudgetCategories: async () => {
        return throwOnError(
            await supabase.from('budget_categories').select('*').order('isIncome').order('orderIndex')
        );
    },

    createBudgetCategory: async (category) => {
        return throwOnError(
            await supabase.from('budget_categories').insert({
                name: category.name,
                icon: category.icon,
                color: category.color,
                isIncome: category.isIncome,
                parentId: category.parentId || null,
                orderIndex: category.orderIndex,
            }).select()
        );
    },

    updateBudgetCategory: async (category) => {
        return throwOnError(
            await supabase.from('budget_categories').update({
                name: category.name,
                icon: category.icon,
                color: category.color,
                isIncome: category.isIncome,
                parentId: category.parentId || null,
                orderIndex: category.orderIndex,
            }).eq('id', category.id!)
        );
    },

    deleteBudgetCategory: async (id) => {
        // Also delete associated transactions and targets
        const txResult = await supabase.from('budget_transactions').delete().eq('categoryId', id);
        if (txResult.error) console.error('Failed to delete transactions for category', id, txResult.error);
        const targetResult = await supabase.from('budget_targets').delete().eq('categoryId', id);
        if (targetResult.error) console.error('Failed to delete targets for category', id, targetResult.error);
        return throwOnError(await supabase.from('budget_categories').delete().eq('id', id));
    },

    // ── Budget Transactions ──────────────────────────────────────
    getTransactions: async (month) => {
        const { data: transactions, error } = await supabase
            .from('budget_transactions')
            .select('*, budget_categories(name, color, icon)')
            .like('date', `${month}%`)
            .order('date', { ascending: false })
            .order('id', { ascending: false });

        if (error) throw error;
        if (!transactions || transactions.length === 0) return [];

        return transactions.map((tx: any) => ({
            ...tx,
            categoryName: tx.budget_categories?.name,
            categoryColor: tx.budget_categories?.color,
            categoryIcon: tx.budget_categories?.icon,
            budget_categories: undefined,
        }));
    },

    addTransaction: async (tx) => {
        return throwOnError(await supabase.from('budget_transactions').insert({
            amount: tx.amount,
            categoryId: tx.categoryId,
            isIncome: tx.isIncome,
            date: tx.date,
            paymentMethod: tx.paymentMethod || null,
            notes: tx.notes || null,
            isRecurring: tx.isRecurring || 0,
            recurringRule: tx.recurringRule || null,
            createdAt: new Date().toISOString(),
        }));
    },

    updateTransaction: async (tx) => {
        return throwOnError(
            await supabase.from('budget_transactions').update({
                amount: tx.amount,
                categoryId: tx.categoryId,
                isIncome: tx.isIncome,
                date: tx.date,
                paymentMethod: tx.paymentMethod || null,
                notes: tx.notes || null,
                isRecurring: tx.isRecurring || 0,
                recurringRule: tx.recurringRule || null,
            }).eq('id', tx.id!)
        );
    },

    deleteTransaction: async (id) => {
        return throwOnError(await supabase.from('budget_transactions').delete().eq('id', id));
    },

    // ── Budget Targets ───────────────────────────────────────────
    getBudgetTargets: async (month) => {
        const { data: targets, error } = await supabase
            .from('budget_targets')
            .select('*, budget_categories(name)')
            .eq('month', month);

        if (error) throw error;
        if (!targets || targets.length === 0) return [];

        return targets.map((t: any) => ({
            ...t,
            categoryName: t.budget_categories?.name,
            budget_categories: undefined,
        }));
    },

    setBudgetTarget: async (target) => {
        return throwOnError(
            await supabase.from('budget_targets').upsert({
                categoryId: target.categoryId,
                month: target.month,
                limitAmount: target.limitAmount,
            }, { onConflict: 'categoryId,month,user_id' })
        );
    },

    deleteBudgetTarget: async (id) => {
        return throwOnError(await supabase.from('budget_targets').delete().eq('id', id));
    },

    // ── Export ──────────────────────────────────────────────────
    exportAllData: async () => {
        const [tasks, sessions, stats, dailyLogs, devItems, repeatingTasks, subjects, notes, streaks, budgetCategories, budgetTransactions, budgetTargets] = await Promise.all([
            supabase.from('tasks').select('*'),
            supabase.from('sessions').select('*'),
            supabase.from('stats').select('*'),
            supabase.from('daily_logs').select('*'),
            supabase.from('dev_items').select('*'),
            supabase.from('repeating_tasks').select('*'),
            supabase.from('subjects').select('*'),
            supabase.from('notes').select('*'),
            supabase.from('streaks').select('*'),
            supabase.from('budget_categories').select('*'),
            supabase.from('budget_transactions').select('*'),
            supabase.from('budget_targets').select('*'),
        ]);
        return {
            tasks: tasks.data || [],
            sessions: sessions.data || [],
            stats: stats.data || [],
            dailyLogs: dailyLogs.data || [],
            devItems: devItems.data || [],
            repeatingTasks: repeatingTasks.data || [],
            subjects: subjects.data || [],
            notes: notes.data || [],
            streaks: streaks.data || [],
            budgetCategories: budgetCategories.data || [],
            budgetTransactions: budgetTransactions.data || [],
            budgetTargets: budgetTargets.data || [],
            exportedAt: new Date().toISOString(),
        };
    },
} as ApiBackend;
