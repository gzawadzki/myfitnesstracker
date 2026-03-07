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

  // 2. Fetch Sleep (Using sessions endpoint for activityType=72 which is Sleep)
  let sleepHours = 0;
  try {
    // We look at the last 24 hours for a sleep session
    const sleepStart = new Date();
    sleepStart.setHours(sleepStart.getHours() - 24);
    
    const sleepResponse = await fetch(`https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${sleepStart.toISOString()}&endTime=${new Date().toISOString()}&activityType=72`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (sleepResponse.ok) {
      const sleepData = await sleepResponse.json();
      if (sleepData.session && sleepData.session.length > 0) {
        // Find the longest sleep session or sum them up
        let totalSleepMillis = 0;
        sleepData.session.forEach(session => {
          totalSleepMillis += (parseInt(session.endTimeMillis) - parseInt(session.startTimeMillis));
        });
        sleepHours = Number((totalSleepMillis / (1000 * 60 * 60)).toFixed(2));
      }
    } else {
      console.error("Failed to fetch sleep:", await sleepResponse.text());
    }
  } catch (err) {
    console.error("Error fetching sleep:", err);
  }

  // 3. Fetch Weight (com.google.weight.summary)
  // 3. Fetch Weight (com.google.weight.summary) with graceful failure
  let weightKg = null;
  try {
    const weightResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "aggregateBy": [{
          "dataTypeName": "com.google.weight.summary"
        }],
        "bucketByTime": { "durationMillis": 86400000 },
        "startTimeMillis": startTimeMillis,
        "endTimeMillis": endTimeMillis
      })
    });
    
    if (weightResponse.ok) {
      const weightData = await weightResponse.json();
      weightKg = weightData?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal ?? null;
      if (weightKg !== null) {
        weightKg = Number(weightKg.toFixed(1));
      }
    } else {
      console.warn("Google Fit weight fetch failed (non-fatal):", await weightResponse.text());
    }
  } catch (err) {
    console.warn("Google Fit weight fetch failed (non-fatal):", err);
  }

  return { steps, sleepHours, weightKg };
}
