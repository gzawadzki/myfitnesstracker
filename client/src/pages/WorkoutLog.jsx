import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';

export default function WorkoutLog() {
  const { db, deleteWorkoutSession } = useData();
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

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
                    <button 
                      className="p-1 text-muted hover:text-warning transition-colors"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if(window.confirm("Are you sure you want to delete this workout?")) {
                          try {
                            setDeletingId(session.id);
                            await deleteWorkoutSession(session.id);
                          } catch (err) {
                            alert("Failed to delete: " + err.message);
                            setDeletingId(null);
                          }
                        }
                      }}
                      disabled={deletingId === session.id}
                    >
                      <Trash2 size={16} />
                    </button>
                    <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-muted)', marginLeft: '4px' }}>▼</span>
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
