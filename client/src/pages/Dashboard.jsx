import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePreferences } from '../hooks/usePreferences';
import { useGoogleLogin } from '@react-oauth/google';
import { fetchGoogleFitData } from '../lib/googleFit';

export default function Dashboard() {
  const { db, saveDailyHealthMetric } = useData();
  const { preferences: prefs, loading: prefsLoading } = usePreferences();
  const [gfitToken, setGfitToken] = useState(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  const todayRaw = new Date();
  const offset = todayRaw.getTimezoneOffset() * 60000;
  const todayStr = (new Date(todayRaw - offset)).toISOString().split('T')[0];
  const todayMetrics = db.healthMetrics?.find(m => m.date === todayStr) || {};
  
  const sleep = todayMetrics.sleep_hours || 0;
  const steps = todayMetrics.steps || 0;
  const weight = todayMetrics.weight || 0;

  const sortedMetrics = (db.healthMetrics || []).filter(m => m.weight > 0).sort((a, b) => new Date(b.date) - new Date(a.date));
  const prevWeight = sortedMetrics.length > 1 ? sortedMetrics[1].weight : null;
  const weightDelta = (weight && prevWeight) ? (weight - prevWeight).toFixed(1) : null;

  const syncGoogleFit = async (token) => {
    setGoogleLoading(true);
    setSyncStatus(null);
    try {
      const dailyResults = await fetchGoogleFitData(token, 7);
      for (const day of dailyResults) {
        if (day.steps > 0) await saveDailyHealthMetric(day.date, 'steps', day.steps);
        if (day.sleepHours > 0) await saveDailyHealthMetric(day.date, 'sleep_hours', day.sleepHours);
        if (day.weightKg > 0) await saveDailyHealthMetric(day.date, 'weight', day.weightKg);
      }
      setSyncStatus('success');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      console.error("Google Fit sync failed:", err);
      setGfitToken(null);
      setIsGoogleConnected(false);
      setSyncStatus('error');
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
    scope: 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.sleep.read https://www.googleapis.com/auth/fitness.body.read',
    onError: error => console.error('Login Failed:', error)
  });

  const handleSyncNow = async () => {
    if (gfitToken) {
      await syncGoogleFit(gfitToken);
    } else {
      loginGoogleFit();
    }
  };
  
  const nextWorkout = db.workouts && db.workouts.length > 0 ? db.workouts[0] : null;
  const nextPhase = nextWorkout ? db.phases.find(p => p.id === nextWorkout.phaseId) : null;

  const formatSleep = (hoursDec) => {
    if (!hoursDec) return "0h 0m";
    const h = Math.floor(hoursDec);
    const m = Math.round((hoursDec - h) * 60);
    return `${h}h ${m}m`;
  };

  if (prefsLoading) return <div className="p-4 text-center text-muted">Loading dashboard...</div>;

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="h1 mb-1">Overview</h1>
          <p className="text-secondary">Welcome back, Athlete!</p>
        </div>
        <Link to="/profile">
          <img src="https://ui-avatars.com/api/?name=User&background=3b82f6&color=fff" alt="User" style={{ borderRadius: '50%', width: '48px', height: '48px' }} />
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
        <div className="flex items-center gap-2 mb-4 p-2 rounded text-xs text-warning" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <AlertTriangle size={14} className="flex-shrink-0" />
          <span>Google Fit sync will stop working in 2026. Manual entry is recommended.</span>
        </div>

        <div className="flex justify-between mt-4">
          <div className="flex-col items-center flex-1 text-center" onClick={() => {
            const val = prompt("Enter sleep in hours (e.g. 7.5):", sleep || 0);
            if(val && !isNaN(val)) saveDailyHealthMetric(todayStr, 'sleep_hours', parseFloat(val));
          }}>
            <span className="text-muted text-sm" style={{ cursor: 'pointer' }}>Sleep ✎</span>
            <div className="h2 mt-1 mb-1" style={{ color: sleep >= 7 ? 'var(--success)' : 'var(--warning)' }}>
              {formatSleep(sleep)}
            </div>
            <span className={`badge ${sleep >= 7 ? 'badge-success' : ''}`} style={sleep < 7 ? {backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)'} : {}}>
              {sleep >= 7 ? 'Optimal' : 'Low'}
            </span>
          </div>
          <div style={{ width: '1px', backgroundColor: 'var(--surface-border)' }}></div>
          <div className="flex-col items-center flex-1 text-center" onClick={() => {
            const val = prompt("Enter today's steps:", steps || 0);
            if(val && !isNaN(val)) saveDailyHealthMetric(todayStr, 'steps', parseInt(val));
          }}>
            <span className="text-muted text-sm" style={{ cursor: 'pointer' }}>Steps ✎</span>
            <div className="h2 mt-1 mb-1" style={{ color: steps >= (prefs?.step_goal || 8000) ? 'var(--success)' : 'var(--warning)' }}>
              {steps.toLocaleString()}
            </div>
            <span className={`badge ${steps >= (prefs?.step_goal || 8000) ? 'badge-success' : ''}`} style={steps < (prefs?.step_goal || 8000) ? {backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)'} : {}}>
              {steps >= (prefs?.step_goal || 8000) ? 'Active' : 'Recovery'}
            </span>
          </div>
          <div style={{ width: '1px', backgroundColor: 'var(--surface-border)' }}></div>
          <div className="flex-col items-center flex-1 text-center" onClick={() => {
            const val = prompt("Enter today's weight (kg):", weight || '');
            if(val && !isNaN(val) && parseFloat(val) > 0) saveDailyHealthMetric(todayStr, 'weight', parseFloat(val));
          }}>
            <span className="text-muted text-sm" style={{ cursor: 'pointer' }}>Weight ✎</span>
            <div className="h2 mt-1 mb-1 text-white">
              {weight > 0 ? `${weight}kg` : '— kg'}
            </div>
            {weightDelta !== null ? (
              <span className="badge text-[10px]" style={{
                backgroundColor: Number(weightDelta) > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: Number(weightDelta) > 0 ? 'var(--warning)' : 'var(--success)'
              }}>
                {Number(weightDelta) > 0 ? '+' : ''}{weightDelta}kg vs prev
              </span>
            ) : (
              <span className="badge" style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-secondary)' }}>
                Log
              </span>
            )}
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
        <div className="card text-center text-muted p-6">
          No workouts available. Please import your training plan.
        </div>
      )}
    </div>
  );
}
