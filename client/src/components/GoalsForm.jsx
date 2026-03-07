import React from 'react';
import { getGoalFormValues, sanitizeGoalUpdates } from './goalsUtils';

export default function GoalsForm({
  preferences,
  onSave,
  saving = false,
  submitLabel = 'Save Goals',
  showOnboardingCopy = false,
}) {
  const [goalInputs, setGoalInputs] = React.useState(getGoalFormValues(preferences));

  React.useEffect(() => {
    setGoalInputs(getGoalFormValues(preferences));
  }, [preferences]);

  const weightUnit = goalInputs.weight_goal_unit || 'kg';

  return (
    <div>
      {showOnboardingCopy && (
        <p className="text-xs text-secondary mb-3">
          Set your targets to unlock personalized progress insights and streak tracking.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-secondary mb-1 block">Sleep (h)</label>
          <input
            type="number"
            step="0.5"
            className="input w-full p-2 text-sm h-9"
            placeholder="e.g. 7.5 h"
            value={goalInputs.sleep_goal}
            onChange={(e) => setGoalInputs({ ...goalInputs, sleep_goal: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs text-secondary mb-1 block">Steps</label>
          <input
            type="number"
            className="input w-full p-2 text-sm h-9"
            placeholder="e.g. 8000 steps"
            value={goalInputs.step_goal}
            onChange={(e) => setGoalInputs({ ...goalInputs, step_goal: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs text-secondary mb-1 block">Weight Goal</label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              className="input w-full p-2 pr-12 text-sm h-9"
              placeholder={`e.g. 70 ${weightUnit}`}
              value={goalInputs.weight_goal}
              onChange={(e) => setGoalInputs({ ...goalInputs, weight_goal: e.target.value })}
            />
            <span className="absolute inset-y-0 right-3 flex items-center text-xs text-muted pointer-events-none">
              {weightUnit}
            </span>
          </div>
        </div>

        <div>
          <label className="text-xs text-secondary mb-1 block">Unit</label>
          <select
            className="input w-full p-2 text-sm h-9"
            value={weightUnit}
            onChange={(e) => setGoalInputs({ ...goalInputs, weight_goal_unit: e.target.value })}
          >
            <option value="kg">kg</option>
            <option value="lbs">lbs</option>
          </select>
        </div>
      </div>

      <button
        className="btn btn-primary w-full text-sm h-9"
        onClick={() => onSave(sanitizeGoalUpdates(goalInputs))}
        disabled={saving}
      >
        {saving ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}
