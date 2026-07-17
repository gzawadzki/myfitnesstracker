// Vercel Serverless Function (Node). Exchanges the Google OAuth auth-code for tokens and stores
// the refresh token for the authenticated user. Tokens never reach the browser.
//
// Env (Vercel Project Settings → Environment Variables, NOT prefixed VITE_ so they stay server-only):
//   GOOGLE_HEALTH_CLIENT_ID, GOOGLE_HEALTH_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_HEALTH_CLIENT_ID', 'GOOGLE_HEALTH_CLIENT_SECRET'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    return res.status(500).json({ error: `Server misconfigured: missing env ${missing.join(', ')} — set in Vercel and redeploy` });
  }

  const jwt = (req.headers.authorization || '').replace('Bearer ', '');
  if (!jwt) return res.status(401).json({ error: 'Missing Authorization' });

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: u, error: uErr } = await admin.auth.getUser(jwt);
  if (uErr || !u?.user) return res.status(401).json({ error: 'Invalid session' });
  const userId = u.user.id;

  const code = req.body?.code;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  // @react-oauth/google popup auth-code flow uses redirect_uri "postmessage" + a Web (confidential)
  // client, so the client secret is sent here.
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_HEALTH_CLIENT_ID,
    client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET,
    redirect_uri: 'postmessage',
    grant_type: 'authorization_code',
  });

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokens = await tokenResp.json();
  if (!tokenResp.ok) return res.status(400).json({ error: 'Token exchange failed', detail: tokens });
  if (!tokens.refresh_token) {
    return res.status(400).json({
      error: 'No refresh_token returned. Revoke the app at myaccount.google.com/permissions and reconnect (first consent only).',
    });
  }

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
  const { error: upErr } = await admin.from('google_health_tokens').upsert({
    user_id: userId,
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    expires_at: expiresAt,
    scope: tokens.scope ?? null,
  }, { onConflict: 'user_id' });
  if (upErr) return res.status(500).json({ error: 'Store failed', detail: upErr.message });

  return res.status(200).json({ ok: true });
}
