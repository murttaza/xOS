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

/** Clear pending offline writes (must be called on logout to prevent data leakage between users) */
export function clearOfflineQueue() {
    offlineQueue.length = 0;
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
            }, { onConflict: 'date,user_id' })
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
        // Escape LIKE wildcards and PostgREST filter metacharacters (commas, parens)
        const escaped = query.replace(/[%_\\]/g, c => `\\${c}`);
        const pattern = `%${escaped}%`;
        // Use two separate queries instead of .or() with string interpolation
        // to avoid PostgREST parsing issues with commas/dots in user input.
        const [titleResult, contentResult] = await Promise.all([
            supabase.from('notes').select('*, subjects(title, color)').ilike('title', pattern).order('updatedAt', { ascending: false }),
            supabase.from('notes').select('*, subjects(title, color)').ilike('content', pattern).order('updatedAt', { ascending: false }),
        ]);
        if (titleResult.error) throw titleResult.error;
        if (contentResult.error) throw contentResult.error;
        // Deduplicate by note ID
        const seen = new Set<number>();
        const notes: any[] = [];
        for (const note of [...(titleResult.data || []), ...(contentResult.data || [])]) {
            if (!seen.has(note.id)) {
                seen.add(note.id);
                notes.push(note);
            }
        }

        if (notes.length === 0) return [];

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
    // ── Fitness: Catalog ───────────────────────────────────────
    getExercises: async () => {
        return throwOnError(await supabase.from('exercises').select('*').order('name'));
    },

    getPrograms: async () => {
        return throwOnError(await supabase.from('programs').select('*').order('created_at'));
    },

    getProgram: async (id) => {
        const [programRes, phasesRes, daysRes, exercisesRes, principlesRes] = await Promise.all([
            supabase.from('programs').select('*').eq('id', id).single(),
            supabase.from('program_phases').select('*').eq('program_id', id).order('order'),
            supabase.from('program_days').select('*').eq('program_id', id).order('order'),
            supabase.from('program_exercises').select('*').in('program_day_id',
                (await supabase.from('program_days').select('id').eq('program_id', id)).data?.map((d: any) => d.id) || []
            ).order('order'),
            supabase.from('program_principles').select('*').eq('program_id', id).order('order'),
        ]);
        return {
            program: throwOnError(programRes),
            phases: throwOnError(phasesRes),
            days: throwOnError(daysRes),
            exercises: throwOnError(exercisesRes),
            principles: throwOnError(principlesRes),
        };
    },

    // ── Fitness: User Programs ───────────────────────────────────
    getUserPrograms: async () => {
        return throwOnError(await supabase.from('user_programs').select('*, programs(*)').order('created_at', { ascending: false }));
    },

    createProgram: async (program) => {
        const slug = program.slug || program.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return throwOnError(
            await supabase.from('programs').insert({
                name: program.name,
                slug,
                description: program.description || '',
                total_weeks: program.total_weeks,
            }).select('*').single()
        ) as any;
    },

    createProgramPhase: async (phase) => {
        return throwOnError(
            await supabase.from('program_phases').insert({
                program_id: phase.program_id,
                name: phase.name,
                week_start: phase.week_start,
                week_end: phase.week_end,
                rir_guidance: phase.rir_guidance || '',
                description: phase.description || '',
                order: phase.order,
            }).select('*').single()
        ) as any;
    },

    createProgramDay: async (day) => {
        return throwOnError(
            await supabase.from('program_days').insert({
                program_id: day.program_id,
                phase_id: day.phase_id,
                day_of_week: day.day_of_week,
                name: day.name,
                focus: day.focus || '',
                order: day.order,
            }).select('*').single()
        ) as any;
    },

    updateProgram: async (id, updates) => {
        return throwOnError(
            await supabase.from('programs').update(updates).eq('id', id).select('*').single()
        ) as any;
    },

    deleteProgram: async (id) => {
        return throwOnError(await supabase.from('programs').delete().eq('id', id));
    },

    updateProgramPhase: async (id, updates) => {
        return throwOnError(
            await supabase.from('program_phases').update(updates).eq('id', id).select('*').single()
        ) as any;
    },

    deleteProgramPhase: async (id) => {
        return throwOnError(await supabase.from('program_phases').delete().eq('id', id));
    },

    updateProgramDay: async (id, updates) => {
        return throwOnError(
            await supabase.from('program_days').update(updates).eq('id', id).select('*').single()
        ) as any;
    },

    deleteProgramDay: async (id) => {
        return throwOnError(await supabase.from('program_days').delete().eq('id', id));
    },

    createProgramExercise: async (exercise) => {
        return throwOnError(
            await supabase.from('program_exercises').insert({
                program_day_id: exercise.program_day_id,
                exercise_id: exercise.exercise_id || null,
                display_name: exercise.display_name,
                type: exercise.type,
                prescribed_sets: exercise.prescribed_sets,
                prescribed_reps: exercise.prescribed_reps,
                notes: exercise.notes || null,
                is_loggable: exercise.is_loggable,
                order: exercise.order,
            }).select('*').single()
        ) as any;
    },

    updateProgramExercise: async (id, updates) => {
        return throwOnError(
            await supabase.from('program_exercises').update(updates).eq('id', id).select('*').single()
        ) as any;
    },

    deleteProgramExercise: async (id) => {
        return throwOnError(await supabase.from('program_exercises').delete().eq('id', id));
    },

    startProgram: async (programId, startedOn) => {
        const result = throwOnError(
            await supabase.from('user_programs').insert({
                program_id: programId,
                started_on: startedOn,
                current_week: 1,
                status: 'active',
            }).select('*').single()
        );
        return result as any;
    },

    updateUserProgram: async (id, updates) => {
        return throwOnError(await supabase.from('user_programs').update(updates).eq('id', id));
    },

    // ── Fitness: Workout Sessions ────────────────────────────────
    getSessionsForProgram: async (userProgramId) => {
        return throwOnError(
            await supabase.from('workout_sessions').select('*, program_days(*)')
                .eq('user_program_id', userProgramId)
                .order('scheduled_date')
        );
    },

    getSession: async (id) => {
        const session = throwOnError(
            await supabase.from('workout_sessions').select('*, program_days(*)').eq('id', id).single()
        );
        const logs = throwOnError(
            await supabase.from('exercise_logs').select('*, program_exercises(*)').eq('session_id', id).order('created_at')
        );
        return { ...session, program_day: session.program_days, exercise_logs: logs } as any;
    },

    createSession: async (session) => {
        return throwOnError(
            await supabase.from('workout_sessions').insert({
                user_program_id: session.user_program_id,
                program_day_id: session.program_day_id,
                scheduled_date: session.scheduled_date,
                status: session.status || 'planned',
            }).select('*, program_days(*)').single()
        ) as any;
    },

    updateSession: async (id, updates) => {
        const doUpdate = async () => throwOnError(
            await supabase.from('workout_sessions').update(updates).eq('id', id)
        );
        if (enqueueIfOffline(doUpdate)) return;
        return withRetry(doUpdate);
    },

    createWeekSessions: async (userProgramId, programDays, weekStartDate) => {
        const startDate = new Date(weekStartDate + 'T00:00:00');
        const sessions = programDays.map(day => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + (day.day_of_week - 1));
            return {
                user_program_id: userProgramId,
                program_day_id: day.id,
                scheduled_date: date.toISOString().split('T')[0],
                status: 'planned',
            };
        });
        return throwOnError(
            await supabase.from('workout_sessions').upsert(sessions, {
                onConflict: 'user_program_id,program_day_id,scheduled_date',
                ignoreDuplicates: true,
            }).select('*, program_days(*)')
        ) as any;
    },

    // ── Fitness: Exercise Logs ───────────────────────────────────
    getExerciseLogs: async (sessionId) => {
        return throwOnError(
            await supabase.from('exercise_logs').select('*, program_exercises(*)')
                .eq('session_id', sessionId).order('created_at')
        );
    },

    upsertExerciseLog: async (log) => {
        const payload: any = {
            session_id: log.session_id,
            program_exercise_id: log.program_exercise_id,
            exercise_id: log.exercise_id,
            substituted: log.substituted || false,
            working_weight: log.working_weight,
            weight_unit: log.weight_unit || 'lb',
            reps_hit: log.reps_hit,
            sets_completed: log.sets_completed,
            rir: log.rir,
            duration_seconds: log.duration_seconds,
            notes: log.notes,
            is_completed: log.is_completed || false,
        };
        if (log.id) payload.id = log.id;

        const doUpsert = async () => throwOnError(
            await supabase.from('exercise_logs').upsert(payload).select('*, program_exercises(*)').single()
        ) as any;
        if (enqueueIfOffline(doUpsert)) return { ...payload, id: `offline-${Date.now()}` } as any;
        return withRetry(doUpsert);
    },

    deleteExerciseLog: async (id) => {
        return throwOnError(await supabase.from('exercise_logs').delete().eq('id', id));
    },

    // ── Fitness: Exercise Sets ───────────────────────────────────
    getExerciseSets: async (logId) => {
        return throwOnError(
            await supabase.from('exercise_sets').select('*').eq('exercise_log_id', logId).order('set_number')
        );
    },

    upsertExerciseSets: async (logId, sets) => {
        // Delete existing sets and re-insert
        await supabase.from('exercise_sets').delete().eq('exercise_log_id', logId);
        if (sets.length === 0) return [];
        const payload = sets.map((s, i) => ({
            exercise_log_id: logId,
            set_number: s.set_number ?? i + 1,
            weight: s.weight,
            reps: s.reps,
            rir: s.rir,
        }));
        return throwOnError(await supabase.from('exercise_sets').insert(payload).select('*')) as any;
    },

    // ── Fitness: Body Metrics ────────────────────────────────────
    getBodyMetrics: async () => {
        return throwOnError(
            await supabase.from('body_metrics').select('*').order('date', { ascending: false })
        );
    },

    upsertBodyMetric: async (metric) => {
        const payload: any = {
            user_program_id: metric.user_program_id,
            week_number: metric.week_number,
            date: metric.date,
            body_weight: metric.body_weight,
            weight_unit: metric.weight_unit || 'lb',
            rhr: metric.rhr,
            rope_minutes: metric.rope_minutes,
            rope_pace: metric.rope_pace,
            bench_top_set: metric.bench_top_set,
            squat_top_set: metric.squat_top_set,
            deadlift_top_set: metric.deadlift_top_set,
            notes: metric.notes,
        };
        if (metric.id) payload.id = metric.id;
        return throwOnError(
            await supabase.from('body_metrics').upsert(payload).select('*').single()
        ) as any;
    },

    // ── Fitness: Exercise History ────────────────────────────────
    getExerciseHistory: async (exerciseId) => {
        return throwOnError(
            await supabase.from('exercise_logs').select('*, workout_sessions(scheduled_date, status)')
                .eq('exercise_id', exerciseId)
                .order('created_at', { ascending: false })
        );
    },
} as ApiBackend;
