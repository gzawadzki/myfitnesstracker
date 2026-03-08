/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const DataContext = createContext(null);

const createEmptyDb = () => ({
  sessions: [],
  healthMetrics: [],
  phases: [],
  workouts: [],
  exercises: {}
});

export function DataProvider({ children }) {
  const [db, setDb] = useState(() => {
    const cached = localStorage.getItem('fitnotes_db');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return createEmptyDb();
      }
    }
    return createEmptyDb();
  });
  const [loading, setLoading] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [error, setError] = useState(null);

  // Persist DB to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('fitnotes_db', JSON.stringify(db));
  }, [db]);

  useEffect(() => {
    let isMounted = true;
    let focusDebounce = null;

    async function fetchCatalogData() {
      const { data: phasesData, error: phErr } = await supabase.from('phases').select('*').order('order_index');
      if (phErr) throw phErr;

      const { data: workoutsData, error: wErr } = await supabase.from('workout_templates').select('*');
      if (wErr) throw wErr;

      const { data: exercisesData, error: eErr } = await supabase.from('exercises').select('*');
      if (eErr) throw eErr;

      const { data: mappingsData, error: mErr } = await supabase.from('template_exercises').select('*').order('order_index');
      if (mErr) throw mErr;

      return { phasesData, workoutsData, exercisesData, mappingsData };
    }

    async function fetchWorkoutSessions(userId) {
      const { data: latestSessionsData, error: sessErr } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (sessErr) throw sessErr;

      const sessionIds = latestSessionsData.map(s => s.id);
      let loggedSetsData = [];
      if (sessionIds.length > 0) {
        const { data: setsData, error: setsErr } = await supabase
          .from('logged_sets')
          .select('*')
          .in('session_id', sessionIds)
          .order('created_at');
        if (setsErr) throw setsErr;
        loggedSetsData = setsData || [];
      }

      return { latestSessionsData, loggedSetsData };
    }

    async function fetchHealthMetrics(userId) {
      const { data: healthData, error: healthErr } = await supabase
        .from('health_metrics')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      if (healthErr && !healthErr.message?.includes('schema cache') && healthErr.code !== '42P01') {
        throw healthErr;
      }
      return healthData || [];
    }

    function buildMappedDb(catalog, sessions, healthMetrics) {
      const { phasesData, workoutsData, exercisesData, mappingsData } = catalog;
      const { latestSessionsData, loggedSetsData } = sessions;

      const mappedDb = {
        sessions: latestSessionsData.map(session => ({
          ...session,
          sets: loggedSetsData.filter(set => set.session_id === session.id)
        })),
        healthMetrics,
        phases: phasesData,
        workouts: workoutsData.map(w => ({
          ...w,
          phaseId: w.phase_id,
          exercises: mappingsData.filter(m => m.workout_id === w.id).map(m => {
            const relevantSessions = latestSessionsData.filter(s => s.template_id === w.id);
            const history = [];
            if (relevantSessions.length > 0) {
              const lastSessionId = relevantSessions[0].id;
              const lastSessionSets = loggedSetsData.filter(set => set.session_id === lastSessionId && set.exercise_id === m.exercise_id);
              lastSessionSets.forEach(set => {
                history.push({ reps: set.reps, weight: set.weight });
              });
            }
            return {
              exerciseId: m.exercise_id,
              targetSets: m.target_sets,
              targetReps: m.target_reps,
              history
            };
          })
        })),
        exercises: exercisesData.reduce((acc, ex) => {
          acc[ex.id] = { id: ex.id, name: ex.name };
          return acc;
        }, {})
      };

      latestSessionsData.reverse().forEach((sess) => {
        const sessSets = loggedSetsData.filter(s => s.session_id === sess.id);
        const exIdsInSession = [...new Set(sessSets.map(s => s.exercise_id))];

        exIdsInSession.forEach(exId => {
          // Filter out warmup sets so they don't count towards PRs or working volume history
          const exSets = sessSets.filter(s => s.exercise_id === exId && !s.is_warmup);
          if (exSets.length === 0) return; // Skip if only warmups were logged

          const maxWeight = Math.max(...exSets.map(s => Number(s.weight)));
          const avgReps = Math.round(exSets.reduce((sum, s) => sum + Number(s.reps), 0) / exSets.length);

          if (!mappedDb.exercises[exId]) return;
          if (!mappedDb.exercises[exId].history) mappedDb.exercises[exId].history = [];

          if (maxWeight > 0) {
            mappedDb.exercises[exId].history.push({
              date: sess.created_at,
              weight: maxWeight,
              reps: avgReps
            });
          }
        });
      });

      return mappedDb;
    }

    async function loadData(isBackground = false) {
      try {
        const hasCache = db.sessions.length > 0 || Object.keys(db.exercises).length > 0;

        if (isMounted && !isBackground) {
          setError(null);
          // Only show full loading spinner if we don't have any data yet
          if (!hasCache) {
            setLoading(true);
            setLoadingCatalog(true);
            setLoadingSessions(true);
            setLoadingHealth(true);
          }
        }

        // Get current user session (getSession is local and fast, works offline)
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const userId = currentSession?.user?.id;
        
        if (!userId) {
          // If we have cached data, we might still be "logged in" offline
          const cached = localStorage.getItem('fitnotes_db');
          if (cached && !isBackground) {
             setLoadingCatalog(false);
             setLoadingSessions(false);
             setLoadingHealth(false);
             setLoading(false);
             setAppReady(true);
             return;
          }
          throw new Error("Not logged in");
        }

        const catalogPromise = fetchCatalogData().finally(() => {
          if (isMounted) setLoadingCatalog(false);
        });
        const sessionsPromise = fetchWorkoutSessions(userId).finally(() => {
          if (isMounted) setLoadingSessions(false);
        });
        const healthPromise = fetchHealthMetrics(userId).finally(() => {
          if (isMounted) setLoadingHealth(false);
        });
        const [catalog, sessions, healthMetrics] = await Promise.all([catalogPromise, sessionsPromise, healthPromise]);
        const mappedDb = buildMappedDb(catalog, sessions, healthMetrics);

        if (isMounted) {
          setError(null);
          setDb(mappedDb);
        }
      } catch (err) {
        const msg = (err?.message || "").toLowerCase();
        const errName = (err?.name || "").toLowerCase();
        
        const isNetworkError = 
          msg.includes('fetch') || 
          msg.includes('network') ||
          msg.includes('load failed') ||
          msg.includes('cors') ||
          errName.includes('typeerror') || 
          err?.code === 'PGRST102' ||
          err?.code === 'FETCH_ERROR' ||
          !navigator.onLine;

        console.error("Error loading Supabase data:", err);
        
        if (isMounted) {
          // Robust cache check
          const hasCache = (db.sessions && db.sessions.length > 0) || 
                          (db.exercises && Object.keys(db.exercises).length > 0) || 
                          !!localStorage.getItem('fitnotes_db');
          
          if (isNetworkError && hasCache) {
            console.log("Offline mode: Using cached data due to network error.");
            setError(null);
            // Ensure app is marked as ready even if refresh failed
            setAppReady(true);
            setLoading(false);
            setLoadingCatalog(false);
            setLoadingSessions(false);
            setLoadingHealth(false);
          } else {
            setError(err?.message || "Unknown connection error");
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setAppReady(true);
        }
      }
    }

    loadData();

    // Refresh data when user returns to the tab (background, debounced)
    const handleFocus = () => {
      clearTimeout(focusDebounce);
      focusDebounce = setTimeout(() => loadData(true), 500);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      clearTimeout(focusDebounce);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const saveWorkoutSession = async (templateId, setsData, notes, sleep, steps, durationMinutes) => {
    // Insert session
    const insertPayload = {
      template_id: templateId,
      notes: notes,
      health_sleep_hours: sleep,
      health_steps: steps
    };
    if (durationMinutes) insertPayload.duration_minutes = durationMinutes;

    const { data: sessionData, error: sessErr } = await supabase.from('workout_sessions').insert([insertPayload]).select().single();

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
          completed: set.completed,
          is_warmup: set.is_warmup || false
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
    // type can be 'sleep_hours', 'steps', or 'weight'
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const userId = currentSession?.user?.id;
    if (!userId) throw new Error("Not logged in");

    // Step 1: Read existing row for this date (if any) so we don't overwrite other columns
    const { data: existing } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateStr)
      .maybeSingle();

    // Step 2: Merge — keep existing values, only update the target column
    const mergedPayload = {
      user_id: userId,
      date: dateStr,
      sleep_hours: existing?.sleep_hours ?? null,
      steps: existing?.steps ?? null,
      weight: existing?.weight ?? null,
      weight_unit: existing?.weight_unit ?? null,
      heart_rate: existing?.heart_rate ?? null,
      calories_burned: existing?.calories_burned ?? null,
    };
    mergedPayload[type] = value;

    // Step 3: Upsert the merged row
    const { data, error } = await supabase
      .from('health_metrics')
      .upsert(mergedPayload, { onConflict: 'user_id,date' })
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

  const deleteWorkoutSession = async (sessionId) => {
    // Due to cascading deletes or manual deletion, we might just need to delete the session.
    // The sets should have a foreign key on delete cascade, or we manually delete them.
    // Assuming cascading for now or just deleting session. If sets linger, it's safer to delete them first:
    const { error: setsErr } = await supabase.from('logged_sets').delete().eq('session_id', sessionId);
    if (setsErr) throw setsErr;

    const { error: sessErr } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
    if (sessErr) throw sessErr;

    // Update local context
    setDb(prev => ({
      ...prev,
      sessions: (prev.sessions || []).filter(s => s.id !== sessionId)
    }));
    return true;
  };

  const deleteDailyHealthMetric = async (dateStr, type) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const userId = currentSession?.user?.id;
    if (!userId) throw new Error("Not logged in");

    const updatePayload = {};
    updatePayload[type] = null;

    const { data, error } = await supabase
      .from('health_metrics')
      .update(updatePayload)
      .eq('user_id', userId)
      .eq('date', dateStr)
      .select()
      .single();

    if (error) throw error;

    // Update local context
    setDb(prev => {
      const existingIdx = prev.healthMetrics.findIndex(h => h.date === dateStr);
      if (existingIdx >= 0) {
        const newHealth = [...prev.healthMetrics];
        newHealth[existingIdx] = { ...newHealth[existingIdx], ...data };
        return { ...prev, healthMetrics: newHealth };
      }
      return prev;
    });

    return data;
  };

  const createExercise = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Exercise name cannot be empty');
    
    // Generate a simple ID
    const id = 'ex_' + trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    
    // Check if already exists
    if (db.exercises[id]) return { id, name: db.exercises[id].name };
    
    const { data, error } = await supabase
      .from('exercises')
      .insert([{ id, name: trimmed }])
      .select()
      .single();
    if (error) throw error;
    
    // Update local context
    setDb(prev => ({
      ...prev,
      exercises: { ...prev.exercises, [data.id]: { id: data.id, name: data.name } }
    }));
    
    return data;
  };

  return (
    <DataContext.Provider value={{ db, loading, appReady, loadingCatalog, loadingSessions, loadingHealth, error, saveWorkoutSession, saveDailyHealthMetric, deleteWorkoutSession, deleteDailyHealthMetric, createExercise }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
