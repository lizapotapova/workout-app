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
  /** Free-text note for this set. Missing or empty when there is no note. */
  note?: string;
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

// Changes run one after another, never at the same time. Each change reads the saved list,
// edits it and writes it back, so two overlapping changes could otherwise undo each other.
let lastChange: Promise<unknown> = Promise.resolve();

function changeSets(change: (sets: WorkoutSet[]) => WorkoutSet[]): Promise<WorkoutSet[]> {
  const result = lastChange.then(async () => {
    const updated = change(await loadSets());
    await saveSets(updated);
    return updated;
  });
  lastChange = result.catch(() => {});
  return result;
}

/**
 * Adds one or more sets to the saved list and returns the full updated list,
 * sorted so the most recent date comes first.
 */
export function addSets(newSets: WorkoutSet[]): Promise<WorkoutSet[]> {
  return changeSets((sets) =>
    [...newSets, ...sets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

/** Removes one set and returns the full updated list. */
export function deleteSet(id: string): Promise<WorkoutSet[]> {
  return changeSets((sets) => sets.filter((set) => set.id !== id));
}

/** Removes every set logged on one day (e.g. "2026-11-13") and returns the full updated list. */
export function deleteSetsOnDay(day: string): Promise<WorkoutSet[]> {
  return changeSets((sets) => sets.filter((set) => dayKey(new Date(set.createdAt)) !== day));
}

/** Saves the note for one set and returns the full updated list. */
export function saveSetNote(id: string, note: string): Promise<WorkoutSet[]> {
  return changeSets((sets) => sets.map((set) => (set.id === id ? { ...set, note } : set)));
}

// ---- Workout names: one optional name per day, e.g. "Glutes" ----

const NAMES_KEY = 'workout-names-v1';

/** All saved names, as { "2026-11-13": "Glutes", ... }. */
async function loadWorkoutNames(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(NAMES_KEY);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
}

/** Reads the workout name for one day. Returns '' if the day has no name. */
export async function loadWorkoutName(day: string): Promise<string> {
  return (await loadWorkoutNames())[day] ?? '';
}

/** Saves the workout name for one day. An empty name removes it. */
export function saveWorkoutName(day: string, name: string): Promise<void> {
  const result = lastChange.then(async () => {
    const names = await loadWorkoutNames();
    if (name.trim() === '') delete names[day];
    else names[day] = name;
    await AsyncStorage.setItem(NAMES_KEY, JSON.stringify(names));
  });
  lastChange = result.catch(() => {});
  return result;
}
