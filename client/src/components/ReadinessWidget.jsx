import React, { useState } from 'react'
import { Activity, Beaker, BedSingle, ChevronDown, ChevronUp, Footprints } from 'lucide-react'
import { calculateReadinessScore, getReadinessSuggestion } from '../lib/readiness'

export default function ReadinessWidget({ healthMetrics, sessions, prefs }) {
  const [expanded, setExpanded] = useState(false)
  
  // Przelicz wynik i ewaluację
  const { score, breakdown } = calculateReadinessScore(healthMetrics, sessions, prefs)
  const suggestion = getReadinessSuggestion(score)

  return (
    <div className="card glass mb-6 overflow-hidden">
      <div 
        className="flex items-center justify-between cursor-pointer" 
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h2 className="text-secondary text-sm font-medium mb-1 uppercase tracking-wider">
            Readiness Score
          </h2>
          <div className="flex items-center gap-3">
            <div 
              className="text-4xl font-black tabular-nums transition-colors duration-500"
              style={{ color: suggestion.color }}
            >
              {score}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight" style={{ color: suggestion.color }}>
                {suggestion.label}
              </span>
              <span className="text-xs text-muted max-w-[200px]">
                {suggestion.text}
              </span>
            </div>
          </div>
        </div>
        
        <div className="text-secondary opacity-50">
          {expanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </div>
      </div>

      {expanded && (
        <div className="mt-5 pt-4 border-t border-[var(--surface-border)] animate-fade-in">
          <p className="text-xs text-secondary mb-3 uppercase tracking-wider">Score Breakdown</p>
          <div className="grid grid-cols-2 gap-3">
            
            {/* Sleep Component */}
            <div className="bg-[var(--surface-color)] p-3 rounded-lg flex items-start gap-3 border border-[var(--surface-border)]">
              <div className="p-2 bg-indigo-500/10 rounded-md text-indigo-400">
                <BedSingle size={18} />
              </div>
              <div>
                <div className="text-xs text-muted">Sleep (35%)</div>
                <div className="font-bold">{breakdown.sleep} / 35</div>
              </div>
            </div>

            {/* HR Component */}
            <div className="bg-[var(--surface-color)] p-3 rounded-lg flex items-start gap-3 border border-[var(--surface-border)]">
              <div className="p-2 bg-rose-500/10 rounded-md text-rose-400">
                <Activity size={18} />
              </div>
              <div>
                <div className="text-xs text-muted">Resting HR (25%)</div>
                <div className="font-bold">{breakdown.hr} / 25</div>
              </div>
            </div>

            {/* Recovery Component */}
            <div className="bg-[var(--surface-color)] p-3 rounded-lg flex items-start gap-3 border border-[var(--surface-border)]">
              <div className="p-2 bg-emerald-500/10 rounded-md text-emerald-400">
                <Beaker size={18} />
              </div>
              <div>
                <div className="text-xs text-muted">Recovery (20%)</div>
                <div className="font-bold">{breakdown.rest} / 20</div>
              </div>
            </div>

            {/* Steps Component */}
            <div className="bg-[var(--surface-color)] p-3 rounded-lg flex items-start gap-3 border border-[var(--surface-border)]">
              <div className="p-2 bg-blue-500/10 rounded-md text-blue-400">
                <Footprints size={18} />
              </div>
              <div>
                <div className="text-xs text-muted">Background Activity (20%)</div>
                <div className="font-bold">{breakdown.steps} / 20</div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
