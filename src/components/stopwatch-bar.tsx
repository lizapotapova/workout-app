import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addLap,
  formatStopwatch,
  resetStopwatch,
  startStopwatch,
  stopStopwatch,
  useElapsed,
  useStopwatch,
} from '@/lib/stopwatch';

// The height of the iPhone tab bar, not counting the home-indicator area below it.
const TAB_BAR_HEIGHT = 49;

/**
 * The app's stopwatch: a small bar that always floats just above the tab bar, on every
 * screen. It has no page of its own.
 */
export function StopwatchBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const stopwatch = useStopwatch();
  const elapsed = useElapsed(stopwatch);
  const running = stopwatch.startedAt !== null;

  const lapCount = stopwatch.laps.length;
  // How long the latest lap took: its end time minus the end time of the lap before it.
  const lastLap =
    lapCount > 0 ? stopwatch.laps[lapCount - 1] - (lapCount > 1 ? stopwatch.laps[lapCount - 2] : 0) : 0;
  // At zero there is nothing to reset, so the Reset button is dimmed.
  const isZero = !running && elapsed === 0;

  return (
    // "box-none": touches outside the bar itself go through to the screen underneath.
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.two }]}>
      <View
        style={[
          styles.bar,
          { backgroundColor: theme.backgroundElement, borderColor: theme.separator },
        ]}>
        <View style={styles.timeArea} accessible accessibilityLabel={`Stopwatch ${formatStopwatch(elapsed)}`}>
          <ThemedText style={[styles.time, !running && { color: theme.textSecondary }]}>
            {formatStopwatch(elapsed)}
          </ThemedText>
          {/* The most recent lap: its number and how long it took. */}
          {lapCount > 0 && (
            <ThemedText style={styles.lap} themeColor="textSecondary" numberOfLines={1}>
              Lap {lapCount} {formatStopwatch(lastLap)}
            </ThemedText>
          )}
        </View>

        <Pressable
          onPress={running ? addLap : resetStopwatch}
          disabled={isZero}
          hitSlop={6}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.background },
            isZero && styles.disabled,
            pressed && styles.pressed,
          ]}>
          <ThemedText style={styles.buttonText}>{running ? 'Lap' : 'Reset'}</ThemedText>
        </Pressable>

        <Pressable
          onPress={running ? stopStopwatch : startStopwatch}
          hitSlop={6}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: running ? theme.accentSoft : theme.accent },
            pressed && styles.pressed,
          ]}>
          <ThemedText
            style={[styles.buttonText, { color: running ? theme.accent : theme.background }]}>
            {running ? 'Stop' : 'Start'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  bar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: 6,
    // A soft shadow so the bar reads as floating above the page.
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  timeArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  lap: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  time: {
    fontFamily: Fonts?.rounded,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  button: {
    height: 36,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 600,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.6,
  },
});
