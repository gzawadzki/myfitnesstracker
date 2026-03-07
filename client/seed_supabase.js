import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
  console.log('Reading seed_db.json...');
  const dbData = JSON.parse(fs.readFileSync('./src/data/seed_db.json', 'utf8'));
  
  // 1. Insert Phases
  console.log('Inserting Phases...');
  const { error: phaseErr } = await supabase.from('phases').upsert(
    dbData.phases.map((p, idx) => ({ id: p.id, name: p.name, order_index: idx }))
  );
  if (phaseErr) console.error('Error inserting phases:', phaseErr);
  
  // 2. Insert Workouts
  console.log('Inserting Workout Templates...');
  const { error: workoutErr } = await supabase.from('workout_templates').upsert(
    dbData.workouts.map(w => ({ id: w.id, phase_id: w.phaseId, name: w.name }))
  );
  if (workoutErr) console.error('Error inserting workouts:', workoutErr);

  // 3. Insert Exercises
  console.log('Inserting Exercises Catalog...');
  const exercises = Object.values(dbData.exercises);
  const { error: exErr } = await supabase.from('exercises').upsert(
    exercises.map(e => ({ id: e.id, name: e.name }))
  );
  if (exErr) console.error('Error inserting exercises:', exErr);

  // 4. Insert Template Exercises Mapping
  console.log('Inserting Template Exercises Mappings...');
  const templateExercises = [];
  dbData.workouts.forEach(workout => {
    workout.exercises.forEach((ex, idx) => {
      templateExercises.push({
        workout_id: workout.id,
        exercise_id: ex.exerciseId,
        target_sets: ex.targetSets || 3,
        target_reps: ex.targetReps || '8-10',
        order_index: idx
      });
    });
  });
  
  // Delete old mappings to prevent duplicate piling during multiple seeds
  await supabase.from('template_exercises').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  const { error: tmplErr } = await supabase.from('template_exercises').insert(templateExercises);
  if (tmplErr) console.error('Error inserting template exercises:', tmplErr);
  
  console.log('Successfully seeded Supabase Data!');
}

seedDatabase().catch(console.error);
