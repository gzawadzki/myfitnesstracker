// Server-side health sync: pulls Google Health API v4 and upserts into health_metrics +
// cardio_sessions. Replaces the browser-side googleFit.js pull.
//
// Deploy: supabase functions deploy sync-google-health
// Secrets: GOOGLE_HEALTH_CLIENT_ID, GOOGLE_HEALTH_CLIENT_SECRET (+ auto SUPABASE_* ).
// Invoke:  app -> supabase.functions.invoke('sync-google-health')  (user JWT)
//          cron -> POST { "mode":"cron" } with the service-role key (loops all tokens)
//
// Response shapes are CONFIRMED against live data. Each dataPoint carries its payload under a key
// named after the type; the timestamp and value fields differ per type (see getMs / handlers):
//   steps:                p.steps.count (string), p.steps.interval.{startTime,endTime}
//   sleep:                p.sleep.summary.minutesAsleep (string), p.sleep.interval
//   weight:               p.weight.weightGrams (number), p.weight.sampleTime.physicalTime
//   dailyRestingHeartRate:p.dailyRestingHeartRate.beatsPerMinute (string), .date {y,m,d}
//   exercise:             p.exercise.{displayName,exerciseType,interval,metricsSummary}
//   total-calories:       LIST UNSUPPORTED -> dailyRollup only; deferred (display-only field,
//                         still user-editable in the app). See docs/google-health-sync.md.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const HEALTH_BASE = "https://health.googleapis.com/v4";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const { mode, daysBack } = await req.json().catch(() => ({}));
    const days = Number(daysBack) > 0 ? Number(daysBack) : 7;

    let userIds: string[];
    if (mode === "cron") {
      const { data } = await admin.from("google_health_tokens").select("user_id");
      userIds = (data ?? []).map((r) => r.user_id);
    } else {
      const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      const { data: u, error } = await admin.auth.getUser(jwt);
      if (error || !u.user) return json({ error: "Invalid session" }, 401);
      userIds = [u.user.id];
    }

    const results: Record<string, unknown> = {};
    for (const uid of userIds) {
      results[uid] = await syncUser(admin, uid, days).catch((e) => ({ error: String(e) }));
    }
    return json({ ok: true, results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (ms: number) =>
  new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().split("T")[0];
const civilDate = (d: any) => `${d.year}-${pad(d.month)}-${pad(d.day)}`;
const numStr = (x: unknown) => (x == null || isNaN(Number(x)) ? null : Number(x));

async function syncUser(admin: SupabaseClient, userId: string, days: number) {
  const { data: row } = await admin
    .from("google_health_tokens").select("*").eq("user_id", userId).single();
  if (!row?.refresh_token) throw new Error("no refresh token");
  const token = await freshAccessToken(admin, row);

  const now = Date.now();
  const startMs = now - days * 86400000;

  const dayMap: Record<string, Record<string, number | string | null>> = {};
  for (let i = 0; i <= days; i++) dayMap[localDate(now - i * 86400000)] = {};
  const has = (k: string) => k in dayMap;

  // ── steps (list) → sum per day ───────────────────────────────────────────
  for (const p of await fetchWindow(token, "steps", startMs, (o) => intervalEnd(o))) {
    const o = p.steps, key = localDate(intervalEnd(o));
    const n = numStr(o?.count);
    if (n && has(key)) dayMap[key].steps = Math.round((Number(dayMap[key].steps) || 0) + n);
  }

  // ── sleep (list) → minutesAsleep → hours, on wake (end) date ─────────────
  for (const p of await fetchWindow(token, "sleep", startMs, (o) => intervalEnd(o))) {
    const o = p.sleep, key = localDate(intervalEnd(o));
    if (!has(key)) continue;
    const mins = numStr(o?.summary?.minutesAsleep) ??
      (Date.parse(o?.interval?.endTime) - Date.parse(o?.interval?.startTime)) / 60000;
    if (mins > 0) {
      dayMap[key].sleep_hours = Number(((Number(dayMap[key].sleep_hours) || 0) + mins / 60).toFixed(2));
    }
  }

  // ── weight (list) → weightGrams/1000, latest sample of the day ───────────
  const wSeen: Record<string, number> = {};
  for (const p of await fetchWindow(token, "weight", startMs, (o) => sampleMs(o))) {
    const o = p.weight, ms = sampleMs(o), key = localDate(ms);
    const kg = numStr(o?.weightGrams);
    if (kg && has(key) && (!wSeen[key] || ms >= wSeen[key])) {
      wSeen[key] = ms;
      dayMap[key].weight = Number((kg / 1000).toFixed(1));
    }
  }

  // ── daily resting HR (list) → beatsPerMinute, keyed by civil date ────────
  for (const p of await fetchWindow(token, "daily-resting-heart-rate", startMs, (o) => civilMs(o?.date))) {
    const o = p.dailyRestingHeartRate, key = o?.date ? civilDate(o.date) : null;
    const bpm = numStr(o?.beatsPerMinute);
    if (bpm && key && has(key)) dayMap[key].resting_hr = Math.round(bpm);
  }

  // ── exercise (list) → latest_activity + cardio_sessions ──────────────────
  const cardioRows: Record<string, unknown>[] = [];
  const latestMs: Record<string, number> = {};
  for (const p of await fetchWindow(token, "exercise", startMs, (o) => intervalEnd(o))) {
    const o = p.exercise, s = Date.parse(o?.interval?.startTime), e = intervalEnd(o);
    if (!s || !e) continue;
    const key = localDate(e);
    const name = o?.displayName || titleCase(o?.exerciseType) || "Activity";
    if (has(key) && (!latestMs[key] || e > latestMs[key])) {
      latestMs[key] = e;
      dayMap[key].latest_activity = name;
    }
    const durMin = Math.round((e - s) / 60000);
    if (durMin >= 5) {
      const m = o?.metricsSummary ?? {};
      cardioRows.push({
        user_id: userId,
        google_fit_session_id: `gh-${s}`,
        created_at: new Date(s).toISOString(),
        activity_name: name,
        duration_minutes: durMin,
        calories: 0, // not present on exercise; kept editable in-app
        distance_meters: Math.round((numStr(m.distanceMillimeters) ?? 0) / 1000),
        steps: Math.round(numStr(m.steps) ?? 0),
        notes: "",
      });
    }
  }

  // ── upsert ───────────────────────────────────────────────────────────────
  const metricRows = Object.entries(dayMap)
    .filter(([, v]) => Object.keys(v).length > 0)
    .map(([date, v]) => ({ user_id: userId, date, ...v }));

  let savedDays = 0, savedSessions = 0;
  if (metricRows.length) {
    const { error } = await admin.from("health_metrics").upsert(metricRows, { onConflict: "user_id,date" });
    if (error) throw error;
    savedDays = metricRows.length;
  }
  if (cardioRows.length) {
    const { error } = await admin.from("cardio_sessions").upsert(cardioRows, { onConflict: "google_fit_session_id" });
    if (!error) savedSessions = cardioRows.length;
  }
  return { savedDays, savedSessions };
}

// timestamp extractors (payload = p[<key>])
const intervalEnd = (o: any) => Date.parse(o?.interval?.endTime ?? o?.interval?.startTime);
const sampleMs = (o: any) => Date.parse(o?.sampleTime?.physicalTime);
const civilMs = (d: any) => (d ? Date.UTC(d.year, d.month - 1, d.day, 12) : NaN);
const titleCase = (s?: string) =>
  s ? s.toLowerCase().replace(/(^|_)([a-z])/g, (_, __, c) => " " + c.toUpperCase()).trim() : "";

// Page a dataType newest-first, keeping points whose time >= startMs; stop once a page runs
// past the window (results are ordered by interval start time descending).
async function fetchWindow(
  token: string, path: string, startMs: number, getMs: (payload: any) => number,
): Promise<any[]> {
  const out: any[] = [];
  const key = path.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); // steps, dailyRestingHeartRate...
  let pageToken = "", pages = 0;
  do {
    const url = `${HEALTH_BASE}/users/me/dataTypes/${path}/dataPoints?pageSize=1000` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (resp.status === 401 || resp.status === 403) throw new Error(`auth ${resp.status} on ${path}`);
    if (!resp.ok) { console.warn(`${path} ${resp.status}: ${await resp.text()}`); break; }
    const data = await resp.json();
    const pts: any[] = data.dataPoints ?? [];
    let oldest = Infinity;
    for (const p of pts) {
      const ms = getMs(p[key]);
      oldest = Math.min(oldest, ms || Infinity);
      if (ms >= startMs) out.push(p);
    }
    pageToken = data.nextPageToken ?? "";
    if (!pts.length || oldest < startMs) break; // paged past the window
  } while (pageToken && ++pages < 50);
  return out;
}

async function freshAccessToken(admin: SupabaseClient, row: any): Promise<string> {
  if (row.access_token && row.expires_at && Date.parse(row.expires_at) - Date.now() > 60_000) {
    return row.access_token;
  }
  const body = new URLSearchParams({
    client_id: Deno.env.get("GOOGLE_HEALTH_CLIENT_ID")!,
    client_secret: Deno.env.get("GOOGLE_HEALTH_CLIENT_SECRET")!,
    refresh_token: row.refresh_token,
    grant_type: "refresh_token",
  });
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const t = await resp.json();
  if (!resp.ok || !t.access_token) throw new Error(`refresh failed: ${JSON.stringify(t)}`);
  await admin.from("google_health_tokens").update({
    access_token: t.access_token,
    expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
  }).eq("user_id", row.user_id);
  return t.access_token;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
