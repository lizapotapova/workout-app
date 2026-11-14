import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatSet, type ExerciseGroup } from '@/lib/exercises';

/** A read-only view of a workout: numbered exercises, each with a cell per set. */
export function WorkoutSummary({ exercises }: { exercises: ExerciseGroup[] }) {
  const theme = useTheme();

  return (
    <View style={styles.list}>
      {exercises.map((exercise, index) => (
        <ThemedView
          key={exercise.name.trim().toLowerCase()}
          type="backgroundElement"
          style={styles.card}>
          <ThemedText type="smallBold">
            {index + 1}. {exercise.name}
          </ThemedText>
          <View style={styles.cells}>
            {exercise.sets.map((set) => (
              <View key={set.id} style={[styles.cell, { backgroundColor: theme.background }]}>
                <ThemedText type="small">{formatSet(set)}</ThemedText>
              </View>
            ))}
          </View>
        </ThemedView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
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
});
