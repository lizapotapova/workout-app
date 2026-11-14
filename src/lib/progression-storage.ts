import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SETTINGS, type ProgressionSettings } from '@/lib/progression';

const SETTINGS_KEY = 'progression-settings-v1';

/** Reads the saved formula numbers. Returns the built-in ones if nothing is saved yet. */
export async function loadProgressionSettings(): Promise<ProgressionSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  const saved = JSON.parse(raw) as Partial<ProgressionSettings>;
  // Fill in anything missing from the saved copy with the built-in numbers.
  return {
    periodWeeks: saved.periodWeeks ?? DEFAULT_SETTINGS.periodWeeks,
    lower: { ...DEFAULT_SETTINGS.lower, ...saved.lower },
    upper: { ...DEFAULT_SETTINGS.upper, ...saved.upper },
    exercises: saved.exercises ?? DEFAULT_SETTINGS.exercises,
  };
}

export async function saveProgressionSettings(settings: ProgressionSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
