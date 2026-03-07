import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useData } from '../context/DataContext';

export default function WorkoutSelect() {
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
