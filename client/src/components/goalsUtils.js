export function getGoalFormValues(preferences) {
  return {
    sleep_goal: preferences?.sleep_goal ?? 7.5,
    step_goal: preferences?.step_goal ?? 8000,
    weight_goal: preferences?.weight_goal ?? '',
    weight_goal_unit: preferences?.weight_goal_unit ?? 'kg',
  };
}

export function hasIncompleteGoals(preferences) {
  return preferences?.sleep_goal == null || preferences?.step_goal == null || preferences?.weight_goal == null;
}

export function sanitizeGoalUpdates(goalInputs) {
  const sleep = Number(goalInputs.sleep_goal);
  const steps = Number(goalInputs.step_goal);
  const weight = goalInputs.weight_goal === '' ? null : Number(goalInputs.weight_goal);

  return {
    sleep_goal: Number.isFinite(sleep) ? sleep : 7.5,
    step_goal: Number.isFinite(steps) ? steps : 8000,
    weight_goal: Number.isFinite(weight) ? weight : null,
    weight_goal_unit: goalInputs.weight_goal_unit || 'kg',
  };
}

export function formatWeightGoal(weightGoal, unit) {
  if (weightGoal == null || weightGoal === '') return '—';
  return `${weightGoal} ${unit || 'kg'}`;
}
