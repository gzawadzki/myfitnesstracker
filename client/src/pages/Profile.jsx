import React, { useState } from 'react';
import { User, HeartPulse, LogOut, Database, Download, X, Lock, RefreshCw } from 'lucide-react';
import { usePreferences } from '../hooks/usePreferences';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { useGoogleLogin } from '@react-oauth/google';
import { fetchGoogleFitData } from '../lib/googleFit';
import GoalsForm from '../components/GoalsForm';
import { formatWeightGoal, hasIncompleteGoals } from '../components/goalsUtils';

export default function ProfilePage({ session }) {
  const { preferences: prefs, loading: prefsLoading, savePreferences } = usePreferences();
  const { db, loadData, syncExternalSessions } = useData();
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [syncingGfit, setSyncingGfit] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);

  React.useEffect(() => {
    if (prefs?.display_name) setDisplayName(prefs.display_name);
  }, [prefs?.display_name]);

  const syncGoogleFit30Days = async (token) => {
    setSyncingGfit(true);
    try {
      const { dailyResults, activitySessions } = await fetchGoogleFitData(token, 30);
      
      if (dailyResults.length > 0) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const userId = currentSession?.user?.id;
        if (!userId) throw new Error('Not logged in');

        const upsertRows = dailyResults.map(day => ({
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
      }

      if (activitySessions && activitySessions.length > 0) {
        await syncExternalSessions(activitySessions);
      }

      toast.success(`Synced 30 days of data and ${activitySessions?.length || 0} activities`);
      await loadData(true);
    } catch (err) {
      console.error('30-day Google Fit sync failed:', err);
      toast.error('Sync failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSyncingGfit(false);
    }
  };

  const loginGoogleFit30Days = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      syncGoogleFit30Days(tokenResponse.access_token);
    },
    scope: 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read https://www.googleapis.com/auth/fitness.sleep.read https://www.googleapis.com/auth/fitness.location.read',
  });

  const downloadAllData = () => {
    if (!db) return;
    setDownloading(true);
    try {
      const esc = (v) => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [];

      // — Workout Sessions —
      lines.push('WORKOUT SESSIONS');
      lines.push(['Date', 'Workout', 'Exercise', 'Set', 'Weight (kg)', 'Reps', 'Completed', 'Notes'].join(','));
      (db.sessions || []).forEach(sess => {
        const tmpl = db.workouts?.find(w => w.id === sess.template_id);
        const date = sess.created_at ? new Date(sess.created_at).toLocaleDateString() : '';
        (sess.sets || []).forEach(set => {
          const exName = db.exercises[set.exercise_id]?.name || set.exercise_id;
          lines.push([date, esc(tmpl?.name || sess.template_id), esc(exName), set.set_number, set.weight, set.reps, set.completed ? 'Yes' : 'No', esc(sess.notes || '')].join(','));
        });
      });

      lines.push('');

      // — Health Metrics —
      lines.push('HEALTH METRICS');
      lines.push(['Date', 'Sleep (h)', 'Steps', 'Weight', 'Heart Rate', 'Calories Burned'].join(','));
      (db.healthMetrics || []).forEach(h => {
        lines.push([h.date, h.sleep_hours ?? '', h.steps ?? '', h.weight ?? '', h.heart_rate ?? '', h.calories_burned ?? ''].join(','));
      });

      const csv = lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fitnotes-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveGoals = async (updates) => {
    try {
      setSavingGoals(true);
      await savePreferences(updates);
      setShowGoalsModal(false);
    } finally {
      setSavingGoals(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    setUpdatingPassword(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;
      toast.success('Password updated successfully');
      setNewPassword('');
    } catch (err) {
      toast.error('Failed to update password: ' + err.message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const user = session?.user;
  const email = user?.email || '';
  const initials = email
    .split('@')[0]
    .split(/[._-]/)
    .map(p => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  const cardStyle = {
    background: 'rgba(26, 26, 31, 0.85)',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--surface-border)',
    borderRadius: 'var(--radius-xl)',
    overflow: 'hidden'
  };

  return (
    <div className="animate-fade-in p-4 pb-24">
      <div className="flex flex-col items-center text-center mt-4 mb-8">
        <div style={{
          width: '88px', height: '88px', borderRadius: '50%',
          background: 'var(--gradient-main)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', fontWeight: 700, color: '#fff',
          marginBottom: '16px',
          boxShadow: 'var(--shadow-glow)'
        }}>
          {initials || '?'}
        </div>
        <h1 className="h2 mb-1">My Profile</h1>
        <span className="text-secondary text-sm">{email}</span>
      </div>

      <div style={cardStyle} className="mb-4">
        <div className="p-3 px-4 flex items-center gap-2 text-xs uppercase tracking-wider text-secondary font-semibold" style={{ borderBottom: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.15)' }}>
          <User size={14} /> Account
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted">Email</span>
            <span className="font-medium" style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted">Member Since</span>
            <span className="font-medium">{memberSince}</span>
          </div>
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <label className="text-xs text-muted block mb-1">Display Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Your name"
                className="flex-1 p-2 rounded-lg border text-sm"
                style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'var(--surface-border)', color: '#fff' }}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <button
                className="btn btn-secondary text-xs"
                style={{ padding: '8px 12px' }}
                disabled={savingName || !displayName.trim()}
                onClick={async () => {
                  setSavingName(true);
                  try {
                    await savePreferences({ display_name: displayName.trim() });
                    toast.success('Name saved');
                  } catch {
                    toast.error('Failed to save name');
                  } finally {
                    setSavingName(false);
                  }
                }}
              >
                {savingName ? '...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={cardStyle} className="mb-4">
        <div className="p-3 px-4 flex items-center gap-2 text-xs uppercase tracking-wider text-secondary font-semibold" style={{ borderBottom: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.15)' }}>
          <HeartPulse size={14} /> My Goals
        </div>
        {prefsLoading ? (
          <div className="p-4 animate-pulse">
            <div className="h-4 bg-black/20 rounded w-2/3 mb-2"></div>
            <div className="h-4 bg-black/20 rounded w-1/2"></div>
          </div>
        ) : (
          <div className="p-4 flex gap-3">
            <div className="flex-1 text-center p-3 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div className="text-xs text-muted mb-1">Sleep</div>
              <div className="text-lg font-bold text-white">{prefs?.sleep_goal ?? 7.5}h</div>
            </div>
            <div className="flex-1 text-center p-3 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div className="text-xs text-muted mb-1">Steps</div>
              <div className="text-lg font-bold text-white">{((prefs?.step_goal ?? 8000) / 1000).toFixed(1)}k</div>
            </div>
            <div className="flex-1 text-center p-3 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div className="text-xs text-muted mb-1">Weight</div>
              <div className="text-lg font-bold text-white">{formatWeightGoal(prefs?.weight_goal, prefs?.weight_goal_unit || 'kg')}</div>
            </div>
          </div>
        )}
        <div className="px-4 pb-4">
          <button
            className="btn btn-secondary w-full text-sm"
            onClick={() => setShowGoalsModal(true)}
            disabled={prefsLoading}
          >
            {hasIncompleteGoals(prefs) ? 'Complete your goals' : 'Edit goals'}
          </button>
        </div>
      </div>

      {showGoalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0, 0, 0, 0.6)' }}>
          <div className="w-full max-w-md rounded-xl border p-4" style={{ background: 'var(--surface-color)', borderColor: 'var(--surface-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white">Edit Goals</h3>
              <button className="btn-icon" onClick={() => setShowGoalsModal(false)} aria-label="Close goals modal">
                <X size={16} />
              </button>
            </div>
            <GoalsForm
              preferences={prefs}
              onSave={handleSaveGoals}
              saving={savingGoals}
              showOnboardingCopy={hasIncompleteGoals(prefs)}
            />
          </div>
        </div>
      )}


      <div style={cardStyle} className="mb-4">
        <div className="p-3 px-4 flex items-center gap-2 text-xs uppercase tracking-wider text-secondary font-semibold" style={{ borderBottom: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.15)' }}>
          <Lock size={14} /> Security
        </div>
        <div className="p-4">
          <p className="text-xs text-muted mb-3">Change your account password.</p>
          <div className="flex flex-col gap-2">
            <input 
              type="password" 
              placeholder="New password" 
              className="w-full p-3 rounded-xl border text-sm" 
              style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'var(--surface-border)', color: '#fff' }}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button 
              className="btn btn-secondary w-full text-sm" 
              onClick={handlePasswordChange}
              disabled={updatingPassword || !newPassword}
            >
              {updatingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>

      <div style={cardStyle} className="mb-4">
        <div className="p-3 px-4 flex items-center gap-2 text-xs uppercase tracking-wider text-secondary font-semibold" style={{ borderBottom: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.15)' }}>
          <Download size={14} /> Export
        </div>
        <div className="p-4">
          <p className="text-xs text-muted mb-3">Download all your workout sessions, health metrics, and exercise data as a CSV file.</p>
          <button className="btn w-full btn-secondary text-sm flex items-center justify-center gap-2" onClick={downloadAllData} disabled={downloading || !db}>
            <Download size={16} /> {downloading ? 'Preparing…' : 'Download CSV'}
          </button>
        </div>
      </div>

      <div style={cardStyle} className="mb-4">
        <div className="p-3 px-4 flex items-center gap-2 text-xs uppercase tracking-wider text-secondary font-semibold" style={{ borderBottom: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.15)' }}>
          <RefreshCw size={14} /> Integrations
        </div>
        <div className="p-4">
          <p className="text-xs text-muted mb-3">Sync all health and activity data from Google Fit for the last 30 days. This may take a moment.</p>
          <button className="btn w-full btn-secondary text-sm flex items-center justify-center gap-2" onClick={() => loginGoogleFit30Days()} disabled={syncingGfit}>
            <RefreshCw size={16} className={syncingGfit ? "animate-spin" : ""} /> {syncingGfit ? 'Syncing 30 Days...' : 'Sync Last 30 Days'}
          </button>
        </div>
      </div>

      <button
        className="btn w-full flex justify-center items-center gap-2 mt-2"
        style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--danger)', padding: '14px', borderRadius: 'var(--radius-xl)' }}
        onClick={() => supabase.auth.signOut()}
      >
        <LogOut size={18} /> Sign Out
      </button>
    </div>
  );
}
