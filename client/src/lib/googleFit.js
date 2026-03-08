/**
 * Fetches health data from Google Fit for the last N days.
 * Returns an array of { date, steps, sleepHours, weightKg, latestActivity } objects, one per day.
 * Each entry is keyed to its ACTUAL date so callers can save to the correct row.
 */

const ACTIVITY_TYPES = {
  0: 'In vehicle',
  1: 'Biking',
  2: 'On foot',
  3: 'Still',
  4: 'Unknown',
  5: 'Tilting',
  7: 'Walking',
  8: 'Running',
  9: 'Aerobics',
  10: 'Badminton',
  11: 'Baseball',
  12: 'Basketball',
  13: 'Biathlon',
  57: 'Strength Training',
  58: 'Swimming',
  83: 'Yoga'
};

export async function fetchGoogleFitData(accessToken, daysBack = 7) {
  const now = new Date();
  
  // Start exactly N days ago at 00:00:00 local time
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);

  // End exactly today at 23:59:59.999 local time 
  // (Prevents Google Fit from dropping the final incomplete day in pure raw searches)
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startTimeMillis = startDate.getTime();
  const rawEndTimeMillis = endDate.getTime();
  const currentMillis = now.getTime(); // Used for aggregates so we don't request future data

  // Helper: millis -> YYYY-MM-DD in local time
  const toDateStr = (ms) => {
    const d = new Date(ms);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d - offset).toISOString().split('T')[0];
  };

  // Build a map: date -> { steps, sleepHours, weightKg }
  const dayMap = {};
  for (let i = 0; i <= daysBack; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = toDateStr(d.getTime());
    dayMap[key] = { date: key, steps: 0, sleepHours: 0, weightKg: null, heartRate: null, caloriesBurned: 0, latestActivity: null };
  }

  // ─── 1. STEPS ───────────────────────────────────────────
  // 1a. Try raw data sources for real-time step counts (aggregate endpoint lags behind the app)
  try {
    const dsResp = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources?dataTypeName=com.google.step_count.delta', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (dsResp.status === 401 || dsResp.status === 403) throw new Error(dsResp.status === 401 ? 'Unauthorized' : 'Forbidden');
    
    if (dsResp.ok) {
      const dsData = await dsResp.json();
      const sources = dsData.dataSource || [];
      console.log('[Steps] Found', sources.length, 'step data sources');
      
      const stepsPerSource = {}; // { sourceId: { dateKey: steps } }

      for (const source of sources) {
        const streamId = source.dataStreamId;
        const encodedId = encodeURIComponent(streamId);
        const pointsResp = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodedId}/datasets/${startTimeMillis}000000-${rawEndTimeMillis}000000`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (pointsResp.ok) {
          const pointsData = await pointsResp.json();
          stepsPerSource[streamId] = {};
          
          for (const point of (pointsData.point || [])) {
            const pointMs = parseInt(point.endTimeNanos) / 1000000;
            const dateKey = toDateStr(pointMs);
            const val = point.value?.[0]?.intVal || 0;
            if (val > 0) {
              stepsPerSource[streamId][dateKey] = (stepsPerSource[streamId][dateKey] || 0) + val;
            }
          }
        }
      }

      // De-duplicate: for each day, pick the "best" source
      for (const dateKey of Object.keys(dayMap)) {
        let bestValue = 0;
        let foundPreferred = false;

        for (const [streamId, sourceDays] of Object.entries(stepsPerSource)) {
          const val = sourceDays[dateKey] || 0;
          if (val <= 0) continue;

          // Prefer merged/estimated sources
          const isPreferred = streamId.toLowerCase().includes('estimated') || streamId.toLowerCase().includes('merge');
          
          if (isPreferred) {
            if (!foundPreferred || val > bestValue) {
              bestValue = val;
              foundPreferred = true;
            }
          } else if (!foundPreferred) {
            if (val > bestValue) {
              bestValue = val;
            }
          }
        }
        
        if (bestValue > 0) {
          dayMap[dateKey].steps = bestValue;
        }
      }
    }
  } catch (e) {
    if (e.message === 'Unauthorized' || e.message === 'Forbidden') throw e;
    console.warn('Google Fit raw steps error:', e);
  }

  // 1b. Fallback: aggregate if raw sources returned nothing
  try {
    const anyHasSteps = Object.values(dayMap).some(d => d.steps > 0);
    if (!anyHasSteps) {
      console.log('[Steps] Raw sources empty, falling back to aggregate...');
      const resp = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis,
          endTimeMillis: currentMillis
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const bucket of (data.bucket || [])) {
          const dateKey = toDateStr(parseInt(bucket.startTimeMillis));
          const points = bucket.dataset?.[0]?.point || [];
          const total = points.reduce((sum, p) => sum + (p.value?.[0]?.intVal || 0), 0);
          if (dayMap[dateKey] && total > 0) dayMap[dateKey].steps = total;
        }
      }
    }
  } catch (e) {
    console.warn('Google Fit steps aggregate fallback error:', e);
  }
  console.log('[Steps] Final:', Object.entries(dayMap).map(([k,v]) => `${k}:${v.steps}`).join(', '));

  // ─── 2. SLEEP ───────────────────────────────────────────
  // Try sessions endpoint first (activity types: 72=sleep, 109=light, 110=deep, 111=REM, 112=awake)
  try {
    const sleepResp = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startDate.toISOString()}&endTime=${now.toISOString()}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (sleepResp.ok) {
      const sleepData = await sleepResp.json();
      const SLEEP_TYPES = [72, 109, 110, 111, 112];
      for (const session of (sleepData.session || [])) {
        if (!SLEEP_TYPES.includes(session.activityType)) continue;
        const durationMs = parseInt(session.endTimeMillis) - parseInt(session.startTimeMillis);
        // Attribute sleep to the END date (when you woke up)
        const dateKey = toDateStr(parseInt(session.endTimeMillis));
        if (dayMap[dateKey]) {
          dayMap[dateKey].sleepHours += durationMs / (1000 * 60 * 60);
        }
      }
    }
  } catch (e) {
    console.warn('Google Fit sleep sessions error (non-fatal):', e);
  }

  // Fallback: com.google.sleep.segment aggregate
  try {
    const anyHasSleep = Object.values(dayMap).some(d => d.sleepHours > 0);
    if (!anyHasSleep) {
      const resp = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: 'com.google.sleep.segment' }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis,
          endTimeMillis: currentMillis
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const bucket of (data.bucket || [])) {
          const dateKey = toDateStr(parseInt(bucket.startTimeMillis));
          for (const dataset of (bucket.dataset || [])) {
            for (const point of (dataset.point || [])) {
              const ms = (parseInt(point.endTimeNanos) - parseInt(point.startTimeNanos)) / 1e6;
              if (dayMap[dateKey] && ms > 0) {
                dayMap[dateKey].sleepHours += ms / (1000 * 60 * 60);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Google Fit sleep aggregate fallback error (non-fatal):', e);
  }

  // Round sleep hours
  for (const key of Object.keys(dayMap)) {
    if (dayMap[key].sleepHours > 0) {
      dayMap[key].sleepHours = Number(dayMap[key].sleepHours.toFixed(2));
    }
  }

  // ─── 3. WEIGHT ──────────────────────────────────────────
  // 1. Try raw data sources to get exact chronological points (avoids bucket averaging)
  try {
    const dsResp = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources?dataTypeName=com.google.weight', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (dsResp.status === 401 || dsResp.status === 403) throw new Error(dsResp.status === 401 ? 'Unauthorized' : 'Forbidden');
    
    if (dsResp.ok) {
      const dsData = await dsResp.json();
      for (const source of (dsData.dataSource || [])) {
        const streamId = encodeURIComponent(source.dataStreamId);
        const pointsResp = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataSources/${streamId}/datasets/${startTimeMillis}000000-${rawEndTimeMillis}000000`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (pointsResp.ok) {
          const pointsData = await pointsResp.json();
          for (const point of (pointsData.point || [])) {
            const pointMs = parseInt(point.endTimeNanos) / 1000000;
            const dateKey = toDateStr(pointMs);
            if (dayMap[dateKey]) {
              const val = point.value?.[0]?.fpVal;
              if (val) {
                // Replace the bucket's weight if this weigh-in is more recent
                if (!dayMap[dateKey]._maxWeightTime || pointMs >= dayMap[dateKey]._maxWeightTime) {
                  dayMap[dateKey].weightKg = Number(val.toFixed(1));
                  dayMap[dateKey]._maxWeightTime = pointMs;
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    if (e.message === 'Unauthorized') throw e;
    console.warn('Google Fit raw weight error:', e);
  }

  // 2. Fallback: dataset:aggregate if manual/merged dataset failed
  try {
    const anyHasWeight = Object.values(dayMap).some(d => d.weightKg !== null);
    if (!anyHasWeight) {
      const resp = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: 'com.google.weight' }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis,
          endTimeMillis
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const bucket of (data.bucket || [])) {
          const dateKey = toDateStr(parseInt(bucket.startTimeMillis));
          const points = bucket.dataset?.[0]?.point || [];
          if (points.length > 0 && dayMap[dateKey]) {
            // Sort points by timestamp to reliably get the latest measurement of the day
            points.sort((a, b) => parseInt(a.startTimeNanos) - parseInt(b.startTimeNanos));
            const val = points[points.length - 1]?.value?.[0]?.fpVal;
            if (val) dayMap[dateKey].weightKg = Number(val.toFixed(1));
          }
        }
      }
    }
  } catch (e) {
    console.warn('Google Fit weight error (non-fatal):', e);
  }

  // 3. Fallback: com.google.weight.summary
  try {
    const anyHasWeight = Object.values(dayMap).some(d => d.weightKg !== null);
    if (!anyHasWeight) {
      const resp = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: 'com.google.weight.summary' }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis,
          endTimeMillis
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const bucket of (data.bucket || [])) {
          const dateKey = toDateStr(parseInt(bucket.startTimeMillis));
          const points = bucket.dataset?.[0]?.point || [];
          if (points.length > 0 && dayMap[dateKey]) {
            // Sort points by timestamp to reliably get the latest measurement of the day
            points.sort((a, b) => parseInt(a.startTimeNanos) - parseInt(b.startTimeNanos));
            const val = points[points.length - 1]?.value?.[0]?.fpVal;
            if (val) dayMap[dateKey].weightKg = Number(val.toFixed(1));
          }
        }
      }
    }
  } catch (e) {
    console.warn('Google Fit weight summary fallback (non-fatal):', e);
  }

  // ─── 4. HEART RATE ─────────────────────────────────────
  try {
    const resp = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: 'com.google.heart_rate.bpm' }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis,
        endTimeMillis: currentMillis
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      for (const bucket of (data.bucket || [])) {
        const dateKey = toDateStr(parseInt(bucket.startTimeMillis));
        const points = bucket.dataset?.[0]?.point || [];
        if (points.length > 0 && dayMap[dateKey]) {
          // Take average of all readings for the day
          const sum = points.reduce((s, p) => s + (p.value?.[0]?.fpVal || 0), 0);
          dayMap[dateKey].heartRate = Math.round(sum / points.length);
        }
      }
    }
  } catch (e) {
    console.warn('Google Fit heart rate error (non-fatal):', e);
  }

  // ─── 5. CALORIES ───────────────────────────────────────
  // 5a. Try raw data sources for real-time calorie counts
  try {
    const dsResp = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources?dataTypeName=com.google.calories.expended', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (dsResp.ok) {
      const dsData = await dsResp.json();
      const sources = dsData.dataSource || [];
      console.log('[Calories] Found', sources.length, 'calorie data sources');
      
      const calsPerSource = {}; // { sourceId: { dateKey: calories } }

      for (const source of sources) {
        const streamId = source.dataStreamId;
        const encodedId = encodeURIComponent(streamId);
        const pointsResp = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodedId}/datasets/${startTimeMillis}000000-${rawEndTimeMillis}000000`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (pointsResp.ok) {
          const pointsData = await pointsResp.json();
          calsPerSource[streamId] = {};
          
          for (const point of (pointsData.point || [])) {
            const pointMs = parseInt(point.endTimeNanos) / 1000000;
            const dateKey = toDateStr(pointMs);
            const val = point.value?.[0]?.fpVal || 0;
            if (val > 0) {
              calsPerSource[streamId][dateKey] = (calsPerSource[streamId][dateKey] || 0) + val;
            }
          }
        }
      }

      // De-duplicate: for each day, pick the "best" source
      for (const dateKey of Object.keys(dayMap)) {
        let bestValue = 0;
        let foundPreferred = false;

        for (const [streamId, sourceDays] of Object.entries(calsPerSource)) {
          const val = sourceDays[dateKey] || 0;
          if (val <= 0) continue;

          // Prefer merged/estimated sources
          const isPreferred = streamId.toLowerCase().includes('estimated') || streamId.toLowerCase().includes('merge');
          
          if (isPreferred) {
            if (!foundPreferred || val > bestValue) {
              bestValue = val;
              foundPreferred = true;
            }
          } else if (!foundPreferred) {
            if (val > bestValue) {
              bestValue = val;
            }
          }
        }
        
        if (bestValue > 0) {
          dayMap[dateKey].caloriesBurned = bestValue;
        }
      }
    }
  } catch (e) {
    console.warn('Google Fit raw calories error:', e);
  }

  // 5b. Fallback: aggregate if raw sources returned nothing
  try {
    const anyHasCals = Object.values(dayMap).some(d => d.caloriesBurned > 0);
    if (!anyHasCals) {
      console.log('[Calories] Raw sources empty, falling back to aggregate...');
      const resp = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: 'com.google.calories.expended' }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis,
          endTimeMillis: currentMillis
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const bucket of (data.bucket || [])) {
          const dateKey = toDateStr(parseInt(bucket.startTimeMillis));
          const points = bucket.dataset?.[0]?.point || [];
          const total = points.reduce((sum, p) => sum + (p.value?.[0]?.fpVal || 0), 0);
          if (dayMap[dateKey] && total > 0) dayMap[dateKey].caloriesBurned = Math.round(total);
        }
      }
    }
  } catch (e) {
    console.warn('Google Fit calories aggregate fallback error:', e);
  }

  // Round all calories
  for (const key of Object.keys(dayMap)) {
    if (dayMap[key].caloriesBurned > 0) dayMap[key].caloriesBurned = Math.round(dayMap[key].caloriesBurned);
  }
  console.log('[Calories] Final:', Object.entries(dayMap).map(([k,v]) => `${k}:${v.caloriesBurned}`).join(', '));

  // ─── 6. LATEST ACTIVITY ──────────────────────────────────
  try {
    const activityResp = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources?dataTypeName=com.google.activity.segment', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (activityResp.ok) {
      const data = await activityResp.json();
      const sources = data.dataSource || [];
      
      for (const source of sources) {
        const streamId = source.dataStreamId;
        const encodedId = encodeURIComponent(streamId);
        const pointsResp = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodedId}/datasets/${startTimeMillis}000000-${rawEndTimeMillis}000000`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (pointsResp.ok) {
          const pointsData = await pointsResp.json();
          for (const point of (pointsData.point || [])) {
            const pointMs = parseInt(point.endTimeNanos) / 1000000;
            const dateKey = toDateStr(pointMs);
            const typeId = point.value?.[0]?.intVal;
            
            // Skip "Still" (3) or "Unknown" (4) if we want meaningful activities
            if (typeId !== undefined && typeId !== 3 && typeId !== 4) {
              const activityName = ACTIVITY_TYPES[typeId] || `Activity ${typeId}`;
              
              // Only update if this point is LATER than what we already have for this day
              const current = dayMap[dateKey];
              if (current) {
                if (!current._latestActivityMs || pointMs > current._latestActivityMs) {
                  current.latestActivity = activityName;
                  current._latestActivityMs = pointMs;
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Google Fit activity fetch error:', e);
  }

  const results = Object.values(dayMap).map(d => {
    // Clean up internal tracking fields
    const { _latestActivityMs, ...rest } = d;
    return rest;
  });

  console.log('[Google Fit Sync] Per-day results:', results.filter(r => r.steps > 0 || r.sleepHours > 0 || r.weightKg || r.heartRate || r.caloriesBurned > 0 || r.latestActivity));
  return results;
}
