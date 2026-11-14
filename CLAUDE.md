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
- [x] Day page laid out like the user's own notes (screenshot 2026-11-13): a workout name for the day (e.g. "Glutes"), then numbered exercise boxes. On the day page each set is its own row inside the box ("Set 1 … 170 lb • 12"; the user picked this look on 2026-11-13, day page only). The calendar summary is a compact note-style box: one line per exercise ("1. Glute bridge  170lb•12  170lb•12"), so the month and today's workout fit on one screen.
- [x] Edit a set: tapping a set's row shows editable Weight and Reps (autosaved when valid) plus the note and delete. A dashed "+ Add set" row adds another set to that exercise, copied from its last set.
- [x] Calendar screen shows today's workout (read-only summary) below the month grid when there is one; tapping it opens today's page.
- [x] Delete a whole exercise (✕ next to its name, with confirmation). Exercise numbers are computed from the list, so they renumber automatically.
- [x] Compact day page (user wants to see the whole workout with little scrolling): tight spacing, each set row is its own slim cell (the user wants sets visibly separated into cells), "+ Set" moved next to the exercise name, and the add form collapsed behind a "+ Exercise" button once the day has sets.
- [x] General note per exercise per day: a small "Note" line at the bottom of each exercise box, autosaved (key `exercise-notes-v1`, entries keyed `day|exercise name lowercased`).
- [x] Progressive overload: suggestion box in the add form (with a "Use" button and tappable matching exercise names) and a Settings tab for the formula's numbers.
- [x] Notes: a notes box on each set on the day page, saved automatically (shortly after typing stops, on blur, and when the page closes). The user asked for notes per set, not per workout.
- [x] Copy and paste a whole workout between days: "Copy workout" at the bottom of a day, then a "Paste" bar at the top of other days (key `copied-workout-v1`). Copies exercises, sets and the name, not notes; pasting adds to the day.
- [x] Stopwatch tab: start, stop, lap, reset (`src/app/stopwatch.tsx`, logic in `src/lib/stopwatch.ts`, key `stopwatch-v1`). It stores the clock time of the Start press instead of counting, so it keeps running across tabs and while the app is closed.
- [x] Floating stopwatch bar on every screen: `src/components/stopwatch-bar.tsx`, drawn in the root layout above the tab bar. Always shown, also at zero (on 2026-11-13 the user said it must not disappear after Reset); hidden only on the Stopwatch tab. Scrolling pages add `StopwatchBarSpace` to their bottom padding so it never covers the last row.

A "workout" currently means all the sets logged on one day; there is no separate workout record yet.

Weight unit: a kg/lb toggle sits next to the weight box. Each set stores the unit it was entered in (no conversion); the last chosen unit is remembered (key `weight-unit-v1`). Sets logged before this have no unit.

## How the code is organised

The user wants the bottom tab bar kept, with Calendar and Settings tabs (they removed the Log page, then asked for the bar back on 2026-11-13). The stopwatch can become another tab.

- `src/app/_layout.tsx` — root layout, renders the tab bar from `src/components/app-tabs.tsx` (NativeTabs).
- `src/app/(calendar)/` — the Calendar tab, a Stack (`_layout.tsx`). In SDK 58 `Stack` is imported from `expo-router/stack`, not `expo-router`.
  - `index.tsx` — the month grid (home screen, `/`). Tapping a date opens the day page.
  - `day/[date].tsx` — the day page (`/day/2026-11-13`): add-set form plus that day's sets, with delete. One FlatList with `contentInsetAdjustmentBehavior="automatic"` so content starts below the transparent header.
- `src/components/add-set-form.tsx` — the add-set form (with kg/lb switch). Takes a `day`.
- `src/components/exercise-card.tsx` — one exercise on the day page: numbered title, a cell per set, and the selected set's note box + delete.
- `src/hooks/use-autosave.ts` — debounced save used by the note boxes and the workout name.
- `src/lib/sets-storage.ts` — the `WorkoutSet` type plus loading/saving sets with AsyncStorage (key `workout-sets-v1`). Sets are kept sorted newest date first. Also stores one workout name per day (key `workout-names-v1`).
- `src/components/workout-summary.tsx` — compact read-only workout (one text line per exercise), used under the calendar.
- `src/lib/exercises.ts` — `groupByExercise` and `formatSet`.
- `src/app/settings.tsx` — the Settings tab: weeks between steps, lower/upper step sizes, per-exercise body part and overrides. Autosaves.
- `src/components/progression-hint.tsx` — the "Suggested: …" box shown in the add form.
- `src/lib/numbers.ts` — `parseNumber` / `parseWeight` / `parseReps` for typed input.
- `src/lib/dates.ts` — `dayKey` / `parseDayKey` (local-time `YYYY-MM-DD`).

## Progression formula (given by the user on 2026-11-13)

In the user's words: lower body +2 reps for every exercise (+1 rep for split squat) every two weeks, after two weeks same reps and +2.5 lb (+5 lb for glute bridge); upper body +2 reps every two weeks, and after two weeks +2.5 lb and same reps.

How it is built (`src/lib/progression.ts`, pure and testable; storage in `src/lib/progression-storage.ts`, key `progression-settings-v1`):

- A session's level = weight and reps of its first set. The level starts on the first of the back-to-back sessions sharing it.
- Once `periodWeeks` (2) weeks have passed since then, the suggestion takes one step, added to every set of the last session. Steps alternate: reps first, then weight, then reps… (the kind is the opposite of the step that led to the current level).
- Before that, the suggestion is "same as last time" plus the date of the next step.
- Step sizes come from the exercise's body part (lower/upper), with optional per-exercise overrides. Exercises without settings count as lower body. Weight steps are added in whatever unit the sets were logged in.
- The arrows and bracketed numbers in the user's old notes (`170lb•12 ⬆️(2)`) marked these increases; showing them in the app has not been asked for.

## Look and feel

Set on 2026-11-13 when the user asked for the calendar page to look better (so far applied to the calendar page only, not the day page):

- One accent colour, cobalt blue (`accent`, with `accentSoft` for fills and `separator` for thin lines, in `src/constants/theme.ts`). Red stays reserved for delete.
- Headline text and day numbers use the rounded system font (`Fonts.rounded`).
- Calendar: the month name is the page headline (no separate "Calendar" title); workout days are filled circles in `accentSoft`, today has an accent ring.
