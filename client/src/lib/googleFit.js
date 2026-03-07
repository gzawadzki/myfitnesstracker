export async function fetchGoogleFitData(accessToken) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startTimeMillis = today.getTime();
  const endTimeMillis = new Date().getTime();

  // 1. Fetch Steps
  let steps = 0;
  try {
    const stepsResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "aggregateBy": [{
          "dataTypeName": "com.google.step_count.delta"
        }],
        "bucketByTime": { "durationMillis": 86400000 },
        "startTimeMillis": startTimeMillis,
        "endTimeMillis": endTimeMillis
      })
    });
    
    if (stepsResponse.ok) {
      const stepsData = await stepsResponse.json();
      if (stepsData.bucket && stepsData.bucket.length > 0) {
        const dataset = stepsData.bucket[0].dataset[0];
        if (dataset && dataset.point && dataset.point.length > 0) {
          steps = dataset.point.reduce((sum, p) => sum + (p.value[0]?.intVal || 0), 0);
        }
      }
    } else {
      console.error("Failed to fetch steps:", await stepsResponse.text());
    }
  } catch (err) {
    console.error("Error fetching steps:", err);
  }

  // 2. Fetch Sleep
  // Google Fit sleep activity types:
  //   72 = Sleep (generic), 109 = Light sleep, 110 = Deep sleep, 111 = REM, 112 = Awake during sleep
  // We query sessions for the last 24h, matching ANY of these activity types
  let sleepHours = 0;
  try {
    const sleepStart = new Date();
    sleepStart.setHours(sleepStart.getHours() - 24);

    // Fetch ALL sessions from last 24h, then filter sleep types client-side
    const sleepResponse = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${sleepStart.toISOString()}&endTime=${new Date().toISOString()}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (sleepResponse.ok) {
      const sleepData = await sleepResponse.json();
      const SLEEP_ACTIVITY_TYPES = [72, 109, 110, 111, 112];
      
      if (sleepData.session && sleepData.session.length > 0) {
        let totalSleepMillis = 0;
        sleepData.session.forEach(session => {
          // Include any session whose activityType is a sleep variant
          if (SLEEP_ACTIVITY_TYPES.includes(session.activityType)) {
            totalSleepMillis += (parseInt(session.endTimeMillis) - parseInt(session.startTimeMillis));
          }
        });
        sleepHours = Number((totalSleepMillis / (1000 * 60 * 60)).toFixed(2));
      }

      // Fallback: also try the aggregate sleep.segment approach
      if (sleepHours === 0) {
        try {
          const aggResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              "aggregateBy": [{ "dataTypeName": "com.google.sleep.segment" }],
              "bucketByTime": { "durationMillis": 86400000 },
              "startTimeMillis": sleepStart.getTime(),
              "endTimeMillis": endTimeMillis
            })
          });
          if (aggResponse.ok) {
            const aggData = await aggResponse.json();
            if (aggData.bucket && aggData.bucket.length > 0) {
              let totalMs = 0;
              for (const bucket of aggData.bucket) {
                for (const dataset of bucket.dataset) {
                  for (const point of (dataset.point || [])) {
                    // Each point has startTimeNanos and endTimeNanos
                    const startNanos = parseInt(point.startTimeNanos);
                    const endNanos = parseInt(point.endTimeNanos);
                    if (startNanos && endNanos) {
                      totalMs += (endNanos - startNanos) / 1e6;
                    }
                  }
                }
              }
              if (totalMs > 0) {
                sleepHours = Number((totalMs / (1000 * 60 * 60)).toFixed(2));
              }
            }
          }
        } catch (e) {
          console.warn("Sleep aggregate fallback failed (non-fatal):", e);
        }
      }
    } else {
      console.error("Failed to fetch sleep sessions:", await sleepResponse.text());
    }
  } catch (err) {
    console.error("Error fetching sleep:", err);
  }

  // 3. Fetch Weight — try both com.google.weight and com.google.weight.summary
  // Use a wider window (last 7 days) to find the most recent weight entry
  let weightKg = null;
  try {
    const weightStart = new Date();
    weightStart.setDate(weightStart.getDate() - 7);

    // Try com.google.weight first (raw entries)
    const weightResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "aggregateBy": [{ "dataTypeName": "com.google.weight" }],
        "bucketByTime": { "durationMillis": 86400000 * 7 },
        "startTimeMillis": weightStart.getTime(),
        "endTimeMillis": endTimeMillis
      })
    });
    
    if (weightResponse.ok) {
      const weightData = await weightResponse.json();
      // Find the most recent weight point
      for (const bucket of (weightData.bucket || [])) {
        for (const dataset of (bucket.dataset || [])) {
          const points = dataset.point || [];
          if (points.length > 0) {
            // Take the last (most recent) point
            const latestPoint = points[points.length - 1];
            weightKg = latestPoint?.value?.[0]?.fpVal ?? null;
          }
        }
      }
    }

    // Fallback to com.google.weight.summary if no result
    if (weightKg === null) {
      const summaryResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "aggregateBy": [{ "dataTypeName": "com.google.weight.summary" }],
          "bucketByTime": { "durationMillis": 86400000 * 7 },
          "startTimeMillis": weightStart.getTime(),
          "endTimeMillis": endTimeMillis
        })
      });
      
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        for (const bucket of (summaryData.bucket || [])) {
          for (const dataset of (bucket.dataset || [])) {
            const points = dataset.point || [];
            if (points.length > 0) {
              const latestPoint = points[points.length - 1];
              // summary type: value[0]=avg, value[1]=max, value[2]=min
              weightKg = latestPoint?.value?.[0]?.fpVal ?? null;
            }
          }
        }
      }
    }

    if (weightKg !== null) {
      weightKg = Number(weightKg.toFixed(1));
    }
  } catch (err) {
    console.warn("Google Fit weight fetch failed (non-fatal):", err);
  }

  console.log('[Google Fit Sync]', { steps, sleepHours, weightKg });
  return { steps, sleepHours, weightKg };
}
