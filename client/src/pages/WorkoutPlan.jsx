import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, Edit3, Check, X, ArrowUp, ArrowDown, GripVertical, Dumbbell, Save, ClipboardList } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import ExercisePicker from '../components/ExercisePicker';

export default function WorkoutPlan() {
  const { db, savePhase, deletePhase, saveWorkoutTemplate, deleteWorkoutTemplate, saveTemplateExercises, createExercise } = useData();
  const toast = useToast();
  const navigate = useNavigate();

  // ─── State ─────────────────────────────────────────────
  const [selectedPhaseId, setSelectedPhaseId] = useState(() => db.phases?.[0]?.id || null);
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);

  // Phase editing
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [editingPhaseId, setEditingPhaseId] = useState(null);
  const [editPhaseName, setEditPhaseName] = useState('');

  // Workout editing
  const [showAddWorkout, setShowAddWorkout] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState('');
  const [editingWorkoutNameId, setEditingWorkoutNameId] = useState(null);
  const [editWorkoutName, setEditWorkoutName] = useState('');

  // Exercise editing for a workout
  const [workoutExercises, setWorkoutExercises] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Confirm modals
  const [confirmDelete, setConfirmDelete] = useState(null); // { type, id, name }
  const [saving, setSaving] = useState(false);

  // ─── Derived Data ──────────────────────────────────────
  const phases = db.phases || [];
  const selectedPhase = phases.find(p => p.id === selectedPhaseId);
  const phaseWorkouts = useMemo(() =>
    (db.workouts || []).filter(w => w.phaseId === selectedPhaseId),
    [db.workouts, selectedPhaseId]
  );
  const editingWorkout = editingWorkoutId ? (db.workouts || []).find(w => w.id === editingWorkoutId) : null;
  const allExercises = useMemo(() =>
    Object.values(db.exercises || {}).sort((a, b) => a.name.localeCompare(b.name)),
    [db.exercises]
  );

  // ─── Phase Actions ─────────────────────────────────────
  const handleAddPhase = async () => {
    const name = newPhaseName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const id = await savePhase(null, name, phases.length);
      setSelectedPhaseId(id);
      setNewPhaseName('');
      setShowAddPhase(false);
      toast.success(`Phase "${name}" created`);
    } catch (err) {
      toast.error('Failed to create phase: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRenamePhase = async () => {
    const name = editPhaseName.trim();
    if (!name || !editingPhaseId) return;
    setSaving(true);
    try {
      const phase = phases.find(p => p.id === editingPhaseId);
      await savePhase(editingPhaseId, name, phase?.order_index ?? 0);
      setEditingPhaseId(null);
      toast.success('Phase renamed');
    } catch (err) {
      toast.error('Failed to rename phase: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePhase = async () => {
    if (!confirmDelete || confirmDelete.type !== 'phase') return;
    setSaving(true);
    try {
      await deletePhase(confirmDelete.id);
      if (selectedPhaseId === confirmDelete.id) {
        setSelectedPhaseId(phases.find(p => p.id !== confirmDelete.id)?.id || null);
      }
      toast.success(`Phase "${confirmDelete.name}" deleted`);
    } catch (err) {
      toast.error('Failed to delete phase: ' + err.message);
    } finally {
      setSaving(false);
      setConfirmDelete(null);
    }
  };

  // ─── Workout Actions ───────────────────────────────────
  const handleAddWorkout = async () => {
    const name = newWorkoutName.trim();
    if (!name || !selectedPhaseId) return;
    setSaving(true);
    try {
      await saveWorkoutTemplate(null, selectedPhaseId, name);
      setNewWorkoutName('');
      setShowAddWorkout(false);
      toast.success(`Workout "${name}" created`);
    } catch (err) {
      toast.error('Failed to create workout: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRenameWorkout = async () => {
    const name = editWorkoutName.trim();
    if (!name || !editingWorkoutNameId) return;
    setSaving(true);
    try {
      const w = (db.workouts || []).find(w => w.id === editingWorkoutNameId);
      await saveWorkoutTemplate(editingWorkoutNameId, w?.phaseId || selectedPhaseId, name);
      setEditingWorkoutNameId(null);
      toast.success('Workout renamed');
    } catch (err) {
      toast.error('Failed to rename workout: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkout = async () => {
    if (!confirmDelete || confirmDelete.type !== 'workout') return;
    setSaving(true);
    try {
      if (editingWorkoutId === confirmDelete.id) {
        setEditingWorkoutId(null);
      }
      await deleteWorkoutTemplate(confirmDelete.id);
      toast.success(`Workout "${confirmDelete.name}" deleted`);
    } catch (err) {
      toast.error('Failed to delete workout: ' + err.message);
    } finally {
      setSaving(false);
      setConfirmDelete(null);
    }
  };

  // ─── Exercise Editor ───────────────────────────────────
  const openExerciseEditor = (workout) => {
    setEditingWorkoutId(workout.id);
    setWorkoutExercises(
      (workout.exercises || []).map(ex => ({
        exerciseId: ex.exerciseId,
        targetSets: ex.targetSets || 3,
        targetReps: ex.targetReps || '8-12'
      }))
    );
    setHasUnsavedChanges(false);
  };

  const closeExerciseEditor = () => {
    setEditingWorkoutId(null);
    setWorkoutExercises([]);
    setHasUnsavedChanges(false);
  };

  const addExerciseToWorkout = (exerciseId) => {
    if (!exerciseId) return;
    if (workoutExercises.some(e => e.exerciseId === exerciseId)) {
      toast.error('Exercise already added');
      return;
    }
    setWorkoutExercises(prev => [...prev, { exerciseId, targetSets: 3, targetReps: '8-12' }]);
    setHasUnsavedChanges(true);
  };

  const removeExercise = (idx) => {
    setWorkoutExercises(prev => prev.filter((_, i) => i !== idx));
    setHasUnsavedChanges(true);
  };

  const updateExercise = (idx, field, value) => {
    setWorkoutExercises(prev => prev.map((ex, i) => i === idx ? { ...ex, [field]: value } : ex));
    setHasUnsavedChanges(true);
  };

  const moveExerciseInEditor = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= workoutExercises.length) return;
    const newList = [...workoutExercises];
    [newList[idx], newList[newIdx]] = [newList[newIdx], newList[idx]];
    setWorkoutExercises(newList);
    setHasUnsavedChanges(true);
  };

  const handleSaveExercises = async () => {
    if (!editingWorkoutId) return;
    setSaving(true);
    try {
      await saveTemplateExercises(editingWorkoutId, workoutExercises);
      setHasUnsavedChanges(false);
      toast.success('Exercises saved');
    } catch (err) {
      toast.error('Failed to save exercises: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Exercise Detail View (Level 2) ───────────────────
  if (editingWorkout) {
    return (
      <div className="animate-fade-in" style={{ paddingBottom: '60px' }}>
        <header className="flex justify-between items-center mb-6">
          <button className="btn btn-icon" onClick={closeExerciseEditor}>
            <ChevronLeft size={24} />
          </button>
          <div className="text-center flex-1">
            <div className="text-xs text-secondary">{selectedPhase?.name}</div>
            <div className="font-bold">{editingWorkout.name}</div>
          </div>
          <button
            className="btn btn-primary text-sm flex items-center gap-1"
            style={{ padding: '8px 16px', opacity: hasUnsavedChanges ? 1 : 0.5 }}
            onClick={handleSaveExercises}
            disabled={saving || !hasUnsavedChanges}
          >
            <Save size={16} /> Save
          </button>
        </header>

        {/* Exercise List */}
        <div className="flex-col gap-3 mb-4">
          {workoutExercises.length === 0 && (
            <div className="card glass text-center p-6">
              <Dumbbell size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p className="text-muted text-sm">No exercises yet. Add your first exercise below.</p>
            </div>
          )}
          {workoutExercises.map((ex, idx) => {
            const fullEx = db.exercises[ex.exerciseId];
            return (
              <div key={`${ex.exerciseId}-${idx}`} className="card glass" style={{ padding: '12px 16px' }}>
                <div className="flex items-center gap-3">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-1" style={{ flexShrink: 0 }}>
                    <button
                      className="btn-icon text-secondary"
                      style={{ background: 'var(--surface-hover)', padding: '2px', borderRadius: '4px' }}
                      onClick={() => moveExerciseInEditor(idx, -1)}
                      disabled={idx === 0}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      className="btn-icon text-secondary"
                      style={{ background: 'var(--surface-hover)', padding: '2px', borderRadius: '4px' }}
                      onClick={() => moveExerciseInEditor(idx, 1)}
                      disabled={idx === workoutExercises.length - 1}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>

                  {/* Exercise info */}
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="font-medium text-sm mb-2" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {fullEx?.name || ex.exerciseId}
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>Sets</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={ex.targetSets}
                          onChange={e => updateExercise(idx, 'targetSets', parseInt(e.target.value) || 1)}
                          style={{
                            width: '48px', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600,
                            padding: '4px', background: 'var(--surface-color)', border: '1px solid var(--surface-border)',
                            borderRadius: '6px'
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>Reps</label>
                        <input
                          type="text"
                          value={ex.targetReps}
                          onChange={e => updateExercise(idx, 'targetReps', e.target.value)}
                          placeholder="8-12"
                          style={{
                            width: '64px', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600,
                            padding: '4px', background: 'var(--surface-color)', border: '1px solid var(--surface-border)',
                            borderRadius: '6px'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Remove button */}
                  <button
                    className="btn-icon"
                    style={{ color: 'var(--danger)', padding: '6px', flexShrink: 0 }}
                    onClick={() => removeExercise(idx)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Exercise */}
        <div className="card" style={{ padding: '12px 16px' }}>
          <div className="text-xs text-secondary font-medium mb-2">Add Exercise</div>
          <ExercisePicker
            exercises={allExercises}
            selectedExerciseId={null}
            onSelect={(id) => { if (id) addExerciseToWorkout(id); }}
            placeholder="Search & add exercise..."
            title="Add exercise to workout"
          />
        </div>

        {/* Delete Workout */}
        <button
          className="btn btn-block mt-6 text-sm flex items-center justify-center gap-2"
          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--danger)', padding: '12px' }}
          onClick={() => setConfirmDelete({ type: 'workout', id: editingWorkout.id, name: editingWorkout.name })}
        >
          <Trash2 size={16} /> Delete Workout
        </button>

        <ConfirmModal
          open={!!confirmDelete}
          title={`Delete ${confirmDelete?.type === 'workout' ? 'workout' : 'phase'}?`}
          message={`"${confirmDelete?.name}" and all its data will be permanently deleted.`}
          confirmLabel="Delete"
          variant="warning"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDelete?.type === 'workout' ? handleDeleteWorkout : handleDeletePhase}
        />
      </div>
    );
  }

  // ─── Level 1: Phase & Workout List ─────────────────────
  return (
    <div className="animate-fade-in" style={{ paddingBottom: '60px' }}>
      <header className="mb-6">
        <h1 className="h1 mb-1">Workout Plan</h1>
        <p className="text-secondary">Manage your training phases and workouts.</p>
      </header>

      {/* Phase Tabs */}
      <div className="flex gap-2 mb-6 items-center" style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        {phases.map((phase) => (
          <div
            key={phase.id}
            className="flex items-center gap-1"
            style={{ flexShrink: 0 }}
          >
            {editingPhaseId === phase.id ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editPhaseName}
                  onChange={e => setEditPhaseName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRenamePhase(); if (e.key === 'Escape') setEditingPhaseId(null); }}
                  autoFocus
                  style={{
                    padding: '6px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.875rem',
                    fontWeight: 500, background: 'var(--surface-color)', border: '1px solid var(--accent-primary)',
                    width: '140px'
                  }}
                />
                <button className="btn-icon" style={{ color: 'var(--success)', padding: '4px' }} onClick={handleRenamePhase}><Check size={16} /></button>
                <button className="btn-icon" style={{ color: 'var(--text-muted)', padding: '4px' }} onClick={() => setEditingPhaseId(null)}><X size={16} /></button>
              </div>
            ) : (
              <div
                onClick={() => setSelectedPhaseId(phase.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)', fontSize: '0.875rem', fontWeight: 500,
                  cursor: 'pointer',
                  background: phase.id === selectedPhaseId ? 'var(--gradient-main)' : 'var(--surface-color)',
                  color: phase.id === selectedPhaseId ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${phase.id === selectedPhaseId ? 'transparent' : 'var(--surface-border)'}`,
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <span>{phase.name}</span>
                {phase.id === selectedPhaseId && (
                  <div className="flex items-center gap-0" style={{ marginLeft: '4px' }}>
                    <button
                      className="btn-icon"
                      style={{ padding: '2px', color: 'rgba(255,255,255,0.7)' }}
                      onClick={(e) => { e.stopPropagation(); setEditingPhaseId(phase.id); setEditPhaseName(phase.name); }}
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      className="btn-icon"
                      style={{ padding: '2px', color: 'rgba(255,255,255,0.7)' }}
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'phase', id: phase.id, name: phase.name }); }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add Phase Button / Input */}
        {showAddPhase ? (
          <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Phase name..."
              value={newPhaseName}
              onChange={e => setNewPhaseName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddPhase(); if (e.key === 'Escape') { setShowAddPhase(false); setNewPhaseName(''); } }}
              autoFocus
              style={{
                padding: '6px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.875rem',
                fontWeight: 500, background: 'var(--surface-color)', border: '1px solid var(--accent-primary)',
                width: '140px'
              }}
            />
            <button className="btn-icon" style={{ color: 'var(--success)', padding: '4px' }} onClick={handleAddPhase} disabled={saving}><Check size={16} /></button>
            <button className="btn-icon" style={{ color: 'var(--text-muted)', padding: '4px' }} onClick={() => { setShowAddPhase(false); setNewPhaseName(''); }}><X size={16} /></button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddPhase(true)}
            style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.875rem',
              fontWeight: 500, cursor: 'pointer', border: '1px dashed var(--surface-border)',
              background: 'transparent', color: 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <Plus size={14} /> Add Phase
          </button>
        )}
      </div>

      {/* Empty state */}
      {phases.length === 0 && (
        <div className="card glass text-center p-6">
          <ClipboardList size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <h3 className="h3 mb-2">No phases yet</h3>
          <p className="text-sm text-secondary mb-4">Create your first training phase to get started.</p>
          <button className="btn btn-primary" onClick={() => setShowAddPhase(true)}>
            <Plus size={18} /> Create Phase
          </button>
        </div>
      )}

      {/* Workouts in selected phase */}
      {selectedPhase && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="h3 mb-0">{selectedPhase.name}</h2>
            <span className="badge">{phaseWorkouts.length} workout{phaseWorkouts.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="flex-col gap-3">
            {phaseWorkouts.map(workout => (
              <div key={workout.id} className="card glass" style={{ padding: '14px 16px' }}>
                {editingWorkoutNameId === workout.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editWorkoutName}
                      onChange={e => setEditWorkoutName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameWorkout(); if (e.key === 'Escape') setEditingWorkoutNameId(null); }}
                      autoFocus
                      style={{
                        flex: 1, padding: '6px 10px', fontSize: '0.875rem',
                        fontWeight: 600, background: 'var(--surface-color)',
                        border: '1px solid var(--accent-primary)', borderRadius: '8px'
                      }}
                    />
                    <button className="btn-icon" style={{ color: 'var(--success)', padding: '4px' }} onClick={handleRenameWorkout}><Check size={16} /></button>
                    <button className="btn-icon" style={{ color: 'var(--text-muted)', padding: '4px' }} onClick={() => setEditingWorkoutNameId(null)}><X size={16} /></button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => openExerciseEditor(workout)}
                      style={{ cursor: 'pointer' }}
                    >
                      <h3 className="font-semibold text-sm mb-1">{workout.name}</h3>
                      <p className="text-xs text-muted">{workout.exercises?.length || 0} Exercises</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="btn-icon text-secondary"
                        style={{ padding: '6px' }}
                        onClick={() => { setEditingWorkoutNameId(workout.id); setEditWorkoutName(workout.name); }}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        className="btn-icon"
                        style={{ padding: '6px', color: 'var(--danger)' }}
                        onClick={() => setConfirmDelete({ type: 'workout', id: workout.id, name: workout.name })}
                      >
                        <Trash2 size={16} />
                      </button>
                      <button
                        className="btn-icon text-accent-primary"
                        style={{ padding: '6px' }}
                        onClick={() => openExerciseEditor(workout)}
                      >
                        <ChevronLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add Workout */}
            {showAddWorkout ? (
              <div className="card" style={{ padding: '12px 16px' }}>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Workout name..."
                    value={newWorkoutName}
                    onChange={e => setNewWorkoutName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddWorkout(); if (e.key === 'Escape') { setShowAddWorkout(false); setNewWorkoutName(''); } }}
                    autoFocus
                    style={{
                      flex: 1, padding: '8px 12px', fontSize: '0.875rem',
                      fontWeight: 500, background: 'var(--surface-color)',
                      border: '1px solid var(--accent-primary)', borderRadius: '8px'
                    }}
                  />
                  <button className="btn btn-primary text-sm" style={{ padding: '8px 16px' }} onClick={handleAddWorkout} disabled={saving}>
                    <Check size={16} />
                  </button>
                  <button className="btn btn-secondary text-sm" style={{ padding: '8px' }} onClick={() => { setShowAddWorkout(false); setNewWorkoutName(''); }}>
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="card text-center flex items-center justify-center gap-2"
                style={{
                  padding: '16px', cursor: 'pointer',
                  border: '1px dashed var(--surface-border)',
                  background: 'transparent', color: 'var(--accent-primary)',
                  fontSize: '0.875rem', fontWeight: 500
                }}
                onClick={() => setShowAddWorkout(true)}
              >
                <Plus size={18} /> Add Workout
              </button>
            )}
          </div>
        </>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title={`Delete ${confirmDelete?.type}?`}
        message={`"${confirmDelete?.name}" and all its data will be permanently deleted.`}
        confirmLabel="Delete"
        variant="warning"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={confirmDelete?.type === 'workout' ? handleDeleteWorkout : handleDeletePhase}
      />
    </div>
  );
}
