import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAutosave } from '@/hooks/use-autosave';
import { useTheme } from '@/hooks/use-theme';
import { type WorkoutSet } from '@/lib/sets-storage';

const DELETE_COLOR = '#E5484D';

/** The text inside a cell, e.g. "170 lb • 12". */
function formatSet(set: WorkoutSet): string {
  return `${set.weight}${set.unit ? ` ${set.unit}` : ''} • ${set.reps}`;
}

type Props = {
  /** The exercise's position in the workout: 1, 2, 3… */
  number: number;
  name: string;
  /** This exercise's sets, in the order they were done. */
  sets: WorkoutSet[];
  onDeleteSet: (set: WorkoutSet) => void;
  onNoteChange: (set: WorkoutSet, note: string) => void;
};

/**
 * One exercise in a workout: "1. Glute bridge" with a cell for each set.
 * Tapping a cell opens that set's note and delete button underneath.
 */
export function ExerciseCard({ number, name, sets, onDeleteSet, onNoteChange }: Props) {
  const theme = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sets.find((set) => set.id === selectedId);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">
        {number}. {name}
      </ThemedText>

      <View style={styles.cells}>
        {sets.map((set, index) => {
          const isSelected = set.id === selectedId;
          return (
            <Pressable
              key={set.id}
              onPress={() => setSelectedId(isSelected ? null : set.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Set ${index + 1}: ${formatSet(set)}`}
              style={[
                styles.cell,
                { backgroundColor: isSelected ? theme.text : theme.background },
              ]}>
              <ThemedText type="small" style={isSelected && { color: theme.background }}>
                {formatSet(set)}
                {/* A small pencil marks a set that has a note. */}
                {set.note ? ' ✎' : ''}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {selected && (
        <View style={styles.details}>
          {/* `key` gives each set its own fresh notes box when a different cell is tapped. */}
          <NoteInput
            key={selected.id}
            initialNote={selected.note ?? ''}
            onChange={(note) => onNoteChange(selected, note)}
          />
          <Pressable
            onPress={() => onDeleteSet(selected)}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
            <ThemedText type="small" style={{ color: DELETE_COLOR }}>
              Delete this set
            </ThemedText>
          </Pressable>
        </View>
      )}
    </ThemedView>
  );
}

/** The notes box for one set. Saves by itself shortly after typing stops. */
function NoteInput({
  initialNote,
  onChange,
}: {
  initialNote: string;
  onChange: (note: string) => void;
}) {
  const theme = useTheme();
  const [note, setNote] = useState(initialNote);
  const autosave = useAutosave(onChange);

  return (
    <TextInput
      style={[styles.note, { backgroundColor: theme.background, color: theme.text }]}
      placeholder="Add a note for this set"
      placeholderTextColor={theme.textSecondary}
      value={note}
      onChangeText={(text) => {
        setNote(text);
        autosave.change(text);
      }}
      onBlur={autosave.flush}
      multiline
    />
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cells: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cell: {
    paddingHorizontal: 12,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  details: {
    gap: Spacing.two,
  },
  note: {
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
