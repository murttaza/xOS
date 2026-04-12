-- Remove duplicate workout sessions, keeping the oldest one per (user_program_id, program_day_id, scheduled_date)
DELETE FROM workout_sessions
WHERE id NOT IN (
    SELECT DISTINCT ON (user_program_id, program_day_id, scheduled_date) id
    FROM workout_sessions
    ORDER BY user_program_id, program_day_id, scheduled_date, created_at ASC
);

-- Add unique constraint to prevent future duplicates
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'workout_sessions_user_program_id_program_day_id_scheduled__key'
    ) THEN
        ALTER TABLE workout_sessions
        ADD CONSTRAINT workout_sessions_user_program_id_program_day_id_scheduled__key
        UNIQUE (user_program_id, program_day_id, scheduled_date);
    END IF;
END $$;
