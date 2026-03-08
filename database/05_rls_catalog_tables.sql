-- SEC-02: Add RLS policies for catalog tables
-- These tables are shared/public but need explicit policies to prevent
-- accidental lockout if someone enables RLS via Supabase UI.

-- Phases
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON public.phases FOR SELECT USING (true);

-- Workout Templates
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON public.workout_templates FOR SELECT USING (true);

-- Exercises
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON public.exercises FOR SELECT USING (true);

-- Template Exercises (mapping table)
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON public.template_exercises FOR SELECT USING (true);

-- Health Metrics (user-scoped)
ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own health metrics" ON public.health_metrics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own health metrics" ON public.health_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own health metrics" ON public.health_metrics
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own health metrics" ON public.health_metrics
  FOR DELETE USING (auth.uid() = user_id);
