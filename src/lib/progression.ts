import { addDays, dayKey, parseDayKey } from '@/lib/dates';
import { exerciseKey } from '@/lib/exercises';
import { type WeightUnit, type WorkoutSet } from '@/lib/sets-storage';

// The progression formula ("progressive overload"):
//
//   Every `periodWeeks` weeks an exercise takes one step up. The steps take turns:
//   first more reps (same weight), then more weight (same reps), then more reps again…
//
// How big a step is comes from two numbers that apply to every exercise. A single
// exercise can have its own numbers instead (for example glute bridge: +5 weight).

/** How much one step adds. */
export type Steps = { reps: number; weight: number };

/** One exercise's own step sizes. `reps` / `weight` are only set when they differ from the general ones. */
export type ExerciseRule = {
  name: string;
  reps?: number;
  weight?: number;
};

export type ProgressionSettings = {
  /** How many weeks to stay at one level before the next step. */
  periodWeeks: number;
  /** The step sizes for every exercise that doesn't have its own. */
  steps: Steps;
  /** Per-exercise step sizes, keyed by `exerciseKey(name)`. */
  exercises: Record<string, ExerciseRule>;
};

export const DEFAULT_SETTINGS: ProgressionSettings = {
  periodWeeks: 2,
  steps: { reps: 2, weight: 2.5 },
  exercises: {
    'split squat': { name: 'Split squat', reps: 1 },
    'glute bridge': { name: 'Glute bridge', weight: 5 },
  },
};

/** The step sizes that apply to one exercise. */
export function stepsFor(settings: ProgressionSettings, exercise: string): Steps {
  const rule = settings.exercises[exerciseKey(exercise)];
  return {
    reps: rule?.reps ?? settings.steps.reps,
    weight: rule?.weight ?? settings.steps.weight,
  };
}

export type SuggestedSet = { weight: number; reps: number; unit?: WeightUnit };

/** "Nov 12: 170 lb × 12, 3 sets" when every set was the same, otherwise each set listed. */
export function formatLastTime(day: string, sets: SuggestedSet[]): string {
  const date = parseDayKey(day);
  const when = date
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : day;
  const one = (set: SuggestedSet) => `${set.weight}${set.unit ? ` ${set.unit}` : ''} × ${set.reps}`;
  const first = one(sets[0]);
  const what = sets.every((set) => one(set) === first)
    ? sets.length === 1
      ? first
      : `${first}, ${sets.length} sets`
    : sets.map(one).join(' / ');
  return `${when}: ${what}`;
}

export type Suggestion = {
  /** The most recent earlier day this exercise was done, and what was done. */
  lastDay: string;
  lastSets: SuggestedSet[];
  /** What to do this time, one entry per set. */
  nextSets: SuggestedSet[];
  /** What changed compared with last time. 'none' means it isn't time for a step yet. */
  change: 'reps' | 'weight' | 'none';
  /** How much was added (reps or weight). 0 when `change` is 'none'. */
  amount: number;
  /** What the next step will be, and the first day it applies. Only when `change` is 'none'. */
  upcoming?: { change: 'reps' | 'weight'; amount: number; day: string };
};

type Session = { day: string; sets: WorkoutSet[] };

/** Avoids results like 172.50000000000003 when adding decimals. */
function tidy(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Works out what to do for an exercise on `day`, from the sessions before that day.
 * Returns null if the exercise has never been done before that day.
 *
 * A session's "level" is the weight and reps of its first set. The level is counted as
 * starting on the first of the back-to-back sessions that share it. Once `periodWeeks`
 * weeks have passed since then, it's time for a step: reps if the step before was weight
 * (or if there was no step before), otherwise weight. The step is added to every set of
 * the last session.
 */
export function suggestNext(
  allSets: WorkoutSet[],
  exercise: string,
  day: string,
  settings: ProgressionSettings,
): Suggestion | null {
  const key = exerciseKey(exercise);
  if (key === '') return null;

  // Collect this exercise's earlier sessions, oldest first.
  const byDay = new Map<string, WorkoutSet[]>();
  for (const set of allSets) {
    if (exerciseKey(set.exercise) !== key) continue;
    const setDay = dayKey(new Date(set.createdAt));
    if (setDay >= day) continue;
    const list = byDay.get(setDay);
    if (list) list.push(set);
    else byDay.set(setDay, [set]);
  }
  const sessions: Session[] = [...byDay.entries()]
    .map(([sessionDay, sets]) => ({
      day: sessionDay,
      sets: sets.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
  if (sessions.length === 0) return null;

  const last = sessions[sessions.length - 1];
  const level = last.sets[0];
  const sameLevel = (session: Session) =>
    session.sets[0].weight === level.weight && session.sets[0].reps === level.reps;

  // Walk back to the first session of the current level.
  let start = sessions.length - 1;
  while (start > 0 && sameLevel(sessions[start - 1])) start--;
  const levelStartDay = sessions[start].day;

  // The step that led to the current level decides which kind comes next.
  const before = start > 0 ? sessions[start - 1].sets[0] : null;
  const lastStepWasReps = before !== null && level.weight <= before.weight && level.reps > before.reps;
  const nextChange: 'reps' | 'weight' = lastStepWasReps ? 'weight' : 'reps';

  const steps = stepsFor(settings, exercise);
  const amount = nextChange === 'reps' ? steps.reps : steps.weight;
  const dueDay = addDays(levelStartDay, settings.periodWeeks * 7);

  const lastSets: SuggestedSet[] = last.sets.map((set) => ({
    weight: set.weight,
    reps: set.reps,
    unit: set.unit,
  }));

  if (day < dueDay) {
    return {
      lastDay: last.day,
      lastSets,
      nextSets: lastSets,
      change: 'none',
      amount: 0,
      upcoming: { change: nextChange, amount, day: dueDay },
    };
  }

  return {
    lastDay: last.day,
    lastSets,
    nextSets: lastSets.map((set) =>
      nextChange === 'reps'
        ? { ...set, reps: set.reps + amount }
        : { ...set, weight: tidy(set.weight + amount) },
    ),
    change: nextChange,
    amount,
  };
}
