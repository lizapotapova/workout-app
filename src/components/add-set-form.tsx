import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, parseDayKey } from '@/lib/dates';
import {
  addSet,
  loadUnit,
  saveUnit,
  type WeightUnit,
  type WorkoutSet,
} from '@/lib/sets-storage';

const UNITS: WeightUnit[] = ['kg', 'lb'];

/** Turns typed text like "62,5" or "62.5" into a number. Returns null if it isn't a valid number. */
function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/**
 * The date and time to store on a new set. For today (or no day given) that's right now.
 * For another day it's that day with the current clock time, so sets added one after
 * another stay in the order they were entered.
 */
function timestampFor(day: string | undefined): string {
  const now = new Date();
  const date = day && day !== dayKey(now) ? parseDayKey(day) : null;
  if (!date) return now.toISOString();
  date.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return date.toISOString();
}

type Props = {
  /** The day to log the set on, e.g. "2026-11-13". Leave out to log it for right now. */
  day?: string;
  /** Called after a set is saved, with the full updated list of sets. */
  onSaved: (sets: WorkoutSet[]) => void;
};

/** The exercise / weight / reps boxes with the kg-lb switch and the "Add set" button. */
export function AddSetForm({ day, onSaved }: Props) {
  const theme = useTheme();

  const [exercise, setExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
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

  function submit() {
    const name = exercise.trim();
    const weightValue = parseNumber(weight);
    const repsValue = parseNumber(reps);

    if (name === '') {
      Alert.alert('Enter an exercise name');
      return;
    }
    if (weightValue === null || weightValue < 0) {
      Alert.alert('Enter the weight as a number', 'Use 0 for bodyweight exercises.');
      return;
    }
    if (repsValue === null || repsValue < 1 || !Number.isInteger(repsValue)) {
      Alert.alert('Enter the reps as a whole number');
      return;
    }

    addSet({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      exercise: name,
      weight: weightValue,
      unit,
      reps: repsValue,
      createdAt: timestampFor(day),
    })
      .then((sets) => {
        onSaved(sets);
        // Keep the exercise name and weight so the next set is quick to add.
        setReps('');
      })
      .catch(() => Alert.alert('Could not save this set', 'Please try again.'));
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  return (
    <View style={styles.form}>
      <TextInput
        style={inputStyle}
        placeholder="Exercise (e.g. Squat)"
        placeholderTextColor={theme.textSecondary}
        value={exercise}
        onChangeText={setExercise}
        autoCapitalize="words"
        returnKeyType="done"
      />
      <View style={styles.row}>
        <TextInput
          style={[inputStyle, styles.rowInput]}
          placeholder="Weight"
          placeholderTextColor={theme.textSecondary}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
        />
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
        <TextInput
          style={[inputStyle, styles.rowInput]}
          placeholder="Reps"
          placeholderTextColor={theme.textSecondary}
          value={reps}
          onChangeText={setReps}
          keyboardType="number-pad"
        />
      </View>
      <Pressable
        onPress={submit}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.text, opacity: pressed ? 0.7 : 1 },
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          Add set
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rowInput: {
    flex: 1,
  },
  unitToggle: {
    flexDirection: 'row',
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
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderRadius: 12,
  },
  button: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
});
