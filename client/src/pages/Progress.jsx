import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useData } from '../context/DataContext';
import { usePreferences } from '../hooks/usePreferences';

export default function Progress() {
  const { db, loadingCatalog, loadingSessions, loadingHealth } = useData();
  const { preferences: prefs } = usePreferences();
  const navigate = useNavigate();
  const sleepGoal = prefs?.sleep_goal ?? 7.5;
  const exerciseIds = Object.keys(db.exercises || {});
  const [selectedExUrlId, setSelectedExUrlId] = useState(null);
  const [xAxisMode, setXAxisMode] = useState('week');

  useEffect(() => {
    if (!selectedExUrlId && exerciseIds.length > 0) {
      setSelectedExUrlId(exerciseIds[0]);
    }
  }, [exerciseIds.length]);
  
  // We extract actual history data from the global db context to build the chart
  const buildChartData = (exerciseId) => {
    const ex = db.exercises[exerciseId];
    if (!ex || !ex.history) return [];

    return ex.history.map((h, i) => ({
      week: `Wk ${i + 1}`,
      date: h.date ? new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `Wk ${i + 1}`,
      weight: h.weight,
      volume: h.weight * h.reps,
      reps: h.reps
    }));
  };

  const chartData = buildChartData(selectedExUrlId);
  const selectedEx = db.exercises[selectedExUrlId];

  // 1. Calculate Real Metric Cards Data
  const totalWorkouts = db.sessions ? db.sessions.length : 0;
  
  const totalVolume = (db.sessions || []).reduce((acc, sess) => {
    return acc + (sess.sets || []).reduce((sAcc, set) => sAcc + (Number(set.weight) * Number(set.reps)), 0);
  }, 0);
  const volumeTons = totalVolume > 0 ? (totalVolume / 1000).toFixed(1) : 0;

  const sleepDays = (db.healthMetrics || []).filter(m => Number(m.sleep_hours) > 0);
  const avgSleepDec = sleepDays.length > 0 
    ? sleepDays.reduce((acc, m) => acc + Number(m.sleep_hours), 0) / sleepDays.length 
    : 0;
  const avgSleepH = Math.floor(avgSleepDec);
  const avgSleepM = Math.round((avgSleepDec - avgSleepH) * 60);
  const avgSleepStr = avgSleepDec > 0 ? `${avgSleepH}h ${avgSleepM}m` : '0h 0m';

  // 2. Calculate Real Recovery Correlation
  let wellRestedSets = [];
  let tiredSets = [];

  (db.sessions || []).forEach(sess => {
    const sessDate = sess.created_at.split('T')[0];
    const dayMetrics = db.healthMetrics?.find(m => m.date === sessDate);
    const sleep = dayMetrics ? Number(dayMetrics.sleep_hours) : 0;
    
    const exSets = (sess.sets || []).filter(s => s.exercise_id === selectedExUrlId);
    if (sleep >= sleepGoal) {
      wellRestedSets.push(...exSets);
    } else if (sleep > 0) {
      tiredSets.push(...exSets);
    }
  });

  const getAvgVolume = (sets) => sets.length > 0 ? sets.reduce((acc, s) => acc + (Number(s.weight) * Number(s.reps)), 0) / sets.length : 0;
  const wellRestedVol = getAvgVolume(wellRestedSets);
  const tiredVol = getAvgVolume(tiredSets);

  let diffPercent = 0;
  if (tiredVol > 0 && wellRestedVol > 0) {
    diffPercent = Math.round(((wellRestedVol - tiredVol) / tiredVol) * 100);
  }

  if (loadingCatalog || loadingSessions || loadingHealth) {
    return (
      <div className="animate-fade-in" style={{ paddingBottom: '60px' }}>
        <h1 className="h2 mb-4">Analytics</h1>
        <div className="card glass animate-pulse mb-4" style={{ height: '80px' }}></div>
        <div className="card glass animate-pulse" style={{ height: '300px' }}></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '60px' }}>
      <header className="flex justify-between items-center mb-6">
        <button className="btn btn-icon" onClick={() => navigate('/')}>
          <ChevronLeft size={24} />
        </button>
        <h1 className="h2 mb-0">Analytics</h1>
        <div style={{ width: '40px' }}></div> {/* Spacer */}
      </header>

      {/* Metric Cards */}
      <div className="flex gap-2 mb-6">
        <div className="card glass flex-1 text-center" style={{ padding: 'var(--space-3)' }}>
          <span className="text-xs text-muted">Workouts</span>
          <div className="h2 mt-1 mb-0" style={{ color: 'var(--accent-primary)' }}>{totalWorkouts}</div>
        </div>
        <div className="card glass flex-1 text-center" style={{ padding: 'var(--space-3)' }}>
          <span className="text-xs text-muted">Volume (T)</span>
          <div className="h2 mt-1 mb-0" style={{ color: 'var(--accent-secondary)' }}>{volumeTons}</div>
        </div>
        <div className="card glass flex-1 text-center" style={{ padding: 'var(--space-3)' }}>
          <span className="text-xs text-muted">Avg Sleep</span>
          <div className="h2 mt-1 mb-0 opacity-90 text-sm flex items-center justify-center font-bold">{avgSleepStr}</div>
        </div>
      </div>

      <h2 className="h3 mb-4">Exercise Progress</h2>
      
      <div className="mb-4 flex items-center justify-between gap-2">
        <select 
          className="text-sm font-medium flex-1" 
          value={selectedExUrlId}
          onChange={e => setSelectedExUrlId(e.target.value)}
        >
          {Object.values(db.exercises).map(ex => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
        
        <div className="flex rounded-md p-1" style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)' }}>
          <button 
            className="text-xs font-medium rounded-sm"
            style={{ 
              padding: '4px 12px',
              background: xAxisMode === 'week' ? 'var(--accent-primary)' : 'transparent',
              color: xAxisMode === 'week' ? '#fff' : 'var(--text-muted)'
            }}
            onClick={() => setXAxisMode('week')}
          >
            Week
          </button>
          <button 
            className="text-xs font-medium rounded-sm"
            style={{ 
              padding: '4px 12px',
              background: xAxisMode === 'date' ? 'var(--accent-primary)' : 'transparent',
              color: xAxisMode === 'date' ? '#fff' : 'var(--text-muted)'
            }}
            onClick={() => setXAxisMode('date')}
          >
            Date
          </button>
        </div>
      </div>

      <div className="card glass mb-6" style={{ height: '300px', padding: 'var(--space-4) var(--space-2)' }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
              <XAxis dataKey={xAxisMode} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)' }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Line 
                type="monotone" 
                dataKey="weight" 
                name="Max Weight (kg)"
                stroke="var(--accent-primary)" 
                strokeWidth={3}
                dot={{ fill: 'var(--accent-primary)', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: 'var(--accent-primary)' }} 
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-muted text-sm">
            No history data available for this exercise.
          </div>
        )}
      </div>

      {/* Cross Metric Health View */}
      <h2 className="h3 mb-4">Recovery Correlation</h2>
      <div className="card glass">
        <p className="text-sm text-secondary mb-3">
          Comparing your performance on {selectedEx?.name} against sleep metrics.
        </p>
        
        {wellRestedSets.length > 0 && tiredSets.length > 0 ? (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1" style={{ height: '8px', background: 'var(--surface-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Math.max(10, 50 + diffPercent))}%`, height: '100%', background: diffPercent >= 0 ? 'var(--success)' : 'var(--warning)' }}></div>
              </div>
              <span className={`text-xs font-bold ${diffPercent >= 0 ? 'text-success' : 'text-warning'}`}>
                {diffPercent > 0 ? '+' : ''}{diffPercent}% Strength
              </span>
            </div>
            <p className="text-xs text-muted mt-2">
              Your volume averages {diffPercent > 0 ? `a ${diffPercent}% increase` : `a ${Math.abs(diffPercent)}% decrease`} on days following &gt;{sleepGoal}h sleep vs poorly rested days.
            </p>
          </>
        ) : (
           <p className="text-xs text-muted mt-2 italic">
              Keep logging both workouts and sleep! Need more data across well-rested and tired days to calculate statistically significant correlations.
           </p>
        )}
      </div>

    </div>
  );
}
