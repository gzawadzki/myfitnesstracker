// Client helpers for the Google Health API v4 sync (Vercel serverless backend).
//
// The browser NEVER fetches health data or stores a Google token. It only:
//   1. hands the OAuth auth-code to /api/google-health/connect (stores the refresh token server-side)
//   2. asks /api/google-health/sync to run.
// Both calls carry the user's Supabase JWT so the API route knows who they are.
//
// The OAuth popup is triggered by useGoogleLogin({ flow: 'auth-code', scope: GOOGLE_HEALTH_SCOPES })
// inside the component (hooks can't live in a plain module) — see Dashboard.jsx.

import { supabase } from './supabase';

export const GOOGLE_HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
].join(' ');

async function authedPost(path, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const resp = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload || {}),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

/** Exchange the OAuth auth-code + store the refresh token server-side. */
export function connectGoogleHealth(code) {
  return authedPost('/api/google-health/connect', { code });
}

/** Trigger a server-side sync for the current user. Returns { savedDays, savedSessions }. */
export function syncGoogleHealth(daysBack = 7) {
  return authedPost('/api/google-health/sync', { daysBack });
}
