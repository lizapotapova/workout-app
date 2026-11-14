import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ProgressionHint } from '@/components/progression-hint';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { timeOnDay } from '@/lib/dates';
import { exerciseKey } from '@/lib/exercises';
import { parseReps, parseWeight } from '@/lib/numbers';
import { suggestNext, type ProgressionSettings } from '@/lib/progression';
import {
  addSets,
  loadUnit,
  saveUnit,
  type WeightUnit,
  type WorkoutSet,
} from '@/lib/sets-storage';

const UNITS: WeightUnit[] = ['kg', 'lb'];
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
 *    have its own numbers. A box suggests the weight and reps for this time, worked out
 *    from the progression formula.
 *
 * Sets can be added all at once or one at a time as the workout goes on. The exercise
 * name and the rows stay until every set has been added; only then does the form clear.
 */
export function AddSetForm({ day, history, settings, onSaved }: Props) {
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
  const [unit, setUnit] = useState<WeightUnit>('kg');

  // Start with the unit chosen last time.
  useEffect(() => {
    loadUnit()
      .then(setUnit)
      .catch(() => {});
  }, []);

  function chooseUnit(next: WeightUnit) {
    setUnit(next);
    // Remember the choice for next time. Not critical if this fails.
    saveUnit(next).catch(() => {});
  }

  function changeRow(index: number, field: keyof SetInput, text: string) {
    const next = [...rows];
    // Fill any gap so that every row up to this one exists.
    for (let i = 0; i <= index; i++) next[i] = next[i] ?? EMPTY_ROW;
    next[index] = { ...next[index], [field]: text };
    setRows(next);
  }

  /** Empties the form, ready for the next exercise. The number of sets and the unit stay. */
  function startNextExercise() {
    setExercise('');
    setSearch('');
    setRows([]);
    setSavedCount(0);
  }

  function submit() {
    const name = exercise.trim();
    if (name === '') return;

    // Take every filled-in row after the ones already added, stopping at the first empty row.
    const values: { weight: number; reps: number }[] = [];
    for (let i = savedCount; i < setCount; i++) {
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

        // More sets to go: keep the exercise name, and start the next row with the same
        // numbers as the set just added, since they are often the same or close.
        setSavedCount(nowSaved);
        const next = [...rows];
        for (let i = 0; i <= nowSaved; i++) next[i] = next[i] ?? EMPTY_ROW;
        const nextRow = next[nowSaved];
        if (nextRow.weight.trim() === '' && nextRow.reps.trim() === '') {
          next[nowSaved] = next[nowSaved - 1];
        }
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

  function pickExercise(name: string) {
    setExercise(name);
    setSearch('');
  }

  /** The keyboard's Done key: picks the exercise with that exact name, or adds it as new. */
  function pickTyped() {
    if (searchKey === '') return;
    pickExercise(knownNames.get(searchKey) ?? search.trim());
  }

  // What the formula suggests for this exercise today. Hidden once sets are being added.
  const suggestion =
    settings && savedCount === 0 ? suggestNext(history, exercise, day, settings) : null;

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
    const suggestedUnit = suggestion.nextSets[0].unit;
    if (suggestedUnit) chooseUnit(suggestedUnit);
  }

  // While some sets are already added, the count can't go below the next set to fill in.
  const minSets = savedCount + 1;
  const setNumbers = Array.from({ length: setCount }, (_, i) => i);

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

      {suggestion && <ProgressionHint suggestion={suggestion} onUse={fillFromSuggestion} />}

      <View style={styles.row}>
        <View style={[styles.stepper, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.stepperLabel}>
            Sets
          </ThemedText>
          <Pressable
            onPress={() => setSetCount(Math.max(minSets, setCount - 1))}
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
            onPress={() => setSetCount(Math.min(MAX_SETS, setCount + 1))}
            disabled={setCount >= MAX_SETS}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="One set more"
            style={[stepperButtonStyle, setCount >= MAX_SETS && styles.disabled]}>
            <ThemedText type="smallBold">+</ThemedText>
          </Pressable>
        </View>

        <View style={styles.spacer} />

        <View style={[styles.unitToggle, { backgroundColor: theme.backgroundElement }]}>
          {UNITS.map((option) => {
            const selected = option === unit;
            return (
              <Pressable
                key={option}
                onPress={() => chooseUnit(option)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.unitOption, selected && { backgroundColor: theme.text }]}>
                <ThemedText
                  type="smallBold"
                  style={{ color: selected ? theme.background : theme.textSecondary }}>
                  {option}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {setNumbers.map((i) => {
        const done = i < savedCount;
        return (
          <View key={i} style={[styles.row, done && styles.done]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.setLabel}>
              {done ? '✓ ' : ''}Set {i + 1}
            </ThemedText>
            <TextInput
              style={[inputStyle, styles.rowInput]}
              placeholder="Weight"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={`Weight for set ${i + 1}`}
              value={rows[i]?.weight ?? ''}
              onChangeText={(text) => changeRow(i, 'weight', text)}
              keyboardType="decimal-pad"
              editable={!done}
            />
            <TextInput
              style={[inputStyle, styles.rowInput]}
              placeholder="Reps"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={`Reps for set ${i + 1}`}
              value={rows[i]?.reps ?? ''}
              onChangeText={(text) => changeRow(i, 'reps', text)}
              keyboardType="number-pad"
              editable={!done}
            />
          </View>
        );
      })}

      <Pressable
        onPress={submit}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.text, opacity: pressed ? 0.7 : 1 },
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          {savedCount > 0 ? `Add set ${savedCount + 1}` : 'Add'}
        </ThemedText>
      </Pressable>

      {savedCount > 0 && (
        <Pressable
          onPress={startNextExercise}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.finish, pressed && styles.disabled]}>
          <ThemedText type="small" themeColor="textSecondary">
            Finish this exercise early
          </ThemedText>
        </Pressable>
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
  rowInput: {
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
  setLabel: {
    width: 68,
  },
  done: {
    opacity: 0.5,
  },
  finish: {
    alignSelf: 'center',
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
  unitToggle: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  unitOption: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
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
