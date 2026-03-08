-- Add latest_activity to health_metrics
ALTER TABLE health_metrics
  ADD COLUMN IF NOT EXISTS latest_activity TEXT;
