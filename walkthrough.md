# Walkthrough: Plan Naprawczy — Rounds 1 & 2

## Round 1 — Security & Bug Fixes (`248a48d`)

| Task | File | Change |
|---|---|---|
| SEC-01 | [05_rls_catalog_tables.sql](file:///c:/Users/qqq/myfitnotes/database/05_rls_catalog_tables.sql) | Added `DELETE` RLS policy for `health_metrics` |
| SEC-04 | [supabase.js](file:///c:/Users/qqq/myfitnotes/client/src/lib/supabase.js) | Throw error on missing env vars |
| BUG-01 | [Health.jsx](file:///c:/Users/qqq/myfitnotes/client/src/pages/Health.jsx) | `useEffect` to resync inputs when async data arrives |
| CODE-04 | [DataContext.jsx](file:///c:/Users/qqq/myfitnotes/client/src/context/DataContext.jsx) | `[...arr].reverse()` to prevent mutation |
| SEC-05 | [Profile.jsx](file:///c:/Users/qqq/myfitnotes/client/src/pages/Profile.jsx) | Password min 6→8 |
| FUNC-03 | [DataContext.jsx](file:///c:/Users/qqq/myfitnotes/client/src/context/DataContext.jsx) | `crypto.randomUUID()` for exercise IDs |

---

## Round 2 — UX Improvements (`6d7e6ba`)

### New Component
- [ConfirmModal.jsx](file:///c:/Users/qqq/myfitnotes/client/src/components/ConfirmModal.jsx) — replaces `window.confirm()` with a styled modal (danger/warning variants, loading state, backdrop blur)

### ConfirmModal Integration
| File | What it replaces |
|---|---|
| [WorkoutLog.jsx](file:///c:/Users/qqq/myfitnotes/client/src/pages/WorkoutLog.jsx) | Delete workout confirmation |
| [Health.jsx](file:///c:/Users/qqq/myfitnotes/client/src/pages/Health.jsx) | Delete health record confirmation |
| [NewWorkout.jsx](file:///c:/Users/qqq/myfitnotes/client/src/pages/NewWorkout.jsx) | Discard workout confirmation |

### Empty State Improvements
| File | Before | After |
|---|---|---|
| WorkoutLog | "No workouts logged yet." | Icon + CTA "Start a Workout" |
| Dashboard | "No workouts available..." | Icon + styled card |
| Progress chart | Long text block | 📊 icon + brief copy |
| Recovery correlation | Academic paragraph | "Log 5+ workouts and your sleep..." |

## Verification
- ✅ Vite build passed (exit code 0)
- ✅ Both rounds committed and pushed to `origin/main`
