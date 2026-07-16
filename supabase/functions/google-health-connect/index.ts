// Exchanges a Google OAuth authorization code (from the app's auth-code popup flow) for tokens
// and stores the refresh token for the authenticated user. Never returns the tokens to the client.
//
// Deploy: supabase functions deploy google-health-connect
// Secrets needed: GOOGLE_HEALTH_CLIENT_ID, GOOGLE_HEALTH_CLIENT_SECRET
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ error: "Missing Authorization" }, 401);

    // Identify the caller from their Supabase JWT.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
    const userId = userData.user.id;

    const { code } = await req.json().catch(() => ({}));
    if (!code) return json({ error: "Missing code" }, 400);

    // Exchange the auth code. The @react-oauth/google popup auth-code flow uses redirect_uri
    // "postmessage" and a confidential (Web application) client, so we send the client secret.
    const body = new URLSearchParams({
      code,
      client_id: Deno.env.get("GOOGLE_HEALTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_HEALTH_CLIENT_SECRET")!,
      redirect_uri: "postmessage",
      grant_type: "authorization_code",
    });

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokens = await tokenResp.json();
    if (!tokenResp.ok) return json({ error: "Token exchange failed", detail: tokens }, 400);

    // refresh_token is only returned when access_type=offline + prompt=consent were requested.
    if (!tokens.refresh_token) {
      return json({
        error: "No refresh_token returned. Request access_type=offline and prompt=consent, " +
          "and revoke the app at myaccount.google.com/permissions before retrying.",
      }, 400);
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

    const { error: upErr } = await admin.from("google_health_tokens").upsert({
      user_id: userId,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expires_at: expiresAt,
      scope: tokens.scope ?? null,
    }, { onConflict: "user_id" });
    if (upErr) return json({ error: "Store failed", detail: upErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
