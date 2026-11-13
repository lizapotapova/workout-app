import AsyncStorage from '@react-native-async-storage/async-storage';

import { dayKey } from '@/lib/dates';

export type WeightUnit = 'kg' | 'lb';

/** One logged set, e.g. "Squat, 60 kg × 8". */
export type WorkoutSet = {
  id: string;
  exercise: string;
  weight: number;
  /** Unit the weight was entered in. Missing on sets logged before units existed. */
  unit?: WeightUnit;
  reps: number;
  /** When the set was logged, as an ISO date string. */
  createdAt: string;
};

const STORAGE_KEY = 'workout-sets-v1';
const UNIT_KEY = 'weight-unit-v1';

/** Reads the unit the user last chose. Defaults to kg. */
export async function loadUnit(): Promise<WeightUnit> {
  const raw = await AsyncStorage.getItem(UNIT_KEY);
  return raw === 'lb' ? 'lb' : 'kg';
}

/** Remembers the chosen unit for next time. */
export async function saveUnit(unit: WeightUnit): Promise<void> {
  await AsyncStorage.setItem(UNIT_KEY, unit);
}

/** Reads all saved sets from the phone. Returns an empty list if nothing is saved yet. */
export async function loadSets(): Promise<WorkoutSet[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as WorkoutSet[]) : [];
}

/** Saves the full list of sets to the phone, replacing what was there. */
export async function saveSets(sets: WorkoutSet[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}

/**
 * Adds one set to the saved list and returns the full updated list,
 * sorted so the most recent date comes first.
 */
export async function addSet(set: WorkoutSet): Promise<WorkoutSet[]> {
  const sets = await loadSets();
  const updated = [set, ...sets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await saveSets(updated);
  return updated;
}

/** Removes one set and returns the full updated list. */
export async function deleteSet(id: string): Promise<WorkoutSet[]> {
  const updated = (await loadSets()).filter((set) => set.id !== id);
  await saveSets(updated);
  return updated;
}

/** Removes every set logged on one day (e.g. "2026-11-13") and returns the full updated list. */
export async function deleteSetsOnDay(day: string): Promise<WorkoutSet[]> {
  const updated = (await loadSets()).filter((set) => dayKey(new Date(set.createdAt)) !== day);
  await saveSets(updated);
  return updated;
}
