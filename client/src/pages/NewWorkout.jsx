/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, Plus, Save, Play, Check, ArrowUp, ArrowDown, SkipForward, RefreshCw, Search, X, Clock, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useToast } from '../components/Toast';

export default function NewWorkout() {
  const { db, saveWorkoutSession } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [setsData, setSetsData] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('workoutSetsData')) || {}; } catch { return {}; }
  });
  const [workoutComment, setWorkoutComment] = useState(
    () => sessionStorage.getItem('workoutComment') || ''
  );
  const workoutStartTime = useRef(() => {
    const stored = sessionStorage.getItem('workoutStartTime');
    if (stored) return parseInt(stored);
    const now = Date.now();
    sessionStorage.setItem('workoutStartTime', now);
    return now;
  });
  // Initialize the ref value (lazy init)
  if (typeof workoutStartTime.current === 'function') {
    workoutStartTime.current = workoutStartTime.current();
  }
  const [elapsedSeconds, setElapsedSeconds] = useState(
    () => Math.floor((Date.now() - (parseInt(sessionStorage.getItem('workoutStartTime')) || Date.now())) / 1000)
  );

  // Parse workout ID from URL or default to first
  const queryParams = new URLSearchParams(location.search);
  const workoutId = queryParams.get('id') || (db.workouts && db.workouts.length > 0 ? db.workouts[0].id : null);
  const currentWorkout = db.workouts?.find(w => w.id === workoutId);
  const phase = currentWorkout ? db.phases?.find(p => p.id === currentWorkout.phaseId) : null;

  // ─── Exercise flexibility state ───────────────────────
  const baseExercises = useMemo(() => {
    return currentWorkout?.exercises?.map(ex => {
      const fullEx = db.exercises[ex.exerciseId];
      return {
        ...ex,
        id: ex.exerciseId,
        name: fullEx ? fullEx.name : ex.exerciseId
      };
    }) || [];
  }, [currentWorkout, db.exercises]);

  const [exerciseOrder, setExerciseOrder] = useState(() => baseExercises.map(ex => ex.id));
  const [skippedExercises, setSkippedExercises] = useState(new Set());
  const [swappedExercises, setSwappedExercises] = useState({}); // { originalId: newExerciseId }
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSearch, setSwapSearch] = useState('');

  // Sync exerciseOrder when baseExercises changes (e.g. on first load)
  useEffect(() => {
    if (baseExercises.length > 0 && exerciseOrder.length === 0) {
      setExerciseOrder(baseExercises.map(ex => ex.id));
    }
  }, [baseExercises]);

  // Workout elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - workoutStartTime.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Persist setsData and comments to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('workoutSetsData', JSON.stringify(setsData));
  }, [setsData]);
  useEffect(() => {
    sessionStorage.setItem('workoutComment', workoutComment);
  }, [workoutComment]);

  // Clear sessionStorage when leaving the workout page
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('workoutStartTime');
      sessionStorage.removeItem('workoutSetsData');
      sessionStorage.removeItem('workoutComment');
    };
  }, []);

  // Build the active exercise list using order + skips + swaps
  const exercises = useMemo(() => {
    return exerciseOrder.map(exId => {
      const swappedId = swappedExercises[exId];
      const effectiveId = swappedId || exId;
      const baseEx = baseExercises.find(e => e.id === exId);
      const fullEx = db.exercises[effectiveId];
      
      return {
        ...(baseEx || {}),
        id: effectiveId,
        originalId: exId,
        name: fullEx ? fullEx.name : effectiveId,
        isSkipped: skippedExercises.has(exId),
        isSwapped: !!swappedId
      };
    });
  }, [exerciseOrder, skippedExercises, swappedExercises, baseExercises, db.exercises]);

  if (!currentWorkout) {
    return (
      <div className="flex items-center justify-center p-6 min-h-screen text-center">
        <div className="text-muted">Workout not found. Please select a valid workout from the dashboard.</div>
      </div>
    );
  }

  const exercise = exercises[activeExerciseIndex];
  
  // Initialize sets based on targetSets, populated with history if available
  const currentSets = (exercise && setsData[exercise.id]) || Array.from({ length: exercise?.targetSets || 1 }, (_, i) => {
    const historicalSet = exercise?.history && exercise.history[i];
    return {
      id: i + 1,
      reps: historicalSet ? historicalSet.reps : '',
      weight: historicalSet ? historicalSet.weight : '',
      completed: false
    };
  });

  const [restTimer, setRestTimer] = useState(null);
  
  // Handle timer tick
  useEffect(() => {
    let interval;
    if (restTimer !== null && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer(prev => prev - 1);
      }, 1000);
    } else if (restTimer === 0) {
      // Vibrate + beep when timer finishes
      try {
        navigator.vibrate?.([200, 100, 200]);
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        setTimeout(() => { osc.stop(); audioCtx.close(); }, 300);
      } catch (e) { /* audio not available */ }
      setRestTimer(null);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [restTimer]);

  // Exit confirmation when workout has data
  const hasData = Object.keys(setsData).length > 0;
  useEffect(() => {
    if (!hasData) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasData]);

  const addSet = () => {
    setSetsData({
      ...setsData,
      [exercise.id]: [...currentSets, { id: currentSets.length + 1, reps: '', weight: '', completed: false }]
    });
  };

  const updateSet = (setId, field, value) => {
    setSetsData({
      ...setsData,
      [exercise.id]: currentSets.map(s => s.id === setId ? { ...s, [field]: value } : s)
    });
  };

  const toggleSetComplete = (setId) => {
    const set = currentSets.find(s => s.id === setId);
    const isNowComplete = !set.completed;
    
    setSetsData({
      ...setsData,
      [exercise.id]: currentSets.map(s => s.id === setId ? { ...s, completed: isNowComplete } : s)
    });

    if (isNowComplete) {
      setRestTimer(90);
    } else {
      setRestTimer(null);
    }
  };

  // ─── Reorder ──────────────────────────────────────────
  const moveExercise = (direction) => {
    const newOrder = [...exerciseOrder];
    const targetIdx = activeExerciseIndex + direction;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    [newOrder[activeExerciseIndex], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[activeExerciseIndex]];
    setExerciseOrder(newOrder);
    setActiveExerciseIndex(targetIdx);
  };

  // ─── Skip ─────────────────────────────────────────────
  const toggleSkip = (originalId) => {
    setSkippedExercises(prev => {
      const next = new Set(prev);
      if (next.has(originalId)) {
        next.delete(originalId);
      } else {
        next.add(originalId);
      }
      return next;
    });
  };

  // ─── Swap ─────────────────────────────────────────────
  const allExercisesList = useMemo(() => {
    return Object.values(db.exercises || {}).sort((a, b) => a.name.localeCompare(b.name));
  }, [db.exercises]);

  const filteredExercises = useMemo(() => {
    if (!swapSearch.trim()) return allExercisesList;
    const q = swapSearch.toLowerCase();
    return allExercisesList.filter(ex => ex.name.toLowerCase().includes(q));
  }, [allExercisesList, swapSearch]);

  const handleSwap = (newExerciseId) => {
    const originalId = exercise.originalId || exercise.id;
    setSwappedExercises(prev => ({ ...prev, [originalId]: newExerciseId }));
    setShowSwapModal(false);
    setSwapSearch('');
  };

  const undoSwap = () => {
    const originalId = exercise.originalId || exercise.id;
    setSwappedExercises(prev => {
      const next = { ...prev };
      delete next[originalId];
      return next;
    });
  };

  // ─── Navigation ───────────────────────────────────────
  const activeExercises = exercises.filter(ex => !ex.isSkipped);
  const isLastExercise = activeExerciseIndex === exercises.length - 1;

  const nextExercise = () => {
    // Skip to next non-skipped exercise
    for (let i = activeExerciseIndex + 1; i < exercises.length; i++) {
      if (!exercises[i].isSkipped) {
        setActiveExerciseIndex(i);
        return;
      }
    }
  };
  
  const finishWorkout = async () => {
    try {
      const finalSetsData = {};
      for (const ex of exercises) {
        if (ex.isSkipped) continue;
        const sets = setsData[ex.id];
        if (sets && sets.length > 0) {
          finalSetsData[ex.id] = sets;
        }
      }
      await saveWorkoutSession(currentWorkout.id, finalSetsData, workoutComment, null, null, Math.round(elapsedSeconds / 60));
      sessionStorage.removeItem('workoutStartTime');
      sessionStorage.removeItem('workoutSetsData');
      sessionStorage.removeItem('workoutComment');
      toast.success('Workout saved!');
      navigate('/');
    } catch (err) {
      console.error("Failed to save workout:", err);
      toast.error('Failed to save workout. Check console logs.');
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '60px' }}>
      <header className="flex justify-between items-center mb-6">
        <button className="btn btn-icon" onClick={() => navigate('/')}>
          <ChevronLeft size={24} />
        </button>
        <div className="text-center">
          <div className="text-xs text-secondary">{phase?.name}</div>
          <div className="font-bold">{currentWorkout.name}</div>
          <div className="flex items-center justify-center gap-1 text-xs text-muted mt-1">
            <Clock size={12} />
            {Math.floor(elapsedSeconds / 3600) > 0 && `${Math.floor(elapsedSeconds / 3600)}:`}
            {String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
          </div>
        </div>
        <button className="btn btn-secondary text-sm" style={{ padding: '6px 12px' }} onClick={() => {
          if (!hasData || window.confirm('Discard this workout?')) navigate('/');
        }}>
          <X size={16} /> Cancel
        </button>
      </header>
      
      {/* Rest Timer Banner */}
      {restTimer && restTimer > 0 && (
        <div className="glass mb-4 p-3 rounded flex justify-between items-center" style={{ border: '1px solid var(--accent-primary)' }}>
          <div className="flex items-center gap-2">
            <div className="h3 mb-0" style={{ color: 'var(--accent-primary)', marginBottom: 0 }}>{formatTime(restTimer)}</div>
            <span className="text-sm font-medium">Rest Timer</span>
          </div>
          <button className="btn btn-secondary text-xs" style={{ padding: '4px 8px' }} onClick={() => setRestTimer(null)}>
            Skip
          </button>
        </div>
      )}

      {/* Progress Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {exercises.map((ex, idx) => {
          const words = (ex.name || '').split(' ');
          const shortName = words.length > 2 ? `${words[0]} ${words[1]}` : ex.name;

          return (
            <div 
              key={ex.originalId || ex.id}
              onClick={() => setActiveExerciseIndex(idx)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                opacity: ex.isSkipped ? 0.4 : 1,
                textDecoration: ex.isSkipped ? 'line-through' : 'none',
                background: idx === activeExerciseIndex 
                  ? 'var(--gradient-main)' 
                  : ex.isSwapped 
                    ? 'rgba(245, 158, 11, 0.15)' 
                    : 'var(--surface-color)',
                color: idx === activeExerciseIndex ? 'white' : ex.isSwapped ? 'var(--warning)' : 'var(--text-secondary)',
                border: `1px solid ${idx === activeExerciseIndex ? 'transparent' : ex.isSwapped ? 'rgba(245, 158, 11, 0.3)' : 'var(--surface-border)'}`
              }}
            >
              {shortName}
            </div>
          );
        })}
      </div>

      {/* Exercise Card */}
      {exercise && !exercise.isSkipped ? (
        <div className="card glass mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="badge">Target: {exercise.targetSets || '?'}x{exercise.targetReps || '?'}</span>
                {exercise.isSwapped && (
                  <button className="text-[10px] text-warning cursor-pointer" onClick={undoSwap} style={{ background: 'none', border: 'none' }}>
                    undo swap
                  </button>
                )}
              </div>
              <h2 className="h2" style={{ marginBottom: 0 }}>{exercise.name}</h2>
            </div>
            {/* Reorder + Action Buttons */}
            <div className="flex flex-col gap-1 ml-2">
              <button 
                className="btn-icon text-secondary" 
                style={{ background: 'var(--surface-hover)', padding: '4px' }}
                onClick={() => moveExercise(-1)}
                disabled={activeExerciseIndex === 0}
                title="Move up"
              >
                <ArrowUp size={16} />
              </button>
              <button 
                className="btn-icon text-secondary" 
                style={{ background: 'var(--surface-hover)', padding: '4px' }}
                onClick={() => moveExercise(1)}
                disabled={activeExerciseIndex === exercises.length - 1}
                title="Move down"
              >
                <ArrowDown size={16} />
              </button>
            </div>
          </div>

          {/* Column Headers */}
          <div className="flex justify-between text-xs text-secondary font-medium mb-2 px-2">
            <div style={{ width: '40px' }}>SET</div>
            <div className="flex-1 text-center">PREV</div>
            <div className="flex-1 text-center">KG</div>
            <div className="flex-1 text-center">REPS</div>
            <div style={{ width: '40px', textAlign: 'center' }}>DONE</div>
          </div>

          {/* Sets List */}
          <div className="flex-col gap-2">
            {currentSets.map((set, i) => {
              const historySet = exercise.history && exercise.history[i];
              return (
              <div 
                key={set.id}
                className="flex justify-between items-center p-2 rounded"
                style={{ 
                  background: set.completed ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-color)',
                  border: `1px solid ${set.completed ? 'var(--success)' : 'var(--surface-border)'}`,
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ width: '40px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {i + 1}
                </div>
                <div className="flex-1 px-1 text-center text-xs text-muted font-medium flex-col justify-center gap-1" style={{ display: 'flex' }}>
                  {historySet ? `${historySet.weight}kg x ${historySet.reps}` : '-'}
                </div>
                <div className="flex-1 px-1">
                  <input 
                    type="number"  
                    placeholder="-"
                    className="w-full text-center"
                    style={{ width: '100%', background: 'transparent', border: 'none', fontSize: '1.25rem', fontWeight: 600, padding: 0 }}
                    value={set.weight}
                    step="0.5"
                    onChange={e => updateSet(set.id, 'weight', e.target.value)}
                    readOnly={set.completed}
                  />
                </div>
                <div className="flex-1 px-1">
                  <input 
                    type="number" 
                    placeholder="-"
                    className="w-full text-center"
                    style={{ width: '100%', background: 'transparent', border: 'none', fontSize: '1.25rem', fontWeight: 600, padding: 0 }}
                    value={set.reps}
                    onChange={e => updateSet(set.id, 'reps', e.target.value)}
                    readOnly={set.completed}
                  />
                </div>
                <div style={{ width: '40px', display: 'flex', justifyContent: 'center' }}>
                  <button 
                    className={`btn-icon ${set.completed ? 'text-white' : 'text-secondary'}`}
                    style={{ background: set.completed ? 'var(--success)' : 'var(--surface-hover)' }}
                    onClick={() => toggleSetComplete(set.id)}
                  >
                    <Check size={20} />
                  </button>
                </div>
              </div>
              );
            })}
          </div>

          {/* Workout comment */}
          <textarea
            className="w-full text-sm"
            style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', resize: 'none', minHeight: '40px', maxHeight: '120px', lineHeight: 1.4, outline: 'none', marginTop: '16px', width: '100%', boxSizing: 'border-box' }}
            placeholder="Workout notes..."
            value={workoutComment}
            onChange={e => setWorkoutComment(e.target.value)}
            rows={2}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
          />

          {/* Action Buttons: Add Set | Skip | Swap */}
          <div className="flex gap-2 mt-4">
            <button className="btn btn-secondary flex-1 flex items-center justify-center gap-1 text-sm" onClick={addSet}>
              <Plus size={16} /> Add Set
            </button>
            <button 
              className="btn flex items-center justify-center gap-1 text-sm"
              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--danger)', flex: '0 0 auto', padding: '8px 12px' }}
              onClick={() => toggleSkip(exercise.originalId || exercise.id)}
            >
              <SkipForward size={16} /> Skip
            </button>
            <button 
              className="btn flex items-center justify-center gap-1 text-sm"
              style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: 'var(--warning)', flex: '0 0 auto', padding: '8px 12px' }}
              onClick={() => { setSwapSearch(''); setShowSwapModal(true); }}
            >
              <RefreshCw size={16} /> Swap
            </button>
          </div>
        </div>
      ) : exercise?.isSkipped ? (
        <div className="card glass mb-6 text-center p-6">
          <p className="text-muted mb-2">
            <SkipForward size={24} className="mx-auto mb-2" style={{ opacity: 0.5 }} />
            <strong>{exercise.name}</strong> is skipped
          </p>
          <button 
            className="btn btn-secondary text-sm" 
            onClick={() => toggleSkip(exercise.originalId || exercise.id)}
          >
            Undo Skip
          </button>
        </div>
      ) : null}

      {/* Swap Modal */}
      {showSwapModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
        }} onClick={() => setShowSwapModal(false)}>
          <div 
            className="animate-fade-in"
            style={{
              background: 'var(--bg-color)', borderRadius: '16px 16px 0 0',
              width: '100%', maxWidth: '500px', maxHeight: '70vh',
              padding: '16px', display: 'flex', flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="h3 mb-0">Swap Exercise</h3>
              <button className="btn-icon text-secondary" onClick={() => setShowSwapModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-3 px-2 py-2 rounded" style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)' }}>
              <Search size={16} className="text-muted" />
              <input 
                type="text" 
                placeholder="Search exercises..."
                className="w-full"
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.9rem' }}
                value={swapSearch}
                onChange={e => setSwapSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {filteredExercises.map(ex => (
                <button
                  key={ex.id}
                  className="w-full text-left p-3 rounded mb-1 text-sm font-medium"
                  style={{ 
                    background: 'var(--surface-color)', border: '1px solid var(--surface-border)',
                    cursor: 'pointer', display: 'block',
                    color: ex.id === exercise.id ? 'var(--success)' : 'var(--text-primary)'
                  }}
                  onClick={() => handleSwap(ex.id)}
                >
                  {ex.name} {ex.id === exercise.id && '(current)'}
                </button>
              ))}
              {filteredExercises.length === 0 && (
                <p className="text-muted text-sm text-center p-4">No exercises match "{swapSearch}"</p>
              )}
            </div>
          </div>
        </div>
      )}



      <button 
        className="btn btn-primary btn-block text-center"
        onClick={isLastExercise ? finishWorkout : nextExercise}
      >
        {isLastExercise ? 'Review & Finish' : 'Next Exercise'}
      </button>
    </div>
  );
}
