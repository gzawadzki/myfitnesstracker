# Plan Naprawczy — Round 2

## Already Done (discovered during research)

| Task | Status | Evidence |
|---|---|---|
| Rest Timer vibration + beep | ✅ Done | [NewWorkout.jsx](file:///c:/Users/qqq/myfitnotes/client/src/pages/NewWorkout.jsx) L149-160 — `navigator.vibrate` + WebAudio API beep |
| Exit confirmation for active workout | ✅ Done | [NewWorkout.jsx](file:///c:/Users/qqq/myfitnotes/client/src/pages/NewWorkout.jsx) L170-175 — `beforeunload` handler + confirm on Cancel |
| CODE-01 (hide mock data in prod) | ✅ Done | [App.jsx](file:///c:/Users/qqq/myfitnotes/client/src/App.jsx) L106 — `import.meta.env.DEV` guard |

---

## Proposed Changes

### UX Improvements

---

#### [MODIFY] [WorkoutLog.jsx](file:///c:/Users/qqq/myfitnotes/client/src/pages/WorkoutLog.jsx)
**UX-02**: Replace bare "No workouts logged yet." text with a rich empty state: icon + message + CTA button linking to workout selection.

---

#### [MODIFY] [Dashboard.jsx](file:///c:/Users/qqq/myfitnotes/client/src/pages/Dashboard.jsx)
**UX-02**: Replace the empty "No workouts available" card with a richer empty state with CTA.

---

#### [MODIFY] [Progress.jsx](file:///c:/Users/qqq/myfitnotes/client/src/pages/Progress.jsx)
**UX-06**: Improve the empty chart state message — currently says generic text, replace with clearer copy and an icon.

Also improve recovery correlation copy (was flagged as too verbose/academic).

---

### Confirm Modal (replaces window.confirm)

---

#### [NEW] [ConfirmModal.jsx](file:///c:/Users/qqq/myfitnotes/client/src/components/ConfirmModal.jsx)
Create a reusable confirm modal component matching the app's design system, replacing native `window.confirm()` across the app.

#### [MODIFY] [WorkoutLog.jsx](file:///c:/Users/qqq/myfitnotes/client/src/pages/WorkoutLog.jsx)
Replace `window.confirm("Delete this workout session?")` with `<ConfirmModal>`.

#### [MODIFY] [Health.jsx](file:///c:/Users/qqq/myfitnotes/client/src/pages/Health.jsx)
Replace `window.confirm(...)` for health record deletion with `<ConfirmModal>`.

#### [MODIFY] [NewWorkout.jsx](file:///c:/Users/qqq/myfitnotes/client/src/pages/NewWorkout.jsx)
Replace `window.confirm('Discard this workout?')` with `<ConfirmModal>`.

---

## Verification Plan
- Vite production build (`npx vite build`)
- Visual check of empty states (no data scenarios)
- Confirm modal renders correctly in workout log, health, and new workout views
