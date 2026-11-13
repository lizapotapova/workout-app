import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { type WorkoutSet } from '@/lib/sets-storage';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Props = {
  set: WorkoutSet;
  /** If given, the row shows a ✕ button that calls this when tapped. */
  onDelete?: () => void;
};

/** One line in a list of sets: exercise name and time on the left, "60 kg × 8" on the right. */
export function SetRow({ set, onDelete }: Props) {
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <View style={styles.info}>
        <ThemedText type="smallBold">{set.exercise}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(set.createdAt)}
        </ThemedText>
      </View>
      <ThemedText>
        {set.weight}
        {set.unit ? ` ${set.unit}` : ''} × {set.reps}
      </ThemedText>
      {onDelete && (
        <Pressable
          onPress={onDelete}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${set.exercise} set`}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText themeColor="textSecondary">✕</ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderRadius: 12,
  },
  info: {
    flex: 1,
  },
  pressed: {
    opacity: 0.5,
  },
});
