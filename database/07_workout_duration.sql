-- Add workout duration tracking
ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
