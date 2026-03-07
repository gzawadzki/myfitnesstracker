-- Step 1: Add weight to health_metrics with validation
ALTER TABLE health_metrics
  ADD COLUMN IF NOT EXISTS weight NUMERIC,
  ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(3) DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lbs')),
  ADD CONSTRAINT weight_range CHECK (weight IS NULL OR (weight > 20 AND weight < 500));

-- Step 2: Ensure upsert safety (if not already present)
-- We use DO block to avoid error if it already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'health_metrics_user_date_unique'
    ) THEN
        ALTER TABLE health_metrics ADD CONSTRAINT health_metrics_user_date_unique UNIQUE (user_id, date);
    END IF;
END $$;

-- Step 3: Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_goal NUMERIC CHECK (weight_goal IS NULL OR (weight_goal > 20 AND weight_goal < 500)),
  weight_goal_unit VARCHAR(3) DEFAULT 'kg' CHECK (weight_goal_unit IN ('kg', 'lbs')),
  step_goal INTEGER DEFAULT 8000 CHECK (step_goal > 0 AND step_goal < 100000),
  sleep_goal NUMERIC DEFAULT 7.5 CHECK (sleep_goal > 0 AND sleep_goal < 24),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: RLS — MUST NOT be omitted
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'user_preferences' AND policyname = 'Users manage own preferences'
    ) THEN
        CREATE POLICY "Users manage own preferences"
          ON user_preferences FOR ALL
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;


-- Step 5: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS preferences_updated_at ON user_preferences;
CREATE TRIGGER preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
