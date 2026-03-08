-- Add detailed metrics to workout_sessions for synced activities
ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS calories NUMERIC,
  ADD COLUMN IF NOT EXISTS distance_meters NUMERIC,
  ADD COLUMN IF NOT EXISTS steps INTEGER;
