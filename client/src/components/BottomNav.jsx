import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LineChart, Activity, Plus, HeartPulse, Play, ClipboardList } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);

  // Poll sessionStorage for active workout (set by NewWorkout.jsx)
  useEffect(() => {
    const check = () => setHasActiveWorkout(!!sessionStorage.getItem('activeWorkoutId'));
    check();
    // Re-check on focus and storage events
    window.addEventListener('focus', check);
    window.addEventListener('storage', check);
    const interval = setInterval(check, 2000);
    return () => {
      window.removeEventListener('focus', check);
      window.removeEventListener('storage', check);
      clearInterval(interval);
    };
  }, []);

  // Don't show banner if we're already on the workout page
  const showBanner = hasActiveWorkout && !path.includes('/workouts/new');

  return (
    <>
      {showBanner && (
        <Link
          to={`/workouts/new?id=${sessionStorage.getItem('activeWorkoutId')}`}
          className="fixed z-40 left-4 right-4 flex items-center justify-between p-3 rounded-xl"
          style={{
            bottom: '80px',
            background: 'var(--gradient-main)',
            boxShadow: 'var(--shadow-glow)',
            textDecoration: 'none',
            color: 'white'
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)' }}>
              <Play size={16} fill="white" />
            </div>
            <div>
              <div className="text-sm font-bold">Workout in progress</div>
              <div className="text-[10px]" style={{ opacity: 0.8 }}>Tap to continue</div>
            </div>
          </div>
          <div className="text-xs font-medium" style={{ opacity: 0.9 }}>Resume →</div>
        </Link>
      )}
      <nav className="bottom-nav">
        <Link to="/" className={`nav-item ${path === '/' ? 'active' : ''}`}>
          <Home size={24} />
          <span>Home</span>
        </Link>
        <Link to="/workouts" className={`nav-item ${path === '/workouts' && !path.includes('/new') && !path.includes('/select') ? 'active' : ''}`}>
          <Activity size={24} />
          <span>Log</span>
        </Link>
        <Link to="/plan" className={`nav-item ${path === '/plan' ? 'active' : ''}`}>
          <ClipboardList size={24} />
          <span>Plan</span>
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
    </>
  );
}
