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
  const { appReady, error } = useData();
  const toast = useToast();

  if (!appReady) {
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
          <Route path="/profile" element={<ProfilePage session={session} />} />
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
