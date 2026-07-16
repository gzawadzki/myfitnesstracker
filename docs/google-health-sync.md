# Migrating health sync: Google Fit REST → Google Health API v4

## Why

The Google Fit REST API that `client/src/lib/googleFit.js` calls reaches **end-of-service late
2026**. Its successor for cloud pulls is the **Google Health API v4**
(`https://health.googleapis.com/v4`). We also take the chance to move sync **off the browser**:
today an `access_token` lives in `localStorage` (1-hour expiry, no refresh, only syncs while the
app is open). The new design does the pull **server-side in a Supabase Edge Function** with a
stored **refresh token**, on a **schedule**.

Target data (unchanged): `health_metrics` (`steps, sleep_hours, weight, resting_hr,
calories_burned, latest_activity`, conflict key `user_id,date`) and `cardio_sessions`
(activity sessions, conflict key `google_fit_session_id`).

## Coverage (verified against the Health API v4 data-type list)

| FitNotes field | Health API v4 dataType | Method | Note |
|---|---|---|---|
| steps | `steps` | list (filter) / dailyRollup | interval samples, summed per day |
| sleep_hours | `sleep` | list | session; attribute to wake (end) date |
| weight | `weight` | list | latest sample of the day |
| resting_hr | `daily-resting-heart-rate` | list | **upgrade** — native daily RHR (`beatsPerMinute`, keyed by `date`) |
| calories_burned | `total-calories` | **dailyRollup only** | list unsupported → **deferred**; field stays user-editable in-app |
| latest_activity + cardio | `exercise` | list | **upgrade** — native typed sessions (`displayName`/`exerciseType`) |

**Response shapes are confirmed against live data** (Playground). Coverage verified: steps come from
**FITBIT**, weight/HR/exercise from **HEALTH_CONNECT** — both surface through the cloud API, so no
Android companion is needed. Per-type value fields: `steps.count` (string), `weight.weightGrams`
(÷1000, `sampleTime.physicalTime`), `dailyRestingHeartRate.beatsPerMinute` (string, `.date` object),
`sleep.summary.minutesAsleep` (string), `exercise.metricsSummary.{distanceMillimeters,steps}`.
Calories: `total-calories` rejects `list` (allowed: `rollup`,`dailyRollup`) — wire it later via a
`dailyRollup` POST; until then calories stay manual on the Dashboard.

## Two hard gotchas (read before building the cloud cron)

1. **Does the API actually have YOUR data?** Health API v4 is strongest for **Fitbit / Pixel
   Watch** sources. Plain **phone-sensor** data (old Google Fit) may not flow through it. This is
   unverified for our account — **Step 0 settles it empirically.**
2. **Restricted scopes + Testing-mode token expiry.** All `googlehealth.*` scopes are
   **Restricted**; production needs Google's security review (CASA). A personal app normally stays
   in OAuth **"Testing"** status, where **refresh tokens expire after 7 days** — which breaks an
   unattended weekly cron. Options: (a) publish to Production + do the review, (b) accept weekly
   re-consent, (c) keep the pull triggered from the app (fresh token each session) instead of a
   pure background cron.

---

## Step 0 — Coverage + raw-JSON dump (DO THIS FIRST, no app code needed)

Confirms data exists **and** pins the exact per-type value field names for the mapping.

1. In Google Cloud Console: create a project, **enable the Google Health API**, configure the
   **OAuth consent screen** (External, your own account as a **Test user**), add scopes:
   - `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`
   - `https://www.googleapis.com/auth/googlehealth.sleep.readonly`
   - `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly`
   Create an **OAuth client ID → Desktop app** (this is for the CLI only; the app itself uses a
   separate **Web** client in Step 1) and download its `client_secret.json`.
2. Build + authorize the official CLI (needs Go):
   ```bash
   git clone https://github.com/Google-Health-API/google-health-cli.git
   cd google-health-cli && go build -o ghealth .
   ./ghealth setup --client-secret ~/Downloads/client_secret_XXX.json --scopes-preset readonly
   ```
3. Dump raw JSON per type (exact subcommand syntax `ghealth data <type> <list|daily-rollup>`):
   ```bash
   ./ghealth data steps daily-rollup --from 2026-07-10 --to 2026-07-17 > dump-steps.json
   ./ghealth data sleep list         --from 2026-07-10 --to 2026-07-17 > dump-sleep.json
   ./ghealth data weight list        --from 2026-06-17 --to 2026-07-17 > dump-weight.json
   ./ghealth data daily-resting-heart-rate list --from 2026-07-10 --to 2026-07-17 > dump-rhr.json
   ./ghealth data total-calories daily-rollup   --from 2026-07-10 --to 2026-07-17 > dump-calories.json
   ./ghealth data exercise list      --from 2026-07-10 --to 2026-07-17 > dump-exercise.json
   ```
   (If a subcommand name differs, `./ghealth data --help`; the goal is one raw JSON dump per type.)

**Decision gate:**
- Data comes back → continue to Step 1 (Edge Function). Paste the dumps back and we finalize
  `mapDataPoint()` in `supabase/functions/sync-google-health/index.ts` against the real field names.
- Dumps are empty → your data is phone/Health-Connect-bound. **Stop this track** and build the
  **Capacitor + Health Connect Android companion** instead (reads on-device, pushes to Supabase).

---

## Step 1 — Google OAuth client (Web application)

In the same Cloud project, create an **OAuth 2.0 Client ID → Web application**:
- Authorized JavaScript origins: your app origin (e.g. `http://localhost:5173`, prod domain).
- Note the **Client ID** and **Client secret**.

The client uses `@react-oauth/google` **auth-code flow** (popup), so the code is exchanged with
`redirect_uri: 'postmessage'`.

## Step 2 — Secrets & DB

Set Edge Function secrets (Supabase dashboard → Project Settings → Edge Functions, or CLI):
```bash
supabase secrets set GOOGLE_HEALTH_CLIENT_ID=xxx
supabase secrets set GOOGLE_HEALTH_CLIENT_SECRET=xxx
# SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically in functions.
```
Apply the token table migration:
```bash
supabase db push   # applies supabase/migrations/*_google_health_tokens.sql
```

## Step 3 — Deploy functions

```bash
supabase functions deploy google-health-connect
supabase functions deploy sync-google-health
```
- `google-health-connect` — receives the OAuth `code` from the app (auth'd JWT), exchanges it for
  tokens, stores the **refresh token** in `google_health_tokens` for that user.
- `sync-google-health` — refreshes an access token, pulls each dataType, upserts into
  `health_metrics` / `cardio_sessions`. Callable two ways:
  - from the app (user JWT) for "Sync now";
  - from cron with the service-role key (loops all stored tokens).

## Step 4 — Wire the client

Add the connect + sync path (see `client/src/lib/googleHealth.js`). The browser **no longer**
fetches health data or stores a token. Same `VITE_GOOGLE_CLIENT_ID` works — the Cloud project just
needs the Health API enabled and the `googlehealth.*` scopes on its consent screen. Keep the old
Fit path until this is verified, then delete `lib/googleFit.js` and the localStorage token code.

Drop-in hook for `Dashboard.jsx`:

```jsx
import { useGoogleLogin } from '@react-oauth/google';
import { connectGoogleHealth, syncGoogleHealth, GOOGLE_HEALTH_SCOPES } from '../lib/googleHealth';

const connectHealth = useGoogleLogin({
  flow: 'auth-code',                 // returns { code }, not a token
  scope: GOOGLE_HEALTH_SCOPES,
  onSuccess: async ({ code }) => {
    try {
      await connectGoogleHealth(code);         // backend stores the refresh token
      const r = await syncGoogleHealth();       // first pull
      toast.success(`Synced ${r.savedDays} day(s)`);
      await loadData(true);
    } catch (e) { toast.error(e.message); }
  },
  onError: () => toast.error('Google Health connection failed'),
});

// The "Sync now" button, once connected, just calls:
//   const r = await syncGoogleHealth(); await loadData(true);
```

Note: `useGoogleLogin` auth-code flow requests `access_type=offline`; if no refresh token comes
back, revoke the app at myaccount.google.com/permissions and reconnect (first consent only).

## Step 5 — Schedule (only if in Production / long-lived refresh token)

```sql
select cron.schedule(
  'sync-google-health-daily',
  '0 5 * * *',
  $$ select net.http_post(
       url    := 'https://<PROJECT_REF>.functions.supabase.co/sync-google-health',
       headers:= jsonb_build_object('Authorization','Bearer <SERVICE_ROLE_KEY>',
                                    'Content-Type','application/json'),
       body   := '{"mode":"cron"}'::jsonb
     ); $$
);
```
In Testing mode the refresh token dies after 7 days — until you publish, prefer app-triggered sync
over this cron.

## Rollback

Nothing is deleted until Step 4's cutover. To revert: keep `googleFit.js` wired, drop the two
functions, `drop table google_health_tokens;`. The old Fit sync keeps working until end-2026.
