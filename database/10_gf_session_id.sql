-- Add google_fit_session_id to prevent duplicates when syncing from Google Fit
ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS google_fit_session_id TEXT UNIQUE;

-- Ensure duration_minutes exists (should have been added in 07)
ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
