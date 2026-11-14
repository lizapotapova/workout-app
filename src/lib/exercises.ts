import { type WorkoutSet } from '@/lib/sets-storage';

export type ExerciseGroup = { name: string; sets: WorkoutSet[] };

/**
 * Groups a day's sets by exercise, like a written workout: exercises in the order they
 * were first done, and each exercise's sets in the order they were done.
 * "squat" and "Squat" count as the same exercise.
 */
export function groupByExercise(sets: WorkoutSet[]): ExerciseGroup[] {
  const oldestFirst = [...sets].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const groups = new Map<string, ExerciseGroup>();
  for (const set of oldestFirst) {
    const key = set.exercise.trim().toLowerCase();
    const group = groups.get(key);
    if (group) group.sets.push(set);
    else groups.set(key, { name: set.exercise, sets: [set] });
  }
  return [...groups.values()];
}

/** A set as short text, e.g. "170 lb • 12". */
export function formatSet(set: WorkoutSet): string {
  return `${set.weight}${set.unit ? ` ${set.unit}` : ''} • ${set.reps}`;
}
