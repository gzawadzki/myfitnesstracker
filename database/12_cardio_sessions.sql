-- 1. Create cardio_sessions table
CREATE TABLE IF NOT EXISTS public.cardio_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    google_fit_session_id TEXT UNIQUE,
    activity_name TEXT NOT NULL,
    duration_minutes INTEGER,
    calories NUMERIC,
    distance_meters NUMERIC,
    steps INTEGER,
    notes TEXT
);

-- 2. Enable RLS and add policies
ALTER TABLE public.cardio_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cardio sessions"
    ON public.cardio_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cardio sessions"
    ON public.cardio_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cardio sessions"
    ON public.cardio_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cardio sessions"
    ON public.cardio_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- 3. Migrate existing Google Fit sessions from workout_sessions to cardio_sessions
INSERT INTO public.cardio_sessions (
    user_id, 
    created_at, 
    google_fit_session_id, 
    activity_name, 
    duration_minutes, 
    calories, 
    distance_meters, 
    steps, 
    notes
)
SELECT 
    user_id, 
    created_at, 
    google_fit_session_id, 
    -- Extract activity name from notes (e.g. "Synced from Google Fit: Walking"), fallback if parsing fails
    REPLACE(COALESCE(notes, 'Activity'), 'Synced from Google Fit: ', ''), 
    duration_minutes, 
    calories, 
    distance_meters, 
    steps, 
    notes
FROM public.workout_sessions
WHERE template_id IS NULL AND google_fit_session_id IS NOT NULL
ON CONFLICT (google_fit_session_id) DO NOTHING;

-- 4. Delete the migrated sessions from workout_sessions
DELETE FROM public.workout_sessions
WHERE template_id IS NULL AND google_fit_session_id IS NOT NULL;
