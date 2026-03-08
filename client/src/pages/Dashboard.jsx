import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Activity } from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePreferences } from '../hooks/usePreferences';
import { useToast } from '../components/Toast';
import { useGoogleLogin } from '@react-oauth/google';
import { fetchGoogleFitData } from '../lib/googleFit';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const { db, loadData, saveDailyHealthMetric, syncExternalSessions, loadingCatalog, loadingSessions, loadingHealth } = useData();
  const { preferences: prefs, loading: prefsLoading } = usePreferences();
  const toast = useToast();
  const [gfitToken, setGfitToken] = useState(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  // Inline editing state
  const [editingField, setEditingField] = useState(null); // 'sleep' | 'steps' | 'weight'
  const [editValue, setEditValue] = useState('');
  const [savedField, setSavedField] = useState(null);

  const todayRaw = new Date();
  const offset = todayRaw.getTimezoneOffset() * 60000;
  const todayStr = (new Date(todayRaw - offset)).toISOString().split('T')[0];
  const todayMetrics = db.healthMetrics?.find(m => m.date === todayStr) || {};
  
  const sleep = todayMetrics.sleep_hours || 0;
  const steps = todayMetrics.steps || 0;
  const weight = todayMetrics.weight || 0;
  const latestActivity = todayMetrics.latest_activity || '';
  const calories = todayMetrics.calories_burned || 0;

  const sortedMetrics = (db.healthMetrics || []).filter(m => m.weight > 0).sort((a, b) => new Date(b.date) - new Date(a.date));
  const prevWeight = sortedMetrics.length > 1 ? sortedMetrics[1].weight : null;
  const weightDelta = (weight && prevWeight) ? (weight - prevWeight).toFixed(1) : null;

  // Get user's name from email
  const [session, setSession] = useState(null);
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
  }, []);
  const email = session?.user?.email || '';
  const displayName = prefs?.display_name
    || (email ? email.split('@')[0].split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Athlete');

  const syncGoogleFit = async (token) => {
    setGoogleLoading(true);
    setSyncStatus(null);
    try {
      // --- Smart delta sync ---
      // Find the most recent date we already have health data for (excluding today,
      // because today's data is always refreshed as it changes throughout the day).
      const todayRawForSync = new Date();
      const syncOffset = todayRawForSync.getTimezoneOffset() * 60000;
      const todayForSync = new Date(todayRawForSync - syncOffset).toISOString().split('T')[0];

      const existingDates = (db.healthMetrics || [])
        .map(m => m.date)
        .filter(d => d < todayForSync) // exclude today
        .sort((a, b) => (a > b ? -1 : 1)); // descending

      const lastSyncedDate = existingDates[0] || null; // e.g. '2026-03-07'

      let daysBack;
      if (!lastSyncedDate) {
        // No prior data — first sync, fetch full 7 days
        daysBack = 7;
      } else {
        // Calculate how many days since last synced date (not counting today)
        const lastSyncedMs = new Date(lastSyncedDate + 'T00:00:00').getTime();
        const todayMs = new Date(todayForSync + 'T00:00:00').getTime();
        const daysSinceLast = Math.floor((todayMs - lastSyncedMs) / 86400000);

        if (daysSinceLast <= 0) {
          // Last sync was today — only fetch today (1 day)
          daysBack = 1;
        } else {
          // Fetch from day after last sync through today
          // +1 to include today itself, capped at 7 to avoid huge requests
          daysBack = Math.min(daysSinceLast + 1, 7);
        }
      }

      console.log(`[syncGoogleFit] lastSyncedDate=${lastSyncedDate}, daysBack=${daysBack}`);

      const { dailyResults, activitySessions } = await fetchGoogleFitData(token, daysBack);

      // Filter: only save days that are NEW (not yet in db) OR today (always refresh)
      const existingDatesSet = new Set(existingDates);
      const daysToSave = dailyResults.filter(day => day.date === todayForSync || !existingDatesSet.has(day.date));

      console.log(`[syncGoogleFit] Total fetched: ${dailyResults.length}, saving: ${daysToSave.length} day(s)`);

      // Batch upsert all health metrics in one go instead of N sequential calls
      if (daysToSave.length > 0) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const userId = currentSession?.user?.id;
        if (!userId) throw new Error('Not logged in');

        const upsertRows = daysToSave.map(day => ({
          user_id: userId,
          date: day.date,
          ...(day.steps > 0 && { steps: day.steps }),
          ...(day.sleepHours > 0 && { sleep_hours: day.sleepHours }),
          ...(day.weightKg > 0 && { weight: day.weightKg }),
          ...(day.latestActivity && { latest_activity: day.latestActivity }),
          ...(day.caloriesBurned > 0 && { calories_burned: day.caloriesBurned }),
        }));

        const { error: upsertError } = await supabase
          .from('health_metrics')
          .upsert(upsertRows, { onConflict: 'user_id,date' });

        if (upsertError) throw upsertError;

        // Refresh local context so UI updates immediately
        await loadData(true);
      }

      // Sync activity sessions as workouts (deduplication handled inside syncExternalSessions)
      if (activitySessions && activitySessions.length > 0) {
        await syncExternalSessions(activitySessions);
      }

      setSyncStatus('success');
      const saved = daysToSave.length;
      toast.success(saved > 0 ? `Google Fit synced (${saved} new day${saved > 1 ? 's' : ''})` : 'Already up to date');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      console.error('Google Fit sync failed:', err);
      setGfitToken(null);
      setIsGoogleConnected(false);
      setSyncStatus('error');
      if (err.message === 'Unauthorized' || err.message === 'Forbidden') {
        toast.error('Session expired — reconnecting to Google Fit...');
        setTimeout(() => loginGoogleFit(), 500);
      } else if (err.message?.includes('fetch') || err.message?.includes('network') || !navigator.onLine) {
        toast.error('Network error — check your connection and try again.');
      } else {
        toast.error('Google Fit sync failed: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const loginGoogleFit = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGfitToken(tokenResponse.access_token);
      setIsGoogleConnected(true);
      await syncGoogleFit(tokenResponse.access_token);
    },
    scope: 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.sleep.read https://www.googleapis.com/auth/fitness.body.read https://www.googleapis.com/auth/fitness.heart_rate.read https://www.googleapis.com/auth/fitness.location.read',
    onError: error => console.error('Login Failed:', error)
  });

  const handleSyncNow = async () => {
    if (gfitToken) {
      await syncGoogleFit(gfitToken);
    } else {
      loginGoogleFit();
    }
  };

  // Smart next workout rotation
  const lastSession = db.sessions?.[0]; // most recent
  const lastTemplateIdx = db.workouts ? db.workouts.findIndex(w => w.id === lastSession?.template_id) : -1;
  const nextIdx = db.workouts && db.workouts.length > 0 ? (lastTemplateIdx + 1) % db.workouts.length : 0;
  const nextWorkout = db.workouts && db.workouts.length > 0 ? db.workouts[nextIdx] : null;
  const nextPhase = nextWorkout ? db.phases.find(p => p.id === nextWorkout.phaseId) : null;

  const formatSleep = (hoursDec) => {
    if (!hoursDec) return "—";
    const h = Math.floor(hoursDec);
    const m = Math.round((hoursDec - h) * 60);
    return `${h}h ${m}m`;
  };

  // Inline editing
  const startEdit = (field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue && currentValue !== 0 ? String(currentValue) : '');
  };

  const saveEdit = async () => {
    if (!editingField || editValue === '') { setEditingField(null); return; }
    const val = editingField === 'activity' ? editValue : parseFloat(editValue);
    if (editingField !== 'activity' && (isNaN(val) || val <= 0)) { setEditingField(null); return; }
    
    const typeMap = { sleep: 'sleep_hours', steps: 'steps', weight: 'weight', activity: 'latest_activity', calories: 'calories_burned' };
    try {
      await saveDailyHealthMetric(todayStr, typeMap[editingField], editingField === 'steps' ? parseInt(editValue) : val);
      setSavedField(editingField);
      setTimeout(() => setSavedField(null), 1500);
    } catch {
      toast.error('Failed to save');
    }
    setEditingField(null);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') setEditingField(null);
  };

  if (prefsLoading) return <div className="p-4 text-center text-muted">Loading dashboard...</div>;

  if (loadingCatalog || loadingSessions || loadingHealth) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <div className="h1 mb-2">Overview</div>
          <p className="text-secondary">Loading your dashboard…</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="card glass animate-pulse" style={{ height: '110px' }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="h1 mb-1">Overview</h1>
          <p className="text-secondary">Welcome back, {displayName}!</p>
        </div>
        <Link to="/profile">
          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff`} alt="User" style={{ borderRadius: '50%', width: '48px', height: '48px' }} />
        </Link>
      </div>

      <div className="card mb-6 glass">
        <h2 className="h3 flex justify-between items-center mb-2">
          Today's Readiness
          <div className="flex flex-col items-end gap-1">
            <button 
              className="badge text-xs px-2 py-1 cursor-pointer"
              style={{ 
                background: isGoogleConnected ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-color)', 
                color: isGoogleConnected ? 'var(--success)' : 'var(--text-primary)', 
                border: `1px solid ${isGoogleConnected ? 'rgba(16, 185, 129, 0.3)' : 'var(--surface-border)'}` 
              }}
              onClick={handleSyncNow}
              disabled={googleLoading}
            >
              {googleLoading ? 'Syncing...' : isGoogleConnected ? '↻ Sync Now' : 'Connect Google Fit'}
            </button>
            {syncStatus === 'success' && <span className="text-[10px] text-success">Synced ✓</span>}
            {syncStatus === 'error' && <span className="text-[10px] text-warning">Token expired — tap to reconnect</span>}
          </div>
        </h2>


        <div className="flex justify-between mt-4">
          {/* Sleep */}
          <div className="flex-col items-center flex-1 text-center" onClick={() => editingField !== 'sleep' && startEdit('sleep', sleep)} style={{ cursor: 'pointer' }}>
            <span className="text-muted text-sm">Sleep {savedField === 'sleep' ? <span style={{ color: 'var(--success)' }}>✓</span> : '✎'}</span>
            {editingField === 'sleep' ? (
              <input
                type="number"
                step="0.1"
                className="mt-1 mb-1"
                style={{ width: '80px', textAlign: 'center', fontSize: '1.25rem', fontWeight: 600, padding: '4px', background: 'var(--surface-color)', border: '1px solid var(--accent-primary)', borderRadius: '8px' }}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleEditKeyDown}
                placeholder="7.5"
                autoFocus
              />
            ) : (
              <div className="h2 mt-1 mb-1" style={{ color: sleep > 0 ? (sleep >= 7 ? 'var(--success)' : 'var(--warning)') : 'var(--text-muted)' }}>
                {formatSleep(sleep)}
              </div>
            )}
            <span className={`badge ${sleep > 0 && sleep >= 7 ? 'badge-success' : ''}`} style={
              sleep === 0 ? { backgroundColor: 'var(--surface-color)', color: 'var(--text-muted)' } :
              sleep < 7 ? {backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)'} : {}
            }>
              {sleep === 0 ? 'Not logged' : sleep >= 7 ? 'Optimal' : 'Low'}
            </span>
          </div>
          <div style={{ width: '1px', backgroundColor: 'var(--surface-border)' }}></div>
          {/* Steps */}
          <div className="flex-col items-center flex-1 text-center" onClick={() => editingField !== 'steps' && startEdit('steps', steps)} style={{ cursor: 'pointer' }}>
            <span className="text-muted text-sm">Steps {savedField === 'steps' ? <span style={{ color: 'var(--success)' }}>✓</span> : '✎'}</span>
            {editingField === 'steps' ? (
              <input
                type="number"
                className="mt-1 mb-1"
                style={{ width: '80px', textAlign: 'center', fontSize: '1.25rem', fontWeight: 600, padding: '4px', background: 'var(--surface-color)', border: '1px solid var(--accent-primary)', borderRadius: '8px' }}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleEditKeyDown}
                placeholder="8000"
                autoFocus
              />
            ) : (
              <div className="h2 mt-1 mb-1" style={{ color: steps > 0 ? (steps >= (prefs?.step_goal || 8000) ? 'var(--success)' : 'var(--warning)') : 'var(--text-muted)' }}>
                {steps > 0 ? steps.toLocaleString() : '—'}
              </div>
            )}
            <span className={`badge ${steps > 0 && steps >= (prefs?.step_goal || 8000) ? 'badge-success' : ''}`} style={
              steps === 0 ? { backgroundColor: 'var(--surface-color)', color: 'var(--text-muted)' } :
              steps < (prefs?.step_goal || 8000) ? {backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)'} : {}
            }>
              {steps === 0 ? 'Not logged' : steps >= (prefs?.step_goal || 8000) ? 'Active' : 'Recovery'}
            </span>
          </div>
          <div style={{ width: '1px', backgroundColor: 'var(--surface-border)' }}></div>
          {/* Weight */}
          <div className="flex-col items-center flex-1 text-center" onClick={() => editingField !== 'weight' && startEdit('weight', weight)} style={{ cursor: 'pointer' }}>
            <span className="text-muted text-sm">Weight {savedField === 'weight' ? <span style={{ color: 'var(--success)' }}>✓</span> : '✎'}</span>
            {editingField === 'weight' ? (
              <input
                type="number"
                step="0.1"
                className="mt-1 mb-1"
                style={{ width: '80px', textAlign: 'center', fontSize: '1.25rem', fontWeight: 600, padding: '4px', background: 'var(--surface-color)', border: '1px solid var(--accent-primary)', borderRadius: '8px' }}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleEditKeyDown}
                placeholder="75"
                autoFocus
              />
            ) : (
              <div className="h2 mt-1 mb-1 text-white">
                {weight > 0 ? `${weight}kg` : '— kg'}
              </div>
            )}
            {weightDelta !== null ? (
              <span className="badge text-[10px]" style={{
                backgroundColor: Number(weightDelta) > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: Number(weightDelta) > 0 ? 'var(--warning)' : 'var(--success)'
              }}>
                {Number(weightDelta) > 0 ? '+' : ''}{weightDelta}kg vs prev
              </span>
            ) : (
              <span className="badge" style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-secondary)' }}>
                {weight > 0 ? 'Logged' : 'Not logged'}
              </span>
            )}
          </div>
        </div>

        {/* HR + Calories row */}
        <div className="flex justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
          {/* Latest Activity */}
          <div className="flex-col items-center flex-1 text-center" onClick={() => editingField !== 'activity' && startEdit('activity', latestActivity)} style={{ cursor: 'pointer' }}>
            <span className="text-muted text-sm flex items-center justify-center gap-1">
              <Activity size={14} className="text-accent-secondary" /> 
              Latest {savedField === 'activity' ? <span style={{ color: 'var(--success)' }}>✓</span> : '✎'}
            </span>
            {editingField === 'activity' ? (
              <input
                type="text"
                className="mt-1 mb-1"
                style={{ width: '120px', textAlign: 'center', fontSize: '1rem', fontWeight: 600, padding: '4px', background: 'var(--surface-color)', border: '1px solid var(--accent-primary)', borderRadius: '8px' }}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleEditKeyDown}
                placeholder="Walking"
                autoFocus
              />
            ) : (
              <div className="h2 mt-1 mb-1" style={{ color: latestActivity ? 'var(--accent-secondary)' : 'var(--text-muted)', fontSize: latestActivity.length > 10 ? '1rem' : '1.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {latestActivity || '—'}
              </div>
            )}
            <span className="badge" style={
              !latestActivity ? { backgroundColor: 'var(--surface-color)', color: 'var(--text-muted)' } :
              { backgroundColor: 'rgba(236, 72, 153, 0.1)', color: 'var(--accent-secondary)' }
            }>
              {latestActivity ? 'Movement' : 'No Activity'}
            </span>
          </div>
          <div style={{ width: '1px', backgroundColor: 'var(--surface-border)' }}></div>
          {/* Calories */}
          <div className="flex-col items-center flex-1 text-center" onClick={() => editingField !== 'calories' && startEdit('calories', calories)} style={{ cursor: 'pointer' }}>
            <span className="text-muted text-sm">Calories {savedField === 'calories' ? <span style={{ color: 'var(--success)' }}>✓</span> : '✎'}</span>
            {editingField === 'calories' ? (
              <input
                type="number"
                className="mt-1 mb-1"
                style={{ width: '80px', textAlign: 'center', fontSize: '1.25rem', fontWeight: 600, padding: '4px', background: 'var(--surface-color)', border: '1px solid var(--accent-primary)', borderRadius: '8px' }}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleEditKeyDown}
                placeholder="2000"
                autoFocus
              />
            ) : (
              <div className="h2 mt-1 mb-1" style={{ color: calories > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                {calories > 0 ? calories.toLocaleString() : '—'}
              </div>
            )}
            <span className="badge" style={
              calories === 0 ? { backgroundColor: 'var(--surface-color)', color: 'var(--text-muted)' } :
              { backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)' }
            }>
              {calories === 0 ? 'Not logged' : 'kcal burned'}
            </span>
          </div>
        </div>
      </div>

      <h2 className="h2 mb-4">Next Workout</h2>
      {nextWorkout ? (
        <div className="card">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="badge mb-2 text-gradient font-bold" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>{nextPhase?.name}</span>
              <h3 className="h3">{nextWorkout.name}</h3>
              <p className="text-secondary text-sm">{nextWorkout.exercises?.length} Exercises</p>
            </div>
          </div>
          <Link to={`/workouts/new?id=${nextWorkout.id}`} className="btn btn-primary btn-block text-center mt-2">
            Start Workout
          </Link>
        </div>
      ) : (
        <div className="card glass text-center p-6">
          <Activity size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <h3 className="h3 mb-2">No workouts available</h3>
          <p className="text-sm text-secondary mb-0">Import your training plan to get started.</p>
        </div>
      )}
    </div>
  );
}
