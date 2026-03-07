import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function injectMockData() {
  const userId = process.argv[2];

  if(!userId) {
     console.error("ERROR: Please provide your Supabase User ID as an argument.");
     console.error("Usage: node inject_mock_data.mjs <your-uuid-here>");
     console.error("You can find your User ID in the Supabase Dashboard -> Authentication -> Users.");
     process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`✅ Injecting 14 Days of Mock History`);
  console.log(`Target User ID: ${userId}`);
  console.log(`========================================\n`);

  // Get templates and exercises
  const { data: templates } = await supabase.from('workout_templates').select('*').limit(5);
  const { data: exercises } = await supabase.from('exercises').select('*').limit(20);

  if (!templates || templates.length === 0) {
    console.error("No workout templates found. Have you seeded the db?");
    return;
  }

  // Generate 14 days of Health Metrics
  const healthData = [];
  for (let i = 14; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    healthData.push({
      user_id: userId,
      date: dateStr,
      sleep_hours: (Math.random() * (9 - 5) + 5).toFixed(1), // 5 to 9 hours
      steps: Math.floor(Math.random() * (12000 - 3000) + 3000) // 3k to 12k steps
    });
  }

  console.log("Inserting Health Data...");
  await supabase.from('health_metrics').upsert(healthData, { onConflict: 'user_id, date' });

  // Generate 10 past Workouts over the last 14 days
  console.log("Inserting Workout Sessions...");
  for (let i = 10; i >= 1; i--) {
    const template = templates[i % templates.length];
    
    // Spread the 10 workouts smoothly across the last 14 days 
    const d = new Date();
    d.setDate(d.getDate() - (i + Math.floor(i * 0.4))); 
    
    const { data: sessionData, error: sessErr } = await supabase.from('workout_sessions').insert({
      user_id: userId,
      template_id: template.id,
      notes: "Mock data session",
      created_at: d.toISOString()
    }).select().single();

    if (sessErr) {
      console.error(sessErr);
      continue;
    }

    // Give it 3 random exercises with 3 sets each, progressing slowly over time
    const sets = [];
    for (let exIdx = 0; exIdx < 3; exIdx++) {
      const exercise = exercises[exIdx];
      // Increase mock weight over time (10 -> 1 is older -> newer)
      const baseWeight = 20 + (10 - i) * 2.5; 
      
      for (let s = 1; s <= 3; s++) {
        sets.push({
          user_id: userId,
          session_id: sessionData.id,
          exercise_id: exercise.id,
          set_number: s,
          reps: Math.floor(Math.random() * (12 - 8) + 8),
          weight: baseWeight,
          completed: true,
          created_at: d.toISOString()
        });
      }
    }

    await supabase.from('logged_sets').insert(sets);
  }

  console.log("✅ Successfully injected 14 days of mock data!");
}

injectMockData();
