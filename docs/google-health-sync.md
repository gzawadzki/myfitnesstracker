# Migrating health sync: Google Fit REST → Google Health API v4 (Vercel)

## Why

The Google Fit REST API that `client/src/lib/googleFit.js` calls reaches **end-of-service late
2026**. Its successor for cloud pulls is the **Google Health API v4** (`https://health.googleapis.com/v4`).
We also move sync **off the browser**: today an `access_token` lives in `localStorage` (1-hour
expiry, no refresh, only syncs while the app is open). The new design runs the pull in **Vercel
serverless functions** with a **refresh token** stored in Supabase — deploys with the app on
`git push`, no separate infra.

Architecture:
- `client/api/google-health/connect.js` — exchanges the OAuth code → stores the refresh token.
- `client/api/google-health/sync.js` — pulls the Health API, upserts `health_metrics` + `cardio_sessions`.
- `database/13_google_health_tokens.sql` — token table (RLS denies all client access).
- `client/src/lib/googleHealth.js` + `Dashboard.jsx` — the browser just calls `/api/...` with its
  Supabase JWT. No Google token in the browser.

> **Vercel root directory.** This assumes the Vercel project's Root Directory is **`client`** (the
> app lives there), so functions sit in `client/api/**` and deploy automatically. If your Vercel
> root is the **repo root** instead, move the `api/` folder to the repo root and set the build to
> `cd client && npm run build` (output `client/dist`).

## Coverage — verified against live data

| FitNotes field | Health API v4 | value field | source |
|---|---|---|---|
| steps | `steps` (list) | `steps.count` (string) | FITBIT |
| sleep_hours | `sleep` (list) | `sleep.summary.minutesAsleep`/60 | FITBIT |
| weight | `weight` (list) | `weight.weightGrams`/1000, `sampleTime.physicalTime` | HEALTH_CONNECT |
| resting_hr | `daily-resting-heart-rate` (list) | `beatsPerMinute`, keyed by `date` | HEALTH_CONNECT |
| latest_activity + cardio | `exercise` (list) | `displayName`/`exerciseType` + `metricsSummary` | HEALTH_CONNECT |
| calories_burned | `total-calories` | **dailyRollup only** — deferred, stays user-editable |

Both FITBIT and HEALTH_CONNECT surface through the cloud API → **no Android companion needed**.

## Two gotchas

1. **Restricted scopes.** All `googlehealth.*` scopes need Google's security review (CASA) for
   Production. Personal use runs in OAuth **"Testing"** with yourself as a Test user.
2. **Testing-mode refresh tokens expire after 7 days.** So the **app-triggered** sync (the Sync
   button) is the default; the Vercel Cron below only makes sense once you publish to Production.

---

## Deploy

### 1. Database (Supabase SQL Editor)
Run `database/13_google_health_tokens.sql`.

### 2. Google Cloud (one Web OAuth client)
- Enable the **Google Health API**.
- OAuth consent screen: **External / Testing**, add yourself as a **Test user**, add scopes
  `googlehealth.activity_and_fitness.readonly`, `.sleep.readonly`,
  `.health_metrics_and_measurements.readonly`.
- Credentials → **OAuth client ID → Web application**. Add your app origin(s) to **Authorized
  JavaScript origins** (prod domain + `http://localhost:5173`). No redirect URI needed (the popup
  auth-code flow uses `postmessage`). Copy the **Client ID + Client secret**.

### 3. Vercel env vars (Project → Settings → Environment Variables)
Server-only (do **not** prefix with `VITE_`):
```
GOOGLE_HEALTH_CLIENT_ID       = 2053...apps.googleusercontent.com
GOOGLE_HEALTH_CLIENT_SECRET   = GOCSPX-...
SUPABASE_URL                  = https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY     = <service role key from Supabase → API settings>
# optional, only if you enable the cron below:
CRON_SECRET                   = <any long random string>
```
`VITE_GOOGLE_CLIENT_ID` in `client/.env` must equal the same Web client's ID (the browser popup
uses it).

### 4. Ship
`git push` the branch (or merge to main). Vercel builds the client and deploys `client/api/**` as
serverless functions automatically. Done — no CLI.

### 5. First run + verify
Open the app → **Connect Google Health** on the Dashboard → approve consent. Confirm
`health_metrics` fills in the Supabase table editor. The old Fit path is left dormant in the code;
once you trust this, delete `client/src/lib/googleFit.js` and the `gfit_*` localStorage logic.

### 6. (Optional) Vercel Cron — only after Production publish
`client/vercel.json`:
```json
{ "crons": [ { "path": "/api/google-health/sync", "schedule": "0 5 * * *" } ] }
```
Vercel Cron can't send a custom body/header, so add a tiny cron wrapper route that calls
`syncUser` for all tokens guarded by `CRON_SECRET`, or gate `sync.js` on the Vercel cron header.
Skip until you're out of Testing mode (7-day token limit).

## Rollback

Nothing is deleted until Step 5's cutover note. To revert: the dormant Fit code still works — point
the Dashboard back at it, remove the `api/` folder + env vars, `drop table google_health_tokens;`.
The old Fit sync keeps working until end-2026.
