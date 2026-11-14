import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ProgressionHint } from '@/components/progression-hint';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { timeOnDay } from '@/lib/dates';
import { exerciseKey } from '@/lib/exercises';
import { parseNumber, parseReps, parseWeight } from '@/lib/numbers';
import {
  DEFAULT_SETTINGS,
  formatLastTime,
  stepsFor,
  suggestNext,
  type ProgressionSettings,
} from '@/lib/progression';
import { addSets, type WeightUnit, type WorkoutSet } from '@/lib/sets-storage';

/** The most sets one exercise can have in the form. */
const MAX_SETS = 20;

/** What is typed into one set's row. */
type SetInput = { weight: string; reps: string };
const EMPTY_ROW: SetInput = { weight: '', reps: '' };

/** How many exercises to offer as chips at once. */
const MAX_CHIPS = 8;

type Props = {
  /** The day to log the sets on, e.g. "2026-11-13". */
  day: string;
  /** Every saved set, used to look up earlier sessions of the exercise being typed. */
  history: WorkoutSet[];
  /** The weight unit chosen in Settings. `history` is already converted to it. */
  unit: WeightUnit;
  /** The progression formula's numbers. Suggestions are hidden until these have loaded. */
  settings: ProgressionSettings | null;
  /** Called after the sets are saved, with the full updated list of sets. */
  onSaved: (sets: WorkoutSet[]) => void;
};

/**
 * The form for adding one exercise. It has two stages:
 *
 * 1. Pick the exercise: the most recently done exercises are shown as chips to tap.
 *    The search box narrows them down, and offers to add what was typed as a new one.
 * 2. Enter the sets: how many, and a Weight and Reps box for every set, so each set can
 *    have its own numbers. The boxes start with the numbers from the last session, and
 *    − and + buttons change them without the keyboard. When the progression formula says
 *    it is time for a step up, a box offers the new numbers.
 *
 * The main button adds one set at a time, as the workout goes on ("Add set 2"); a
 * smaller link adds all the remaining sets at once. The exercise name and the rows stay
 * until every set has been added; only then does the form clear.
 */
export function AddSetForm({ day, history, unit, settings, onSaved }: Props) {
  const theme = useTheme();

  // The exercise that was picked. Empty while the picker is showing.
  const [exercise, setExercise] = useState('');
  // What is typed into the picker's search box.
  const [search, setSearch] = useState('');
  const [setCount, setSetCount] = useState(1);
  // What has been typed for each set. Rows that were never touched are simply missing.
  const [rows, setRows] = useState<SetInput[]>([]);
  // How many of this exercise's sets have already been added. They show a ✓ and are locked.
  const [savedCount, setSavedCount] = useState(0);

  /** Changes one box of one set. The other sets are left alone. */
  function changeRow(index: number, field: keyof SetInput, text: string) {
    const next = Array.from({ length: setCount }, (_, i) => rows[i] ?? EMPTY_ROW);
    next[index] = { ...next[index], [field]: text };
    setRows(next);
  }

  // One tap on − or + changes reps by 1, and weight by this exercise's step from Settings.
  const weightStep = stepsFor(settings ?? DEFAULT_SETTINGS, exercise).weight;

  function stepRow(index: number, field: keyof SetInput, direction: 1 | -1) {
    const current = parseNumber((rows[index] ?? EMPTY_ROW)[field]) ?? 0;
    const size = field === 'reps' ? 1 : weightStep;
    const smallest = field === 'reps' ? 1 : 0;
    // Rounded to avoid results like 172.50000000000003.
    const next = Math.max(smallest, Math.round((current + direction * size) * 100) / 100);
    changeRow(index, field, String(next));
  }

  /** Changes how many sets there are. A new row starts as a copy of the row above it. */
  function changeSetCount(count: number) {
    const next = Array.from({ length: count }, (_, i) => rows[i] ?? rows[setCount - 1] ?? EMPTY_ROW);
    // Rows that are already added keep their place even if the count went down and up.
    setRows(next.length >= rows.length ? next : [...next, ...rows.slice(next.length)]);
    setSetCount(count);
  }

  /** Empties the form, ready for the next exercise. The number of sets stays. */
  function startNextExercise() {
    setExercise('');
    setSearch('');
    setRows([]);
    setSavedCount(0);
  }

  /** Adds the next set, or with `all` every remaining set that is filled in. */
  function submit(all: boolean) {
    const name = exercise.trim();
    if (name === '') return;

    // Take the next row, or with `all` every row after the ones already added, stopping
    // at the first empty row.
    const values: { weight: number; reps: number }[] = [];
    const end = all ? setCount : savedCount + 1;
    for (let i = savedCount; i < end; i++) {
      const row = rows[i] ?? EMPTY_ROW;
      const isEmpty = row.weight.trim() === '' && row.reps.trim() === '';
      if (isEmpty && values.length > 0) break;

      const weightValue = parseWeight(row.weight);
      const repsValue = parseReps(row.reps);
      if (weightValue === null) {
        Alert.alert(
          `Enter the weight for set ${i + 1} as a number`,
          'Use 0 for bodyweight exercises.',
        );
        return;
      }
      if (repsValue === null) {
        Alert.alert(`Enter the reps for set ${i + 1} as a whole number`);
        return;
      }
      values.push({ weight: weightValue, reps: repsValue });
    }

    // Each set is stamped a millisecond after the one before, so they keep their order.
    const start = timeOnDay(day).getTime();
    const newSets: WorkoutSet[] = values.map((value, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      exercise: name,
      weight: value.weight,
      unit,
      reps: value.reps,
      createdAt: new Date(start + i).toISOString(),
    }));

    addSets(newSets)
      .then((sets) => {
        onSaved(sets);

        const nowSaved = savedCount + newSets.length;
        if (nowSaved >= setCount) {
          // Every set of this exercise is in, so clear the form.
          startNextExercise();
          return;
        }

        // More sets to go: keep the exercise name. Any box of the next row that is still
        // empty starts with the number from the set just added.
        setSavedCount(nowSaved);
        const next = [...rows];
        for (let i = 0; i <= nowSaved; i++) next[i] = next[i] ?? EMPTY_ROW;
        const previous = next[nowSaved - 1];
        const nextRow = next[nowSaved];
        next[nowSaved] = {
          weight: nextRow.weight.trim() === '' ? previous.weight : nextRow.weight,
          reps: nextRow.reps.trim() === '' ? previous.reps : nextRow.reps,
        };
        setRows(next);
      })
      .catch(() => Alert.alert('Could not save', 'Please try again.'));
  }

  // Every exercise done before, most recent first ("squat" and "Squat" count as one).
  const knownNames = new Map<string, string>();
  for (const set of history) {
    const key = exerciseKey(set.exercise);
    if (!knownNames.has(key)) knownNames.set(key, set.exercise.trim());
  }
  // The chips: the recent exercises, narrowed down to the search text if there is any.
  const searchKey = exerciseKey(search);
  const chips = [...knownNames.entries()]
    .filter(([key]) => key.includes(searchKey))
    .slice(0, MAX_CHIPS)
    .map(([, name]) => name);
  // Typed text that isn't an existing exercise can be added as a new one.
  const canAddNew = searchKey !== '' && !knownNames.has(searchKey);

  /** Picks the exercise and starts the form with what was done in its last session. */
  function pickExercise(name: string) {
    setExercise(name);
    setSearch('');

    const last = suggestNext(history, name, day, settings ?? DEFAULT_SETTINGS)?.lastSets;
    if (!last) {
      setRows([]);
      return;
    }
    const count = Math.min(MAX_SETS, last.length);
    setSetCount(count);
    setRows(last.slice(0, count).map((set) => ({ weight: String(set.weight), reps: String(set.reps) })));
  }

  /** The keyboard's Done key: picks the exercise with that exact name, or adds it as new. */
  function pickTyped() {
    if (searchKey === '') return;
    pickExercise(knownNames.get(searchKey) ?? search.trim());
  }

  // The last session of this exercise, and what the formula suggests for today.
  const suggestion = settings ? suggestNext(history, exercise, day, settings) : null;

  /** Copies the suggested sets into the form's rows, ready to add or adjust. */
  function fillFromSuggestion() {
    if (!suggestion) return;
    const count = Math.min(MAX_SETS, suggestion.nextSets.length);
    setSetCount(count);
    setRows(
      suggestion.nextSets
        .slice(0, count)
        .map((set) => ({ weight: String(set.weight), reps: String(set.reps) })),
    );
  }

  // While some sets are already added, the count can't go below the next set to fill in.
  const minSets = savedCount + 1;
  const setNumbers = Array.from({ length: setCount }, (_, i) => i);
  // How many sets "Add all" would add: the filled-in rows that are not added yet.
  let remaining = 0;
  for (let i = savedCount; i < setCount; i++) {
    const row = rows[i] ?? EMPTY_ROW;
    if (row.weight.trim() === '' && row.reps.trim() === '') break;
    remaining++;
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];
  const stepperButtonStyle = [styles.stepperButton, { backgroundColor: theme.background }];

  // Stage 1: no exercise picked yet, so show only the picker.
  if (exercise === '') {
    return (
      <View style={styles.form}>
        <TextInput
          style={inputStyle}
          placeholder={knownNames.size > 0 ? 'Search or add an exercise' : 'Exercise (e.g. Squat)'}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Search or add an exercise"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={pickTyped}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
          clearButtonMode="while-editing"
        />

        {searchKey === '' && chips.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Recent
          </ThemedText>
        )}

        {(chips.length > 0 || canAddNew) && (
          <View style={styles.chips}>
            {chips.map((name) => (
              <Pressable
                key={name}
                onPress={() => pickExercise(name)}
                accessibilityRole="button"
                accessibilityLabel={`Pick ${name}`}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.disabled,
                ]}>
                <ThemedText style={styles.chipText}>{name}</ThemedText>
              </Pressable>
            ))}
            {canAddNew && (
              <Pressable
                onPress={() => pickExercise(search.trim())}
                accessibilityRole="button"
                accessibilityLabel={`Add new exercise ${search.trim()}`}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: theme.accentSoft },
                  pressed && styles.disabled,
                ]}>
                <ThemedText style={[styles.chipText, { color: theme.accent }]}>
                  + Add “{search.trim()}”
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  }

  // Stage 2: the exercise is picked, so show its sets.
  return (
    <View style={styles.form}>
      <View style={styles.row}>
        <ThemedText style={styles.picked} numberOfLines={2}>
          {exercise}
        </ThemedText>
        {/* The exercise can be swapped until its first set has been added. */}
        {savedCount === 0 && (
          <Pressable
            onPress={startNextExercise}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Pick a different exercise"
            style={({ pressed }) => [
              styles.change,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.disabled,
            ]}>
            <ThemedText type="smallBold">Change</ThemedText>
          </Pressable>
        )}
      </View>

      {suggestion && (
        <ThemedText type="small" themeColor="textSecondary">
          Last time, {formatLastTime(suggestion.lastDay, suggestion.lastSets)}
        </ThemedText>
      )}

      {/* The suggestion is hidden once sets are being added. */}
      {suggestion && savedCount === 0 && (
        <ProgressionHint suggestion={suggestion} onUse={fillFromSuggestion} />
      )}

      <View style={styles.row}>
        <View style={[styles.stepper, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.stepperLabel}>
            Sets
          </ThemedText>
          <Pressable
            onPress={() => changeSetCount(Math.max(minSets, setCount - 1))}
            disabled={setCount <= minSets}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="One set fewer"
            style={[stepperButtonStyle, setCount <= minSets && styles.disabled]}>
            <ThemedText type="smallBold">−</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" style={styles.stepperValue}>
            {setCount}
          </ThemedText>
          <Pressable
            onPress={() => changeSetCount(Math.min(MAX_SETS, setCount + 1))}
            disabled={setCount >= MAX_SETS}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="One set more"
            style={[stepperButtonStyle, setCount >= MAX_SETS && styles.disabled]}>
            <ThemedText type="smallBold">+</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.setLabel} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.columnTitle}>
          Weight ({unit})
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.columnTitle}>
          Reps
        </ThemedText>
      </View>

      {setNumbers.map((i) => {
        const done = i < savedCount;
        // One box with − and + on either side of it.
        const box = (field: keyof SetInput, label: string) => (
          <View style={[styles.stepBox, { backgroundColor: theme.backgroundElement }]}>
            {!done && (
              <Pressable
                onPress={() => stepRow(i, field, -1)}
                accessibilityRole="button"
                accessibilityLabel={`Less ${label} for set ${i + 1}`}
                style={({ pressed }) => [styles.stepButton, pressed && styles.disabled]}>
                <ThemedText style={[styles.stepSign, { color: theme.accent }]}>−</ThemedText>
              </Pressable>
            )}
            <TextInput
              style={[styles.stepInput, { color: theme.text }]}
              placeholder={field === 'weight' ? 'Weight' : 'Reps'}
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={`${field === 'weight' ? 'Weight' : 'Reps'} for set ${i + 1}`}
              value={rows[i]?.[field] ?? ''}
              onChangeText={(text) => changeRow(i, field, text)}
              keyboardType={field === 'weight' ? 'decimal-pad' : 'number-pad'}
              editable={!done}
              selectTextOnFocus
            />
            {!done && (
              <Pressable
                onPress={() => stepRow(i, field, 1)}
                accessibilityRole="button"
                accessibilityLabel={`More ${label} for set ${i + 1}`}
                style={({ pressed }) => [styles.stepButton, pressed && styles.disabled]}>
                <ThemedText style={[styles.stepSign, { color: theme.accent }]}>+</ThemedText>
              </Pressable>
            )}
          </View>
        );
        return (
          <View key={i} style={[styles.row, done && styles.done]}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.setLabel}>
              {done ? '✓' : i + 1}
            </ThemedText>
            {box('weight', 'weight')}
            {box('reps', 'reps')}
          </View>
        );
      })}

      <Pressable
        onPress={() => submit(false)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.text, opacity: pressed ? 0.7 : 1 },
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          {setCount > 1 ? `Add set ${savedCount + 1}` : 'Add set'}
        </ThemedText>
      </Pressable>

      {(remaining > 1 || savedCount > 0) && (
        <View style={styles.links}>
          {remaining > 1 && (
            <Pressable
              onPress={() => submit(true)}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => [styles.link, pressed && styles.disabled]}>
              <ThemedText type="small" themeColor="textSecondary">
                Add all {remaining} sets
              </ThemedText>
            </Pressable>
          )}
          {savedCount > 0 && (
            <Pressable
              onPress={startNextExercise}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => [styles.link, pressed && styles.disabled]}>
              <ThemedText type="small" themeColor="textSecondary">
                Finish this exercise early
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  // Chips are tall enough to hit easily with a thumb.
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 500,
  },
  picked: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  change: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  columnTitle: {
    flex: 1,
    textAlign: 'center',
  },
  // A number box with its − and + buttons, all in one rounded shape.
  stepBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
  },
  stepButton: {
    width: 42,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSign: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: 600,
  },
  stepInput: {
    flex: 1,
    height: 44,
    fontSize: 17,
    fontWeight: 600,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  setLabel: {
    width: 20,
    textAlign: 'center',
  },
  done: {
    opacity: 0.5,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  link: {
    paddingVertical: Spacing.one,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 4,
    gap: Spacing.two,
  },
  stepperLabel: {
    paddingLeft: Spacing.two,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 20,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  button: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
});
