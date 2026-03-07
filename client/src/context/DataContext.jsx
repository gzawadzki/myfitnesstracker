/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const { data: phasesData, error: phErr } = await supabase.from('phases').select('*').order('order_index');
        if (phErr) throw phErr;

        const { data: workoutsData, error: wErr } = await supabase.from('workout_templates').select('*');
        if (wErr) throw wErr;

        const { data: exercisesData, error: eErr } = await supabase.from('exercises').select('*');
        if (eErr) throw eErr;

        const { data: mappingsData, error: mErr } = await supabase.from('template_exercises').select('*').order('order_index');
        if (mErr) throw mErr;

        const { data: latestSessionsData, error: sessErr } = await supabase.from('workout_sessions').select('*').order('created_at', { ascending: false }).limit(20);
        if (sessErr) throw sessErr;

        const { data: loggedSetsData, error: setsErr } = await supabase.from('logged_sets').select('*').order('created_at');
        if (setsErr) throw setsErr;

        const { data: healthData, error: healthErr } = await supabase.from('health_metrics').select('*').order('date', { ascending: false });
        if (healthErr && healthErr.code !== '42P01') throw healthErr; // Ignore table not found error initially until user runs the SQL

        // Reconstruct the `db` structure to match what the UI expects
        const mappedDb = {
          sessions: latestSessionsData.map(session => ({
            ...session,
            sets: loggedSetsData.filter(set => set.session_id === session.id)
          })),
          healthMetrics: healthData || [],
          phases: phasesData,
          workouts: workoutsData.map(w => ({
            ...w,
            phaseId: w.phase_id,
            exercises: mappingsData.filter(m => m.workout_id === w.id).map(m => {
              // Extract history from loggedSets for this template -> exercise
              const relevantSessions = latestSessionsData.filter(s => s.template_id === w.id);
              const history = [];
              if (relevantSessions.length > 0) {
                // Find nearest previous session
                const lastSessionId = relevantSessions[0].id;
                const lastSessionSets = loggedSetsData.filter(set => set.session_id === lastSessionId && set.exercise_id === m.exercise_id);
                // Create a history array
                lastSessionSets.forEach(set => {
                  history.push({ reps: set.reps, weight: set.weight });
                });
              }
              
              // Find all historical data for analytics (Progress charts want every previous session)
              // For now, attach full history to the exercise globally so Progress can read it
              return {
                exerciseId: m.exercise_id,
                targetSets: m.target_sets,
                targetReps: m.target_reps,
                history: history
              };
            })
          })),
          exercises: exercisesData.reduce((acc, ex) => {
            acc[ex.id] = { id: ex.id, name: ex.name };
            return acc;
          }, {})
        };

        // Inject the full history across all sessions for the Progress Chart 
        // We look at all past sets for a specific exercise and average/max them out per session
        latestSessionsData.reverse().forEach((sess) => {
          const sessSets = loggedSetsData.filter(s => s.session_id === sess.id);
          const exIdsInSession = [...new Set(sessSets.map(s => s.exercise_id))];
          
          exIdsInSession.forEach(exId => {
            const exSets = sessSets.filter(s => s.exercise_id === exId);
            const maxWeight = Math.max(...exSets.map(s => Number(s.weight)));
            const avgReps = Math.round(exSets.reduce((sum, s) => sum + Number(s.reps), 0) / exSets.length);
            
            if(!mappedDb.exercises[exId].history) mappedDb.exercises[exId].history = [];
            
            // Add a history point if valid
            if (maxWeight > 0) {
              mappedDb.exercises[exId].history.push({
                weight: maxWeight,
                reps: avgReps
              });
            }
          });
        });

        setDb(mappedDb);
      } catch (err) {
        console.error("Error loading Supabase data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
     
  }, []);

  const saveWorkoutSession = async (templateId, setsData, notes, sleep, steps) => {
    // Insert session
    const { data: sessionData, error: sessErr } = await supabase.from('workout_sessions').insert([{
      template_id: templateId,
      notes: notes,
      health_sleep_hours: sleep,
      health_steps: steps
    }]).select().single();

    if (sessErr) throw sessErr;

    // Insert sets
    const setsToInsert = [];
    Object.keys(setsData).forEach(exId => {
      setsData[exId].forEach(set => {
        setsToInsert.push({
          session_id: sessionData.id,
          exercise_id: exId,
          set_number: set.id,
          reps: Number(set.reps) || 0,
          weight: Number(set.weight) || 0,
          completed: set.completed
        });
      });
    });

    if(setsToInsert.length > 0){
      const { error: setsErr } = await supabase.from('logged_sets').insert(setsToInsert);
      if (setsErr) throw setsErr;
    }

    // Update local context so the new session is immediately visible in the WorkoutLog
    setDb(prev => ({
      ...prev,
      sessions: [{ ...sessionData, sets: setsToInsert }, ...(prev.sessions || [])]
    }));

    return true;
  };

  const saveDailyHealthMetric = async (dateStr, type, value) => {
    // type is 'sleep_hours' or 'steps'
    const updatePayload = { date: dateStr };
    updatePayload[type] = value;

    const { data, error } = await supabase
      .from('health_metrics')
      .upsert(updatePayload, { onConflict: 'user_id, date' })
      .select()
      .single();

    if (error) throw error;

    // Update local context
    setDb(prev => {
      const existingIdx = prev.healthMetrics.findIndex(h => h.date === dateStr);
      const newHealth = [...prev.healthMetrics];
      if (existingIdx >= 0) {
        newHealth[existingIdx] = { ...newHealth[existingIdx], ...data };
      } else {
        newHealth.unshift(data);
      }
      return { ...prev, healthMetrics: newHealth.sort((a,b) => new Date(b.date) - new Date(a.date)) };
    });

    return data;
  };

  return (
    <DataContext.Provider value={{ db, loading, error, saveWorkoutSession, saveDailyHealthMetric }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
