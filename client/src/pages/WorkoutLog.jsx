import React, { useState } from 'react';
import { Trash2, Dumbbell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

export default function WorkoutLog() {
  const { db, deleteWorkoutSession, loadMoreSessions, hasMoreSessions, loadingSessions } = useData();
  const toast = useToast();
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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
          <div className="card glass text-center p-8 mt-4">
            <Dumbbell size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <h3 className="h3 mb-2">No workouts yet</h3>
            <p className="text-sm text-secondary mb-4">Complete your first session to see it here.</p>
            <Link to="/workouts/select" className="btn btn-primary text-sm" style={{ display: 'inline-flex', padding: '10px 24px' }}>
              Start a Workout
            </Link>
          </div>
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
                    <h3 className="h3 mb-1 text-sm">
                      {session.google_fit_session_id ? `Synced: ${session.notes?.replace('Synced from Google Fit: ', '') || 'Activity'}` : templateName}
                    </h3>
                    <p className="text-xs text-muted">
                      {formatShortDate(session.created_at)}
                      {session.duration_minutes > 0 && <span className="ml-2">⏱ {session.duration_minutes} min</span>}
                      {session.distance_meters > 0 && <span className="ml-2">📍 {(session.distance_meters / 1000).toFixed(2)} km</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.notes && <span className="badge badge-success text-[10px]">Notes</span>}
                    <button 
                      className="p-1 text-muted hover:text-warning transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(session.id);
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

                    {(session.health_sleep_hours || session.health_steps || session.calories || session.distance_meters || session.steps) && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {session.health_sleep_hours && (
                          <div className="badge text-xs" style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)' }}>
                            💤 {session.health_sleep_hours}h
                          </div>
                        )}
                        {session.health_steps && !session.google_fit_session_id && (
                          <div className="badge text-xs" style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)' }}>
                            👟 {session.health_steps.toLocaleString()}
                          </div>
                        )}
                        {/* Synced Activity Details */}
                        {session.google_fit_session_id && (
                          <>
                            {session.steps > 0 && (
                              <div className="badge text-xs" style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                                👟 {session.steps.toLocaleString()} steps
                              </div>
                            )}
                            {session.distance_meters > 0 && (
                              <div className="badge text-xs" style={{ background: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.2)' }}>
                                📍 {(session.distance_meters / 1000).toFixed(2)} km
                              </div>
                            )}
                            {session.distance_meters > 0 && session.duration_minutes > 0 && (
                              <div className="badge text-xs" style={{ background: 'rgba(167, 139, 250, 0.1)', color: '#a78bfa', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
                                ⏱️ {(() => {
                                  const pace = session.duration_minutes / (session.distance_meters / 1000);
                                  const paceMin = Math.floor(pace);
                                  const paceSec = Math.round((pace % 1) * 60).toString().padStart(2, '0');
                                  return `${paceMin}:${paceSec}`;
                                })()} min/km
                              </div>
                            )}
                            {session.calories > 0 && (
                              <div className="badge text-xs" style={{ background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
                                🔥 {session.calories} kcal
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    
                    {Object.keys(setsByExercise).length > 0 ? (
                      <div className="flex-col gap-3">
                        {Object.keys(setsByExercise).map(exId => {
                          const exInfo = db.exercises[exId];
                          const exName = exInfo ? exInfo.name : exId;
                          const exSets = [...setsByExercise[exId]].sort((a, b) => {
                            // Warmup sets first, then working sets, preserving original order within each group
                            if (a.is_warmup && !b.is_warmup) return -1;
                            if (!a.is_warmup && b.is_warmup) return 1;
                            return (a.set_number || 0) - (b.set_number || 0);
                          });
                          
                          return (
                            <div key={exId}>
                              <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{exName}</div>
                              <div className="flex flex-wrap gap-2">
                                {exSets.map((s, i) => (
                                  <div key={i} className="badge text-[10px]" style={{ 
                                    padding: '2px 6px', 
                                    background: s.is_warmup ? 'rgba(245, 158, 11, 0.08)' : s.completed ? 'var(--surface-color)' : 'rgba(239, 68, 68, 0.1)', 
                                    color: s.is_warmup ? 'var(--warning)' : s.completed ? 'var(--text-secondary)' : 'var(--warning)', 
                                    border: `1px solid ${s.is_warmup ? 'rgba(245, 158, 11, 0.25)' : 'var(--surface-border)'}`,
                                    opacity: s.is_warmup ? 0.7 : 1
                                  }}>
                                    {s.is_warmup && <span style={{ marginRight: '2px', fontWeight: 700 }}>W</span>}
                                    {s.weight}kg x {s.reps} {!s.completed && !s.is_warmup && '(Missed)'}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      !session.google_fit_session_id && <div className="text-xs text-muted">No exercises recorded for this session.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {hasMoreSessions && sessions.length > 0 && (
        <div className="flex justify-center mt-6 mb-2">
          <button 
            className="btn btn-secondary text-sm"
            onClick={loadMoreSessions}
            disabled={loadingSessions}
          >
            {loadingSessions ? 'Loading...' : 'Load older workouts'}
          </button>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        title="Delete workout?"
        message="This will permanently remove this session and all its sets. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={!!deletingId}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={async () => {
          try {
            setDeletingId(confirmDeleteId);
            await deleteWorkoutSession(confirmDeleteId);
            toast.success('Workout deleted');
          } catch (err) {
            toast.error('Failed to delete: ' + err.message);
          } finally {
            setDeletingId(null);
            setConfirmDeleteId(null);
          }
        }}
      />
    </div>
  );
}
