-- Referential integrity for notes
--
-- 001 created notes."subjectId" and tasks."noteId" without foreign keys; the
-- client deleted children manually, and a mid-flight failure could strand
-- notes pointing at a deleted subject (or tasks pointing at a deleted note).
-- Enforce it in the database instead.
--
-- No new tables, so no extra GRANTs needed.

-- 1) Clean up any orphans left behind by the old manual cascade.
DELETE FROM notes WHERE "subjectId" NOT IN (SELECT id FROM subjects);
UPDATE tasks SET "noteId" = NULL
    WHERE "noteId" IS NOT NULL AND "noteId" NOT IN (SELECT id FROM notes);

-- 2) Align column types with the BIGINT identity PKs they reference.
ALTER TABLE notes ALTER COLUMN "subjectId" TYPE BIGINT;
ALTER TABLE tasks ALTER COLUMN "noteId" TYPE BIGINT;

-- 3) Foreign keys: deleting a subject removes its notes; deleting a note
--    unlinks (but keeps) any task that referenced it.
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_subject_fk;
ALTER TABLE notes ADD CONSTRAINT notes_subject_fk
    FOREIGN KEY ("subjectId") REFERENCES subjects(id) ON DELETE CASCADE;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_note_fk;
ALTER TABLE tasks ADD CONSTRAINT tasks_note_fk
    FOREIGN KEY ("noteId") REFERENCES notes(id) ON DELETE SET NULL;
