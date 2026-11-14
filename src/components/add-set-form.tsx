import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, parseDayKey } from '@/lib/dates';
import { parseReps, parseWeight } from '@/lib/numbers';
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

/**
 * The date and time to store on a new set. For today (or no day given) that's right now.
 * For another day it's that day with the current clock time, so sets added one after
 * another stay in the order they were entered.
 */
function timeFor(day: string | undefined): Date {
  const now = new Date();
  const date = day && day !== dayKey(now) ? parseDayKey(day) : null;
  if (!date) return now;
  date.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return date;
}

type Props = {
  /** The day to log the sets on, e.g. "2026-11-13". Leave out to log them for right now. */
  day?: string;
  /** Called after the sets are saved, with the full updated list of sets. */
  onSaved: (sets: WorkoutSet[]) => void;
};

/**
 * The form for adding one exercise: its name, how many sets, and a Weight and Reps box
 * for every set, so each set can have its own numbers.
 *
 * Sets can be added all at once or one at a time as the workout goes on. The exercise
 * name and the rows stay until every set has been added; only then does the form clear.
 */
export function AddSetForm({ day, onSaved }: Props) {
  const theme = useTheme();

  const [exercise, setExercise] = useState('');
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
    setRows([]);
    setSavedCount(0);
  }

  function submit() {
    const name = exercise.trim();
    if (name === '') {
      Alert.alert('Enter an exercise name');
      return;
    }

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
    const start = timeFor(day).getTime();
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

  // While some sets are already added, the count can't go below the next set to fill in.
  const minSets = savedCount + 1;
  const setNumbers = Array.from({ length: setCount }, (_, i) => i);

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];
  const stepperButtonStyle = [styles.stepperButton, { backgroundColor: theme.background }];

  return (
    <View style={styles.form}>
      <TextInput
        style={inputStyle}
        placeholder="Exercise (e.g. Squat)"
        placeholderTextColor={theme.textSecondary}
        value={exercise}
        onChangeText={setExercise}
        autoCapitalize="sentences"
        returnKeyType="done"
      />

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
