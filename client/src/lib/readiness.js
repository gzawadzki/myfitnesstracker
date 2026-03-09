export function calculateReadinessScore(healthMetrics = [], sessions = [], prefs = {}) {
  if (!healthMetrics || healthMetrics.length === 0) return 0

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  
  // Znajdź metryki z ostatnich 30 dni żeby móc obliczyć średnie (np. HR)
  const last30DaysMetrics = healthMetrics
    .filter(m => {
      const diffTime = Math.abs(now - new Date(m.date))
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays <= 30
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const todayMetric = healthMetrics.find(m => m.date === todayStr) || 
                      last30DaysMetrics[0] || {} // Opadamy na "wczoraj" jeśli dzisiejszych jeszcze nie ma

  // 1. Sen (waga: 35%) - cel 7.5h (450 minut) lub wg preferencji
  let sleepScore = 0
  const sleepTargetHours = prefs?.sleep_goal || 7.5
  if (todayMetric.sleep_hours) {
    // 0 do 100 procent z 7.5h, nakładana maxymalna czapka 100 (zbyt dużo snu ma ten sam wynik)
    const ratio = Math.min(todayMetric.sleep_hours / sleepTargetHours, 1)
    sleepScore = ratio * 35 
  }

  // 2. HR Spoczynkowy - odchylenie od 30dniowej średniej (waga: 25%)
  let hrScore = 0
  const hrMetrics = last30DaysMetrics.filter(m => m.resting_hr > 0)
  if (hrMetrics.length > 0 && todayMetric.resting_hr) {
    const avgHr = hrMetrics.reduce((sum, m) => sum + m.resting_hr, 0) / hrMetrics.length
    const currentHr = todayMetric.resting_hr
    
    // Różnica w uderzeniach. Mniej = lepiej. 
    // Zakładamy, że 10% odchylenia w górę to czerwona flaga (zmęczenie/choroba).
    const diffPercentage = (currentHr - avgHr) / avgHr
    
    if (diffPercentage <= 0) {
      // HR równe średniej lub niższe od niej (bardzo dobrze)
      hrScore = 25
    } else if (diffPercentage > 0.1) {
       // Ponad 10% wyższe - bardzo słabo.
       hrScore = 0
    } else {
       // Stopniowa utrata punktów w progu od 0% do 10% wyższego HR
       const penalty = (diffPercentage / 0.1) * 25
       hrScore = Math.max(0, 25 - penalty)
    }
  } else {
    // Brak danych HR daje uśrednione, "neutralne" punkty równe 15
    hrScore = 15
  }

  // 3. Dni od ostatniego treningu (waga: 20%)
  let restScore = 0
  if (sessions && sessions.length > 0) {
    const sortedSessions = [...sessions].sort((a,b) => new Date(b.date) - new Date(a.date))
    const lastSessionDate = new Date(sortedSessions[0].date)
    
    const diffTime = Math.abs(now - lastSessionDate)
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      // Trenował dzisiaj, uciete punkty "regeneracyjne" (albo drugi trening)
      restScore = 5
    } else if (diffDays === 1) {
      // Trenował wczoraj. Może być okej, zależnie od zmęczenia = 10 pkt
      restScore = 10
    } else if (diffDays === 2) {
      // Dwa dni przerwy to optymalna regeneracja = 20 pkt
      restScore = 20  
    } else {
       // Więcej przerw, pełen wynik
      restScore = 20 
    }
  } else {
    // Nowy użytkownik - zakładamy gotowość do rozpoczęcia
    restScore = 20
  }

  // 4. Kroki z poprzedniego dnia (waga: 20%) - cel 8000 lub wg preferencji
  let stepsScore = 0
  const stepsTarget = prefs?.step_goal || 8000
  
  // Bierzemy dane sprzed dzisiaj
  const yesterdayMetric = last30DaysMetrics.find(m => {
    const d = new Date(m.date)
    return d.getDate() === now.getDate() - 1 || last30DaysMetrics.indexOf(m) === 1
  }) || todayMetric

  if (yesterdayMetric.steps) {
    const ratio = Math.min(yesterdayMetric.steps / stepsTarget, 1)
    stepsScore = ratio * 20
  } else {
    stepsScore = 10 // baseline
  }

  const finalScore = Math.round(sleepScore + hrScore + restScore + stepsScore)
  
  return {
    score: Math.min(finalScore, 100),
    breakdown: {
      sleep: Math.round(sleepScore),
      hr: Math.round(hrScore),
      rest: restScore,
      steps: Math.round(stepsScore)
    }
  }
}

export function getReadinessSuggestion(score) {
  if (score >= 80) return { label: 'Ready', text: 'Great day for a heavy session', color: 'var(--success)' }
  if (score >= 60) return { label: 'Moderate', text: 'You can train, but listen to your body', color: 'var(--warning)' }
  if (score >= 40) return { label: 'Cautious', text: 'Consider a lighter session or recovery', color: 'var(--accent-primary)' }
  return { label: 'Rest', text: 'Rest is key today', color: 'var(--danger)' }
}
