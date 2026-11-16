import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_SETTINGS,
  type ExerciseRule,
  type ProgressionSettings,
  type Steps,
} from '@/lib/progression';

const SETTINGS_KEY = 'progression-settings-v1';

/**
 * How the settings were saved before the Lower body / Upper body split was removed:
 * two sets of step sizes, and a body part on every exercise.
 */
type OldRule = ExerciseRule & { bodyPart?: 'lower' | 'upper' };
type OldSettings = {
  periodWeeks?: number;
  lower?: Partial<Steps>;
  upper?: Partial<Steps>;
  exercises?: Record<string, OldRule>;
};

/**
 * Turns settings saved in the old shape into the new one, without changing what any
 * exercise does: the lower-body numbers become the general ones, and an upper-body
 * exercise keeps the upper-body numbers as its own if they were different.
 */
function fromOldSettings(saved: OldSettings): ProgressionSettings {
  const steps: Steps = { ...DEFAULT_SETTINGS.steps, ...saved.lower };
  const upper: Steps = { ...DEFAULT_SETTINGS.steps, ...saved.upper };

  const exercises: Record<string, ExerciseRule> = {};
  const oldRules: Record<string, OldRule> = saved.exercises ?? DEFAULT_SETTINGS.exercises;
  for (const [key, old] of Object.entries(oldRules)) {
    const group = old.bodyPart === 'upper' ? upper : steps;
    const reps = old.reps ?? group.reps;
    const weight = old.weight ?? group.weight;
    const rule: ExerciseRule = { name: old.name };
    if (reps !== steps.reps) rule.reps = reps;
    if (weight !== steps.weight) rule.weight = weight;
    // Exercises that simply follow the general numbers don't need an entry.
    if (rule.reps !== undefined || rule.weight !== undefined) exercises[key] = rule;
  }

  return { periodWeeks: saved.periodWeeks ?? DEFAULT_SETTINGS.periodWeeks, steps, exercises };
}

/** Reads the saved formula numbers. Returns the built-in ones if nothing is saved yet. */
export async function loadProgressionSettings(): Promise<ProgressionSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  const saved = JSON.parse(raw) as Partial<ProgressionSettings> & OldSettings;
  if (!saved.steps) return fromOldSettings(saved);
  // Fill in anything missing from the saved copy with the built-in numbers.
  return {
    periodWeeks: saved.periodWeeks ?? DEFAULT_SETTINGS.periodWeeks,
    steps: { ...DEFAULT_SETTINGS.steps, ...saved.steps },
    exercises: saved.exercises ?? DEFAULT_SETTINGS.exercises,
  };
}

export async function saveProgressionSettings(settings: ProgressionSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
