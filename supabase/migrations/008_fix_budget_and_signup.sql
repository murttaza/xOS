-- Fix 1: Add exception handler to budget category seeding trigger
-- Without this, any error in budget seeding rolls back the entire user creation
-- causing "Database error" on signup.
CREATE OR REPLACE FUNCTION seed_new_user_budget_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO budget_categories (name, icon, color, "isIncome", "orderIndex", user_id) VALUES
        ('Food & Dining',   'utensils',       '#ef4444', 0, 0,  NEW.id),
        ('Transportation',  'car',            '#f97316', 0, 1,  NEW.id),
        ('Housing',         'home',           '#eab308', 0, 2,  NEW.id),
        ('Utilities',       'zap',            '#84cc16', 0, 3,  NEW.id),
        ('Entertainment',   'tv',             '#22c55e', 0, 4,  NEW.id),
        ('Shopping',        'shopping-bag',   '#14b8a6', 0, 5,  NEW.id),
        ('Health',          'heart-pulse',    '#06b6d4', 0, 6,  NEW.id),
        ('Education',       'graduation-cap', '#3b82f6', 0, 7,  NEW.id),
        ('Personal Care',   'sparkles',       '#8b5cf6', 0, 8,  NEW.id),
        ('Other',           'circle-dot',     '#6b7280', 0, 9,  NEW.id),
        ('Salary',          'briefcase',      '#22c55e', 1, 0,  NEW.id),
        ('Freelance',       'laptop',         '#14b8a6', 1, 1,  NEW.id),
        ('Investments',     'trending-up',    '#3b82f6', 1, 2,  NEW.id),
        ('Other Income',    'plus-circle',    '#8b5cf6', 1, 3,  NEW.id);
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Don't block signup if seeding fails; client will seed defaults
    RETURN NEW;
END;
$$;

-- Fix 2: Add missing foreign keys from budget_transactions and budget_targets
-- to budget_categories. Without these, PostgREST cannot resolve the nested
-- select joins, causing all fetch queries to fail (data saves but never loads).

-- Clean up orphaned transactions (categoryId pointing to deleted categories)
DELETE FROM budget_transactions
WHERE "categoryId" NOT IN (SELECT id FROM budget_categories);

-- Clean up orphaned targets
DELETE FROM budget_targets
WHERE "categoryId" NOT IN (SELECT id FROM budget_categories);

-- Add FK constraints
ALTER TABLE budget_transactions
    ADD CONSTRAINT fk_budget_transactions_category
    FOREIGN KEY ("categoryId") REFERENCES budget_categories(id) ON DELETE CASCADE;

ALTER TABLE budget_targets
    ADD CONSTRAINT fk_budget_targets_category
    FOREIGN KEY ("categoryId") REFERENCES budget_categories(id) ON DELETE CASCADE;
