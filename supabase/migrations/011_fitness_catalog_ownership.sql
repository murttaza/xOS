-- Fitness catalog: per-user ownership + global templates
--
-- PROBLEM (security): 005/007 left the catalog tables (programs, program_phases,
-- program_days, program_exercises, program_principles) with USING (true) /
-- WITH CHECK (true) policies for ALL authenticated users. Any signed-in user
-- could read, modify, or delete any other user's training programs.
--
-- MODEL after this migration:
--   programs.user_id   owner; DEFAULT auth.uid() so existing client inserts
--                      keep working unchanged (same pattern as user_programs).
--   programs.is_global curated read-only templates visible to everyone
--                      (seeded plans on a fresh DB). Owned programs are private.
--   Child tables inherit access through their parent program — the same
--   join-based policy pattern 005 already uses for workout_sessions →
--   user_programs.
--
-- No new tables are created, so no explicit GRANTs are needed (existing
-- tables keep their Data API grants; the 2026-10-30 rule only affects
-- newly created tables).

-- ============================================================
-- 1) Ownership columns
-- ============================================================
-- auth.uid() is STABLE, so existing rows backfill to NULL here (no session
-- in the SQL editor) and new rows evaluate it per-insert — exactly what we want.
ALTER TABLE programs
    ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_programs_user ON programs(user_id);

-- ============================================================
-- 2) Backfill ownership
-- ============================================================
-- A program started by exactly one user belongs to that user (on a personal
-- install the starter is the creator).
UPDATE programs p
SET user_id = (
    SELECT up.user_id FROM user_programs up WHERE up.program_id = p.id LIMIT 1
)
WHERE p.user_id IS NULL
  AND (SELECT COUNT(DISTINCT up.user_id) FROM user_programs up WHERE up.program_id = p.id) = 1;

-- Programs never started, or started by 2+ users, stay visible to everyone as
-- read-only templates. (Hiding them would break user_programs rows that
-- reference them.)
UPDATE programs SET is_global = true WHERE user_id IS NULL;

-- ============================================================
-- 3) Per-user slugs
-- ============================================================
-- The global UNIQUE(slug) from 005 would make two tenants collide on
-- "push-pull-legs". Scope uniqueness to the owner; keep globals unique
-- among themselves.
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS programs_user_slug_key
    ON programs (user_id, slug) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS programs_global_slug_key
    ON programs (slug) WHERE is_global;

-- ============================================================
-- 4) Replace the permissive policies
-- ============================================================
-- (Both old and new policy names are dropped first so this whole file is
-- safe to re-run if a previous attempt stopped partway.)
DROP POLICY IF EXISTS "Authenticated read" ON programs;
DROP POLICY IF EXISTS "Authenticated insert" ON programs;
DROP POLICY IF EXISTS "Authenticated update" ON programs;
DROP POLICY IF EXISTS "Authenticated delete" ON programs;
DROP POLICY IF EXISTS "Read own or global" ON programs;
DROP POLICY IF EXISTS "Insert own" ON programs;
DROP POLICY IF EXISTS "Update own" ON programs;
DROP POLICY IF EXISTS "Delete own" ON programs;

DROP POLICY IF EXISTS "Authenticated read" ON program_phases;
DROP POLICY IF EXISTS "Authenticated insert" ON program_phases;
DROP POLICY IF EXISTS "Authenticated update" ON program_phases;
DROP POLICY IF EXISTS "Authenticated delete" ON program_phases;
DROP POLICY IF EXISTS "Read own or global" ON program_phases;
DROP POLICY IF EXISTS "Insert own" ON program_phases;
DROP POLICY IF EXISTS "Update own" ON program_phases;
DROP POLICY IF EXISTS "Delete own" ON program_phases;

DROP POLICY IF EXISTS "Authenticated read" ON program_days;
DROP POLICY IF EXISTS "Authenticated insert" ON program_days;
DROP POLICY IF EXISTS "Authenticated update" ON program_days;
DROP POLICY IF EXISTS "Authenticated delete" ON program_days;
DROP POLICY IF EXISTS "Read own or global" ON program_days;
DROP POLICY IF EXISTS "Insert own" ON program_days;
DROP POLICY IF EXISTS "Update own" ON program_days;
DROP POLICY IF EXISTS "Delete own" ON program_days;

DROP POLICY IF EXISTS "Authenticated read" ON program_exercises;
DROP POLICY IF EXISTS "Authenticated insert" ON program_exercises;
DROP POLICY IF EXISTS "Authenticated update" ON program_exercises;
DROP POLICY IF EXISTS "Authenticated delete" ON program_exercises;
DROP POLICY IF EXISTS "Read own or global" ON program_exercises;
DROP POLICY IF EXISTS "Insert own" ON program_exercises;
DROP POLICY IF EXISTS "Update own" ON program_exercises;
DROP POLICY IF EXISTS "Delete own" ON program_exercises;

DROP POLICY IF EXISTS "Authenticated read" ON program_principles;
DROP POLICY IF EXISTS "Authenticated insert" ON program_principles;
DROP POLICY IF EXISTS "Authenticated update" ON program_principles;
DROP POLICY IF EXISTS "Authenticated delete" ON program_principles;
DROP POLICY IF EXISTS "Read own or global" ON program_principles;
DROP POLICY IF EXISTS "Insert own" ON program_principles;
DROP POLICY IF EXISTS "Update own" ON program_principles;
DROP POLICY IF EXISTS "Delete own" ON program_principles;

-- exercises (the shared read-only dictionary) keeps its SELECT-only policy
-- from 005 — intentionally untouched.

-- programs ---------------------------------------------------
-- (SELECT auth.uid()) is evaluated once per statement instead of per row.
CREATE POLICY "Read own or global" ON programs FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR is_global);

CREATE POLICY "Insert own" ON programs FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) AND NOT is_global);

CREATE POLICY "Update own" ON programs FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()) AND NOT is_global);

CREATE POLICY "Delete own" ON programs FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- program_phases / program_days / program_principles ---------
-- (one hop: program_id → programs)
CREATE POLICY "Read own or global" ON program_phases FOR SELECT TO authenticated
    USING (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid()) OR is_global));
CREATE POLICY "Insert own" ON program_phases FOR INSERT TO authenticated
    WITH CHECK (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "Update own" ON program_phases FOR UPDATE TO authenticated
    USING (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid())))
    WITH CHECK (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "Delete own" ON program_phases FOR DELETE TO authenticated
    USING (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Read own or global" ON program_days FOR SELECT TO authenticated
    USING (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid()) OR is_global));
CREATE POLICY "Insert own" ON program_days FOR INSERT TO authenticated
    WITH CHECK (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "Update own" ON program_days FOR UPDATE TO authenticated
    USING (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid())))
    WITH CHECK (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "Delete own" ON program_days FOR DELETE TO authenticated
    USING (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Read own or global" ON program_principles FOR SELECT TO authenticated
    USING (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid()) OR is_global));
CREATE POLICY "Insert own" ON program_principles FOR INSERT TO authenticated
    WITH CHECK (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "Update own" ON program_principles FOR UPDATE TO authenticated
    USING (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid())))
    WITH CHECK (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "Delete own" ON program_principles FOR DELETE TO authenticated
    USING (program_id IN (SELECT id FROM programs WHERE user_id = (SELECT auth.uid())));

-- program_exercises ------------------------------------------
-- (two hops: program_day_id → program_days → programs)
CREATE POLICY "Read own or global" ON program_exercises FOR SELECT TO authenticated
    USING (program_day_id IN (
        SELECT d.id FROM program_days d
        JOIN programs p ON p.id = d.program_id
        WHERE p.user_id = (SELECT auth.uid()) OR p.is_global
    ));
CREATE POLICY "Insert own" ON program_exercises FOR INSERT TO authenticated
    WITH CHECK (program_day_id IN (
        SELECT d.id FROM program_days d
        JOIN programs p ON p.id = d.program_id
        WHERE p.user_id = (SELECT auth.uid())
    ));
CREATE POLICY "Update own" ON program_exercises FOR UPDATE TO authenticated
    USING (program_day_id IN (
        SELECT d.id FROM program_days d
        JOIN programs p ON p.id = d.program_id
        WHERE p.user_id = (SELECT auth.uid())
    ))
    WITH CHECK (program_day_id IN (
        SELECT d.id FROM program_days d
        JOIN programs p ON p.id = d.program_id
        WHERE p.user_id = (SELECT auth.uid())
    ));
CREATE POLICY "Delete own" ON program_exercises FOR DELETE TO authenticated
    USING (program_day_id IN (
        SELECT d.id FROM program_days d
        JOIN programs p ON p.id = d.program_id
        WHERE p.user_id = (SELECT auth.uid())
    ));

-- NOTE: global templates (is_global = true, user_id NULL) are read-only for
-- everyone through the Data API — they can only be edited via the SQL editor
-- or a service-role key. Users who want to customize a template create their
-- own program in the app.
