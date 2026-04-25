/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const DataContext = createContext(null);

const createEmptyDb = () => ({
  sessions: [],
  healthMetrics: [],
  phases: [],
  workouts: [],
  exercises: {},
  cardioSessions: []
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
  const [sessionLimit, setSessionLimit] = useState(100);
  const [hasMoreSessions, setHasMoreSessions] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);

  // Persist DB to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('fitnotes_db', JSON.stringify(db));
  }, [db]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchCatalogData = useCallback(async () => {
    const { data: phasesData, error: phErr } = await supabase.from('phases').select('*').order('order_index');
    if (phErr) throw phErr;

    const { data: workoutsData, error: wErr } = await supabase.from('workout_templates').select('*');
    if (wErr) throw wErr;

    const { data: exercisesData, error: eErr } = await supabase.from('exercises').select('*');
    if (eErr) throw eErr;

    const { data: mappingsData, error: mErr } = await supabase.from('template_exercises').select('*').order('order_index');
    if (mErr) throw mErr;

    return { phasesData, workoutsData, exercisesData, mappingsData };
  }, []);

  const fetchWorkoutSessions = useCallback(async (userId, currentLimit) => {
    const { data: latestSessionsData, error: sessErr } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(currentLimit + 1); // fetch one extra to check if there are more
    if (sessErr) throw sessErr;

    const hasMore = latestSessionsData.length > currentLimit;
    const items = hasMore ? latestSessionsData.slice(0, currentLimit) : latestSessionsData;
    
    if (isMounted.current) {
      setHasMoreSessions(hasMore);
    }

    const sessionIds = items.map(s => s.id);
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

    return { latestSessionsData: items, loggedSetsData };
  }, []);

  const fetchHealthMetrics = useCallback(async (userId) => {
    const { data: healthData, error: healthErr } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (healthErr && !healthErr.message?.includes('schema cache') && healthErr.code !== '42P01') {
      throw healthErr;
    }
    return healthData || [];
  }, []);

  const fetchCardioSessions = useCallback(async (userId, currentLimit) => {
    const { data: cardioData, error: cardioErr } = await supabase
      .from('cardio_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(currentLimit);
    if (cardioErr) throw cardioErr;
    return cardioData || [];
  }, []);

  const buildMappedDb = useCallback((catalog, sessions, healthMetrics, cardioSessionsData) => {
    const { phasesData, workoutsData, exercisesData, mappingsData } = catalog;
    const { latestSessionsData, loggedSetsData } = sessions;

    const mappedDb = {
      sessions: latestSessionsData.map(session => ({
        ...session,
        sets: loggedSetsData.filter(set => set.session_id === session.id)
      })),
      cardioSessions: cardioSessionsData,
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

    [...latestSessionsData].reverse().forEach((sess) => {
      const sessSets = loggedSetsData.filter(s => s.session_id === sess.id);
      const exIdsInSession = [...new Set(sessSets.map(s => s.exercise_id))];

      exIdsInSession.forEach(exId => {
        const exSets = sessSets.filter(s => s.exercise_id === exId && !s.is_warmup);
        if (exSets.length === 0) return;

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
  }, []);

  const loadData = useCallback(async (isBackground = false, specificLimit = null) => {
    const activeLimit = specificLimit || sessionLimit;
    try {
      // Use a local check for cache that doesn't depend on the state variable directly in the callback's dependencies
      const cached = localStorage.getItem('fitnotes_db');
      const hasCache = !!cached;

      if (isMounted.current && !isBackground) {
        setError(null);
        if (!hasCache) {
          setLoading(true);
          setLoadingCatalog(true);
          setLoadingSessions(true);
          setLoadingHealth(true);
        }
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const userId = currentSession?.user?.id;
      
      if (!userId) {
        if (hasCache && !isBackground) {
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
        if (isMounted.current) setLoadingCatalog(false);
      });
      const sessionsPromise = fetchWorkoutSessions(userId, activeLimit).finally(() => {
        if (isMounted.current) setLoadingSessions(false);
      });
      const healthPromise = fetchHealthMetrics(userId).finally(() => {
        if (isMounted.current) setLoadingHealth(false);
      });
      const cardioPromise = fetchCardioSessions(userId, activeLimit);
      
      const [catalog, sessions, healthMetrics, cardioSessionsList] = await Promise.all([catalogPromise, sessionsPromise, healthPromise, cardioPromise]);
      const mappedDb = buildMappedDb(catalog, sessions, healthMetrics, cardioSessionsList);

      if (isMounted.current) {
        setError(null);
        setDb(mappedDb);
      }
    } catch (err) {
      console.error("Error loading Supabase data:", err);
      if (isMounted.current) {
        const msg = (err?.message || "").toLowerCase();
        const isNetworkError = msg.includes('fetch') || msg.includes('network') || !navigator.onLine;
        const hasCache = !!localStorage.getItem('fitnotes_db');
        
        if (isNetworkError && hasCache) {
          setError(null);
        } else {
          setError(err?.message || "Unknown connection error");
        }
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setAppReady(true);
      }
    }
  }, [sessionLimit, fetchCatalogData, fetchWorkoutSessions, fetchHealthMetrics, fetchCardioSessions, buildMappedDb]);

  const loadMoreSessions = useCallback(async () => {
    const newLimit = sessionLimit + 50;
    setSessionLimit(newLimit);
    await loadData(true, newLimit);
  }, [sessionLimit, loadData]);

  useEffect(() => {
    let focusDebounce = null;
    loadData();

    const handleFocus = () => {
      clearTimeout(focusDebounce);
      focusDebounce = setTimeout(() => loadData(true), 500);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimeout(focusDebounce);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadData]);

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
    // type can be 'sleep_hours', 'steps', 'weight', 'heart_rate', 'calories_burned', or 'latest_activity'
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
      latest_activity: existing?.latest_activity ?? null,
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

  const deleteCardioSession = async (sessionId) => {
    const { error } = await supabase.from('cardio_sessions').delete().eq('id', sessionId);
    if (error) throw error;
    await loadData(true);
  };

  const createExercise = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Exercise name cannot be empty');
    
    // Check if exercise with this name already exists
    const existing = Object.values(db.exercises).find(
      ex => ex.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return { id: existing.id, name: existing.name };

    const id = crypto.randomUUID();
    
    const { data, error } = await supabase
      .from('exercises')
      .insert([{ id, name: trimmed }])
      .select()
      .single();
    if (error) throw error;
    
    setDb(prev => ({ ...prev, exercises: { ...prev.exercises, [data.id]: { ...data, history: [] } } }));
    
    return data;
  };

  const syncExternalSessions = async (externalSessions) => {
    if (!externalSessions || externalSessions.length === 0) return;
    
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const userId = currentSession?.user?.id;
    if (!userId) return;

    // 1. Extra defensive de-duplication of incoming sessions (Map keeps only one per ID)
    const uniqueMap = {};
    externalSessions.forEach(s => { if (s.id) uniqueMap[s.id] = s; });
    const uniqueInputSessions = Object.values(uniqueMap);

    // 2. Filter out what we already have in local state
    const existingGfIds = new Set((db.cardioSessions || []).filter(s => s.google_fit_session_id).map(s => s.google_fit_session_id));
    const newSessions = uniqueInputSessions.filter(s => !existingGfIds.has(s.id));

    if (newSessions.length === 0) return;

    console.log(`[syncExternalSessions] Syncing ${newSessions.length} new sessions...`);

    const sessionsToInsert = newSessions.map(s => {
      let paceStr = '';
      let minStr = '';
      let secStr = '';
      
      if (s.distanceMeters > 0 && s.durationMinutes > 0) {
        const pace = s.durationMinutes / (s.distanceMeters / 1000);
        const min = Math.floor(pace);
        const sec = Math.round((pace % 1) * 60).toString().padStart(2, '0');
        minStr = min;
        secStr = sec;
        paceStr = ` | Tempo: ${min}:${sec} min/km`;
      }

      return {
        user_id: userId,
        google_fit_session_id: s.id,
        created_at: s.startTime,
        activity_name: s.type,
        duration_minutes: s.durationMinutes,
        calories: s.calories,
        distance_meters: s.distanceMeters,
        steps: s.steps,
        notes: paceStr ? `Tempo: ${minStr}:${secStr} min/km` : ''
      };
    });

    const { data, error } = await supabase
      .from('cardio_sessions')
      .upsert(sessionsToInsert, { onConflict: 'google_fit_session_id' })
      .select();

    if (error) {
      console.error('[syncExternalSessions] Error:', error);
      return;
    }

    if (data && data.length > 0) {
      setDb(prev => {
        const updatedCardio = [...data, ...(prev.cardioSessions || [])];
        // Sort by date descending
        updatedCardio.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return { ...prev, cardioSessions: updatedCardio };
      });
    }
  };

  // ─── Workout Plan CRUD ────────────────────────────────────

  const savePhase = async (id, name, orderIndex) => {
    const phaseId = id || `phase_${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase
      .from('phases')
      .upsert({ id: phaseId, name, order_index: orderIndex }, { onConflict: 'id' });
    if (error) throw error;
    await loadData(true);
    return phaseId;
  };

  const deletePhase = async (phaseId) => {
    // Delete template_exercises for all workouts in this phase first
    const { data: templates } = await supabase
      .from('workout_templates')
      .select('id')
      .eq('phase_id', phaseId);
    
    if (templates && templates.length > 0) {
      const templateIds = templates.map(t => t.id);
      await supabase.from('template_exercises').delete().in('workout_id', templateIds);
      await supabase.from('workout_templates').delete().eq('phase_id', phaseId);
    }

    const { error } = await supabase.from('phases').delete().eq('id', phaseId);
    if (error) throw error;
    await loadData(true);
  };

  const saveWorkoutTemplate = async (id, phaseId, name) => {
    const templateId = id || `w_${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase
      .from('workout_templates')
      .upsert({ id: templateId, phase_id: phaseId, name }, { onConflict: 'id' });
    if (error) throw error;
    await loadData(true);
    return templateId;
  };

  const deleteWorkoutTemplate = async (templateId) => {
    await supabase.from('template_exercises').delete().eq('workout_id', templateId);
    const { error } = await supabase.from('workout_templates').delete().eq('id', templateId);
    if (error) throw error;
    await loadData(true);
  };

  const saveTemplateExercises = async (workoutId, exercises) => {
    // Replace all exercise mappings: delete existing, insert new
    const { error: delErr } = await supabase
      .from('template_exercises')
      .delete()
      .eq('workout_id', workoutId);
    if (delErr) throw delErr;

    if (exercises.length > 0) {
      const rows = exercises.map((ex, idx) => ({
        workout_id: workoutId,
        exercise_id: ex.exerciseId,
        target_sets: ex.targetSets,
        target_reps: ex.targetReps,
        order_index: idx
      }));
      const { error: insErr } = await supabase.from('template_exercises').insert(rows);
      if (insErr) throw insErr;
    }

    await loadData(true);
  };

  return (
    <DataContext.Provider value={{
      db,
      loading,
      appReady,
      loadingCatalog,
      loadingSessions,
      loadingHealth,
      error,
      loadData,
      saveWorkoutSession,
      deleteWorkoutSession,
      deleteCardioSession,
      saveDailyHealthMetric,
      deleteDailyHealthMetric,
      createExercise,
      syncExternalSessions,
      loadMoreSessions,
      hasMoreSessions,
      savePhase,
      deletePhase,
      saveWorkoutTemplate,
      deleteWorkoutTemplate,
      saveTemplateExercises
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
