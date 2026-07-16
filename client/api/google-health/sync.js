// Vercel Serverless Function (Node). Pulls the Google Health API v4 and upserts into
// health_metrics + cardio_sessions. Replaces the browser-side googleFit.js pull.
//
// Invoke:
//   app ("Sync now"):  POST /api/google-health/sync  with Authorization: Bearer <supabase JWT>
//   cron (optional):   POST { "mode":"cron" } with header  x-cron-secret: <CRON_SECRET>
//
// Env: GOOGLE_HEALTH_CLIENT_ID, GOOGLE_HEALTH_CLIENT_SECRET, SUPABASE_URL,
//      SUPABASE_SERVICE_ROLE_KEY, (optional) CRON_SECRET.
//
// Response shapes CONFIRMED against live data. Each dataPoint carries its payload under a key
// named after the type; timestamp + value fields differ per type (see getMs / handlers):
//   steps: steps.count (string), .interval           weight: weight.weightGrams, .sampleTime.physicalTime
//   sleep: sleep.summary.minutesAsleep (string)      dailyRestingHeartRate: .beatsPerMinute, .date
//   exercise: .displayName/.exerciseType/.metricsSummary
//   total-calories: LIST unsupported (dailyRollup only) → deferred; field stays user-editable.

import { createClient } from '@supabase/supabase-js';

const HEALTH_BASE = 'https://health.googleapis.com/v4';
const pad = (n) => String(n).padStart(2, '0');
const localDate = (ms) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().split('T')[0];
const civilDate = (d) => `${d.year}-${pad(d.month)}-${pad(d.day)}`;
const numStr = (x) => (x == null || isNaN(Number(x)) ? null : Number(x));
const titleCase = (s) => (s ? s.toLowerCase().replace(/(^|_)([a-z])/g, (_, __, c) => ' ' + c.toUpperCase()).trim() : '');

const intervalEnd = (o) => Date.parse(o?.interval?.endTime ?? o?.interval?.startTime);
const sampleMs = (o) => Date.parse(o?.sampleTime?.physicalTime);
const civilMs = (d) => (d ? Date.UTC(d.year, d.month - 1, d.day, 12) : NaN);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const days = Number(req.body?.daysBack) > 0 ? Number(req.body.daysBack) : 7;

  let userIds;
  if (req.body?.mode === 'cron') {
    if (!process.env.CRON_SECRET || req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Bad cron secret' });
    }
    const { data } = await admin.from('google_health_tokens').select('user_id');
    userIds = (data ?? []).map((r) => r.user_id);
  } else {
    const jwt = (req.headers.authorization || '').replace('Bearer ', '');
    const { data: u, error } = await admin.auth.getUser(jwt);
    if (error || !u?.user) return res.status(401).json({ error: 'Invalid session' });
    userIds = [u.user.id];
  }

  const results = {};
  for (const uid of userIds) {
    try { results[uid] = await syncUser(admin, uid, days); }
    catch (e) { results[uid] = { error: String(e.message || e) }; }
  }
  return res.status(200).json({ ok: true, ...(userIds.length === 1 ? results[userIds[0]] : { results }) });
}

async function syncUser(admin, userId, days) {
  const { data: row } = await admin.from('google_health_tokens').select('*').eq('user_id', userId).single();
  if (!row?.refresh_token) throw new Error('no refresh token — connect Google Health first');
  const token = await freshAccessToken(admin, row);

  const now = Date.now();
  const startMs = now - days * 86400000;

  const dayMap = {};
  for (let i = 0; i <= days; i++) dayMap[localDate(now - i * 86400000)] = {};
  const has = (k) => k in dayMap;

  // steps → sum per day (value = count, a string)
  for (const p of await fetchWindow(token, 'steps', startMs, (o) => intervalEnd(o))) {
    const o = p.steps, key = localDate(intervalEnd(o)), n = numStr(o?.count);
    if (n && has(key)) dayMap[key].steps = Math.round((Number(dayMap[key].steps) || 0) + n);
  }
  // sleep → minutesAsleep → hours, on wake (end) date
  for (const p of await fetchWindow(token, 'sleep', startMs, (o) => intervalEnd(o))) {
    const o = p.sleep, key = localDate(intervalEnd(o));
    if (!has(key)) continue;
    const mins = numStr(o?.summary?.minutesAsleep) ??
      (Date.parse(o?.interval?.endTime) - Date.parse(o?.interval?.startTime)) / 60000;
    if (mins > 0) dayMap[key].sleep_hours = Number(((Number(dayMap[key].sleep_hours) || 0) + mins / 60).toFixed(2));
  }
  // weight → weightGrams/1000, latest sample of the day
  const wSeen = {};
  for (const p of await fetchWindow(token, 'weight', startMs, (o) => sampleMs(o))) {
    const o = p.weight, ms = sampleMs(o), key = localDate(ms), kg = numStr(o?.weightGrams);
    if (kg && has(key) && (!wSeen[key] || ms >= wSeen[key])) {
      wSeen[key] = ms; dayMap[key].weight = Number((kg / 1000).toFixed(1));
    }
  }
  // daily resting HR → beatsPerMinute, keyed by civil date
  for (const p of await fetchWindow(token, 'daily-resting-heart-rate', startMs, (o) => civilMs(o?.date))) {
    const o = p.dailyRestingHeartRate, key = o?.date ? civilDate(o.date) : null, bpm = numStr(o?.beatsPerMinute);
    if (bpm && key && has(key)) dayMap[key].resting_hr = Math.round(bpm);
  }
  // exercise → latest_activity + cardio_sessions
  const cardioRows = [];
  const latestMs = {};
  for (const p of await fetchWindow(token, 'exercise', startMs, (o) => intervalEnd(o))) {
    const o = p.exercise, s = Date.parse(o?.interval?.startTime), e = intervalEnd(o);
    if (!s || !e) continue;
    const key = localDate(e), name = o?.displayName || titleCase(o?.exerciseType) || 'Activity';
    if (has(key) && (!latestMs[key] || e > latestMs[key])) { latestMs[key] = e; dayMap[key].latest_activity = name; }
    const durMin = Math.round((e - s) / 60000);
    if (durMin >= 5) {
      const m = o?.metricsSummary ?? {};
      cardioRows.push({
        user_id: userId, google_fit_session_id: `gh-${s}`, created_at: new Date(s).toISOString(),
        activity_name: name, duration_minutes: durMin, calories: 0,
        distance_meters: Math.round((numStr(m.distanceMillimeters) ?? 0) / 1000),
        steps: Math.round(numStr(m.steps) ?? 0), notes: '',
      });
    }
  }

  const metricRows = Object.entries(dayMap)
    .filter(([, v]) => Object.keys(v).length > 0)
    .map(([date, v]) => ({ user_id: userId, date, ...v }));

  let savedDays = 0, savedSessions = 0;
  if (metricRows.length) {
    const { error } = await admin.from('health_metrics').upsert(metricRows, { onConflict: 'user_id,date' });
    if (error) throw error;
    savedDays = metricRows.length;
  }
  if (cardioRows.length) {
    const { error } = await admin.from('cardio_sessions').upsert(cardioRows, { onConflict: 'google_fit_session_id' });
    if (!error) savedSessions = cardioRows.length;
  }
  return { savedDays, savedSessions };
}

// Page a dataType newest-first, keep points whose time >= startMs; stop once past the window
// (results are ordered by interval start time descending).
async function fetchWindow(token, path, startMs, getMs) {
  const out = [];
  const key = path.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); // steps, dailyRestingHeartRate...
  let pageToken = '', pages = 0;
  do {
    const url = `${HEALTH_BASE}/users/me/dataTypes/${path}/dataPoints?pageSize=1000` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (resp.status === 401 || resp.status === 403) throw new Error(`auth ${resp.status} on ${path}`);
    if (!resp.ok) { console.warn(`${path} ${resp.status}: ${await resp.text()}`); break; }
    const data = await resp.json();
    const pts = data.dataPoints ?? [];
    let oldest = Infinity;
    for (const p of pts) {
      const ms = getMs(p[key]);
      oldest = Math.min(oldest, ms || Infinity);
      if (ms >= startMs) out.push(p);
    }
    pageToken = data.nextPageToken ?? '';
    if (!pts.length || oldest < startMs) break;
  } while (pageToken && ++pages < 50);
  return out;
}

async function freshAccessToken(admin, row) {
  if (row.access_token && row.expires_at && Date.parse(row.expires_at) - Date.now() > 60000) {
    return row.access_token;
  }
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_HEALTH_CLIENT_ID,
    client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET,
    refresh_token: row.refresh_token,
    grant_type: 'refresh_token',
  });
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  const t = await resp.json();
  if (!resp.ok || !t.access_token) throw new Error(`refresh failed: ${JSON.stringify(t)}`);
  await admin.from('google_health_tokens').update({
    access_token: t.access_token,
    expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
  }).eq('user_id', row.user_id);
  return t.access_token;
}
