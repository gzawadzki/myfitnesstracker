# FitNotes — Cloud-First Workout Logger

An advanced, cloud-synchronized workout logger and analytics dashboard. Replaces manual Excel training plans with a premium, mobile-optimized experience that tracks gym sessions, health metrics, and visualizes progressive overload over time.

## 🚀 Features

### 🏋️ Workout Tracking
- **Guided Workout Flow** — Select a workout template, log sets × reps × weight per exercise with real-time guidance from your last session
- **Smart Next Workout** — Dashboard suggests the next workout in your training rotation
- **Rest Timer** — Configurable rest timer between sets with vibration + audio alert when done
- **Workout Duration** — Automatic stopwatch tracks total session time from start to finish
- **Exercise Swap & Skip** — Substitute exercises on the fly or skip unavailable ones
- **Session Notes** — Add free-text comments to any workout session
- **Workout Log** — Full history of completed sessions with duration, sets, and notes
- **Cardio Tracking** — Dedicated syncing and timeline views for non-gym cardio activities

### 📊 Health Metrics
- **Sleep Tracking** — Log daily sleep hours, view 7d/30d averages and goal streaks
- **Step Counting** — Daily step entry with goal tracking
- **Body Weight** — Weight tracker with sparkline chart, delta vs previous, and goal line
- **Heart Rate** — Resting BPM with color-coded zones (Resting / Normal / Elevated)
- **Calories Burned** — Daily calorie expenditure tracking
- **Save All** — Single button to save all metrics at once

### 📈 Analytics & Insights
- **Progress Charts** — Isolate any exercise to visualize weight progression across training blocks
- **Readiness Dashboard** — Today's sleep, steps, weight, HR, and calories at a glance with inline editing
- **Health Insights** — 7-day and 30-day averages, goal streaks, and weight trend charts
- **Google Fit Sync** — OAuth 2.0 integration to auto-import sleep, steps, weight, heart rate, and calories from Google Fit

### 🔐 Security
- **Google OAuth Login** — Secure authentication via Supabase Auth
- **Row Level Security** — Strict RLS policies so only you can access your data
- **Zero vulnerabilities** — All production dependencies pass `npm audit`

### 🎨 UX Polish
- **Toast Notifications** — Non-intrusive success/error/info messages replace all `alert()` calls
- **Dark Mode** — Premium dark glassmorphism design optimized for mobile
- **Inline Editing** — Tap any Dashboard metric to edit it in place
- **Exit Confirmation** — Prevents accidental data loss during active workouts
- **Touch-Friendly** — Card hover effects disabled on touch devices

---

## 🏗️ Project Structure

```
├── client/                    # Vite + React SPA
│   └── src/
│       ├── components/        # Reusable UI (Toast, BottomNav, etc.)
│       ├── context/           # DataContext — Supabase data layer
│       ├── hooks/             # usePreferences custom hook
│       ├── lib/               # Supabase client, Google Fit API
│       └── pages/
│           ├── Dashboard.jsx  # Home — readiness metrics + next workout
│           ├── Health.jsx     # Sleep, steps, weight, HR, calories trackers
│           ├── NewWorkout.jsx # Active workout session with timer
│           ├── WorkoutLog.jsx # Session history
│           ├── Progress.jsx   # Exercise progression charts
│           ├── Profile.jsx    # User profile + settings
│           └── Login.jsx      # Google OAuth login
├── database/
│   ├── supabase_init.sql      # Base schema (phases, templates, exercises, sessions, sets)
│   ├── 02_health_metrics.sql  # Health metrics table
│   ├── 03_user_goals_and_weight.sql  # Weight column + user_preferences table
│   ├── 04_not_null_user_id.sql
│   ├── 05_rls_catalog_tables.sql
│   ├── 06_heart_rate_calories.sql    # Heart rate + calories columns
│   ├── 07_workout_duration.sql       # Workout duration column
│   ├── 08_exercises_insert_policy.sql
│   ├── 09_latest_activity.sql
│   ├── 10_gf_session_id.sql
│   ├── 11_gf_session_details.sql
│   ├── 12_cardio_sessions.sql        # Cardio isolation table
│   └── add_warmup_column.sql
```

---

## ⚙️ Local Development

### 1. Install Dependencies
```bash
cd client && npm install  # React app
```

### 2. Configure Environment
Create `client/.env`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_CLIENT_ID=your_google_cloud_oauth_id
```

### 3. Initialize Database
Run the SQL migrations in order in the Supabase SQL Editor:
1. `supabase_init.sql`
2. `02_health_metrics.sql` → `12_cardio_sessions.sql`
3. `add_warmup_column.sql`

### 4. Start the App
```bash
cd client
npm run dev
```



## 📱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Styling | Custom CSS (dark glassmorphism) |
| Charts | Recharts |
| Icons | Lucide React |
| Auth | Google OAuth via `@react-oauth/google` |
| Backend | Supabase (Postgres + Auth + RLS) |
| Health Sync | Google Fit REST API |
