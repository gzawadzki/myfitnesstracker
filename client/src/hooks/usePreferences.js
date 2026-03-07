import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function getDefaultPreferences() {
  return { sleep_goal: 7.5, step_goal: 8000, weight_goal: null, weight_goal_unit: 'kg' };
}

export function usePreferences() {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPreferences = async () => {
      try {
        setLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user?.id) {
          if (isMounted) {
            setPreferences(getDefaultPreferences());
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', userData.user.id)
          .maybeSingle();

        if (error) {
          console.warn("Preferences fetch error:", error);
        }

        if (isMounted) {
          setPreferences(data ?? getDefaultPreferences());
          setError(null);
        }
      } catch (err) {
        console.error("Error loading preferences:", err);
        if (isMounted) {
          setPreferences(getDefaultPreferences());
          setError(err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const savePreferences = async (updates) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) throw new Error("Not logged in");

    // Optimistic update
    const previousPrefs = { ...preferences };
    setPreferences(prev => ({ ...(prev || getDefaultPreferences()), ...updates }));
    
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ user_id: userData.user.id, ...updates }, { onConflict: 'user_id' });
      
      if (error) {
        throw error;
      }
    } catch (err) {
      // Rollback
      setPreferences(previousPrefs);
      throw err;
    }
  };

  return { preferences, loading, error, savePreferences };
}
