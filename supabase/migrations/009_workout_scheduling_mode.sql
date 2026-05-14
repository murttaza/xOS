-- Per-program scheduling mode.
-- 'weekly'     : sessions auto-spawn on day_of_week (current behavior, default)
-- 'sequential' : next-up only; sessions are created lazily, one at a time, in
--                program_days.order. Missed days don't shift future sessions.
--
-- Backward compatible: existing programs default to 'weekly' so behavior is
-- unchanged for the seeded 'hybrid-comeback' plan and any user-created programs
-- that pre-date this migration.

ALTER TABLE programs
    ADD COLUMN IF NOT EXISTS scheduling_mode TEXT NOT NULL DEFAULT 'weekly'
    CHECK (scheduling_mode IN ('weekly', 'sequential'));

COMMENT ON COLUMN programs.scheduling_mode IS
    'weekly: pre-spawn one session per program_day per week, anchored on day_of_week. sequential: lazily create one ''next'' session in program_days.order; misses don''t advance the schedule.';
