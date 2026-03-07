import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function saveWorkout(workoutData) {
  // If no real keys are provided, we just log to console for now
  if (supabaseUrl.includes('placeholder')) {
    console.log('Mock saving workout to cloud...', workoutData);
    return { data: workoutData, error: null };
  }

  const { data, error } = await supabase
    .from('workouts')
    .insert([workoutData]);
    
  return { data, error };
}
