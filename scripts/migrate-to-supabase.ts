/**
 * Migration script: SQLite export JSON → Supabase
 *
 * Usage:
 *   1. In the Electron app, go to Settings and export your data (saves a JSON file)
 *   2. Run: npx tsx scripts/migrate-to-supabase.ts path/to/export.json
 *
 * Prerequisites:
 *   - npm install tsx (if not installed)
 *   - .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 *   - A Supabase user created and signed in (the script will prompt for credentials)
 *   - The SQL migration (001_initial_schema.sql) already run in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as readline from 'readline';

// Load env from .env file manually (no dotenv dependency needed)
const envContent = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
}

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function askQuestion(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

function parseJSON(val: any): any {
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return val; }
    }
    return val;
}

async function main() {
    const exportPath = process.argv[2];
    if (!exportPath) {
        console.error('Usage: npx tsx scripts/migrate-to-supabase.ts <path-to-export.json>');
        process.exit(1);
    }

    const raw = readFileSync(resolve(exportPath), 'utf-8');
    const data = JSON.parse(raw);

    // Authenticate - use CLI args or prompt
    const email = process.argv[3] || await askQuestion('Email: ');
    const password = process.argv[4] || await askQuestion('Password: ');

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
        console.error('Auth failed:', authError.message);
        process.exit(1);
    }
    console.log('Authenticated successfully.\n');

    // Migrate stats first (no FK dependencies)
    if (data.stats?.length) {
        console.log(`Migrating ${data.stats.length} stats...`);
        const { error } = await supabase.from('stats').upsert(
            data.stats.map((s: any) => ({
                statName: s.statName,
                currentXP: s.currentXP,
                currentLevel: s.currentLevel,
            })),
            { onConflict: 'statName' }
        );
        if (error) console.error('  Stats error:', error.message);
        else console.log('  Stats done.');
    }

    // Migrate subjects (notes depend on them)
    if (data.subjects?.length) {
        console.log(`Migrating ${data.subjects.length} subjects...`);
        for (const s of data.subjects) {
            const { error } = await supabase.from('subjects').insert({
                title: s.title,
                color: s.color,
                createdAt: s.createdAt,
                orderIndex: s.orderIndex,
            });
            if (error) console.error(`  Subject "${s.title}" error:`, error.message);
        }
        console.log('  Subjects done.');
    }

    // Get subject ID mapping (old SQLite ID → new Supabase ID) by title
    const { data: newSubjects } = await supabase.from('subjects').select('id, title');
    const subjectMap = new Map<number, number>();
    if (data.subjects && newSubjects) {
        for (let i = 0; i < data.subjects.length; i++) {
            const oldId = data.subjects[i].id;
            const match = newSubjects.find((ns: any) => ns.title === data.subjects[i].title);
            if (match) subjectMap.set(oldId, match.id);
        }
    }

    // Migrate tasks (convert JSON string columns to JSONB objects)
    if (data.tasks?.length) {
        console.log(`Migrating ${data.tasks.length} tasks...`);
        const batch = data.tasks.map((t: any) => ({
            title: t.title,
            description: t.description,
            dueDate: t.dueDate,
            difficulty: t.difficulty,
            isComplete: t.isComplete,
            statTarget: parseJSON(t.statTarget) || [],
            labels: parseJSON(t.labels) || [],
            repeatingTaskId: t.repeatingTaskId || null,
            subtasks: parseJSON(t.subtasks) || [],
            completedAt: t.completedAt || null,
            noteId: t.noteId || null,
            time: t.time || null,
        }));

        // Insert in chunks of 50
        for (let i = 0; i < batch.length; i += 50) {
            const chunk = batch.slice(i, i + 50);
            const { error } = await supabase.from('tasks').insert(chunk);
            if (error) console.error(`  Tasks chunk ${i} error:`, error.message);
        }
        console.log('  Tasks done.');
    }

    // Migrate sessions
    if (data.sessions?.length) {
        console.log(`Migrating ${data.sessions.length} sessions...`);
        // Sessions reference tasks by taskId. Since IDs changed, we skip FK mapping
        // (the FK constraint isn't enforced in Supabase schema for simplicity)
        const batch = data.sessions.map((s: any) => ({
            taskId: s.taskId,
            startTime: s.startTime,
            endTime: s.endTime,
            duration_minutes: s.duration_minutes,
            dateLogged: s.dateLogged,
        }));

        for (let i = 0; i < batch.length; i += 50) {
            const chunk = batch.slice(i, i + 50);
            const { error } = await supabase.from('sessions').insert(chunk);
            if (error) console.error(`  Sessions chunk ${i} error:`, error.message);
        }
        console.log('  Sessions done.');
    }

    // Migrate daily logs
    if (data.dailyLogs?.length) {
        console.log(`Migrating ${data.dailyLogs.length} daily logs...`);
        const batch = data.dailyLogs.map((d: any) => ({
            date: d.date,
            journalEntry: d.journalEntry,
            prayersCompleted: parseJSON(d.prayersCompleted) || {},
        }));

        for (let i = 0; i < batch.length; i += 50) {
            const chunk = batch.slice(i, i + 50);
            const { error } = await supabase.from('daily_logs').upsert(chunk, { onConflict: 'date' });
            if (error) console.error(`  Daily logs chunk ${i} error:`, error.message);
        }
        console.log('  Daily logs done.');
    }

    // Migrate dev items
    if (data.devItems?.length) {
        console.log(`Migrating ${data.devItems.length} dev items...`);
        const { error } = await supabase.from('dev_items').insert(
            data.devItems.map((d: any) => ({ text: d.text, isComplete: d.isComplete }))
        );
        if (error) console.error('  Dev items error:', error.message);
        else console.log('  Dev items done.');
    }

    // Migrate repeating tasks
    if (data.repeatingTasks?.length) {
        console.log(`Migrating ${data.repeatingTasks.length} repeating tasks...`);
        const { error } = await supabase.from('repeating_tasks').insert(
            data.repeatingTasks.map((t: any) => ({
                title: t.title,
                description: t.description,
                difficulty: t.difficulty,
                statTarget: parseJSON(t.statTarget) || [],
                labels: parseJSON(t.labels) || [],
                repeatType: t.repeatType,
                repeatDays: parseJSON(t.repeatDays) || [],
                isActive: t.isActive,
                lastGeneratedDate: t.lastGeneratedDate || null,
                subtasks: parseJSON(t.subtasks) || [],
                streak: t.streak || 0,
            }))
        );
        if (error) console.error('  Repeating tasks error:', error.message);
        else console.log('  Repeating tasks done.');
    }

    // Migrate notes (using subject ID mapping)
    if (data.notes?.length) {
        console.log(`Migrating ${data.notes.length} notes...`);
        for (const n of data.notes) {
            const newSubjectId = subjectMap.get(n.subjectId);
            if (!newSubjectId) {
                console.error(`  Skipping note "${n.title}" - subject ${n.subjectId} not found`);
                continue;
            }
            const { error } = await supabase.from('notes').insert({
                subjectId: newSubjectId,
                title: n.title,
                content: n.content,
                createdAt: n.createdAt,
                updatedAt: n.updatedAt,
            });
            if (error) console.error(`  Note "${n.title}" error:`, error.message);
        }
        console.log('  Notes done.');
    }

    // Migrate streaks
    if (data.streaks?.length) {
        console.log(`Migrating ${data.streaks.length} streaks...`);
        const { error } = await supabase.from('streaks').insert(
            data.streaks.map((s: any) => ({
                title: s.title,
                currentStreak: s.currentStreak,
                lastUpdated: s.lastUpdated,
                isPaused: s.isPaused,
                createdAt: s.createdAt,
            }))
        );
        if (error) console.error('  Streaks error:', error.message);
        else console.log('  Streaks done.');
    }

    console.log('\nMigration complete!');
    process.exit(0);
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
