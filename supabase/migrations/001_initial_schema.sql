-- xOS Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    "dueDate" TEXT,
    difficulty INTEGER,
    "isComplete" INTEGER DEFAULT 0,
    "statTarget" JSONB DEFAULT '[]'::jsonb,
    labels JSONB DEFAULT '[]'::jsonb,
    "repeatingTaskId" INTEGER,
    subtasks JSONB DEFAULT '[]'::jsonb,
    "completedAt" TEXT,
    "noteId" INTEGER,
    time TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "taskId" INTEGER,
    "startTime" TEXT,
    "endTime" TEXT,
    duration_minutes INTEGER,
    "dateLogged" TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_dateLogged ON sessions("dateLogged");
CREATE INDEX IF NOT EXISTS idx_sessions_taskId ON sessions("taskId");
CREATE INDEX IF NOT EXISTS idx_tasks_dueDate ON tasks("dueDate");

CREATE TABLE IF NOT EXISTS daily_logs (
    date TEXT PRIMARY KEY,
    "journalEntry" TEXT,
    "prayersCompleted" JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS stats (
    "statName" TEXT PRIMARY KEY,
    "currentXP" INTEGER DEFAULT 0,
    "currentLevel" INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS dev_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    text TEXT NOT NULL,
    "isComplete" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS repeating_tasks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    difficulty INTEGER,
    "statTarget" JSONB DEFAULT '[]'::jsonb,
    labels JSONB DEFAULT '[]'::jsonb,
    "repeatType" TEXT,
    "repeatDays" JSONB DEFAULT '[]'::jsonb,
    "isActive" INTEGER DEFAULT 1,
    "lastGeneratedDate" TEXT,
    subtasks JSONB DEFAULT '[]'::jsonb,
    streak INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subjects (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    color TEXT DEFAULT '#ef4444',
    "createdAt" TEXT,
    "orderIndex" INTEGER
);

CREATE TABLE IF NOT EXISTS notes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "subjectId" INTEGER NOT NULL,
    title TEXT,
    content TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

CREATE INDEX IF NOT EXISTS idx_notes_subjectId ON notes("subjectId");

CREATE TABLE IF NOT EXISTS streaks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    "currentStreak" INTEGER DEFAULT 0,
    "lastUpdated" TEXT,
    "isPaused" INTEGER DEFAULT 0,
    "createdAt" TEXT
);

-- ============================================================
-- Default stats (same as SQLite db.ts)
-- ============================================================

INSERT INTO stats ("statName") VALUES ('Fitness') ON CONFLICT DO NOTHING;
INSERT INTO stats ("statName") VALUES ('Mental') ON CONFLICT DO NOTHING;
INSERT INTO stats ("statName") VALUES ('Religion') ON CONFLICT DO NOTHING;
INSERT INTO stats ("statName") VALUES ('Finance') ON CONFLICT DO NOTHING;
INSERT INTO stats ("statName") VALUES ('Social') ON CONFLICT DO NOTHING;

-- ============================================================
-- RPC: rename_stat (transactional stat rename across stats + tasks)
-- ============================================================

CREATE OR REPLACE FUNCTION rename_stat(old_name TEXT, new_name TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    task_row RECORD;
    targets JSONB;
    idx INTEGER;
BEGIN
    -- Rename in stats table
    UPDATE stats SET "statName" = new_name WHERE "statName" = old_name;

    -- Update statTarget in all tasks that reference the old name
    FOR task_row IN SELECT id, "statTarget" FROM tasks LOOP
        targets := task_row."statTarget";
        IF targets IS NOT NULL AND jsonb_typeof(targets) = 'array' THEN
            -- Find index of old_name in the array
            FOR idx IN 0..jsonb_array_length(targets) - 1 LOOP
                IF targets->idx #>> '{}' = old_name THEN
                    targets := jsonb_set(targets, ARRAY[idx::text], to_jsonb(new_name));
                END IF;
            END LOOP;
            UPDATE tasks SET "statTarget" = targets WHERE id = task_row.id;
        END IF;
    END LOOP;
END;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE repeating_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

-- Simple policy: any authenticated user has full access (single-user app)
CREATE POLICY "Authenticated full access" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON daily_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON stats FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON dev_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON repeating_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON subjects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON streaks FOR ALL TO authenticated USING (true) WITH CHECK (true);
