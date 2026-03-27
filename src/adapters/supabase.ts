import type { ApiBackend } from './types';
import { supabase } from '../lib/supabase';

function throwOnError<T>(result: { data: T; error: any }): T {
    if (result.error) throw result.error;
    return result.data;
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
        return throwOnError(await supabase.from('sessions').insert({
            taskId: session.taskId,
            startTime: session.startTime,
            endTime: session.endTime,
            duration_minutes: session.duration_minutes,
            dateLogged: session.dateLogged,
        }));
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
        await supabase.from('notes').delete().eq('subjectId', id);
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
        const pattern = `%${query}%`;
        // Fetch matching notes
        const { data: notes, error } = await supabase
            .from('notes')
            .select('*')
            .or(`title.ilike.${pattern},content.ilike.${pattern}`)
            .order('updatedAt', { ascending: false });

        if (error) throw error;
        if (!notes || notes.length === 0) return [];

        // Fetch subjects for the matched notes
        const subjectIds = [...new Set(notes.map((n: any) => n.subjectId))];
        const { data: subjectsData } = await supabase
            .from('subjects')
            .select('id, title, color')
            .in('id', subjectIds);

        const subjectMap = new Map((subjectsData || []).map((s: any) => [s.id, s]));

        return notes.map((note: any) => {
            const subject = subjectMap.get(note.subjectId);
            return { ...note, subjectTitle: subject?.title, subjectColor: subject?.color };
        });
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

    // ── Export ──────────────────────────────────────────────────
    exportAllData: async () => {
        const [tasks, sessions, stats, dailyLogs, devItems, repeatingTasks, subjects, notes, streaks] = await Promise.all([
            supabase.from('tasks').select('*'),
            supabase.from('sessions').select('*'),
            supabase.from('stats').select('*'),
            supabase.from('daily_logs').select('*'),
            supabase.from('dev_items').select('*'),
            supabase.from('repeating_tasks').select('*'),
            supabase.from('subjects').select('*'),
            supabase.from('notes').select('*'),
            supabase.from('streaks').select('*'),
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
            exportedAt: new Date().toISOString(),
        };
    },
} as ApiBackend;
