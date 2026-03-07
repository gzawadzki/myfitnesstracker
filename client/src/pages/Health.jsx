import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Moon, Footprints, AlertCircle, Save, Trash2, TrendingUp } from 'lucide-react';

export default function Health() {
  const { db, saveDailyHealthMetric, deleteDailyHealthMetric } = useData();
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  // Get today's local date string (YYYY-MM-DD)
  const todayRaw = new Date();
  const offset = todayRaw.getTimezoneOffset() * 60000;
  const todayStr = (new Date(todayRaw - offset)).toISOString().split('T')[0];

  const todayMetrics = db.healthMetrics?.find(m => m.date === todayStr) || {};
  
  const [sleepInput, setSleepInput] = useState(todayMetrics.sleep_hours || "");
  const [stepsInput, setStepsInput] = useState(todayMetrics.steps || "");

  const handleSave = async (type) => {
    try {
      setSaving(true);
      setError(null);
      if (type === 'sleep_hours') {
        await saveDailyHealthMetric(todayStr, 'sleep_hours', parseFloat(sleepInput));
      } else {
        await saveDailyHealthMetric(todayStr, 'steps', parseInt(stepsInput));
      }
    } catch (err) {
      console.error(err);
      setError("Failed to save metrics. Check connection.");
    } finally {
      setSaving(false);
    }
  };

  const recentMetrics = (db.healthMetrics || []).slice(0, 14); // Last 14 days

  const formatShortDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDelete = async (dateStr, type) => {
    if(!window.confirm(`Delete ${type === 'sleep_hours' ? 'sleep' : 'step'} record for ${formatShortDate(dateStr)}?`)) return;
    try {
      setDeletingId(`${dateStr}-${type}`);
      await deleteDailyHealthMetric(dateStr, type);
    } catch(err) {
      console.error(err);
      setError("Failed to delete record.");
    } finally {
      setDeletingId(null);
    }
  };

  // Calculate Insights
  const calcAvg = (metrics, days, type) => {
    const subset = metrics.slice(0, days).filter(m => m[type] !== null && m[type] !== undefined);
    if(subset.length === 0) return 0;
    const sum = subset.reduce((acc, m) => acc + Number(m[type]), 0);
    return sum / subset.length;
  };

  const calcStreak = (metrics, type, threshold) => {
    let streak = 0;
    for(let m of metrics) {
      if(m[type] !== null && m[type] !== undefined && Number(m[type]) >= threshold) streak++;
      else break;
    }
    return streak;
  };

  const sleepAvg7 = calcAvg(db.healthMetrics || [], 7, 'sleep_hours').toFixed(1);
  const stepsAvg7 = Math.round(calcAvg(db.healthMetrics || [], 7, 'steps'));
  const sleepAvg30 = calcAvg(db.healthMetrics || [], 30, 'sleep_hours').toFixed(1);
  const stepsAvg30 = Math.round(calcAvg(db.healthMetrics || [], 30, 'steps'));
  
  const sleepStreak = calcStreak(db.healthMetrics || [], 'sleep_hours', 7);
  const stepsStreak = calcStreak(db.healthMetrics || [], 'steps', 5000);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '80px' }}>
      <header className="mb-6 p-4 pb-0">
        <h1 className="h1 mb-1">Health Metrics</h1>
        <p className="text-secondary">Track your daily sleep and step counts.</p>
      </header>

      {error && (
        <div className="mx-4 mb-4 p-3 badge text-xs" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--warning)', border: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Insights Card */}
      <div className="card glass mx-4 mb-6" style={{ background: 'var(--gradient-card)' }}>
        <div className="flex items-center gap-2 mb-4 font-bold text-white">
          <TrendingUp size={20} /> Insights & Statistics
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="text-xs text-secondary mb-1 uppercase tracking-wider">Sleep</div>
            <div className="text-sm">7d Avg: <strong className="text-white">{sleepAvg7}h</strong></div>
            <div className="text-sm">30d Avg: <strong className="text-white">{sleepAvg30}h</strong></div>
            <div className="text-sm mt-1">Streak: <strong className="text-success">{sleepStreak} days</strong> (≥7h)</div>
          </div>
          <div style={{ width: '1px', background: 'var(--surface-border)', opacity: 0.5 }}></div>
          <div className="flex-1">
            <div className="text-xs text-secondary mb-1 uppercase tracking-wider">Steps</div>
            <div className="text-sm">7d Avg: <strong className="text-white">{stepsAvg7.toLocaleString()}</strong></div>
            <div className="text-sm">30d Avg: <strong className="text-white">{stepsAvg30.toLocaleString()}</strong></div>
            <div className="text-sm mt-1">Streak: <strong className="text-success">{stepsStreak} days</strong> (≥5k)</div>
          </div>
        </div>
      </div>

      {/* Sleep Card */}
      <div className="card glass mx-4 mb-4">
        <div className="flex items-center gap-3 mb-4 text-gradient font-bold" style={{ fontSize: '1.25rem' }}>
          <Moon className="text-accent-primary" /> Sleep Tracker
        </div>
        
        <div className="mb-4">
          <label className="text-sm font-medium text-secondary block mb-2">Today's Sleep (Hours)</label>
          <div className="flex gap-2">
            <input 
              type="number" 
              className="input flex-1" 
              placeholder="e.g. 7.5"
              step="0.1"
              value={sleepInput}
              onChange={(e) => setSleepInput(e.target.value)}
            />
            <button 
              className="btn btn-primary" 
              onClick={() => handleSave('sleep_hours')}
              disabled={saving || !sleepInput}
            >
              {saving ? '...' : <Save size={20} />}
            </button>
          </div>
        </div>

        <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--surface-border)' }}>
          <h4 className="text-sm font-bold mb-3">Recent History</h4>
          {recentMetrics.filter(m => m.sleep_hours).length === 0 ? (
            <p className="text-xs text-muted">No sleep data recorded yet.</p>
          ) : (
            <div className="flex-col gap-2 relative">
              {recentMetrics.filter(m => m.sleep_hours).slice(0, 5).map((m, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm p-2 rounded" style={{ background: 'var(--surface-color)' }}>
                  <span className="text-secondary">{formatShortDate(m.date)}</span>
                  <span className="font-bold flex items-center gap-2">
                    {m.sleep_hours}h
                    <span className="badge text-[10px]" style={m.sleep_hours >= 7 ? {background: 'var(--success)', color: 'white'} : {background: 'var(--warning)', color: 'white'}}>
                      {m.sleep_hours >= 7 ? 'Optimal' : 'Low'}
                    </span>
                    <button 
                      className="p-1 ml-2 text-muted hover:text-warning transition-colors"
                      onClick={() => handleDelete(m.date, 'sleep_hours')}
                      disabled={deletingId === `${m.date}-sleep_hours`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Steps Card */}
      <div className="card glass mx-4 mb-4">
        <div className="flex items-center gap-3 mb-4 text-gradient font-bold" style={{ fontSize: '1.25rem' }}>
          <Footprints className="text-accent-primary" /> Steps Tracker
        </div>
        
        <div className="mb-4">
          <label className="text-sm font-medium text-secondary block mb-2">Today's Step Count</label>
          <div className="flex gap-2">
            <input 
              type="number" 
              className="input flex-1" 
              placeholder="e.g. 10000"
              value={stepsInput}
              onChange={(e) => setStepsInput(e.target.value)}
            />
            <button 
              className="btn btn-primary" 
              onClick={() => handleSave('steps')}
              disabled={saving || !stepsInput}
            >
              {saving ? '...' : <Save size={20} />}
            </button>
          </div>
        </div>

        <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--surface-border)' }}>
          <h4 className="text-sm font-bold mb-3">Recent History</h4>
          {recentMetrics.filter(m => m.steps).length === 0 ? (
            <p className="text-xs text-muted">No step data recorded yet.</p>
          ) : (
            <div className="flex-col gap-2 relative">
              {recentMetrics.filter(m => m.steps).slice(0, 5).map((m, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm p-2 rounded" style={{ background: 'var(--surface-color)' }}>
                  <span className="text-secondary">{formatShortDate(m.date)}</span>
                  <span className="font-bold flex items-center gap-2">
                    {m.steps.toLocaleString()}
                    <span className="badge text-[10px]" style={m.steps >= 8000 ? {background: 'var(--success)', color: 'white'} : {background: 'var(--warning)', color: 'white'}}>
                      {m.steps >= 8000 ? 'Active' : 'Low'}
                    </span>
                    <button 
                      className="p-1 ml-2 text-muted hover:text-warning transition-colors"
                      onClick={() => handleDelete(m.date, 'steps')}
                      disabled={deletingId === `${m.date}-steps`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
