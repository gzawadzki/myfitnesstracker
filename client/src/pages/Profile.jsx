import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, HeartPulse, LogOut, Database, Download } from 'lucide-react';
import { usePreferences } from '../hooks/usePreferences';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';

export default function ProfilePage({ session, injectMockData }) {
  const { preferences: prefs, loading: prefsLoading } = usePreferences();
  const { db } = useData();
  const [downloading, setDownloading] = useState(false);

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
              <div className="text-lg font-bold text-white">{prefs?.weight_goal ?? '—'}{prefs?.weight_goal ? (prefs?.weight_goal_unit || 'kg') : ''}</div>
            </div>
          </div>
        )}
        <div className="px-4 pb-4">
          <Link to="/health" className="text-xs text-accent-primary hover:underline">Edit goals in Health tab →</Link>
        </div>
      </div>

      {injectMockData && (
        <div style={cardStyle} className="mb-4">
          <div className="p-3 px-4 flex items-center gap-2 text-xs uppercase tracking-wider text-secondary font-semibold" style={{ borderBottom: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.15)' }}>
            <Database size={14} /> Data
          </div>
          <div className="p-4">
            <p className="text-xs text-muted mb-3">Inject 14 days of mock workouts, sleep, and steps for testing.</p>
            <button className="btn w-full btn-secondary text-sm" onClick={injectMockData}>
              Inject Test Analytics
            </button>
          </div>
        </div>
      )}

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
