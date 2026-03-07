import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: phases, error: pErr } = await supabase.from('phases').select('id');
  const { data: workouts, error: wErr } = await supabase.from('workout_templates').select('id');
  const { data: exercises, error: eErr } = await supabase.from('exercises').select('id');
  
  console.log('Phases count:', phases?.length, 'Error:', pErr?.message);
  console.log('Workouts count:', workouts?.length, 'Error:', wErr?.message);
  console.log('Exercises count:', exercises?.length, 'Error:', eErr?.message);
}

check();
