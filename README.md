# FitNotes - Cloud-First Workout Logger

An advanced, cloud-synchronized workout logger and analytics dashboard. This application replaces manual Excel training plans with a premium, mobile-optimized experience that tracks your gym sessions, connects with Google Fit for readiness metrics (sleep and steps), and visualizes your historical progress over time.

## 🚀 Features
- **Cloud Synchronization**: Backed by a Supabase Postgres SQL backend so your sets, reps, weights, and health data sync across all your devices instantly.
- **Google Fit Integration**: Connect your Google Account for live OAuth 2.0 fetching of your daily Sleep hours and Step count instead of typing it manually.
- **Automated Data Seeding**: Scripts are provided in the `database` folder to parse large, multi-phase Excel spreadsheets (`Plan_Treningowy.xlsx`) right into the relational SQL schema.
- **Detailed Analytics Dashboard**: Chart views let you isolate specific exercises (like Squats or Deadlifts) to track your progressive overload across multiple training blocks alongside your Readiness scores.
- **Secure Architecture**: Secured via Supabase Auth and strictly enforced Row Level Security (RLS) SQL policies so only *you* can see your private workout history.

---

## 🏗️ Project Structure
- `client/`: Main Vite + React single-page frontend application.
  - `src/pages/`: Contains the Dashboard (`App.jsx`), Workout forms, and Progress Analytics.
  - `src/context/`: Contains the global Supabase `DataContext` wrapper that intelligently hydrates React with up-to-date relational history models.
- `database/`: Contains the static Excel catalog files, the Node `seed.js` parser, and the raw SQL migration commands (`supabase_init.sql`) used to initialize the cloud schema.

---

## 🛠️ Security Audit Notes
During the pre-deployment security audit, NPM successfully validated all client application scripts and dependencies as `0 vulnerabilities`. 

**Note on `xlsx`**: If you run `npm audit` in the root folder, it may flag `xlsx` with a vulnerability prototype pollution warning. This library is only used as a developer-side one-off parsing script (`database/seed.js`) to locally extract tables from Excel, and is *not* shipped to the production app. It poses zero attack vector on your live user website.

---

## ⚙️ Local Development environment

1. **Install Dependencies**:
```bash
# Install root spreadsheet parser dependencies
npm install

# Install the actual React Application
cd client
npm install
```

2. **Configure your Database Credentials**:
Create a `.env` file in the `client/` folder with your keys:
```text
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_CLIENT_ID=your_google_cloud_oauth_id
```

3. **Initialize the App**:
```bash
cd client
npm run dev
```
