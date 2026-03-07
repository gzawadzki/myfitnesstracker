import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, LineChart, Activity, User, Plus, HeartPulse } from 'lucide-react';
import NewWorkout from './pages/NewWorkout';
import Progress from './pages/Progress';
import Health from './pages/Health';
import { useData } from './context/DataContext';
import { useGoogleLogin } from '@react-oauth/google';
import { fetchGoogleFitData } from './lib/googleFit';
import { supabase } from './lib/supabase';
import Login from './pages/Login';

// ... BottomNav code ...

function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav className="bottom-nav">
      <Link to="/" className={`nav-item ${path === '/' ? 'active' : ''}`}>
        <Home size={24} />
        <span>Home</span>
      </Link>
      <Link to="/workouts" className={`nav-item ${path === '/workouts' && !path.includes('/new') && !path.includes('/select') ? 'active' : ''}`}>
        <Activity size={24} />
        <span>Log</span>
      </Link>
      <div style={{ position: 'relative', top: '-15px' }}>
        <Link to="/workouts/select" className="btn btn-primary btn-icon" style={{ padding: '12px', boxShadow: 'var(--shadow-lg)' }}>
          <Plus size={28} color="white" />
        </Link>
      </div>
      <Link to="/progress" className={`nav-item ${path === '/progress' ? 'active' : ''}`}>
        <LineChart size={24} />
        <span>Progress</span>
      </Link>
      <Link to="/health" className={`nav-item ${path === '/health' ? 'active' : ''}`}>
        <HeartPulse size={24} />
        <span>Health</span>
      </Link>
    </nav>
  );
}

function Dashboard() {
  const { db, saveDailyHealthMetric } = useData();
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Get today's local date string (YYYY-MM-DD)
  const todayRaw = new Date();
  const offset = todayRaw.getTimezoneOffset() * 60000;
  const todayStr = (new Date(todayRaw - offset)).toISOString().split('T')[0];
  const todayMetrics = db.healthMetrics?.find(m => m.date === todayStr) || {};
  
  const sleep = todayMetrics.sleep_hours || 0;
  const steps = todayMetrics.steps || 0;

  const loginGoogleFit = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setGoogleLoading(true);
        const { steps: fitSteps, sleepHours: fitSleep } = await fetchGoogleFitData(tokenResponse.access_token);
        if (fitSteps > 0) await saveDailyHealthMetric(todayStr, 'steps', fitSteps);
        if (fitSleep > 0) await saveDailyHealthMetric(todayStr, 'sleep_hours', fitSleep);
        setIsGoogleConnected(true);
      } catch (err) {
        console.error("Failed to sync metrics from Google Fit:", err);
      } finally {
        setGoogleLoading(false);
      }
    },
    scope: 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.sleep.read',
    onError: error => console.error('Login Failed:', error)
  });
  
  const nextWorkout = db.workouts && db.workouts.length > 0 ? db.workouts[0] : null;
  const nextPhase = nextWorkout ? db.phases.find(p => p.id === nextWorkout.phaseId) : null;

  const formatSleep = (hoursDec) => {
    if (!hoursDec) return "0h 0m";
    const h = Math.floor(hoursDec);
    const m = Math.round((hoursDec - h) * 60);
    return `${h}h ${m}m`;
  };

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
        <h2 className="h3 flex justify-between items-center">
          Today's Readiness
          {!isGoogleConnected ? (
            <button 
              className="badge text-xs px-2 py-1 cursor-pointer"
              style={{ background: 'var(--surface-color)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
              onClick={() => loginGoogleFit()}
              disabled={googleLoading}
            >
              {googleLoading ? 'Syncing...' : 'Connect Google Fit'}
            </button>
          ) : (
            <span className="badge badge-success text-xs">Live Fit Sync ✓</span>
          )}
        </h2>
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
            <div className="h2 mt-1 mb-1" style={{ color: steps >= 8000 ? 'var(--success)' : 'var(--warning)' }}>
              {steps.toLocaleString()}
            </div>
            <span className={`badge ${steps >= 8000 ? 'badge-success' : ''}`} style={steps < 8000 ? {backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)'} : {}}>
              {steps >= 8000 ? 'Active' : 'Recovery'}
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
        <div className="card text-center text-muted p-6">
          No workouts available. Please import your training plan.
        </div>
      )}
    </div>
  );
}

function WorkoutLog() {
  const { db } = useData();
  const [expandedSessionId, setExpandedSessionId] = useState(null);

  // Sort and display the latest sessions we fetched from Context
  // We need to map the session template_id back to actual workout names
  const sessions = [...(db.sessions || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const formatShortDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const toggleExpand = (id) => {
    if (expandedSessionId === id) setExpandedSessionId(null);
    else setExpandedSessionId(id);
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '60px' }}>
      <header className="mb-6">
        <h1 className="h1 mx-4 mt-4 mb-1">Workout Log</h1>
        <p className="text-secondary mx-4">History of your completed sessions.</p>
      </header>

      <div className="flex-col gap-3 mx-4">
        {sessions.length === 0 ? (
          <div className="text-center text-muted text-sm mt-8">No workouts logged yet.</div>
        ) : (
          sessions.map(session => {
            const template = db.workouts && db.workouts.find(w => w.id === session.template_id);
            const templateName = template ? template.name : "Unknown Workout";
            const isExpanded = expandedSessionId === session.id;
            
            // Group session sets by exercise ID to display
            const setsByExercise = {};
            if (session.sets) {
              session.sets.forEach(s => {
                if (!setsByExercise[s.exercise_id]) {
                  setsByExercise[s.exercise_id] = [];
                }
                setsByExercise[s.exercise_id].push(s);
              });
            }

            return (
              <div key={session.id} className="card glass mb-3" style={{ padding: 0, overflow: 'hidden' }}>
                <div 
                  className="flex justify-between items-center p-4 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
                  style={{ background: isExpanded ? 'var(--surface-hover)' : 'transparent' }}
                  onClick={() => toggleExpand(session.id)}
                >
                  <div>
                    <h3 className="h3 mb-1 text-sm">{templateName}</h3>
                    <p className="text-xs text-muted">{formatShortDate(session.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.notes && <span className="badge badge-success text-[10px]">Notes</span>}
                    <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-muted)' }}>▼</span>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="p-4" style={{ borderTop: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.1)' }}>
                    {session.notes && (
                      <div className="mb-4">
                        <div className="text-xs text-secondary font-medium mb-1">Notes:</div>
                        <div className="text-sm italic" style={{ borderLeft: '2px solid var(--accent-primary)', paddingLeft: '8px' }}>
                          "{session.notes}"
                        </div>
                      </div>
                    )}

                    {(session.health_sleep_hours || session.health_steps) && (
                      <div className="flex gap-2 mb-4">
                        {session.health_sleep_hours && (
                          <div className="badge text-xs" style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)' }}>
                            💤 {session.health_sleep_hours}h
                          </div>
                        )}
                        {session.health_steps && (
                          <div className="badge text-xs" style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)' }}>
                            👟 {session.health_steps.toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {Object.keys(setsByExercise).length > 0 ? (
                      <div className="flex-col gap-3">
                        {Object.keys(setsByExercise).map(exId => {
                          const exInfo = db.exercises[exId];
                          const exName = exInfo ? exInfo.name : exId;
                          const exSets = setsByExercise[exId];
                          
                          return (
                            <div key={exId}>
                              <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{exName}</div>
                              <div className="flex flex-wrap gap-2">
                                {exSets.map((s, i) => (
                                  <div key={i} className="badge text-[10px]" style={{ padding: '2px 6px', background: s.completed ? 'var(--surface-color)' : 'rgba(239, 68, 68, 0.1)', color: s.completed ? 'var(--text-secondary)' : 'var(--warning)', border: '1px solid var(--surface-border)' }}>
                                    {s.weight}kg x {s.reps} {!s.completed && '(Missed)'}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-muted">No exercises recorded for this session.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function WorkoutSelect() {
  const { db } = useData();
  const hasPhases = db.phases && db.phases.length > 0;
  const [selectedPhaseId, setSelectedPhaseId] = useState(hasPhases ? db.phases[0].id : null);

  if (!hasPhases) {
    return (
      <div className="animate-fade-in text-center p-6 text-muted">
        No workouts found in the database.
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '60px' }}>
      <header className="mb-6">
        <h1 className="h1 mb-1">Select Workout</h1>
        <p className="text-secondary">Choose a workout from your plan.</p>
      </header>

      {/* Phase Selector */}
      <div className="flex gap-2 mb-6" style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        {db.phases.map((phase) => (
          <div 
            key={phase.id}
            onClick={() => setSelectedPhaseId(phase.id)}
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              background: phase.id === selectedPhaseId ? 'var(--gradient-main)' : 'var(--surface-color)',
              color: phase.id === selectedPhaseId ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${phase.id === selectedPhaseId ? 'transparent' : 'var(--surface-border)'}`
            }}
          >
            {phase.name.split(' ')[0]} {phase.name.split(' ')[1]}
          </div>
        ))}
      </div>

      {/* Workout List */}
      <div className="flex-col gap-3">
        {db.workouts.filter(w => w.phaseId === selectedPhaseId).map(workout => (
          <Link key={workout.id} to={`/workouts/new?id=${workout.id}`}>
            <div className="card glass flex justify-between items-center hover:var(--surface-hover) transition-colors p-4">
              <div>
                <h3 className="h3 mb-1 text-sm">{workout.name}</h3>
                <p className="text-xs text-muted">{workout.exercises.length} Exercises</p>
              </div>
              <Plus size={20} className="text-accent-primary" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Layout() {
  const { loading, error } = useData();

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center p-6 text-center">
        <div className="animate-fade-in">
          <Activity size={48} className="text-accent-primary mb-4 mx-auto" />
          <h2 className="h2 mb-2">Syncing Data</h2>
          <p className="text-secondary">Loading your workouts from the cloud...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container flex items-center justify-center p-6 text-center">
        <div>
          <h2 className="h2 text-warning mb-2">Connection Error</h2>
          <p className="text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  const injectMockData = async () => {
    try {
      if(!window.confirm("Inject 14 days of mock workouts and health data into your account?")) return;
      
      const userId = (await supabase.auth.getSession()).data.session?.user?.id;
      if (!userId) throw new Error("No active session");

      const { data: templates } = await supabase.from('workout_templates').select('*').limit(5);
      const { data: exercises } = await supabase.from('exercises').select('*').limit(20);

      const healthData = [];
      for (let i = 14; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        healthData.push({
          user_id: userId,
          date: d.toISOString().split('T')[0],
          sleep_hours: (Math.random() * (9 - 5) + 5).toFixed(1),
          steps: Math.floor(Math.random() * (12000 - 3000) + 3000)
        });
      }
      await supabase.from('health_metrics').upsert(healthData, { onConflict: 'user_id, date' });

      for (let i = 10; i >= 1; i--) {
        const template = templates[i % templates.length];
        const d = new Date(); d.setDate(d.getDate() - (i + Math.floor(i * 0.4))); 

        const { data: sessionData } = await supabase.from('workout_sessions').insert({
          user_id: userId, template_id: template.id, notes: "Mock data session", created_at: d.toISOString()
        }).select().single();

        const sets = [];
        for (let exIdx = 0; exIdx < 3; exIdx++) {
          const exercise = exercises[exIdx];
          const baseWeight = 20 + (10 - i) * 2.5; 
          for (let s = 1; s <= 3; s++) {
            sets.push({
              user_id: userId, session_id: sessionData.id, exercise_id: exercise.id,
              set_number: s, reps: Math.floor(Math.random() * (12 - 8) + 8), weight: baseWeight,
              completed: true, created_at: d.toISOString()
            });
          }
        }
        await supabase.from('logged_sets').insert(sets);
      }
      alert("✅ Mock Data Setup Complete! Refresh the app to view Analytics.");
      window.location.reload();
    } catch (err) {
      alert("Injection Failed: " + err.message);
    }
  };

  return (
    <div className="app-container">
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workouts" element={<WorkoutLog />} />
          <Route path="/workouts/select" element={<WorkoutSelect />} />
          <Route path="/workouts/new" element={<NewWorkout />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/health" element={<Health />} />
          <Route path="/profile" element={
            <div className="animate-fade-in p-4">
              <h1 className="h1 mb-1">Profile</h1>
              <p className="text-secondary mb-6">Manage your account and connections.</p>
              
              <button 
                className="btn w-full mb-4" 
                style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)' }} 
                onClick={injectMockData}
              >
                Inject Test Analytics (14 Days)
              </button>

              <button 
                className="btn w-full text-warning" 
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--warning)' }} 
                onClick={() => supabase.auth.signOut()}
              >
                Sign Out
              </button>
            </div>
          } />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return <div className="app-container flex items-center justify-center min-h-screen"><Activity size={48} className="text-accent-primary animate-pulse" /></div>;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

export default App;
