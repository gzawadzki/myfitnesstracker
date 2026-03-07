/**
 * Fetches health data from Google Fit for the last N days.
 * Returns an array of { date, steps, sleepHours, weightKg } objects, one per day.
 * Each entry is keyed to its ACTUAL date so callers can save to the correct row.
 */
export async function fetchGoogleFitData(accessToken, daysBack = 7) {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);

  const startTimeMillis = startDate.getTime();
  const endTimeMillis = now.getTime();

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
    dayMap[key] = { date: key, steps: 0, sleepHours: 0, weightKg: null };
  }

  // ─── 1. STEPS ───────────────────────────────────────────
  try {
    const resp = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
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
        const total = points.reduce((sum, p) => sum + (p.value?.[0]?.intVal || 0), 0);
        if (dayMap[dateKey]) dayMap[dateKey].steps = total;
      }
    } else {
      console.error('Google Fit steps fetch failed:', await resp.text());
    }
  } catch (e) {
    console.error('Google Fit steps error:', e);
  }

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
          endTimeMillis
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
  // Try com.google.weight (raw) with daily buckets
  try {
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
          const val = points[points.length - 1]?.value?.[0]?.fpVal;
          if (val) dayMap[dateKey].weightKg = Number(val.toFixed(1));
        }
      }
    }
  } catch (e) {
    console.warn('Google Fit weight error (non-fatal):', e);
  }

  // Fallback: com.google.weight.summary
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
            const val = points[points.length - 1]?.value?.[0]?.fpVal;
            if (val) dayMap[dateKey].weightKg = Number(val.toFixed(1));
          }
        }
      }
    }
  } catch (e) {
    console.warn('Google Fit weight summary fallback (non-fatal):', e);
  }

  const results = Object.values(dayMap);
  console.log('[Google Fit Sync] Per-day results:', results.filter(r => r.steps > 0 || r.sleepHours > 0 || r.weightKg));
  return results;
}
