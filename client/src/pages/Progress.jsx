import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useData } from '../context/DataContext';

export default function Progress() {
  const { db } = useData();
  const navigate = useNavigate();
  const [selectedExUrlId, setSelectedExUrlId] = useState('ex_1'); // Barbell Back Squat
  
  // We extract actual history data from the global db context to build the chart
  const buildChartData = (exerciseId) => {
    const ex = db.exercises[exerciseId];
    if (!ex || !ex.history) return [];

    return ex.history.map((h, i) => ({
      week: `Wk ${i + 1}`,
      weight: h.weight,
      volume: h.weight * h.reps,
      reps: h.reps
    }));
  };

  const chartData = buildChartData(selectedExUrlId);
  const selectedEx = db.exercises[selectedExUrlId];

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
          <div className="h2 mt-1 mb-0" style={{ color: 'var(--accent-primary)' }}>18</div>
        </div>
        <div className="card glass flex-1 text-center" style={{ padding: 'var(--space-3)' }}>
          <span className="text-xs text-muted">Volume (T)</span>
          <div className="h2 mt-1 mb-0" style={{ color: 'var(--accent-secondary)' }}>42.5</div>
        </div>
        <div className="card glass flex-1 text-center" style={{ padding: 'var(--space-3)' }}>
          <span className="text-xs text-muted">Avg Sleep</span>
          <div className="h2 mt-1 mb-0 opacity-90">7h 10m</div>
        </div>
      </div>

      <h2 className="h3 mb-4">Exercise Progress</h2>
      
      <div className="mb-4">
        <select 
          className="w-full text-sm font-medium" 
          style={{ width: '100%' }}
          value={selectedExUrlId}
          onChange={e => setSelectedExUrlId(e.target.value)}
        >
          {Object.values(db.exercises).map(ex => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
      </div>

      <div className="card glass mb-6" style={{ height: '300px', padding: 'var(--space-4) var(--space-2)' }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
              <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
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
        <div className="flex items-center gap-3">
          <div className="flex-1" style={{ height: '8px', background: 'var(--surface-color)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: '85%', height: '100%', background: 'var(--success)' }}></div>
          </div>
          <span className="text-xs font-bold text-success">+12% Strength</span>
        </div>
        <p className="text-xs text-muted mt-2">
          Your volume increases by an average of 12% on days following &gt;7.5h sleep.
        </p>
      </div>

    </div>
  );
}
