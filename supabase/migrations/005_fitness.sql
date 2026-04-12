-- Fitness Module: programmed training plans, workout logging, body metrics, exercise history
-- Run this in the Supabase SQL Editor after 004_budget_mode.sql

-- ============================================================
-- Catalog Tables (program templates — read-only for users)
-- ============================================================

CREATE TABLE IF NOT EXISTS exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- squat, hinge, press, row, pull, isolation, carry, conditioning, core, mobility
    default_unit TEXT DEFAULT 'lb'
);

CREATE TABLE IF NOT EXISTS programs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    total_weeks INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS program_phases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    week_start INT NOT NULL,
    week_end INT NOT NULL,
    rir_guidance TEXT,
    description TEXT,
    "order" INT NOT NULL
);

CREATE TABLE IF NOT EXISTS program_days (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    phase_id UUID NOT NULL REFERENCES program_phases(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL, -- 1=Mon ... 7=Sun
    name TEXT NOT NULL,
    focus TEXT, -- lower_squat, upper_push, conditioning, lower_hinge, upper_pull, rest
    "order" INT NOT NULL
);

CREATE TABLE IF NOT EXISTS program_exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_day_id UUID NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id),
    display_name TEXT NOT NULL,
    type TEXT NOT NULL, -- strength, conditioning, mobility, core, warmup, finisher
    prescribed_sets TEXT,
    prescribed_reps TEXT,
    notes TEXT,
    is_loggable BOOLEAN DEFAULT true,
    "order" INT NOT NULL
);

CREATE TABLE IF NOT EXISTS program_principles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    "order" INT NOT NULL
);

-- ============================================================
-- User Tables (instances and logs)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_programs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    program_id UUID NOT NULL REFERENCES programs(id),
    started_on DATE NOT NULL,
    current_week INT DEFAULT 1,
    status TEXT DEFAULT 'active', -- active, paused, completed, abandoned
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_program_id UUID NOT NULL REFERENCES user_programs(id) ON DELETE CASCADE,
    program_day_id UUID NOT NULL REFERENCES program_days(id),
    scheduled_date DATE NOT NULL,
    completed_at TIMESTAMPTZ,
    perceived_effort INT, -- 1-10
    notes TEXT,
    status TEXT DEFAULT 'planned', -- planned, in_progress, completed, skipped
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_program_id, program_day_id, scheduled_date)
);

CREATE TABLE IF NOT EXISTS exercise_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    program_exercise_id UUID NOT NULL REFERENCES program_exercises(id),
    exercise_id UUID REFERENCES exercises(id),
    substituted BOOLEAN DEFAULT false,
    working_weight NUMERIC,
    weight_unit TEXT DEFAULT 'lb',
    reps_hit INT,
    sets_completed INT,
    rir INT,
    duration_seconds INT,
    notes TEXT,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercise_sets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exercise_log_id UUID NOT NULL REFERENCES exercise_logs(id) ON DELETE CASCADE,
    set_number INT NOT NULL,
    weight NUMERIC,
    reps INT,
    rir INT
);

CREATE TABLE IF NOT EXISTS body_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    user_program_id UUID REFERENCES user_programs(id),
    week_number INT,
    date DATE NOT NULL,
    body_weight NUMERIC,
    weight_unit TEXT DEFAULT 'lb',
    rhr INT,
    rope_minutes NUMERIC,
    rope_pace INT,
    bench_top_set TEXT,
    squat_top_set TEXT,
    deadlift_top_set TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_program_phases_program ON program_phases(program_id);
CREATE INDEX IF NOT EXISTS idx_program_days_program ON program_days(program_id);
CREATE INDEX IF NOT EXISTS idx_program_days_phase ON program_days(phase_id);
CREATE INDEX IF NOT EXISTS idx_program_exercises_day ON program_exercises(program_day_id);
CREATE INDEX IF NOT EXISTS idx_program_principles_program ON program_principles(program_id);

CREATE INDEX IF NOT EXISTS idx_user_programs_user ON user_programs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_programs_status ON user_programs(status);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_program ON workout_sessions(user_program_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_session ON exercise_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_exercise ON exercise_logs(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_sets_log ON exercise_sets(exercise_log_id);
CREATE INDEX IF NOT EXISTS idx_body_metrics_user ON body_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_body_metrics_date ON body_metrics(date);

-- ============================================================
-- Row Level Security
-- ============================================================

-- Catalog tables: authenticated users can read all + create/update/delete their own
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_principles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read" ON exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON program_phases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON program_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON program_exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON program_principles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert" ON programs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated insert" ON program_phases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated insert" ON program_days FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated insert" ON program_exercises FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated insert" ON program_principles FOR INSERT TO authenticated WITH CHECK (true);

-- User tables: users own their data
ALTER TABLE user_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their data" ON user_programs FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Sessions: accessible via user_program ownership
CREATE POLICY "Users own their data" ON workout_sessions FOR ALL TO authenticated
    USING (user_program_id IN (SELECT id FROM user_programs WHERE user_id = auth.uid()))
    WITH CHECK (user_program_id IN (SELECT id FROM user_programs WHERE user_id = auth.uid()));

CREATE POLICY "Users own their data" ON exercise_logs FOR ALL TO authenticated
    USING (session_id IN (
        SELECT ws.id FROM workout_sessions ws
        JOIN user_programs up ON ws.user_program_id = up.id
        WHERE up.user_id = auth.uid()
    ))
    WITH CHECK (session_id IN (
        SELECT ws.id FROM workout_sessions ws
        JOIN user_programs up ON ws.user_program_id = up.id
        WHERE up.user_id = auth.uid()
    ));

CREATE POLICY "Users own their data" ON exercise_sets FOR ALL TO authenticated
    USING (exercise_log_id IN (
        SELECT el.id FROM exercise_logs el
        JOIN workout_sessions ws ON el.session_id = ws.id
        JOIN user_programs up ON ws.user_program_id = up.id
        WHERE up.user_id = auth.uid()
    ))
    WITH CHECK (exercise_log_id IN (
        SELECT el.id FROM exercise_logs el
        JOIN workout_sessions ws ON el.session_id = ws.id
        JOIN user_programs up ON ws.user_program_id = up.id
        WHERE up.user_id = auth.uid()
    ));

CREATE POLICY "Users own their data" ON body_metrics FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ============================================================
-- Seed: Canonical Exercises
-- ============================================================

INSERT INTO exercises (name, category, default_unit) VALUES
    -- Squat
    ('Goblet Squat',            'squat',        'lb'),
    ('Box Squat',               'squat',        'lb'),
    ('Back Squat',              'squat',        'lb'),
    ('Bulgarian Split Squat',   'squat',        'lb'),
    ('Walking Lunge',           'squat',        'lb'),
    ('Leg Extension',           'isolation',    'lb'),
    -- Hinge
    ('Romanian Deadlift',       'hinge',        'lb'),
    ('Trap Bar Deadlift',       'hinge',        'lb'),
    ('Conventional Deadlift',   'hinge',        'lb'),
    ('Hip Thrust',              'hinge',        'lb'),
    ('Back Extension',          'hinge',        'lb'),
    ('Leg Curl',                'isolation',    'lb'),
    -- Press
    ('Bench Press',             'press',        'lb'),
    ('Incline Barbell Press',   'press',        'lb'),
    ('Incline DB Press',        'press',        'lb'),
    ('Flat DB Press',           'press',        'lb'),
    ('Seated DB Overhead Press','press',        'lb'),
    ('Machine Chest Fly',       'isolation',    'lb'),
    ('Cable Chest Fly',         'isolation',    'lb'),
    ('Lateral Raise',           'isolation',    'lb'),
    ('Overhead Triceps Extension','isolation',  'lb'),
    ('Tricep Pushdown',         'isolation',    'lb'),
    -- Pull / Row
    ('Pull-up',                 'pull',         'lb'),
    ('Lat Pulldown',            'pull',         'lb'),
    ('Weighted Pull-up',        'pull',         'lb'),
    ('Barbell Row',             'row',          'lb'),
    ('DB Row',                  'row',          'lb'),
    ('Chest-Supported Row',     'row',          'lb'),
    ('Lat Pullover',            'pull',         'lb'),
    ('Straight-Arm Pulldown',   'pull',         'lb'),
    ('Face Pull',               'row',          'lb'),
    ('Rear Delt Fly',           'isolation',    'lb'),
    -- Biceps
    ('Biceps Curl',             'isolation',    'lb'),
    ('Incline DB Curl',         'isolation',    'lb'),
    ('Hammer Curl',             'isolation',    'lb'),
    -- Core
    ('Plank',                   'core',         'reps'),
    ('Dead Bug',                'core',         'reps'),
    ('Pallof Press',            'core',         'reps'),
    ('Hanging Leg Raise',       'core',         'reps'),
    -- Carry
    ('Farmers Carry',           'carry',        'lb'),
    -- Conditioning
    ('Skip Rope',               'conditioning', 'min'),
    ('Standing Calf Raise',     'isolation',    'lb')
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- Seed: Hybrid Comeback Program
-- ============================================================

DO $$
DECLARE
    v_program_id UUID;
    v_phase1_id UUID;
    v_phase2_id UUID;
    -- Phase 1 days
    v_p1_mon UUID;
    v_p1_tue UUID;
    v_p1_wed UUID;
    v_p1_thu UUID;
    v_p1_fri UUID;
    -- Phase 2 days
    v_p2_mon UUID;
    v_p2_tue UUID;
    v_p2_wed UUID;
    v_p2_thu UUID;
    v_p2_fri UUID;
    -- Exercise IDs (looked up from canonical table)
    e_goblet_squat UUID;
    e_box_squat UUID;
    e_back_squat UUID;
    e_rdl UUID;
    e_walking_lunge UUID;
    e_leg_curl UUID;
    e_standing_calf UUID;
    e_bench UUID;
    e_incline_db UUID;
    e_incline_bb UUID;
    e_flat_db UUID;
    e_seated_ohp UUID;
    e_lateral_raise UUID;
    e_tricep_pushdown UUID;
    e_overhead_tri UUID;
    e_machine_fly UUID;
    e_cable_fly UUID;
    e_skip_rope UUID;
    e_plank UUID;
    e_dead_bug UUID;
    e_pallof UUID;
    e_trap_bar UUID;
    e_conventional_dl UUID;
    e_bss UUID;
    e_hip_thrust UUID;
    e_back_ext UUID;
    e_farmers UUID;
    e_pullup UUID;
    e_lat_pulldown UUID;
    e_weighted_pullup UUID;
    e_bb_row UUID;
    e_db_row UUID;
    e_chest_row UUID;
    e_face_pull UUID;
    e_biceps_curl UUID;
    e_incline_curl UUID;
    e_hammer_curl UUID;
    e_lat_pullover UUID;
    e_straight_arm UUID;
    e_rear_delt UUID;
    e_hanging_leg UUID;
    e_leg_ext UUID;
BEGIN
    -- Skip if program already exists
    IF EXISTS (SELECT 1 FROM programs WHERE slug = 'hybrid-comeback') THEN
        RETURN;
    END IF;

    -- Look up exercise IDs
    SELECT id INTO e_goblet_squat FROM exercises WHERE name = 'Goblet Squat';
    SELECT id INTO e_box_squat FROM exercises WHERE name = 'Box Squat';
    SELECT id INTO e_back_squat FROM exercises WHERE name = 'Back Squat';
    SELECT id INTO e_rdl FROM exercises WHERE name = 'Romanian Deadlift';
    SELECT id INTO e_walking_lunge FROM exercises WHERE name = 'Walking Lunge';
    SELECT id INTO e_leg_curl FROM exercises WHERE name = 'Leg Curl';
    SELECT id INTO e_standing_calf FROM exercises WHERE name = 'Standing Calf Raise';
    SELECT id INTO e_bench FROM exercises WHERE name = 'Bench Press';
    SELECT id INTO e_incline_db FROM exercises WHERE name = 'Incline DB Press';
    SELECT id INTO e_incline_bb FROM exercises WHERE name = 'Incline Barbell Press';
    SELECT id INTO e_flat_db FROM exercises WHERE name = 'Flat DB Press';
    SELECT id INTO e_seated_ohp FROM exercises WHERE name = 'Seated DB Overhead Press';
    SELECT id INTO e_lateral_raise FROM exercises WHERE name = 'Lateral Raise';
    SELECT id INTO e_tricep_pushdown FROM exercises WHERE name = 'Tricep Pushdown';
    SELECT id INTO e_overhead_tri FROM exercises WHERE name = 'Overhead Triceps Extension';
    SELECT id INTO e_machine_fly FROM exercises WHERE name = 'Machine Chest Fly';
    SELECT id INTO e_cable_fly FROM exercises WHERE name = 'Cable Chest Fly';
    SELECT id INTO e_skip_rope FROM exercises WHERE name = 'Skip Rope';
    SELECT id INTO e_plank FROM exercises WHERE name = 'Plank';
    SELECT id INTO e_dead_bug FROM exercises WHERE name = 'Dead Bug';
    SELECT id INTO e_pallof FROM exercises WHERE name = 'Pallof Press';
    SELECT id INTO e_trap_bar FROM exercises WHERE name = 'Trap Bar Deadlift';
    SELECT id INTO e_conventional_dl FROM exercises WHERE name = 'Conventional Deadlift';
    SELECT id INTO e_bss FROM exercises WHERE name = 'Bulgarian Split Squat';
    SELECT id INTO e_hip_thrust FROM exercises WHERE name = 'Hip Thrust';
    SELECT id INTO e_back_ext FROM exercises WHERE name = 'Back Extension';
    SELECT id INTO e_farmers FROM exercises WHERE name = 'Farmers Carry';
    SELECT id INTO e_pullup FROM exercises WHERE name = 'Pull-up';
    SELECT id INTO e_lat_pulldown FROM exercises WHERE name = 'Lat Pulldown';
    SELECT id INTO e_weighted_pullup FROM exercises WHERE name = 'Weighted Pull-up';
    SELECT id INTO e_bb_row FROM exercises WHERE name = 'Barbell Row';
    SELECT id INTO e_db_row FROM exercises WHERE name = 'DB Row';
    SELECT id INTO e_chest_row FROM exercises WHERE name = 'Chest-Supported Row';
    SELECT id INTO e_face_pull FROM exercises WHERE name = 'Face Pull';
    SELECT id INTO e_biceps_curl FROM exercises WHERE name = 'Biceps Curl';
    SELECT id INTO e_incline_curl FROM exercises WHERE name = 'Incline DB Curl';
    SELECT id INTO e_hammer_curl FROM exercises WHERE name = 'Hammer Curl';
    SELECT id INTO e_lat_pullover FROM exercises WHERE name = 'Lat Pullover';
    SELECT id INTO e_straight_arm FROM exercises WHERE name = 'Straight-Arm Pulldown';
    SELECT id INTO e_rear_delt FROM exercises WHERE name = 'Rear Delt Fly';
    SELECT id INTO e_hanging_leg FROM exercises WHERE name = 'Hanging Leg Raise';
    SELECT id INTO e_leg_ext FROM exercises WHERE name = 'Leg Extension';

    -- Create program
    INSERT INTO programs (slug, name, description, total_weeks)
    VALUES ('hybrid-comeback', '5-Day Hybrid Athlete Comeback Plan',
        'A 12-week plan to rebuild strength, conditioning, and muscle for a former athlete returning to training. Two phases: Reintroduction (Wk 1-4) and Ramp (Wk 5-12).',
        12)
    RETURNING id INTO v_program_id;

    -- Create phases
    INSERT INTO program_phases (program_id, name, week_start, week_end, rir_guidance, description, "order")
    VALUES (v_program_id, 'Reintroduction', 1, 4,
        '2-3 RIR on all sets',
        'Rebuild tissue tolerance, movement patterns, and conditioning base. Every set leaves 2-3 reps in reserve.',
        1)
    RETURNING id INTO v_phase1_id;

    INSERT INTO program_phases (program_id, name, week_start, week_end, rir_guidance, description, "order")
    VALUES (v_program_id, 'Ramp', 5, 12,
        '1-2 RIR on main lifts, 0-2 RIR on isolation',
        'Progressive overload. Add a rep before adding weight. Push isolation close to failure. More volume on arms, chest, and shoulders.',
        2)
    RETURNING id INTO v_phase2_id;

    -- ══════════════════════════════════════════════════════════════
    -- Phase 1 Days
    -- ══════════════════════════════════════════════════════════════

    -- Monday: Lower (Squat focus)
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase1_id, 1, 'Lower — Squat focus', 'lower_squat', 1)
    RETURNING id INTO v_p1_mon;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p1_mon, NULL,              'Warm-up: hips, ankles, t-spine',         'warmup',    '—', '5-10 min', 'Non-negotiable at current weight', false, 1),
    (v_p1_mon, e_goblet_squat,    'Goblet squat or box squat',              'strength',  '3', '8',        'Start with the pattern, protect knees', true, 2),
    (v_p1_mon, e_rdl,             'Romanian deadlift',                      'strength',  '3', '10',       'Feel the hamstrings, don''t round', true, 3),
    (v_p1_mon, e_walking_lunge,   'Walking lunges',                         'strength',  '3', '10/leg',   'Bodyweight or light DBs', true, 4),
    (v_p1_mon, e_leg_curl,        'Leg curl',                               'strength',  '3', '12',       'Slow eccentric', true, 5),
    (v_p1_mon, e_standing_calf,   'Standing calf raise',                    'strength',  '3', '15',       'Full stretch at bottom', true, 6),
    (v_p1_mon, NULL,              'Finisher: 5 min skip rope (easy pace)',  'finisher',  '—', '5 min',    NULL, false, 7);

    -- Tuesday: Upper Push
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase1_id, 2, 'Upper Push', 'upper_push', 2)
    RETURNING id INTO v_p1_tue;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p1_tue, NULL,            'Warm-up: shoulders, t-spine',              'warmup',    '—', '5-10 min', 'Band pull-aparts, arm circles', false, 1),
    (v_p1_tue, e_bench,         'Bench press',                              'strength',  '3', '8',        '~50-55% of old working weight', true, 2),
    (v_p1_tue, e_incline_db,    'Incline DB press',                         'strength',  '3', '10',       'Controlled, stretch at bottom', true, 3),
    (v_p1_tue, e_seated_ohp,    'Seated DB overhead press',                 'strength',  '3', '8',        'Full ROM', true, 4),
    (v_p1_tue, e_lateral_raise, 'Lateral raises',                           'strength',  '3', '12',       'Slow, light, feel the side delt', true, 5),
    (v_p1_tue, e_tricep_pushdown,'Tricep pushdowns',                        'strength',  '3', '12',       'Squeeze at lockout', true, 6),
    (v_p1_tue, NULL,            'Finisher: 5 min skip rope',                'finisher',  '—', '5 min',    NULL, false, 7);

    -- Wednesday: Conditioning + Movement
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase1_id, 3, 'Conditioning + Movement', 'conditioning', 3)
    RETURNING id INTO v_p1_wed;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p1_wed, e_skip_rope,  'Skip rope intervals',                      'conditioning','10','1 min on / 30s off','Rest as needed to stay in form', true, 1),
    (v_p1_wed, NULL,         'Agility (ladder, cones, shuttles)',         'conditioning','—', '15 min',            'Lean on soccer background, keep it fun', false, 2),
    (v_p1_wed, e_plank,      'Plank',                                    'core',        '3', '45 sec',            'Tight core, glutes squeezed', true, 3),
    (v_p1_wed, e_dead_bug,   'Dead bug',                                 'core',        '3', '10/side',           'Slow, lower back pinned to floor', true, 4),
    (v_p1_wed, e_pallof,     'Pallof press',                             'core',        '3', '10/side',           'Anti-rotation, tight core', true, 5),
    (v_p1_wed, NULL,         'Mobility cooldown',                        'mobility',    '—', '10 min',            'Hips, ankles, t-spine', false, 6);

    -- Thursday: Lower (Hinge focus)
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase1_id, 4, 'Lower — Hinge focus', 'lower_hinge', 4)
    RETURNING id INTO v_p1_thu;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p1_thu, NULL,          'Warm-up: hips, hamstrings',                'warmup',    '—', '5-10 min', NULL, false, 1),
    (v_p1_thu, e_trap_bar,    'Trap bar deadlift',                        'strength',  '3', '5',        'Easier on spine than conventional', true, 2),
    (v_p1_thu, e_bss,         'Bulgarian split squats',                   'strength',  '3', '8/leg',    'Light DBs, balance first', true, 3),
    (v_p1_thu, e_hip_thrust,  'Hip thrusts',                              'strength',  '3', '10',       'Squeeze glutes hard at top', true, 4),
    (v_p1_thu, e_back_ext,    'Back extension',                           'strength',  '3', '12',       'Hinge from hips, don''t overextend', true, 5),
    (v_p1_thu, NULL,          'Finisher: Farmer''s carry — 3x40m',       'finisher',  '3', '40m',      'Or sled push', false, 6);

    -- Friday: Upper Pull
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase1_id, 5, 'Upper Pull', 'upper_pull', 5)
    RETURNING id INTO v_p1_fri;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p1_fri, NULL,          'Warm-up: scap work, band rows',            'warmup',    '—', '5-10 min', NULL, false, 1),
    (v_p1_fri, e_pullup,      'Pull-up or lat pulldown',                  'strength',  '3', '8',        'Pulldowns fine at current bw', true, 2),
    (v_p1_fri, e_bb_row,      'Barbell or DB row',                        'strength',  '3', '8',        'Chest up, drive elbow back', true, 3),
    (v_p1_fri, e_chest_row,   'Chest-supported row',                      'strength',  '3', '10',       'Remove lower back from equation', true, 4),
    (v_p1_fri, e_face_pull,   'Face pulls',                               'strength',  '3', '15',       'Shoulder health gold', true, 5),
    (v_p1_fri, e_biceps_curl, 'Biceps curl',                              'strength',  '3', '10',       NULL, true, 6),
    (v_p1_fri, NULL,          'Finisher: 5 min skip rope',                'finisher',  '—', '5 min',    NULL, false, 7);

    -- ══════════════════════════════════════════════════════════════
    -- Phase 2 Days
    -- ══════════════════════════════════════════════════════════════

    -- Monday: Lower (Squat focus)
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase2_id, 1, 'Lower — Squat focus', 'lower_squat', 1)
    RETURNING id INTO v_p2_mon;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p2_mon, NULL,            'Warm-up',                                  'warmup',    '—', '5-10 min', NULL, false, 1),
    (v_p2_mon, e_back_squat,    'Back squat',                               'strength',  '4', '5-6',      'Reintroduced now that pattern is solid', true, 2),
    (v_p2_mon, e_rdl,           'Romanian deadlift',                        'strength',  '4', '8',        'Load up, feel the stretch', true, 3),
    (v_p2_mon, e_walking_lunge, 'Walking lunges',                           'strength',  '3', '10/leg',   'DBs', true, 4),
    (v_p2_mon, e_leg_ext,       'Leg extension',                            'strength',  '3', '12',       NULL, true, 5),
    (v_p2_mon, e_leg_curl,      'Leg curl',                                 'strength',  '3', '12',       NULL, true, 6),
    (v_p2_mon, e_standing_calf, 'Standing calf raise',                      'strength',  '4', '12',       NULL, true, 7),
    (v_p2_mon, NULL,            'Finisher: Skip rope 2 min on / 1 min off x5','finisher','—', '15 min',   NULL, false, 8);

    -- Tuesday: Upper Push (hypertrophy tilt)
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase2_id, 2, 'Upper Push (hypertrophy)', 'upper_push', 2)
    RETURNING id INTO v_p2_tue;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p2_tue, NULL,              'Warm-up',                                'warmup',    '—',  '5-10 min', NULL, false, 1),
    (v_p2_tue, e_incline_bb,     'Incline barbell or DB press',             'strength',  '4',  '6-8',      'Main strength lift; builds upper chest', true, 2),
    (v_p2_tue, e_flat_db,        'Flat DB press',                           'strength',  '3',  '10-12',    'Deep stretch at bottom', true, 3),
    (v_p2_tue, e_machine_fly,    'Machine or cable chest fly',              'strength',  '3',  '12-15',    'Stretch-focused, controlled', true, 4),
    (v_p2_tue, e_lateral_raise,  'Lateral raises',                          'strength',  '4',  '12-15',    'Close to failure; cheat code for looking bigger', true, 5),
    (v_p2_tue, e_overhead_tri,   'Overhead triceps extension',              'strength',  '3',  '10-12',    'Grows long head — most of the arm', true, 6),
    (v_p2_tue, e_tricep_pushdown,'Tricep pushdown',                         'strength',  '3',  '12-15',    NULL, true, 7),
    (v_p2_tue, NULL,             'Finisher: 5 min skip rope or 10 min easy bike','finisher','—','5-10 min', NULL, false, 8);

    -- Wednesday: Conditioning + Movement
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase2_id, 3, 'Conditioning + Movement', 'conditioning', 3)
    RETURNING id INTO v_p2_wed;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p2_wed, e_skip_rope,  'Skip rope intervals',                      'conditioning','—', '2 min on / 1 min off x8','Add double-unders as skill returns', true, 1),
    (v_p2_wed, NULL,         'Agility / tempo runs',                      'conditioning','—', '15-20 min','Shuttles, cone weaves, 100m tempo strides', false, 2),
    (v_p2_wed, NULL,         'Core circuit: Plank 60s, Dead bug 12/side, Pallof 12/side','core','3 rds','—','Full circuit', false, 3),
    (v_p2_wed, NULL,         'Mobility cooldown',                         'mobility',    '—', '10 min',  NULL, false, 4);

    -- Thursday: Lower (Hinge focus)
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase2_id, 4, 'Lower — Hinge focus', 'lower_hinge', 4)
    RETURNING id INTO v_p2_thu;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p2_thu, NULL,          'Warm-up',                                  'warmup',    '—', '5-10 min', NULL, false, 1),
    (v_p2_thu, e_trap_bar,    'Trap bar or conventional deadlift',        'strength',  '4', '4-6',      'Heavy, but 1-2 RIR', true, 2),
    (v_p2_thu, e_bss,         'Bulgarian split squats',                   'strength',  '3', '8/leg',    'DBs, add load', true, 3),
    (v_p2_thu, e_hip_thrust,  'Hip thrusts',                              'strength',  '4', '8',        'Heavy — big posterior chain driver', true, 4),
    (v_p2_thu, e_back_ext,    'Back extension',                           'strength',  '3', '12',       'Can add weight', true, 5),
    (v_p2_thu, e_hanging_leg, 'Hanging leg raise',                        'core',      '3', '10',       'Core', true, 6),
    (v_p2_thu, NULL,          'Finisher: Farmer''s carry — 4x40m',       'finisher',  '—', '4x40m',    'Or sled push', false, 7);

    -- Friday: Upper Pull (back width + biceps)
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase2_id, 5, 'Upper Pull (back width + biceps)', 'upper_pull', 5)
    RETURNING id INTO v_p2_fri;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p2_fri, NULL,            'Warm-up',                                'warmup',    '—', '5-10 min', NULL, false, 1),
    (v_p2_fri, e_weighted_pullup,'Weighted pull-up or lat pulldown',      'strength',  '4', '6-10',     'Width driver', true, 2),
    (v_p2_fri, e_bb_row,       'Barbell row',                             'strength',  '3', '8',        'Thickness', true, 3),
    (v_p2_fri, e_chest_row,    'Chest-supported row',                     'strength',  '3', '10-12',    NULL, true, 4),
    (v_p2_fri, e_lat_pullover, 'Lat pullover or straight-arm pulldown',   'strength',  '3', '12',       'Lat stretch — growth happens here', true, 5),
    (v_p2_fri, e_incline_curl, 'Incline DB curl',                         'strength',  '4', '10-12',    'Stretched biceps = growth', true, 6),
    (v_p2_fri, e_hammer_curl,  'Hammer curl',                             'strength',  '3', '10-12',    'Brachialis — makes arms look thicker', true, 7),
    (v_p2_fri, e_rear_delt,    'Rear delt fly',                           'strength',  '3', '15',       NULL, true, 8),
    (v_p2_fri, NULL,           'Finisher: 5 min skip rope',               'finisher',  '—', '5 min',    NULL, false, 9);

    -- ══════════════════════════════════════════════════════════════
    -- Principles
    -- ══════════════════════════════════════════════════════════════

    INSERT INTO program_principles (program_id, title, body, "order") VALUES
    (v_program_id, 'RIR (Reps In Reserve)',
     'Phase 1: 2-3 RIR. Phase 2: 1-2 RIR on main lifts, 0-2 on isolation.', 1),
    (v_program_id, 'Progressive overload',
     'Add a rep before adding weight. If last week was 10, hit 11 at same weight first.', 2),
    (v_program_id, 'Warm-ups are mandatory',
     '5-10 min of hip/ankle/t-spine mobility before every lift. Non-negotiable at current body weight.', 3),
    (v_program_id, 'Train the stretch',
     'Deep DB press, incline curls, overhead triceps, pullovers. Stretched position drives growth.', 4),
    (v_program_id, 'Arms grow from frequency + volume',
     '12-20 hard sets per week, twice a week minimum. Taken close to failure.', 5),
    (v_program_id, 'Lateral raises = cheat code',
     'Biggest ROI for looking bigger. 4+ sets, 2-3x per week, close to failure.', 6),
    (v_program_id, 'Back width matters as much as arm size',
     'Nobody with a small back looks big. Pull-ups and pulldowns for width, rows for thickness.', 7),
    (v_program_id, 'Rope > running at current bodyweight',
     'Joint-friendly, skill-based, stays interesting. Your conditioning weapon.', 8),
    (v_program_id, 'Hybrid = compromise',
     'Can''t max strength + conditioning + hypertrophy at once. Current plan tilts strength + conditioning with enough hypertrophy to grow.', 9),
    (v_program_id, 'Muscle memory is real',
     'Lifts come back fast. Not 280/405/495 fast, but you''ll shock yourself in 3 months.', 10),
    (v_program_id, 'Diet does the scale work',
     'Training recomps you. Scale movement is driven by eating. Handle that in the other chat.', 11),
    (v_program_id, 'Consistency > intensity',
     '5 boring days > 2 heroic ones. The plan only works if you run it.', 12);

END $$;
