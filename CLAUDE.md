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
- [x] Removed the Log tab — calendar is the home screen; tab bar kept with one Calendar tab.
- [x] Day page — tapping a date opens a page for that day (its sets + the add-set form, which logs onto that date).
- [x] Delete a set (✕ on its row) and delete a whole workout (= all sets on that day), both with a confirmation.
- [x] Add form: a Sets stepper (1–20) and a Weight + Reps row for every set, so each set can have its own numbers. Sets can be added all at once or one at a time: the exercise name and rows stay until every set is added (added rows get a ✓ and lock; the next row is pre-filled with the previous set's numbers). The user logs set by set during the workout and does not want to retype the exercise name.
- [x] Day page laid out like the user's own notes (screenshot 2026-11-13): a workout name for the day (e.g. "Glutes"), then numbered exercises, each with one cell per set ("170 lb • 12"). Tapping a cell opens that set's note and delete.
- [ ] Progressive overload from a user-entered formula
- [x] Notes: a notes box on each set on the day page, saved automatically (shortly after typing stops, on blur, and when the page closes). The user asked for notes per set, not per workout.
- [ ] Stopwatch

Not yet decided / not built: editing a set. A "workout" currently means all the sets logged on one day; there is no separate workout record yet.

Weight unit: a kg/lb toggle sits next to the weight box. Each set stores the unit it was entered in (no conversion); the last chosen unit is remembered (key `weight-unit-v1`). Sets logged before this have no unit.

## How the code is organised

The user wants the bottom tab bar kept, currently with a single Calendar tab (they removed the Log page, then asked for the bar back on 2026-11-13). New features like the stopwatch can become new tabs.

- `src/app/_layout.tsx` — root layout, renders the tab bar from `src/components/app-tabs.tsx` (NativeTabs).
- `src/app/(calendar)/` — the Calendar tab, a Stack (`_layout.tsx`). In SDK 58 `Stack` is imported from `expo-router/stack`, not `expo-router`.
  - `index.tsx` — the month grid (home screen, `/`). Tapping a date opens the day page.
  - `day/[date].tsx` — the day page (`/day/2026-11-13`): add-set form plus that day's sets, with delete. One FlatList with `contentInsetAdjustmentBehavior="automatic"` so content starts below the transparent header.
- `src/components/add-set-form.tsx` — the add-set form (with kg/lb switch). Takes a `day`.
- `src/components/exercise-card.tsx` — one exercise on the day page: numbered title, a cell per set, and the selected set's note box + delete.
- `src/hooks/use-autosave.ts` — debounced save used by the note boxes and the workout name.
- `src/lib/sets-storage.ts` — the `WorkoutSet` type plus loading/saving sets with AsyncStorage (key `workout-sets-v1`). Sets are kept sorted newest date first. Also stores one workout name per day (key `workout-names-v1`).
- `src/lib/dates.ts` — `dayKey` / `parseDayKey` (local-time `YYYY-MM-DD`).

## Notes for the progressive overload piece

In the user's own notes each set looks like `170lb•12 ⬆️(2)`. The arrow and the number in brackets mean they increased or decreased weight or reps. On 2026-11-13 they said to ignore the arrows and brackets for now; ask what exactly the number means before building it.
