@AGENTS.md

# Workout app

## Who I'm working with

The owner is a complete beginner building their first app. They test on a real iPhone with **Expo Go**.

## Rules for working with them

- Build **one small piece at a time**, then stop and tell them exactly what to test on their phone.
- Explain what changed in plain language (no unexplained jargon).
- Only use libraries that work in **Expo Go** (check the "Included in Expo Go" note in the Expo docs before installing anything).
- Do **not** upgrade Expo. Do **not** run `npm audit fix`.

## The app (overall plan)

A workout log:

1. Record exercises with weight and reps.
2. Automatically calculate progressive overload (weight and rep progression) from a formula the user enters.
3. Notes on each workout.
4. A built-in stopwatch.

## Progress

- [x] Piece 1: workout log screen — add a set (exercise, weight, reps), see sets in a list, saved on the phone.
- [x] kg/lb switch next to the weight box.
- [x] Calendar tab — month grid built by hand (no library), dot on days with sets. Weeks start on Monday.
- [x] Removed the Log tab and the tab bar — calendar is the home screen.
- [x] Day page — tapping a date opens a page for that day (its sets + the add-set form, which logs onto that date).
- [x] Delete a set (✕ on its row) and delete a whole workout (= all sets on that day), both with a confirmation.
- [ ] Progressive overload from a user-entered formula
- [ ] Notes on each workout
- [ ] Stopwatch

Not yet decided / not built: editing a set. A "workout" currently means all the sets logged on one day; there is no separate workout record yet.

Weight unit: a kg/lb toggle sits next to the weight box. Each set stores the unit it was entered in (no conversion); the last chosen unit is remembered (key `weight-unit-v1`). Sets logged before this have no unit.

## How the code is organised

There are no tabs: the app is a single Stack (the user asked to remove the separate Log page on 2026-11-13).

- `src/app/_layout.tsx` — the root Stack. In SDK 58 `Stack` is imported from `expo-router/stack`, not `expo-router`.
- `src/app/index.tsx` — the home screen: the calendar month grid. Tapping a date opens the day page.
- `src/app/day/[date].tsx` — the day page (`/day/2026-11-13`): add-set form plus that day's sets. One FlatList with `contentInsetAdjustmentBehavior="automatic"` so content starts below the transparent header.
- `src/components/add-set-form.tsx` — the add-set form (with kg/lb switch). Takes a `day`.
- `src/components/set-row.tsx` — one row in a list of sets.
- `src/lib/sets-storage.ts` — the `WorkoutSet` type plus loading/saving sets with AsyncStorage (key `workout-sets-v1`). `addSet` keeps the list sorted newest date first.
- `src/lib/dates.ts` — `dayKey` / `parseDayKey` (local-time `YYYY-MM-DD`).
