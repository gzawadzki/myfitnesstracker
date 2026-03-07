/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Save, Play, Check } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';

export default function NewWorkout() {
  const { db, saveWorkoutSession } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [setsData, setSetsData] = useState({});
  const [workoutComment, setWorkoutComment] = useState("");

  // Parse workout ID from URL or default to first
  const queryParams = new URLSearchParams(location.search);
  const workoutId = queryParams.get('id') || db.workouts[0].id;
  const currentWorkout = db.workouts.find(w => w.id === workoutId);
  const phase = db.phases.find(p => p.id === currentWorkout.phaseId);

  // Map exercise identifiers to full names
  const exercises = currentWorkout.exercises.map(ex => {
    const fullEx = db.exercises[ex.exerciseId];
    return {
      ...ex,
      id: ex.exerciseId,
      name: fullEx ? fullEx.name : ex.exerciseId
    };
  });

  const exercise = exercises[activeExerciseIndex];
  
  // Initialize sets based on targetSets, populated with history if available
  const currentSets = setsData[exercise.id] || Array.from({ length: exercise.targetSets || 1 }, (_, i) => {
    const historicalSet = exercise.history && exercise.history[i];
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
      setRestTimer(null);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [restTimer]);

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
      // Start 90 second rest timer when a set is completed
      setRestTimer(90);
    } else {
      setRestTimer(null);
    }
  };

  const isLastExercise = activeExerciseIndex === exercises.length - 1;

  const nextExercise = () => {
    if (!isLastExercise) setActiveExerciseIndex(activeExerciseIndex + 1);
  };
  
  const finishWorkout = async () => {
    try {
      // For MVP, we pass default Sleep and Steps parameters. 
      // Ideally these would be pulled from a global Health Context or Apple Health module.
      await saveWorkoutSession(currentWorkout.id, setsData, workoutComment, 7.5, 6200);
      navigate('/');
    } catch (err) {
      console.error("Failed to save workout:", err);
      alert("Failed to save workout to Supabase. Check console logs.");
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
          <div className="text-xs text-secondary">{phase.name}</div>
          <div className="font-bold">{currentWorkout.name}</div>
        </div>
        <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={finishWorkout}>
          <Save size={16} /> Finish
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
          // Shorten the name so it fits better on small screens (e.g., "Barbell Back Squat" -> "Barbell Back")
          const words = ex.name.split(' ');
          const shortName = words.length > 2 ? `${words[0]} ${words[1]}` : ex.name;

          return (
            <div 
              key={ex.id}
              onClick={() => setActiveExerciseIndex(idx)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                background: idx === activeExerciseIndex ? 'var(--gradient-main)' : 'var(--surface-color)',
                color: idx === activeExerciseIndex ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${idx === activeExerciseIndex ? 'transparent' : 'var(--surface-border)'}`
              }}
            >
              {shortName}
            </div>
          );
        })}
      </div>

      <div className="card glass mb-6">
        <div className="flex justify-between items-end mb-4">
          <div>
            <span className="badge mb-2">Target: {exercise.targetSets}x{exercise.targetReps}</span>
            <h2 className="h2" style={{ marginBottom: 0 }}>{exercise.name}</h2>
          </div>
          <button className="btn btn-icon" style={{ background: 'var(--surface-hover)' }}>
            <Play size={20} />
          </button>
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

        <button  
          className="btn btn-secondary btn-block mt-4 flex items-center justify-center gap-2"
          onClick={addSet}
        >
          <Plus size={18} /> Add Set
        </button>
      </div>

      {isLastExercise && (
        <div className="mb-6">
          <label className="text-secondary text-sm font-medium mb-2 block">Workout Comments</label>
          <textarea
            className="w-full"
            style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
            placeholder="How did this session feel? Note any adjustments for next week."
            value={workoutComment}
            onChange={(e) => setWorkoutComment(e.target.value)}
          ></textarea>
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
