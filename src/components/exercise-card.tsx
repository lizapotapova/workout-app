import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAutosave } from '@/hooks/use-autosave';
import { useTheme } from '@/hooks/use-theme';
import { formatSet } from '@/lib/exercises';
import { parseNumber, parseReps, parseWeight } from '@/lib/numbers';
import { type SetChanges, type WorkoutSet } from '@/lib/sets-storage';

const DELETE_COLOR = '#E5484D';

type Props = {
  /** The exercise's position in the workout: 1, 2, 3… */
  number: number;
  name: string;
  /** This exercise's sets, in the order they were done. */
  sets: WorkoutSet[];
  /** The last earlier session, e.g. "Nov 12: 170 lb × 12, 3 sets". Missing if there is none. */
  lastTime?: string;
  /** How much one tap on − or + changes the weight. */
  weightStep: number;
  onDeleteSet: (set: WorkoutSet) => void;
  /** The general note for the whole exercise ('' if there is none). */
  note: string;
  /** Called on every keystroke in the exercise note, to show the new text. */
  onNoteChange: (note: string) => void;
  /** Called shortly after typing stops, with the exercise note that should be saved. */
  onNoteSave: (note: string) => void;
  /** Called when the ✕ next to the exercise name is tapped. */
  onDeleteExercise: () => void;
  /** Called with the new weight, reps and/or note when a set is edited. */
  onChangeSet: (set: WorkoutSet, changes: SetChanges) => void;
  /** Called with the exercise's last set when "+ Set" is tapped. */
  onAddSet: (lastSet: WorkoutSet) => void;
};

/**
 * One exercise in a workout: a box titled "1. Glute bridge" with a row for each set
 * ("Set 1 … 170 lb • 12"), plus "+ Set" and ✕ buttons next to the name. Tapping a set's row opens its weight,
 * reps, note and delete button underneath it.
 */
export function ExerciseCard({
  number,
  name,
  sets,
  lastTime,
  weightStep,
  note,
  onNoteChange,
  onNoteSave,
  onDeleteSet,
  onDeleteExercise,
  onChangeSet,
  onAddSet,
}: Props) {
  const theme = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const noteAutosave = useAutosave(onNoteSave);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.title}>
        <ThemedText type="smallBold" style={styles.titleText}>
          {number}. {name}
        </ThemedText>
        <Pressable
          onPress={() => onAddSet(sets[sets.length - 1])}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Add another set of ${name}`}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="small" themeColor="textSecondary">
            + Set
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={onDeleteExercise}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Delete exercise ${name}`}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText themeColor="textSecondary">✕</ThemedText>
        </Pressable>
      </View>

      {lastTime && (
        <ThemedText style={styles.lastTime} themeColor="textSecondary">
          Last time, {lastTime}
        </ThemedText>
      )}

      <View style={styles.rows}>
        {sets.map((set, index) => {
          const isSelected = set.id === selectedId;
          return (
            <View key={set.id} style={styles.rows}>
              <Pressable
                onPress={() => setSelectedId(isSelected ? null : set.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Set ${index + 1}: ${formatSet(set)}`}
                style={[
                  styles.setRow,
                  { backgroundColor: isSelected ? theme.text : theme.background },
                ]}>
                <ThemedText
                  type="small"
                  style={{ color: isSelected ? theme.background : theme.textSecondary }}>
                  Set {index + 1}
                  {/* A small pencil marks a set that has a note. */}
                  {set.note ? '  ✎' : ''}
                </ThemedText>
                <ThemedText type="small" style={isSelected && { color: theme.background }}>
                  {formatSet(set)}
                </ThemedText>
              </Pressable>

              {isSelected && (
                // The boxes for changing this set open right under its row.
                <SetEditor
                  set={set}
                  weightStep={weightStep}
                  onChange={(changes) => onChangeSet(set, changes)}
                  onDelete={() => onDeleteSet(set)}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* A small general note for the whole exercise. Saves by itself. */}
      <TextInput
        style={[styles.exerciseNote, { color: theme.text }]}
        placeholder="Note"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={`Note for ${name}`}
        value={note}
        onChangeText={(text) => {
          onNoteChange(text);
          noteAutosave.change(text);
        }}
        onBlur={noteAutosave.flush}
        multiline
        // The keyboard's return key says "Done": it closes the keyboard and saves the note,
        // instead of starting a new line. Long notes still wrap onto more lines.
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
      />
    </ThemedView>
  );
}

type EditorProps = {
  set: WorkoutSet;
  weightStep: number;
  onChange: (changes: SetChanges) => void;
  onDelete: () => void;
};

/**
 * The boxes for editing one set: weight, reps and note. Changes save by themselves
 * shortly after typing stops, as long as the weight and reps are valid numbers.
 */
function SetEditor({ set, weightStep, onChange, onDelete }: EditorProps) {
  const theme = useTheme();
  const [weight, setWeight] = useState(String(set.weight));
  const [reps, setReps] = useState(String(set.reps));
  const [note, setNote] = useState(set.note ?? '');
  const autosave = useAutosave(onChange);

  const numbersValid = parseWeight(weight) !== null && parseReps(reps) !== null;

  function edit(next: { weight: string; reps: string; note: string }) {
    setWeight(next.weight);
    setReps(next.reps);
    setNote(next.note);

    const weightValue = parseWeight(next.weight);
    const repsValue = parseReps(next.reps);
    // While a number box is empty or invalid, only the note is saved.
    if (weightValue === null || repsValue === null) autosave.change({ note: next.note });
    else autosave.change({ weight: weightValue, reps: repsValue, note: next.note });
  }

  const inputStyle = [styles.input, { backgroundColor: theme.background, color: theme.text }];

  /** One tap on − or +: reps change by 1, weight by the exercise's step from Settings. */
  function step(field: 'weight' | 'reps', direction: 1 | -1) {
    const current = parseNumber(field === 'weight' ? weight : reps) ?? 0;
    const size = field === 'reps' ? 1 : weightStep;
    const smallest = field === 'reps' ? 1 : 0;
    // Rounded to avoid results like 172.50000000000003.
    const next = String(Math.max(smallest, Math.round((current + direction * size) * 100) / 100));
    edit(field === 'weight' ? { weight: next, reps, note } : { weight, reps: next, note });
  }

  // One number box with − and + on either side of it.
  const stepBox = (field: 'weight' | 'reps') => (
    <View style={[styles.stepBox, { backgroundColor: theme.background }]}>
      <Pressable
        onPress={() => step(field, -1)}
        accessibilityRole="button"
        accessibilityLabel={field === 'weight' ? 'Less weight' : 'Fewer reps'}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
        <ThemedText style={[styles.stepSign, { color: theme.accent }]}>−</ThemedText>
      </Pressable>
      <TextInput
        style={[styles.stepInput, { color: theme.text }]}
        accessibilityLabel={field === 'weight' ? 'Weight' : 'Reps'}
        value={field === 'weight' ? weight : reps}
        onChangeText={(text) =>
          edit(field === 'weight' ? { weight: text, reps, note } : { weight, reps: text, note })
        }
        onBlur={autosave.flush}
        keyboardType={field === 'weight' ? 'decimal-pad' : 'number-pad'}
        selectTextOnFocus
      />
      <Pressable
        onPress={() => step(field, 1)}
        accessibilityRole="button"
        accessibilityLabel={field === 'weight' ? 'More weight' : 'More reps'}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
        <ThemedText style={[styles.stepSign, { color: theme.accent }]}>+</ThemedText>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.editor}>
      <View style={styles.numbers}>
        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Weight{set.unit ? ` (${set.unit})` : ''}
          </ThemedText>
          {stepBox('weight')}
        </View>
        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Reps
          </ThemedText>
          {stepBox('reps')}
        </View>
      </View>
      {!numbersValid && (
        <ThemedText type="small" style={{ color: DELETE_COLOR }}>
          Not saved yet: weight must be a number and reps a whole number.
        </ThemedText>
      )}

      <TextInput
        style={inputStyle}
        placeholder="Add a note for this set"
        placeholderTextColor={theme.textSecondary}
        value={note}
        onChangeText={(text) => edit({ weight, reps, note: text })}
        onBlur={autosave.flush}
        multiline
        // The keyboard's return key says "Done": it closes the keyboard and saves the note,
        // instead of starting a new line. Long notes still wrap onto more lines.
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
      />

      <Pressable
        onPress={onDelete}
        hitSlop={8}
        accessibilityRole="button"
        style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
        <ThemedText type="small" style={{ color: DELETE_COLOR }}>
          Delete this set
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Spacing here is deliberately tight so a whole workout fits on screen with little scrolling.
  card: {
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  titleText: {
    flex: 1,
  },
  // Each set is its own cell, with a small gap between cells.
  rows: {
    gap: 3,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lastTime: {
    fontSize: 13,
    lineHeight: 18,
  },
  stepBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 10,
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
  exerciseNote: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: Spacing.two,
    paddingTop: 0,
    paddingBottom: 0,
  },
  editor: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  numbers: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  field: {
    flex: 1,
    gap: Spacing.one,
  },
  input: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderRadius: 8,
  },
  delete: {
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.5,
  },
});
