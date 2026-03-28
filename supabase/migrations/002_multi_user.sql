-- Multi-user support: add user_id column and per-user RLS policies
-- Run this in the Supabase SQL Editor after 001_initial_schema.sql

-- Step 1: Add user_id to all tables
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE stats ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE dev_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE repeating_tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE notes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE streaks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Step 2: Backfill FIRST (before PK changes, since PK requires NOT NULL)
DO $$
DECLARE
    first_user UUID;
BEGIN
    SELECT id INTO first_user FROM auth.users ORDER BY created_at ASC LIMIT 1;
    IF first_user IS NOT NULL THEN
        UPDATE tasks SET user_id = first_user WHERE user_id IS NULL;
        UPDATE sessions SET user_id = first_user WHERE user_id IS NULL;
        UPDATE daily_logs SET user_id = first_user WHERE user_id IS NULL;
        UPDATE stats SET user_id = first_user WHERE user_id IS NULL;
        UPDATE dev_items SET user_id = first_user WHERE user_id IS NULL;
        UPDATE repeating_tasks SET user_id = first_user WHERE user_id IS NULL;
        UPDATE subjects SET user_id = first_user WHERE user_id IS NULL;
        UPDATE notes SET user_id = first_user WHERE user_id IS NULL;
        UPDATE streaks SET user_id = first_user WHERE user_id IS NULL;
    END IF;
END $$;

-- Step 3: Now safe to change PKs (user_id is populated)
ALTER TABLE stats DROP CONSTRAINT IF EXISTS stats_pkey;
ALTER TABLE stats ADD PRIMARY KEY ("statName", user_id);

ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_pkey;
ALTER TABLE daily_logs ADD PRIMARY KEY (date, user_id);

-- Step 4: Set defaults for new rows
ALTER TABLE tasks ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE sessions ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE daily_logs ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE stats ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE dev_items ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE repeating_tasks ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE subjects ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE notes ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE streaks ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Step 5: Drop old permissive policies
DROP POLICY IF EXISTS "Authenticated full access" ON tasks;
DROP POLICY IF EXISTS "Authenticated full access" ON sessions;
DROP POLICY IF EXISTS "Authenticated full access" ON daily_logs;
DROP POLICY IF EXISTS "Authenticated full access" ON stats;
DROP POLICY IF EXISTS "Authenticated full access" ON dev_items;
DROP POLICY IF EXISTS "Authenticated full access" ON repeating_tasks;
DROP POLICY IF EXISTS "Authenticated full access" ON subjects;
DROP POLICY IF EXISTS "Authenticated full access" ON notes;
DROP POLICY IF EXISTS "Authenticated full access" ON streaks;

-- Step 6: Create per-user RLS policies
CREATE POLICY "Users own their data" ON tasks FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users own their data" ON sessions FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users own their data" ON daily_logs FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users own their data" ON stats FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users own their data" ON dev_items FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users own their data" ON repeating_tasks FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users own their data" ON subjects FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users own their data" ON notes FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users own their data" ON streaks FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Step 7: Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stats_user_id ON stats(user_id);
CREATE INDEX IF NOT EXISTS idx_repeating_tasks_user_id ON repeating_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_streaks_user_id ON streaks(user_id);

-- Step 8: Update rename_stat function to be user-scoped
CREATE OR REPLACE FUNCTION rename_stat(old_name TEXT, new_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    task_row RECORD;
    targets JSONB;
    idx INTEGER;
    current_user_id UUID := auth.uid();
BEGIN
    UPDATE stats SET "statName" = new_name WHERE "statName" = old_name AND user_id = current_user_id;

    FOR task_row IN SELECT id, "statTarget" FROM tasks WHERE user_id = current_user_id LOOP
        targets := task_row."statTarget";
        IF targets IS NOT NULL AND jsonb_typeof(targets) = 'array' THEN
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

-- Step 9: Auto-seed default stats for new signups
CREATE OR REPLACE FUNCTION seed_new_user_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO stats ("statName", user_id) VALUES
        ('Fitness', NEW.id),
        ('Mental', NEW.id),
        ('Religion', NEW.id),
        ('Finance', NEW.id),
        ('Social', NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION seed_new_user_stats();
