-- 1. Create a dedicated table for tracking daily health metrics independent of workout sessions
CREATE TABLE public.health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep_hours NUMERIC,
  steps INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date) -- Ensure only one record per user per day
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;

-- 3. Restrict access to only the authenticated user that owns the data
CREATE POLICY "Users can manage their own health metrics" ON public.health_metrics FOR ALL USING (auth.uid() = user_id);
