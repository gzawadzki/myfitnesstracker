import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { usePreferences } from '../hooks/usePreferences';
import { useToast } from '../components/Toast';
import GoalsForm from '../components/GoalsForm';
import { formatWeightGoal, getGoalFormValues, hasIncompleteGoals } from '../components/goalsUtils';
import { Moon, Footprints, AlertCircle, Save, Trash2, TrendingUp, Scale, Settings, Heart, Flame } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Health() {
  const { db, saveDailyHealthMetric, deleteDailyHealthMetric, loadingHealth } = useData();
  const { preferences: prefs, savePreferences: saveUserPreferences, loading: prefsLoading } = usePreferences();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [savedFields, setSavedFields] = useState({});

  // Get today's local date string
  const todayRaw = new Date();
  const offset = todayRaw.getTimezoneOffset() * 60000;
  const todayStr = (new Date(todayRaw - offset)).toISOString().split('T')[0];
  const todayMetrics = db.healthMetrics?.find(m => m.date === todayStr) || {};

  const [sleepInput, setSleepInput] = useState(todayMetrics.sleep_hours || "");
  const [stepsInput, setStepsInput] = useState(todayMetrics.steps || "");
  const [weightInput, setWeightInput] = useState(todayMetrics.weight || "");
  const [heartRateInput, setHeartRateInput] = useState(todayMetrics.heart_rate || "");
  const [caloriesInput, setCaloriesInput] = useState(todayMetrics.calories_burned || "");

  // Sync inputs when async data arrives or changes (e.g. after Google Fit sync)
  React.useEffect(() => {
    setSleepInput(todayMetrics.sleep_hours || "");
    setStepsInput(todayMetrics.steps || "");
    setWeightInput(todayMetrics.weight || "");
    setHeartRateInput(todayMetrics.heart_rate || "");
    setCaloriesInput(todayMetrics.calories_burned || "");
  }, [todayMetrics.sleep_hours, todayMetrics.steps, todayMetrics.weight, todayMetrics.heart_rate, todayMetrics.calories_burned]);

  // Goals
  const goals = getGoalFormValues(prefs);
  const hasIncomplete = hasIncompleteGoals(prefs);
  const [showGoals, setShowGoals] = useState(false);

  // Expand state
  const [expandedCard, setExpandedCard] = useState(null);
  const toggle = (card) => setExpandedCard(prev => prev === card ? null : card);

  // Save single metric
  const handleSave = async (type) => {
    try {
      setSaving(true);
      setError(null);
      let val;
      if (type === 'sleep_hours') {
        val = parseFloat(sleepInput);
        if (isNaN(val) || val <= 0 || val > 24) { setError('Sleep must be 0–24h.'); return; }
      } else if (type === 'steps') {
        val = parseInt(stepsInput);
        if (isNaN(val) || val <= 0) { setError('Steps must be positive.'); return; }
      } else if (type === 'weight') {
        val = parseFloat(weightInput);
        if (isNaN(val) || val < 20 || val > 500) { setError('Weight must be 20–500.'); return; }
      } else if (type === 'heart_rate') {
        val = parseInt(heartRateInput);
        if (isNaN(val) || val < 30 || val > 250) { setError('HR must be 30–250 BPM.'); return; }
      } else if (type === 'calories_burned') {
        val = parseInt(caloriesInput);
        if (isNaN(val) || val <= 0) { setError('Calories must be positive.'); return; }
      }
      await saveDailyHealthMetric(todayStr, type, val);
      setSavedFields(prev => ({ ...prev, [type]: true }));
      setTimeout(() => setSavedFields(prev => ({ ...prev, [type]: false })), 2000);
    } catch (err) {
      console.error(err);
      const msg = err?.message || 'Failed to save.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGoals = async (updates) => {
    try {
      setSaving(true);
      await saveUserPreferences(updates);
      setShowGoals(false);
    } catch (err) {
      console.error(err);
      setError("Failed to save goals.");
    } finally {
      setSaving(false);
    }
  };

  if (prefsLoading || loadingHealth) {
    return (
      <div className="animate-fade-in">
        <h1 className="h2 mb-4">Health</h1>
        <div className="card glass animate-pulse mb-4" style={{ height: '150px' }}></div>
        <div className="card glass animate-pulse" style={{ height: '220px' }}></div>
      </div>
    );
  }

  const recentMetrics = (db.healthMetrics || []).slice(0, 14);
  const formatShortDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const handleDelete = async (dateStr, type) => {
    const label = { sleep_hours: 'sleep', steps: 'step', weight: 'weight', heart_rate: 'heart rate', calories_burned: 'calories' }[type];
    if (!window.confirm(`Delete ${label} record for ${formatShortDate(dateStr)}?`)) return;
    try {
      setDeletingId(`${dateStr}-${type}`);
      await deleteDailyHealthMetric(dateStr, type);
      toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} record deleted`);
    } catch (err) {
      console.error(err);
      setError("Failed to delete record.");
    } finally {
      setDeletingId(null);
    }
  };

  // Insights
  const calcAvg = (metrics, days, type) => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const subset = metrics.filter(m => new Date(m.date) >= cutoff && m[type] != null);
    if (!subset.length) return 0;
    return subset.reduce((a, m) => a + Number(m[type]), 0) / subset.length;
  };
  const calcStreak = (metrics, type, threshold) => {
    let s = 0;
    for (let m of metrics) { if (m[type] != null && Number(m[type]) >= threshold) s++; else break; }
    return s;
  };

  const sleepAvg7 = calcAvg(db.healthMetrics || [], 7, 'sleep_hours').toFixed(1);
  const stepsAvg7 = Math.round(calcAvg(db.healthMetrics || [], 7, 'steps'));
  const weightAvg7 = calcAvg(db.healthMetrics || [], 7, 'weight').toFixed(1);
  const sleepAvg30 = calcAvg(db.healthMetrics || [], 30, 'sleep_hours').toFixed(1);
  const stepsAvg30 = Math.round(calcAvg(db.healthMetrics || [], 30, 'steps'));
  const weightAvg30 = calcAvg(db.healthMetrics || [], 30, 'weight').toFixed(1);
  const sleepStreak = calcStreak(db.healthMetrics || [], 'sleep_hours', goals.sleep_goal);
  const stepsStreak = calcStreak(db.healthMetrics || [], 'steps', goals.step_goal);
  const hrAvg7 = Math.round(calcAvg(db.healthMetrics || [], 7, 'heart_rate'));
  const calAvg7 = Math.round(calcAvg(db.healthMetrics || [], 7, 'calories_burned'));

  // Weight chart data
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const weightHistoryData = (db.healthMetrics || [])
    .filter(m => m.weight && new Date(m.date) >= thirtyDaysAgo)
    .reverse()
    .map(m => ({ date: formatShortDate(m.date), weight: Number(m.weight) }));

  // History renderer
  const renderHistory = (items, field, formatValue, formatBadge) => {
    const filtered = items.filter(m => m[field]);
    if (!filtered.length) return <p className="text-xs text-muted mt-3">No data yet.</p>;
    return (
      <div className="mt-4 flex-col gap-2">
        {filtered.slice(0, 10).map((m, i) => (
          <div key={i} className="flex justify-between items-center text-xs p-2 rounded" style={{ background: 'var(--bg-color)' }}>
            <span className="text-muted">{formatShortDate(m.date)}</span>
            <span className="font-semibold flex items-center gap-2">
              {formatValue(m)}
              {formatBadge && formatBadge(m)}
              <button className="p-1 text-muted hover:text-warning transition-colors" onClick={() => handleDelete(m.date, field)} disabled={deletingId === `${m.date}-${field}`}>
                <Trash2 size={12} />
              </button>
            </span>
          </div>
        ))}
      </div>
    );
  };


  return (
    <div className="animate-fade-in" style={{ paddingBottom: '80px' }}>
      <header className="mb-6 p-4 pb-0">
        <h1 className="h1 mb-1">Health Metrics</h1>
        <p className="text-secondary">Track your daily health and fitness metrics.</p>
      </header>

      {error && (
        <div className="mx-4 mb-4 p-3 rounded-lg text-xs" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* ── Insights ─────────────────────────────── */}
      <div className="card glass mx-4 mb-6" style={{ background: 'var(--gradient-card)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-bold text-white">
            <TrendingUp size={18} /> Insights
          </div>
          <button onClick={() => setShowGoals(!showGoals)} className="btn-icon text-secondary hover:text-white transition-colors">
            <Settings size={16} />
          </button>
        </div>

        {showGoals && (
          <div className="mb-4 p-4 rounded-lg bg-black/40 border border-white/10">
            <h4 className="text-sm font-bold text-white mb-3">My Targets</h4>
            <GoalsForm
              preferences={prefs}
              onSave={handleSaveGoals}
              saving={saving}
              showOnboardingCopy={hasIncomplete}
            />
          </div>
        )}

        <div className="flex gap-4">
          <div className="flex-1">
            <div className="text-xs text-secondary mb-1 uppercase tracking-wider">Sleep</div>
            <div className="text-sm">7d: <strong className="text-white">{sleepAvg7}h</strong> · 30d: <strong className="text-white">{sleepAvg30}h</strong></div>
            <div className="text-xs text-success mt-1">🔥 {sleepStreak} day streak</div>
          </div>
          <div style={{ width: '1px', background: 'var(--surface-border)', opacity: 0.5 }}></div>
          <div className="flex-1">
            <div className="text-xs text-secondary mb-1 uppercase tracking-wider">Steps</div>
            <div className="text-sm">7d: <strong className="text-white">{stepsAvg7.toLocaleString()}</strong> · 30d: <strong className="text-white">{stepsAvg30.toLocaleString()}</strong></div>
            <div className="text-xs text-success mt-1">🔥 {stepsStreak} day streak</div>
          </div>
        </div>
        <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex-1">
            <div className="text-xs text-secondary mb-1 uppercase tracking-wider">Weight</div>
            <div className="text-sm">7d: <strong className="text-white">{weightAvg7 > 0 ? `${weightAvg7} ${goals.weight_goal_unit}` : '--'}</strong> · 30d: <strong className="text-white">{weightAvg30 > 0 ? `${weightAvg30} ${goals.weight_goal_unit}` : '--'}</strong></div>
            <div className="text-xs text-muted mt-1">🎯 {formatWeightGoal(goals.weight_goal, goals.weight_goal_unit)}</div>
          </div>
          <div style={{ width: '1px', background: 'var(--surface-border)', opacity: 0.5 }}></div>
          <div className="flex-1">
            <div className="text-xs text-secondary mb-1 uppercase tracking-wider">HR / Cal</div>
            <div className="text-sm">HR: <strong className="text-white">{hrAvg7 > 0 ? `${hrAvg7}bpm` : '--'}</strong> · Cal: <strong className="text-white">{calAvg7 > 0 ? calAvg7.toLocaleString() : '--'}</strong></div>
          </div>
        </div>
      </div>

      {/* ── Expandable Tracker Cards ──────────────── */}

      {/* Sleep */}
      <div className="card glass mx-4 mb-3" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => toggle('sleep')} style={{ background: expandedCard === 'sleep' ? 'var(--surface-hover)' : 'transparent' }}>
          <div className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99, 102, 241, 0.15)' }}>
            <Moon size={18} style={{ color: '#818cf8' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">Sleep</div>
            <div className="text-xs text-muted">7d avg: {sleepAvg7}h</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-white">{todayMetrics.sleep_hours ? `${todayMetrics.sleep_hours}h` : '—'}</div>
            {todayMetrics.sleep_hours && (
              <span className="text-[10px]" style={{ color: todayMetrics.sleep_hours >= goals.sleep_goal ? 'var(--success)' : 'var(--warning)' }}>
                {todayMetrics.sleep_hours >= goals.sleep_goal ? 'Optimal' : 'Low'}
              </span>
            )}
          </div>
        </div>
        {expandedCard === 'sleep' && (
          <div className="p-4 pt-0" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <div className="flex gap-2 mt-4">
              <input type="number" step="0.1" className="input flex-1" placeholder="Hours (e.g. 7.5)" value={sleepInput} onChange={e => setSleepInput(e.target.value)} />
              <button className="btn btn-primary" onClick={() => handleSave('sleep_hours')} disabled={saving || !sleepInput}>
                {saving ? '...' : <Save size={18} />}
              </button>
            </div>
            {savedFields.sleep_hours && <span className="text-xs text-success mt-1 block">✓ Saved</span>}
            {renderHistory(recentMetrics, 'sleep_hours',
              m => `${m.sleep_hours}h`,
              m => <span className="badge text-[10px]" style={m.sleep_hours >= goals.sleep_goal ? { background: 'var(--success)', color: 'white' } : { background: 'var(--warning)', color: 'white' }}>{m.sleep_hours >= goals.sleep_goal ? 'Optimal' : 'Low'}</span>
            )}
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="card glass mx-4 mb-3" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => toggle('steps')} style={{ background: expandedCard === 'steps' ? 'var(--surface-hover)' : 'transparent' }}>
          <div className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16, 185, 129, 0.15)' }}>
            <Footprints size={18} style={{ color: '#10b981' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">Steps</div>
            <div className="text-xs text-muted">7d avg: {stepsAvg7.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-white">{todayMetrics.steps ? todayMetrics.steps.toLocaleString() : '—'}</div>
            {todayMetrics.steps && (
              <span className="text-[10px]" style={{ color: todayMetrics.steps >= goals.step_goal ? 'var(--success)' : 'var(--warning)' }}>
                {todayMetrics.steps >= goals.step_goal ? 'Active' : 'Low'}
              </span>
            )}
          </div>
        </div>
        {expandedCard === 'steps' && (
          <div className="p-4 pt-0" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <div className="flex gap-2 mt-4">
              <input type="number" className="input flex-1" placeholder="Steps (e.g. 10000)" value={stepsInput} onChange={e => setStepsInput(e.target.value)} />
              <button className="btn btn-primary" onClick={() => handleSave('steps')} disabled={saving || !stepsInput}>
                {saving ? '...' : <Save size={18} />}
              </button>
            </div>
            {savedFields.steps && <span className="text-xs text-success mt-1 block">✓ Saved</span>}
            {renderHistory(recentMetrics, 'steps',
              m => m.steps.toLocaleString(),
              m => <span className="badge text-[10px]" style={m.steps >= goals.step_goal ? { background: 'var(--success)', color: 'white' } : { background: 'var(--warning)', color: 'white' }}>{m.steps >= goals.step_goal ? 'Active' : 'Low'}</span>
            )}
          </div>
        )}
      </div>

      {/* Weight */}
      <div className="card glass mx-4 mb-3" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => toggle('weight')} style={{ background: expandedCard === 'weight' ? 'var(--surface-hover)' : 'transparent' }}>
          <div className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)' }}>
            <Scale size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">Weight</div>
            <div className="text-xs text-muted">7d avg: {weightAvg7 > 0 ? `${weightAvg7} ${goals.weight_goal_unit}` : '--'}</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-white">{todayMetrics.weight ? `${todayMetrics.weight} ${goals.weight_goal_unit}` : '—'}</div>
            {goals.weight_goal && todayMetrics.weight && (
              <span className="text-[10px]" style={{ color: Math.abs(todayMetrics.weight - goals.weight_goal) < 1 ? 'var(--success)' : 'var(--warning)' }}>
                {Math.abs(todayMetrics.weight - goals.weight_goal) < 1 ? 'On target' : `${todayMetrics.weight > goals.weight_goal ? '+' : ''}${(todayMetrics.weight - goals.weight_goal).toFixed(1)} ${goals.weight_goal_unit}`}
              </span>
            )}
          </div>
        </div>
        {expandedCard === 'weight' && (
          <div className="p-4 pt-0" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <div className="flex gap-2 mt-4">
              <div className="relative flex-1">
                <input type="number" step="0.1" className="input w-full pr-12" placeholder={`Weight (e.g. 70 ${goals.weight_goal_unit})`} value={weightInput} onChange={e => setWeightInput(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{goals.weight_goal_unit}</span>
              </div>
              <button className="btn btn-primary" onClick={() => handleSave('weight')} disabled={saving || !weightInput}>
                {saving ? '...' : <Save size={18} />}
              </button>
            </div>
            {savedFields.weight && <span className="text-xs text-success mt-1 block">✓ Saved</span>}

            {weightHistoryData.length > 1 && (
              <div style={{ height: '180px', width: '100%', marginTop: '16px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightHistoryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${Number(v).toFixed(1)}`} width={45} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '8px', fontSize: '13px', padding: '8px 12px' }} formatter={v => [`${v} ${goals.weight_goal_unit}`, 'Weight']} />
                    <Line type="monotone" dataKey="weight" stroke="var(--accent-primary)" strokeWidth={2.5} dot={{ fill: 'var(--accent-primary)', stroke: 'var(--surface-color)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} fill="url(#weightGradient)" />
                    {goals.weight_goal && <Line type="monotone" dataKey={() => goals.weight_goal} stroke="var(--success)" strokeDasharray="5 5" strokeWidth={1.5} dot={false} name="Goal" />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {renderHistory(recentMetrics, 'weight', m => `${m.weight} ${m.weight_unit || goals.weight_goal_unit}`, null)}
          </div>
        )}
      </div>

      {/* Heart Rate */}
      <div className="card glass mx-4 mb-3" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => toggle('hr')} style={{ background: expandedCard === 'hr' ? 'var(--surface-hover)' : 'transparent' }}>
          <div className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239, 68, 68, 0.15)' }}>
            <Heart size={18} style={{ color: '#ef4444' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">Heart Rate</div>
            <div className="text-xs text-muted">7d avg: {hrAvg7 > 0 ? `${hrAvg7}bpm` : '--'}</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-white">{todayMetrics.heart_rate ? `${todayMetrics.heart_rate}` : '—'}<span className="text-xs text-muted font-normal">{todayMetrics.heart_rate ? ' bpm' : ''}</span></div>
            {todayMetrics.heart_rate && (
              <span className="text-[10px]" style={{ color: todayMetrics.heart_rate < 70 ? 'var(--success)' : todayMetrics.heart_rate < 85 ? 'var(--warning)' : 'var(--danger)' }}>
                {todayMetrics.heart_rate < 70 ? 'Resting' : todayMetrics.heart_rate < 85 ? 'Normal' : 'Elevated'}
              </span>
            )}
          </div>
        </div>
        {expandedCard === 'hr' && (
          <div className="p-4 pt-0" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <div className="flex gap-2 mt-4">
              <input type="number" className="input flex-1" placeholder="BPM (e.g. 65)" value={heartRateInput} onChange={e => setHeartRateInput(e.target.value)} />
              <button className="btn btn-primary" onClick={() => handleSave('heart_rate')} disabled={saving || !heartRateInput}>
                {saving ? '...' : <Save size={18} />}
              </button>
            </div>
            {savedFields.heart_rate && <span className="text-xs text-success mt-1 block">✓ Saved</span>}
            {renderHistory(recentMetrics, 'heart_rate',
              m => `${m.heart_rate} bpm`,
              m => <span className="badge text-[10px]" style={m.heart_rate < 70 ? { background: 'var(--success)', color: 'white' } : m.heart_rate < 85 ? { background: 'var(--warning)', color: 'white' } : { background: 'var(--danger)', color: 'white' }}>{m.heart_rate < 70 ? 'Resting' : m.heart_rate < 85 ? 'Normal' : 'Elevated'}</span>
            )}
          </div>
        )}
      </div>

      {/* Calories */}
      <div className="card glass mx-4 mb-3" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => toggle('calories')} style={{ background: expandedCard === 'calories' ? 'var(--surface-hover)' : 'transparent' }}>
          <div className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245, 158, 11, 0.15)' }}>
            <Flame size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">Calories</div>
            <div className="text-xs text-muted">7d avg: {calAvg7 > 0 ? calAvg7.toLocaleString() : '--'}</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-white">{todayMetrics.calories_burned ? todayMetrics.calories_burned.toLocaleString() : '—'}<span className="text-xs text-muted font-normal">{todayMetrics.calories_burned ? ' kcal' : ''}</span></div>
          </div>
        </div>
        {expandedCard === 'calories' && (
          <div className="p-4 pt-0" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <div className="flex gap-2 mt-4">
              <input type="number" className="input flex-1" placeholder="Calories (e.g. 2200)" value={caloriesInput} onChange={e => setCaloriesInput(e.target.value)} />
              <button className="btn btn-primary" onClick={() => handleSave('calories_burned')} disabled={saving || !caloriesInput}>
                {saving ? '...' : <Save size={18} />}
              </button>
            </div>
            {savedFields.calories_burned && <span className="text-xs text-success mt-1 block">✓ Saved</span>}
            {renderHistory(recentMetrics, 'calories_burned', m => `${m.calories_burned.toLocaleString()} kcal`, null)}
          </div>
        )}
      </div>

    </div>
  );
}
