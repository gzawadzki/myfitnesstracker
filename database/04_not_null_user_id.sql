-- BUG-07: Enforce NOT NULL on user_id columns in user-specific tables
-- This prevents null user_id rows when inserting outside of an auth session

ALTER TABLE workout_sessions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE logged_sets ALTER COLUMN user_id SET NOT NULL;
