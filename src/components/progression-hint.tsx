import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseDayKey } from '@/lib/dates';
import { type SuggestedSet, type Suggestion } from '@/lib/progression';

function formatDay(day: string): string {
  const date = parseDayKey(day);
  return date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : day;
}

function formatOne(set: SuggestedSet): string {
  return `${set.weight}${set.unit ? ` ${set.unit}` : ''} • ${set.reps}`;
}

/** "170 lb • 14 × 3 sets" when every set is the same, otherwise each set listed. */
function formatSets(sets: SuggestedSet[]): string {
  const first = formatOne(sets[0]);
  if (sets.every((set) => formatOne(set) === first)) {
    return sets.length === 1 ? first : `${first} × ${sets.length} sets`;
  }
  return sets.map(formatOne).join(', ');
}

/** "+2 reps" or "+2.5 lb". */
function formatStep(change: 'reps' | 'weight', amount: number, unit?: string): string {
  if (change === 'reps') return `+${amount} ${amount === 1 ? 'rep' : 'reps'}`;
  return `+${amount}${unit ? ` ${unit}` : ''}`;
}

type Props = {
  suggestion: Suggestion;
  /** Called when "Use" is tapped, to copy the suggested sets into the form. */
  onUse: () => void;
};

/** The box under the exercise name that says what to do this time, based on earlier sessions. */
export function ProgressionHint({ suggestion, onUse }: Props) {
  const theme = useTheme();
  const unit = suggestion.lastSets[0].unit;

  const reason =
    suggestion.change === 'none'
      ? suggestion.upcoming
        ? `Same as last time. ${formatStep(suggestion.upcoming.change, suggestion.upcoming.amount, unit)} from ${formatDay(suggestion.upcoming.day)}.`
        : 'Same as last time.'
      : `${formatStep(suggestion.change, suggestion.amount, unit)} on last time.`;

  return (
    <View style={[styles.box, { backgroundColor: theme.accentSoft }]}>
      <View style={styles.text}>
        <ThemedText type="smallBold">Suggested: {formatSets(suggestion.nextSets)}</ThemedText>
        <ThemedText style={styles.detail} themeColor="textSecondary">
          {reason} Last time, {formatDay(suggestion.lastDay)}: {formatSets(suggestion.lastSets)}.
        </ThemedText>
      </View>
      <Pressable
        onPress={onUse}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Use the suggested sets"
        style={({ pressed }) => [
          styles.use,
          { backgroundColor: theme.accent },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          Use
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: 12,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  detail: {
    fontSize: 13,
    lineHeight: 18,
  },
  use: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.6,
  },
});
