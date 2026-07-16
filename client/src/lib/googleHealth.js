// Client helpers for the Google Health API v4 sync.
//
// Unlike the old googleFit.js, the browser NEVER fetches health data or stores a token.
// It only: (1) hands the OAuth auth-code to the `google-health-connect` Edge Function, which
// stores the refresh token server-side, and (2) asks `sync-google-health` to run.
//
// The OAuth popup itself is triggered by `useGoogleLogin({ flow: 'auth-code', ... })` inside the
// component (hooks can't live in a plain module) — see docs/google-health-sync.md, Step 4.
// Request these scopes there:
export const GOOGLE_HEALTH_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
].join(" ");

import { supabase } from "./supabase";

/** Send the OAuth authorization code to the backend, which exchanges + stores the refresh token. */
export async function connectGoogleHealth(code) {
  const { data, error } = await supabase.functions.invoke("google-health-connect", {
    body: { code },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Trigger a server-side sync for the current user. Returns { savedDays, savedSessions }. */
export async function syncGoogleHealth(daysBack = 7) {
  const { data, error } = await supabase.functions.invoke("sync-google-health", {
    body: { daysBack },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
