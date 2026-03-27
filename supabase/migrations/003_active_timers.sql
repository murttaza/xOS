-- Active timers table for cross-device timer sync
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS active_timers (
    "taskId" INTEGER NOT NULL,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    "startTime" TEXT NOT NULL,
    PRIMARY KEY ("taskId", user_id)
);

ALTER TABLE active_timers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their timers" ON active_timers FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
