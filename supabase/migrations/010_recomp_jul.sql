-- Recomp Jul — 12-week Upper/Lower Physique Rebuild Plan for Murtaza.
-- Sequential scheduling (Day 1 → 2 → 3 → ... → 6, weekday is a hint).
-- Phase 1: Weeks 1-4   — Rebuild
-- Phase 2: Weeks 5-8   — Hypertrophy push (more chest/arms/delts volume)
-- Phase 3: Weeks 9-12  — Specialization (slightly heavier compounds)
--
-- Apply with the Supabase SQL Editor after migration 009 has run.
-- Idempotent: re-running is a no-op (skip if program 'recomp-jul' exists).

-- ============================================================
-- 1. Add canonical exercises this plan needs that aren't in 005.
-- ============================================================

INSERT INTO exercises (name, category, default_unit) VALUES
    ('Cable Curl',          'isolation',    'lb'),
    ('Preacher Curl',       'isolation',    'lb'),
    ('Leg Press',           'squat',        'lb'),
    ('Hack Squat',          'squat',        'lb'),
    ('Front Squat',         'squat',        'lb'),
    ('Machine Chest Press', 'press',        'lb'),
    ('Machine Curl',        'isolation',    'lb'),
    ('Seated Cable Row',    'row',          'lb'),
    ('Stiff-Leg Deadlift',  'hinge',        'lb'),
    ('Incline Walk',        'conditioning', 'min'),
    ('Bike',                'conditioning', 'min')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2. Seed: Recomp Jul program
-- ============================================================

DO $$
DECLARE
    v_program_id  UUID;
    v_phase1_id   UUID;
    v_phase2_id   UUID;
    v_phase3_id   UUID;
    v_user_id     UUID;
    -- Phase 1 days (Day 1..6)
    v_p1_d1 UUID; v_p1_d2 UUID; v_p1_d3 UUID; v_p1_d4 UUID; v_p1_d5 UUID; v_p1_d6 UUID;
    -- Phase 2 days
    v_p2_d1 UUID; v_p2_d2 UUID; v_p2_d3 UUID; v_p2_d4 UUID; v_p2_d5 UUID; v_p2_d6 UUID;
    -- Phase 3 days
    v_p3_d1 UUID; v_p3_d2 UUID; v_p3_d3 UUID; v_p3_d4 UUID; v_p3_d5 UUID; v_p3_d6 UUID;
    -- Exercise IDs
    e_bench         UUID; e_incline_bb    UUID; e_incline_db    UUID; e_flat_db       UUID;
    e_machine_press UUID; e_cable_fly     UUID; e_machine_fly   UUID; e_lat_raise     UUID;
    e_back_squat    UUID; e_front_squat   UUID; e_hack_squat    UUID; e_leg_press     UUID;
    e_rdl           UUID; e_stiff_dl      UUID; e_conv_dl       UUID; e_leg_ext       UUID;
    e_leg_curl      UUID; e_calf          UUID; e_chest_row     UUID; e_seated_row    UUID;
    e_lat_pulldown  UUID; e_pull_up       UUID; e_tri_pushdown  UUID; e_overhead_tri  UUID;
    e_cable_curl    UUID; e_preacher_curl UUID; e_machine_curl  UUID; e_incline_curl  UUID;
    e_walk          UUID; e_bike          UUID;
BEGIN
    -- Skip if already seeded.
    IF EXISTS (SELECT 1 FROM programs WHERE slug = 'recomp-jul') THEN
        RAISE NOTICE 'Program recomp-jul already seeded, skipping.';
        RETURN;
    END IF;

    -- Look up exercise IDs
    SELECT id INTO e_bench         FROM exercises WHERE name = 'Bench Press';
    SELECT id INTO e_incline_bb    FROM exercises WHERE name = 'Incline Barbell Press';
    SELECT id INTO e_incline_db    FROM exercises WHERE name = 'Incline DB Press';
    SELECT id INTO e_flat_db       FROM exercises WHERE name = 'Flat DB Press';
    SELECT id INTO e_machine_press FROM exercises WHERE name = 'Machine Chest Press';
    SELECT id INTO e_cable_fly     FROM exercises WHERE name = 'Cable Chest Fly';
    SELECT id INTO e_machine_fly   FROM exercises WHERE name = 'Machine Chest Fly';
    SELECT id INTO e_lat_raise     FROM exercises WHERE name = 'Lateral Raise';
    SELECT id INTO e_back_squat    FROM exercises WHERE name = 'Back Squat';
    SELECT id INTO e_front_squat   FROM exercises WHERE name = 'Front Squat';
    SELECT id INTO e_hack_squat    FROM exercises WHERE name = 'Hack Squat';
    SELECT id INTO e_leg_press     FROM exercises WHERE name = 'Leg Press';
    SELECT id INTO e_rdl           FROM exercises WHERE name = 'Romanian Deadlift';
    SELECT id INTO e_stiff_dl      FROM exercises WHERE name = 'Stiff-Leg Deadlift';
    SELECT id INTO e_conv_dl       FROM exercises WHERE name = 'Conventional Deadlift';
    SELECT id INTO e_leg_ext       FROM exercises WHERE name = 'Leg Extension';
    SELECT id INTO e_leg_curl      FROM exercises WHERE name = 'Leg Curl';
    SELECT id INTO e_calf          FROM exercises WHERE name = 'Standing Calf Raise';
    SELECT id INTO e_chest_row     FROM exercises WHERE name = 'Chest-Supported Row';
    SELECT id INTO e_seated_row    FROM exercises WHERE name = 'Seated Cable Row';
    SELECT id INTO e_lat_pulldown  FROM exercises WHERE name = 'Lat Pulldown';
    SELECT id INTO e_pull_up       FROM exercises WHERE name = 'Pull-up';
    SELECT id INTO e_tri_pushdown  FROM exercises WHERE name = 'Tricep Pushdown';
    SELECT id INTO e_overhead_tri  FROM exercises WHERE name = 'Overhead Triceps Extension';
    SELECT id INTO e_cable_curl    FROM exercises WHERE name = 'Cable Curl';
    SELECT id INTO e_preacher_curl FROM exercises WHERE name = 'Preacher Curl';
    SELECT id INTO e_machine_curl  FROM exercises WHERE name = 'Machine Curl';
    SELECT id INTO e_incline_curl  FROM exercises WHERE name = 'Incline DB Curl';
    SELECT id INTO e_walk          FROM exercises WHERE name = 'Incline Walk';
    SELECT id INTO e_bike          FROM exercises WHERE name = 'Bike';

    -- ─────────────────────────────────────────────────────────
    -- Program
    -- ─────────────────────────────────────────────────────────
    INSERT INTO programs (slug, name, description, total_weeks, scheduling_mode)
    VALUES (
        'recomp-jul',
        'Recomp Jul',
        '12-week Upper/Lower physique rebuild — fat loss, muscle regain, chest/arms/delts priority. 6 days/week, sequential next-up scheduling so missed days don''t shift the plan. Built for retatrutide context: cardio is intentional, no max testing in Phase 1.',
        12,
        'sequential'
    )
    RETURNING id INTO v_program_id;

    -- ─────────────────────────────────────────────────────────
    -- Phases
    -- ─────────────────────────────────────────────────────────
    INSERT INTO program_phases (program_id, name, week_start, week_end, rir_guidance, description, "order")
    VALUES (
        v_program_id, 'Rebuild', 1, 4,
        'Compounds RPE 7-8 (~2 RIR). Accessories RPE 8-9 (~1 RIR). No grinding.',
        'Reintroduce compound lifts, rebuild rhythm and recovery. Leave the gym feeling like you could have done more.',
        1
    ) RETURNING id INTO v_phase1_id;

    INSERT INTO program_phases (program_id, name, week_start, week_end, rir_guidance, description, "order")
    VALUES (
        v_program_id, 'Hypertrophy Push', 5, 8,
        'Compounds RPE 7-8. Accessories RPE 8-9. Push chest/arms/delts volume.',
        'Add 1 set to chest, biceps, and triceps work. Cardio creeps up if recovery is good. Lower C stays light.',
        2
    ) RETURNING id INTO v_phase2_id;

    INSERT INTO program_phases (program_id, name, week_start, week_end, rir_guidance, description, "order")
    VALUES (
        v_program_id, 'Specialization', 9, 12,
        'Compounds RPE 8 (~1-2 RIR). Accessories close to failure. Still no max testing.',
        'Specialize on chest/arms/delts. Compounds creep heavier if sleep + protein are dialed. If recovery is shaky, hold Phase 2 numbers.',
        3
    ) RETURNING id INTO v_phase3_id;

    -- ═════════════════════════════════════════════════════════
    -- PHASE 1 DAYS
    -- ═════════════════════════════════════════════════════════

    -- Day 1: Upper A — Bench Focus
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase1_id, 1, 'Day 1 — Upper A (Bench)', 'upper_push', 1)
    RETURNING id INTO v_p1_d1;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p1_d1, e_bench,         'Barbell Bench Press',   'strength',     '3', '5-8',   'Controlled, no grinding. RPE 7-8.', true,  1),
    (v_p1_d1, e_chest_row,     'Chest-Supported Row',   'strength',     '3', '8-12',  'Squeeze hard at the top.',         true,  2),
    (v_p1_d1, e_incline_db,    'Incline Dumbbell Press','strength',     '3', '8-12',  'Deep controlled stretch.',          true,  3),
    (v_p1_d1, e_lat_pulldown,  'Lat Pulldown',          'strength',     '2', '8-12',  'Full stretch at the top.',          true,  4),
    (v_p1_d1, e_cable_fly,     'Cable Fly / Pec Deck',  'strength',     '2', '12-20', 'Chest isolation. Stretch + squeeze.', true, 5),
    (v_p1_d1, e_tri_pushdown,  'Triceps Pressdown',     'strength',     '3', '10-15', 'Lockout hard.',                     true,  6),
    (v_p1_d1, e_cable_curl,    'Cable Curl',            'strength',     '3', '10-15', 'Controlled reps.',                  true,  7),
    (v_p1_d1, e_walk,          'Incline Walk',          'conditioning', '—', '10-15 min', 'Easy. Optional if short on time.', false, 8);

    -- Day 2: Lower A — Squat Focus
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase1_id, 2, 'Day 2 — Lower A (Squat)', 'lower_squat', 2)
    RETURNING id INTO v_p1_d2;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p1_d2, e_back_squat,    'Barbell Back Squat',    'strength',     '3', '5-8',   'Leave 2 reps in the tank. RPE 7-8.', true, 1),
    (v_p1_d2, e_rdl,           'Romanian Deadlift',     'strength',     '3', '8-10',  'Hamstring stretch, no rounding.',    true, 2),
    (v_p1_d2, e_leg_press,     'Leg Press',             'strength',     '2', '10-15', 'Controlled depth.',                  true, 3),
    (v_p1_d2, e_leg_curl,      'Seated/Lying Leg Curl', 'strength',     '3', '10-15', 'No swinging.',                       true, 4),
    (v_p1_d2, e_calf,          'Calf Raise',            'strength',     '3', '10-20', 'Full stretch at the bottom.',        true, 5),
    (v_p1_d2, e_walk,          'Incline Walk',          'conditioning', '—', '10-15 min', 'Easy. Keep it light.',           false, 6);

    -- Day 3: Upper B — Incline + Arms/Delts
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase1_id, 3, 'Day 3 — Upper B (Incline + Arms/Delts)', 'upper_push', 3)
    RETURNING id INTO v_p1_d3;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p1_d3, e_incline_bb,    'Incline Barbell or DB Press', 'strength',     '3', '6-10',  'Upper chest priority.',           true, 1),
    (v_p1_d3, e_pull_up,       'Pull-Up / Assisted / Pulldown','strength',    '3', '8-12',  'Controlled reps.',                true, 2),
    (v_p1_d3, e_machine_press, 'Machine Chest Press',         'strength',     '2', '10-15', 'Stable chest volume.',            true, 3),
    (v_p1_d3, e_seated_row,    'Seated Cable Row',            'strength',     '2', '10-15', 'Moderate effort.',                true, 4),
    (v_p1_d3, e_lat_raise,     'Lateral Raise',               'strength',     '4', '12-25', 'Side delt focus. Cheat code for looking bigger.', true, 5),
    (v_p1_d3, e_overhead_tri,  'Overhead Cable Tri Extension','strength',     '3', '10-15', 'Long head triceps.',              true, 6),
    (v_p1_d3, e_preacher_curl, 'Preacher / Machine Curl',     'strength',     '3', '10-15', 'Strict reps.',                    true, 7),
    (v_p1_d3, e_walk,          'Incline Walk',                'conditioning', '—', '15 min','Zone 2-ish.',                     false, 8);

    -- Day 4: Lower B — Deadlift Focus
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase1_id, 4, 'Day 4 — Lower B (Deadlift)', 'lower_hinge', 4)
    RETURNING id INTO v_p1_d4;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p1_d4, e_conv_dl,       'Conventional Deadlift', 'strength',     '2-3', '3-6',  'No grinders. RPE 7-8.',               true, 1),
    (v_p1_d4, e_hack_squat,    'Hack Squat / Front Squat / Leg Press', 'strength', '3', '8-12', 'Choose based on equipment.', true, 2),
    (v_p1_d4, e_leg_ext,       'Leg Extension',         'strength',     '3', '12-20', 'Quad pump.',                          true, 3),
    (v_p1_d4, e_leg_curl,      'Leg Curl',              'strength',     '3', '10-15', 'Hamstrings.',                         true, 4),
    (v_p1_d4, e_calf,          'Calf Raise',            'strength',     '3', '10-20', 'Controlled.',                         true, 5),
    (v_p1_d4, e_bike,          'Bike or Incline Walk',  'conditioning', '—', '10-15 min', 'Easy. Keep recovery intact.',    false, 6);

    -- Day 5: Upper C — Chest and Arms Volume
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase1_id, 5, 'Day 5 — Upper C (Chest/Arms Volume)', 'upper_push', 5)
    RETURNING id INTO v_p1_d5;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p1_d5, e_flat_db,       'DB Bench / Machine Press', 'strength',     '3', '8-12',  'Moderate-heavy.',               true, 1),
    (v_p1_d5, e_cable_fly,     'Cable Fly / Pec Deck',     'strength',     '3', '12-20', 'Stretch + squeeze.',            true, 2),
    (v_p1_d5, e_chest_row,     'Chest-Supported Row',      'strength',     '2', '10-15', 'Maintenance back work.',        true, 3),
    (v_p1_d5, e_lat_pulldown,  'Lat Pulldown',             'strength',     '2', '10-15', 'Back volume.',                  true, 4),
    (v_p1_d5, e_tri_pushdown,  'Rope Pressdown',           'strength',     '3', '12-20', 'Triceps volume.',               true, 5),
    (v_p1_d5, e_incline_curl,  'Incline DB / Cable Curl',  'strength',     '3', '12-20', 'Biceps volume.',                true, 6),
    (v_p1_d5, e_lat_raise,     'Lateral Raise',            'strength',     '3', '15-25', 'Side delts.',                   true, 7),
    (v_p1_d5, e_walk,          'Incline Walk',             'conditioning', '—', '15-20 min', 'Easy. Optional extension.', false, 8);

    -- Day 6: Lower C — Lighter Legs + Cardio
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase1_id, 6, 'Day 6 — Lower C (Lighter Legs + Cardio)', 'lower_squat', 6)
    RETURNING id INTO v_p1_d6;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p1_d6, e_leg_press,     'Leg Press',                'strength',     '3', '10-15', 'Moderate.',                     true, 1),
    (v_p1_d6, e_leg_ext,       'Leg Extension',            'strength',     '3', '12-20', 'Controlled pump.',              true, 2),
    (v_p1_d6, e_leg_curl,      'Leg Curl',                 'strength',     '3', '12-20', 'Controlled pump.',              true, 3),
    (v_p1_d6, e_calf,          'Calf Raise',               'strength',     '3', '12-20', 'Full range.',                   true, 4),
    (v_p1_d6, e_rdl,           'Optional Light RDL',       'strength',     '2', '10-12', 'Only if recovered.',            true, 5),
    (v_p1_d6, e_walk,          'Incline Walk / Bike',      'conditioning', '—', '25-35 min', 'Main cardio day. Easy/mod.', false, 6);

    -- ═════════════════════════════════════════════════════════
    -- PHASE 2 DAYS — same exercises with chest/arms/delts volume bumps
    -- ═════════════════════════════════════════════════════════

    -- Day 1: Upper A
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase2_id, 1, 'Day 1 — Upper A (Bench)', 'upper_push', 1)
    RETURNING id INTO v_p2_d1;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p2_d1, e_bench,         'Barbell Bench Press',   'strength',     '3', '5-8',   'Controlled. RPE 7-8.',               true, 1),
    (v_p2_d1, e_chest_row,     'Chest-Supported Row',   'strength',     '3', '8-12',  'Squeeze hard.',                       true, 2),
    (v_p2_d1, e_incline_db,    'Incline Dumbbell Press','strength',     '4', '8-12',  '+1 set vs Phase 1 if recovery is OK.',true, 3),
    (v_p2_d1, e_lat_pulldown,  'Lat Pulldown',          'strength',     '2', '8-12',  'Full stretch at top.',                true, 4),
    (v_p2_d1, e_cable_fly,     'Cable Fly / Pec Deck',  'strength',     '2', '12-20', 'Chest isolation.',                    true, 5),
    (v_p2_d1, e_tri_pushdown,  'Triceps Pressdown',     'strength',     '3', '10-15', 'Lockout hard.',                       true, 6),
    (v_p2_d1, e_cable_curl,    'Cable Curl',            'strength',     '3', '10-15', 'Controlled reps.',                    true, 7),
    (v_p2_d1, e_walk,          'Incline Walk',          'conditioning', '—', '15 min','Easy.',                               false, 8);

    -- Day 2: Lower A
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase2_id, 2, 'Day 2 — Lower A (Squat)', 'lower_squat', 2)
    RETURNING id INTO v_p2_d2;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p2_d2, e_back_squat,    'Barbell Back Squat',    'strength',     '3', '5-8',   'Leave 2 reps in tank.',              true, 1),
    (v_p2_d2, e_rdl,           'Romanian Deadlift',     'strength',     '3', '8-10',  'Hamstring stretch.',                  true, 2),
    (v_p2_d2, e_leg_press,     'Leg Press',             'strength',     '2', '10-15', 'Controlled depth.',                  true, 3),
    (v_p2_d2, e_leg_curl,      'Seated/Lying Leg Curl', 'strength',     '3', '10-15', 'No swinging.',                       true, 4),
    (v_p2_d2, e_calf,          'Calf Raise',            'strength',     '3', '10-20', 'Full stretch.',                       true, 5),
    (v_p2_d2, e_walk,          'Incline Walk',          'conditioning', '—', '10-15 min', 'Easy.',                          false, 6);

    -- Day 3: Upper B
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase2_id, 3, 'Day 3 — Upper B (Incline + Arms/Delts)', 'upper_push', 3)
    RETURNING id INTO v_p2_d3;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p2_d3, e_incline_bb,    'Incline Barbell or DB Press', 'strength',     '3', '6-10',  'Upper chest priority.',         true, 1),
    (v_p2_d3, e_pull_up,       'Pull-Up / Assisted / Pulldown','strength',    '3', '8-12',  'Controlled.',                   true, 2),
    (v_p2_d3, e_machine_press, 'Machine Chest Press',         'strength',     '2', '10-15', 'Stable chest volume.',          true, 3),
    (v_p2_d3, e_seated_row,    'Seated Cable Row',            'strength',     '2', '10-15', 'Moderate effort.',              true, 4),
    (v_p2_d3, e_lat_raise,     'Lateral Raise',               'strength',     '4', '12-25', 'Side delt focus.',              true, 5),
    (v_p2_d3, e_overhead_tri,  'Overhead Cable Tri Extension','strength',     '4', '10-15', '+1 set vs Phase 1.',            true, 6),
    (v_p2_d3, e_preacher_curl, 'Preacher / Machine Curl',     'strength',     '4', '10-15', '+1 set vs Phase 1.',            true, 7),
    (v_p2_d3, e_walk,          'Incline Walk',                'conditioning', '—', '15-20 min', 'Easy.',                     false, 8);

    -- Day 4: Lower B
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase2_id, 4, 'Day 4 — Lower B (Deadlift)', 'lower_hinge', 4)
    RETURNING id INTO v_p2_d4;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p2_d4, e_conv_dl,       'Conventional Deadlift', 'strength',     '2-3', '3-6',  'No grinders.',                       true, 1),
    (v_p2_d4, e_hack_squat,    'Hack / Front / Leg Press','strength',   '3',   '8-12', 'Choose based on equipment.',         true, 2),
    (v_p2_d4, e_leg_ext,       'Leg Extension',         'strength',     '3',   '12-20','Quad pump.',                         true, 3),
    (v_p2_d4, e_leg_curl,      'Leg Curl',              'strength',     '3',   '10-15','Hamstrings.',                        true, 4),
    (v_p2_d4, e_calf,          'Calf Raise',            'strength',     '3',   '10-20','Controlled.',                        true, 5),
    (v_p2_d4, e_bike,          'Bike or Incline Walk',  'conditioning', '—',   '10-15 min', 'Easy.',                         false, 6);

    -- Day 5: Upper C
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase2_id, 5, 'Day 5 — Upper C (Chest/Arms Volume)', 'upper_push', 5)
    RETURNING id INTO v_p2_d5;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p2_d5, e_flat_db,       'DB Bench / Machine Press', 'strength',     '3', '8-12',  'Moderate-heavy.',                  true, 1),
    (v_p2_d5, e_cable_fly,     'Cable Fly / Pec Deck',     'strength',     '3', '12-20', 'Stretch + squeeze.',                true, 2),
    (v_p2_d5, e_chest_row,     'Chest-Supported Row',      'strength',     '2', '10-15', 'Maintenance back work.',            true, 3),
    (v_p2_d5, e_lat_pulldown,  'Lat Pulldown',             'strength',     '2', '10-15', 'Back volume.',                      true, 4),
    (v_p2_d5, e_tri_pushdown,  'Rope Pressdown',           'strength',     '4', '12-20', '+1 set vs Phase 1.',                true, 5),
    (v_p2_d5, e_incline_curl,  'Incline DB / Cable Curl',  'strength',     '4', '12-20', '+1 set vs Phase 1.',                true, 6),
    (v_p2_d5, e_lat_raise,     'Lateral Raise',            'strength',     '4', '15-25', '+1 set vs Phase 1.',                true, 7),
    (v_p2_d5, e_walk,          'Incline Walk',             'conditioning', '—', '20 min','Easy.',                             false, 8);

    -- Day 6: Lower C
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase2_id, 6, 'Day 6 — Lower C (Lighter Legs + Cardio)', 'lower_squat', 6)
    RETURNING id INTO v_p2_d6;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p2_d6, e_leg_press,     'Leg Press',                'strength',     '3', '10-15', 'Moderate.',                         true, 1),
    (v_p2_d6, e_leg_ext,       'Leg Extension',            'strength',     '3', '12-20', 'Controlled pump.',                  true, 2),
    (v_p2_d6, e_leg_curl,      'Leg Curl',                 'strength',     '3', '12-20', 'Controlled pump.',                  true, 3),
    (v_p2_d6, e_calf,          'Calf Raise',               'strength',     '3', '12-20', 'Full range.',                       true, 4),
    (v_p2_d6, e_rdl,           'Optional Light RDL',       'strength',     '2', '10-12', 'Only if recovered.',                true, 5),
    (v_p2_d6, e_walk,          'Incline Walk / Bike',      'conditioning', '—', '30-40 min', 'Main cardio day.',              false, 6);

    -- ═════════════════════════════════════════════════════════
    -- PHASE 3 DAYS — heavier compounds, hold or grow accessory volume
    -- ═════════════════════════════════════════════════════════

    -- Day 1: Upper A
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase3_id, 1, 'Day 1 — Upper A (Bench)', 'upper_push', 1)
    RETURNING id INTO v_p3_d1;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p3_d1, e_bench,         'Barbell Bench Press',   'strength',     '3', '5-8',   'Compound creeps heavier. RPE 8.',     true, 1),
    (v_p3_d1, e_chest_row,     'Chest-Supported Row',   'strength',     '3', '8-12',  'Squeeze hard.',                       true, 2),
    (v_p3_d1, e_incline_db,    'Incline Dumbbell Press','strength',     '4', '8-12',  'Hold Phase 2 volume.',                true, 3),
    (v_p3_d1, e_lat_pulldown,  'Lat Pulldown',          'strength',     '2', '8-12',  'Full stretch at top.',                true, 4),
    (v_p3_d1, e_cable_fly,     'Cable Fly / Pec Deck',  'strength',     '2', '12-20', 'Chest isolation.',                    true, 5),
    (v_p3_d1, e_tri_pushdown,  'Triceps Pressdown',     'strength',     '3', '10-15', 'Lockout hard.',                       true, 6),
    (v_p3_d1, e_cable_curl,    'Cable Curl',            'strength',     '3', '10-15', 'Controlled.',                         true, 7),
    (v_p3_d1, e_walk,          'Incline Walk',          'conditioning', '—', '15-20 min', 'Easy.',                           false, 8);

    -- Day 2: Lower A
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase3_id, 2, 'Day 2 — Lower A (Squat)', 'lower_squat', 2)
    RETURNING id INTO v_p3_d2;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p3_d2, e_back_squat,    'Barbell Back Squat',    'strength',     '3', '5-8',   'Heavier than Phase 2 if form is solid.', true, 1),
    (v_p3_d2, e_rdl,           'Romanian Deadlift',     'strength',     '3', '8-10',  'Hamstring stretch.',                  true, 2),
    (v_p3_d2, e_leg_press,     'Leg Press',             'strength',     '2', '10-15', 'Controlled depth.',                  true, 3),
    (v_p3_d2, e_leg_curl,      'Seated/Lying Leg Curl', 'strength',     '3', '10-15', 'No swinging.',                       true, 4),
    (v_p3_d2, e_calf,          'Calf Raise',            'strength',     '3', '10-20', 'Full stretch.',                       true, 5),
    (v_p3_d2, e_walk,          'Incline Walk',          'conditioning', '—', '15 min','Easy.',                               false, 6);

    -- Day 3: Upper B
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase3_id, 3, 'Day 3 — Upper B (Incline + Arms/Delts)', 'upper_push', 3)
    RETURNING id INTO v_p3_d3;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p3_d3, e_incline_bb,    'Incline Barbell or DB Press', 'strength',     '3', '6-10',  'Upper chest priority. RPE 8.',  true, 1),
    (v_p3_d3, e_pull_up,       'Pull-Up / Assisted / Pulldown','strength',    '3', '8-12',  'Controlled.',                   true, 2),
    (v_p3_d3, e_machine_press, 'Machine Chest Press',         'strength',     '2', '10-15', 'Stable chest volume.',          true, 3),
    (v_p3_d3, e_seated_row,    'Seated Cable Row',            'strength',     '2', '10-15', 'Moderate effort.',              true, 4),
    (v_p3_d3, e_lat_raise,     'Lateral Raise',               'strength',     '4', '12-25', 'Specialization. Close to failure.', true, 5),
    (v_p3_d3, e_overhead_tri,  'Overhead Cable Tri Extension','strength',     '4', '10-15', 'Hold Phase 2 volume.',          true, 6),
    (v_p3_d3, e_preacher_curl, 'Preacher / Machine Curl',     'strength',     '4', '10-15', 'Hold Phase 2 volume.',          true, 7),
    (v_p3_d3, e_walk,          'Incline Walk',                'conditioning', '—', '20 min','Easy.',                         false, 8);

    -- Day 4: Lower B
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase3_id, 4, 'Day 4 — Lower B (Deadlift)', 'lower_hinge', 4)
    RETURNING id INTO v_p3_d4;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p3_d4, e_conv_dl,       'Conventional Deadlift', 'strength',     '2-3', '3-6',  'Heavier if form holds. No grinders.', true, 1),
    (v_p3_d4, e_hack_squat,    'Hack / Front / Leg Press','strength',   '3',   '8-12', 'Choose based on equipment.',         true, 2),
    (v_p3_d4, e_leg_ext,       'Leg Extension',         'strength',     '3',   '12-20','Quad pump.',                         true, 3),
    (v_p3_d4, e_leg_curl,      'Leg Curl',              'strength',     '3',   '10-15','Hamstrings.',                        true, 4),
    (v_p3_d4, e_calf,          'Calf Raise',            'strength',     '3',   '10-20','Controlled.',                        true, 5),
    (v_p3_d4, e_bike,          'Bike or Incline Walk',  'conditioning', '—',   '10-15 min', 'Easy.',                         false, 6);

    -- Day 5: Upper C
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase3_id, 5, 'Day 5 — Upper C (Chest/Arms Volume)', 'upper_push', 5)
    RETURNING id INTO v_p3_d5;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p3_d5, e_flat_db,       'DB Bench / Machine Press', 'strength',     '3', '8-12',  'Moderate-heavy.',                  true, 1),
    (v_p3_d5, e_cable_fly,     'Cable Fly / Pec Deck',     'strength',     '3', '12-20', 'Stretch + squeeze.',                true, 2),
    (v_p3_d5, e_chest_row,     'Chest-Supported Row',      'strength',     '2', '10-15', 'Maintenance back work.',            true, 3),
    (v_p3_d5, e_lat_pulldown,  'Lat Pulldown',             'strength',     '2', '10-15', 'Back volume.',                      true, 4),
    (v_p3_d5, e_tri_pushdown,  'Rope Pressdown',           'strength',     '4', '12-20', 'Hold Phase 2 volume.',              true, 5),
    (v_p3_d5, e_incline_curl,  'Incline DB / Cable Curl',  'strength',     '4', '12-20', 'Hold Phase 2 volume.',              true, 6),
    (v_p3_d5, e_lat_raise,     'Lateral Raise',            'strength',     '4', '15-25', 'Hold Phase 2 volume.',              true, 7),
    (v_p3_d5, e_walk,          'Incline Walk',             'conditioning', '—', '20-25 min', 'Easy.',                         false, 8);

    -- Day 6: Lower C
    INSERT INTO program_days (program_id, phase_id, day_of_week, name, focus, "order")
    VALUES (v_program_id, v_phase3_id, 6, 'Day 6 — Lower C (Lighter Legs + Cardio)', 'lower_squat', 6)
    RETURNING id INTO v_p3_d6;

    INSERT INTO program_exercises (program_day_id, exercise_id, display_name, type, prescribed_sets, prescribed_reps, notes, is_loggable, "order") VALUES
    (v_p3_d6, e_leg_press,     'Leg Press',                'strength',     '3', '10-15', 'Moderate.',                         true, 1),
    (v_p3_d6, e_leg_ext,       'Leg Extension',            'strength',     '3', '12-20', 'Controlled pump.',                  true, 2),
    (v_p3_d6, e_leg_curl,      'Leg Curl',                 'strength',     '3', '12-20', 'Controlled pump.',                  true, 3),
    (v_p3_d6, e_calf,          'Calf Raise',               'strength',     '3', '12-20', 'Full range.',                       true, 4),
    (v_p3_d6, e_rdl,           'Optional Light RDL',       'strength',     '2', '10-12', 'Only if recovered.',                true, 5),
    (v_p3_d6, e_walk,          'Incline Walk / Bike',      'conditioning', '—', '35-45 min', 'Main cardio day.',              false, 6);

    -- ═════════════════════════════════════════════════════════
    -- Principles
    -- ═════════════════════════════════════════════════════════

    INSERT INTO program_principles (program_id, title, body, "order") VALUES
    (v_program_id, 'No max testing in Phase 1',
     'Reintroduce the compounds. RPE 7-8 means leave 2 reps in the tank. Quality reps over heavy ones.', 1),
    (v_program_id, 'Failure rules',
     'Allowed near failure: curls, pressdowns, lateral raises, cable flys, leg extensions, leg curls. Avoid failure: squat, bench, deadlift, RDL, heavy rows.', 2),
    (v_program_id, 'Double progression on compounds',
     'Top of rep range on every set, clean form → add weight next session. If form breaks down, hold weight.', 3),
    (v_program_id, 'No hip thrusts, no Bulgarian split squats',
     'Out of scope for this plan. Substitutions live in the plan doc — sub freely if equipment forces it.', 4),
    (v_program_id, 'Lateral raises are the cheat code',
     '4+ sets, 12-25 reps, close to failure. Side delts are the biggest ROI for looking bigger.', 5),
    (v_program_id, 'Track every working set',
     'Weight, reps hit, RPE. The whole plan compounds on tracked progression. No tracking = no progression.', 6),
    (v_program_id, 'Reta-aware: cardio is intentional',
     'Skip or shorten cardio if dizzy/nauseous, RHR is high, sleep is bad, or hydration is shaky. Walk > run at current bodyweight.', 7),
    (v_program_id, 'Protein is the lever',
     'Minimum 170g/day. Better: 190-210g. If appetite is low on reta, use shakes — protein non-negotiable.', 8),
    (v_program_id, 'Creatine 3-5g/day',
     'Timing irrelevant. Scale will tick up from intramuscular water — that is not fat.', 9),
    (v_program_id, 'Sleep is the bottleneck',
     'If <5 hrs: keep workout, drop compound load 5-10%, skip optional cardio, no failure work, hydrate aggressively. Don''t compensate with caffeine.', 10),
    (v_program_id, 'Deload trigger',
     'Deload week if 2-3 of these hit: strength drops multiple sessions, RHR weirdly high, sleep worse, joint pain, motivation crash, flat all week, appetite too suppressed for protein.', 11),
    (v_program_id, 'No direct abs (yet)',
     'Skipped intentionally for this plan. Add later when bodyweight and comfort improve.', 12);

    -- ═════════════════════════════════════════════════════════
    -- Auto-start for murtazapirzada@gmail.com
    -- ═════════════════════════════════════════════════════════
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'murtazapirzada@gmail.com';

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'auth.users row for murtazapirzada@gmail.com not found — program created but NOT auto-started. Tap Start Program in the picker.';
    ELSE
        -- Pause any other active program so this one becomes the only active.
        UPDATE user_programs
            SET status = 'paused'
            WHERE user_id = v_user_id AND status = 'active';

        -- Activate the new run, starting today.
        INSERT INTO user_programs (user_id, program_id, started_on, current_week, status)
        VALUES (v_user_id, v_program_id, CURRENT_DATE, 1, 'active');

        RAISE NOTICE 'Recomp Jul auto-started for murtazapirzada@gmail.com starting %', CURRENT_DATE;
    END IF;

END $$;
