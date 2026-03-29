-- Budget Mode: expense/income tracking with categories and monthly targets
-- Run this in the Supabase SQL Editor after 003_active_timers.sql

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS budget_categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT DEFAULT '#6b7280',
    "isIncome" INTEGER DEFAULT 0,
    "parentId" INTEGER,
    "orderIndex" INTEGER DEFAULT 0,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS budget_transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    amount NUMERIC(12,2) NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "isIncome" INTEGER DEFAULT 0,
    date TEXT NOT NULL,
    "paymentMethod" TEXT,
    notes TEXT,
    "isRecurring" INTEGER DEFAULT 0,
    "recurringRule" JSONB,
    "createdAt" TEXT,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS budget_targets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "categoryId" INTEGER NOT NULL,
    month TEXT NOT NULL,
    "limitAmount" NUMERIC(12,2) NOT NULL,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    UNIQUE("categoryId", month, user_id)
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_budget_categories_user_id ON budget_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_user_id ON budget_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_date ON budget_transactions(date);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_category ON budget_transactions("categoryId");
CREATE INDEX IF NOT EXISTS idx_budget_targets_user_id ON budget_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_targets_month ON budget_targets(month);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their data" ON budget_categories FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users own their data" ON budget_transactions FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users own their data" ON budget_targets FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Seed default categories for new users
-- ============================================================

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
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_budget ON auth.users;
CREATE TRIGGER on_auth_user_created_budget
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION seed_new_user_budget_categories();
