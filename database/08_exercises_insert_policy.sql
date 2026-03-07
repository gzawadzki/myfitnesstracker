-- Allow authenticated users to create new exercises
CREATE POLICY "Authenticated users can insert exercises"
  ON public.exercises FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
