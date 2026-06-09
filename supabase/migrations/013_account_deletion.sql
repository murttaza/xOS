-- Self-serve account deletion (GDPR/CCPA-style "delete my data")
--
-- A SECURITY DEFINER function owned by postgres can remove the caller's rows
-- across every table and finally the auth.users row itself — the anon/
-- authenticated roles never get direct access to auth.users.
--
-- No new tables, so no table GRANTs needed; the function gets an explicit
-- EXECUTE grant for authenticated only.

CREATE OR REPLACE FUNCTION delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    -- Fitness (children of user_programs cascade via FKs from 005)
    DELETE FROM user_programs WHERE user_id = uid;
    DELETE FROM body_metrics WHERE user_id = uid;

    -- Owned program templates: if (unexpectedly) another user still runs one,
    -- hand it over as an ownerless global template instead of breaking their
    -- run; everything else is deleted (phases/days/exercises cascade).
    UPDATE programs SET is_global = true, user_id = NULL
        WHERE user_id = uid
          AND EXISTS (SELECT 1 FROM user_programs up WHERE up.program_id = programs.id);
    DELETE FROM programs WHERE user_id = uid;

    -- Budget
    DELETE FROM budget_transactions WHERE user_id = uid;
    DELETE FROM budget_targets WHERE user_id = uid;
    DELETE FROM budget_categories WHERE user_id = uid;

    -- Notes (notes cascade from subjects after 012; delete both defensively)
    DELETE FROM notes WHERE user_id = uid;
    DELETE FROM subjects WHERE user_id = uid;

    -- Tasks & time tracking
    DELETE FROM sessions WHERE user_id = uid;
    DELETE FROM active_timers WHERE user_id = uid;
    DELETE FROM tasks WHERE user_id = uid;
    DELETE FROM repeating_tasks WHERE user_id = uid;

    -- Stats, streaks, logs, misc
    DELETE FROM streaks WHERE user_id = uid;
    DELETE FROM daily_logs WHERE user_id = uid;
    DELETE FROM dev_items WHERE user_id = uid;
    DELETE FROM stats WHERE user_id = uid;

    -- Finally, the account itself (ends all sessions/refresh tokens).
    DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION delete_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_account() TO authenticated;
