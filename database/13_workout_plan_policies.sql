-- Migration: Allow authenticated users to manage workout plan catalog tables
-- Run this in Supabase SQL Editor

-- Phases: allow any authenticated user to insert/update/delete
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read phases"
  ON public.phases FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert phases"
  ON public.phases FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update phases"
  ON public.phases FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete phases"
  ON public.phases FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Workout Templates
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read workout_templates"
  ON public.workout_templates FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert workout_templates"
  ON public.workout_templates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update workout_templates"
  ON public.workout_templates FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete workout_templates"
  ON public.workout_templates FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Template Exercises
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read template_exercises"
  ON public.template_exercises FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert template_exercises"
  ON public.template_exercises FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update template_exercises"
  ON public.template_exercises FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete template_exercises"
  ON public.template_exercises FOR DELETE
  USING (auth.uid() IS NOT NULL);
