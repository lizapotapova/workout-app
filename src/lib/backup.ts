import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { dayKey } from '@/lib/dates';
import { loadSets } from '@/lib/sets-storage';

// Everything the app keeps on the phone, by the name it is saved under. The copied
// workout and the stopwatch are left out: they are only temporary.
const KEYS = [
  'workout-sets-v1',
  'workout-names-v1',
  'exercise-notes-v1',
  'weight-unit-v1',
  'progression-settings-v1',
];
const SETS_KEY = 'workout-sets-v1';

/** Written into every export, so an import can tell the file came from this app. */
const APP_MARK = 'workout-log';

type Backup = {
  app: string;
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
};

/**
 * Writes all the app's data into one file and opens the phone's share sheet for it,
 * where it can be saved to Files, sent by AirDrop, emailed and so on.
 */
export async function exportWorkouts(): Promise<void> {
  // Reading the sets first waits for any save that is still on its way.
  await loadSets();

  const data: Record<string, unknown> = {};
  for (const [key, raw] of await AsyncStorage.multiGet(KEYS)) {
    if (raw === null) continue;
    // Most values are saved as JSON text; unpacking them keeps the file readable.
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = raw;
    }
  }
  const backup: Backup = {
    app: APP_MARK,
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };

  const file = new File(Paths.cache, `workouts-${dayKey(new Date())}.json`);
  file.create({ overwrite: true });
  await file.write(JSON.stringify(backup, null, 2));

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Export my workouts',
  });
}

/** A file that was picked and checked, ready to replace the app's data. */
export type PickedBackup = {
  /** How many sets the file holds, and on how many different days. */
  setCount: number;
  dayCount: number;
  /** When the file was exported, e.g. "Nov 15, 2026". Empty if unknown. */
  exportedOn: string;
  /** Replaces everything in the app with the file's contents. */
  restore: () => Promise<void>;
};

function isSet(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const set = value as Record<string, unknown>;
  return (
    typeof set.id === 'string' &&
    typeof set.exercise === 'string' &&
    typeof set.weight === 'number' &&
    typeof set.reps === 'number' &&
    typeof set.createdAt === 'string' &&
    !Number.isNaN(new Date(set.createdAt).getTime())
  );
}

/**
 * Lets the user pick a file and checks that it is an export from this app. Nothing is
 * changed yet: call `restore` on the result to do that. Returns null if the user
 * cancelled. Throws an Error with a readable message if the file can't be used.
 */
export async function pickBackup(): Promise<PickedBackup | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;

  let backup: Backup;
  try {
    backup = JSON.parse(await new File(picked.assets[0].uri).text());
  } catch {
    throw new Error('That file could not be read. Pick a file made with "Export my workouts".');
  }

  const data = backup?.data;
  if (backup?.app !== APP_MARK || typeof data !== 'object' || data === null) {
    throw new Error('That file is not an export from this app.');
  }
  const sets = data[SETS_KEY] ?? [];
  if (!Array.isArray(sets) || !sets.every(isSet)) {
    throw new Error('The workouts in that file are damaged, so nothing was changed.');
  }

  const exported = new Date(backup.exportedAt);
  return {
    setCount: sets.length,
    dayCount: new Set(sets.map((set) => dayKey(new Date(set.createdAt)))).size,
    exportedOn: Number.isNaN(exported.getTime())
      ? ''
      : exported.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    restore: async () => {
      await loadSets();
      const toSave: [string, string][] = [];
      const toRemove: string[] = [];
      for (const key of KEYS) {
        const value = data[key];
        if (value === undefined || value === null) toRemove.push(key);
        else toSave.push([key, typeof value === 'string' ? value : JSON.stringify(value)]);
      }
      await AsyncStorage.multiSet(toSave);
      await AsyncStorage.multiRemove(toRemove);
    },
  };
}
