-- Add heart rate and calories burned to health_metrics
ALTER TABLE health_metrics
  ADD COLUMN IF NOT EXISTS heart_rate INTEGER,
  ADD COLUMN IF NOT EXISTS calories_burned INTEGER;
