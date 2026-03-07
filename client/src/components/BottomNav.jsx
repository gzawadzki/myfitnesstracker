import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LineChart, Activity, Plus, HeartPulse } from 'lucide-react';

export default function BottomNav() {
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
