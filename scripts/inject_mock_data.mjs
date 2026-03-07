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

    // Since this script runs outside the browser, we have no active JWT session.
    // Supabase RLS will block `insert()` calls that don't match `auth.uid()`.
    // To bypass this without a Service Role Key, we will tell the user to run this logic from the browser console,
    // or we can add a temporary button to the UI.

  console.log("Wait! Because of Row Level Security (RLS), this script cannot insert workout sets without an active login session.");
  console.log("Please check my instructions to run this from the app UI instead.");
  process.exit(1);
}

injectMockData();
