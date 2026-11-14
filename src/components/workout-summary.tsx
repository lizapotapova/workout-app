import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatSetCompact, type ExerciseGroup } from '@/lib/exercises';

/**
 * A compact, read-only view of a workout, written like a note: one box with a row per
 * exercise — its number, its name, then its sets, e.g. "170lb•12  170lb•12  170lb•12".
 */
export function WorkoutSummary({ exercises }: { exercises: ExerciseGroup[] }) {
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {exercises.map((exercise, index) => (
        <View
          key={exercise.name.trim().toLowerCase()}
          style={[
            styles.row,
            // A thin line between exercises, but not above the first one.
            index > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.separator,
            },
          ]}>
          <ThemedText style={[styles.number, { color: theme.accent }]}>{index + 1}</ThemedText>
          <ThemedText style={styles.text}>
            <ThemedText style={[styles.text, styles.name]}>{exercise.name}</ThemedText>
            <ThemedText style={[styles.text, styles.sets]} themeColor="textSecondary">
              {/* Each set has no spaces inside it, so it stays in one piece when the line wraps. */}
              {exercise.sets.map((set) => `   ${formatSetCompact(set)}`).join('')}
            </ThemedText>
          </ThemedText>
        </View>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingVertical: Spacing.one,
    borderRadius: 14,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: 7,
  },
  number: {
    width: 18,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  name: {
    fontWeight: 600,
  },
  sets: {
    fontVariant: ['tabular-nums'],
  },
});
