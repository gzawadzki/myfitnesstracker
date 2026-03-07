import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useData } from './context/DataContext';
import { useToast } from './components/Toast';
import Login from './pages/Login';
import BottomNav from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import WorkoutLog from './pages/WorkoutLog';
import WorkoutSelect from './pages/WorkoutSelect';
import NewWorkout from './pages/NewWorkout';
import Progress from './pages/Progress';
import Health from './pages/Health';
import ProfilePage from './pages/Profile';

function Layout({ session }) {
  const { loading, error } = useData();
  const toast = useToast();

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
      toast.success('Mock data injected! Refreshing…');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error('Injection failed: ' + err.message);
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
          <Route path="/profile" element={<ProfilePage session={session} injectMockData={import.meta.env.DEV ? injectMockData : null} />} />
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
    <HashRouter>
      <Layout session={session} />
    </HashRouter>
  );
}

export default App;
