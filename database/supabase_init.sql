-- Execute this SQL in your Supabase SQL Editor to initialize the database tables
-- WARNING: This script drops existing tables to refresh the schema. Remove the DROP lines if you want to keep data (but you will need to ALTER them manually instead).

DROP TABLE IF EXISTS public.logged_sets CASCADE;
DROP TABLE IF EXISTS public.workout_sessions CASCADE;
DROP TABLE IF EXISTS public.template_exercises CASCADE;
DROP TABLE IF EXISTS public.exercises CASCADE;
DROP TABLE IF EXISTS public.workout_templates CASCADE;
DROP TABLE IF EXISTS public.phases CASCADE;

-- 1. Phases (e.g., Faza 1, Faza 2)
CREATE TABLE public.phases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  order_index INTEGER
);

-- 2. Workout Templates (e.g., Trening A)
CREATE TABLE public.workout_templates (
  id TEXT PRIMARY KEY,
  phase_id TEXT REFERENCES public.phases(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

-- 3. Exercises (Catalog)
CREATE TABLE public.exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- 4. Template Exercises (Mapping Exercises to Workouts with target sets/reps)
CREATE TABLE public.template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id TEXT REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  exercise_id TEXT REFERENCES public.exercises(id) ON DELETE CASCADE,
  target_sets INTEGER,
  target_reps TEXT,
  order_index INTEGER
);

-- 5. User-logged Sessions (The actual workouts they perform)
CREATE TABLE public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT REFERENCES public.workout_templates(id),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  health_sleep_hours NUMERIC,
  health_steps INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Logged Sets (The specific weight and reps hit in a session)
CREATE TABLE public.logged_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  exercise_id TEXT REFERENCES public.exercises(id),
  set_number INTEGER,
  reps INTEGER,
  weight NUMERIC,
  completed BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================================
-- Security: Row Level Security (RLS) Policies
-- =================================================================================

-- 1. Enable RLS on User Data tables
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logged_sets ENABLE ROW LEVEL SECURITY;

-- 2. Restrict user data (Sessions and Sets) to only the row owner
CREATE POLICY "Users can manage their own sessions" ON public.workout_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own sets" ON public.logged_sets FOR ALL USING (auth.uid() = user_id);
