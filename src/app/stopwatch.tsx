import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
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

export default function StopwatchScreen() {
  const theme = useTheme();
  const stopwatch = useStopwatch();
  const running = stopwatch.startedAt !== null;

  const elapsed = useElapsed(stopwatch);
  const isZero = !running && elapsed === 0;

  // Newest lap first. Each lap shows its own length and the total time when it was taken.
  const laps = stopwatch.laps
    .map((total, index) => ({
      number: index + 1,
      total,
      length: total - (index > 0 ? stopwatch.laps[index - 1] : 0),
    }))
    .reverse();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedText style={styles.heading}>Stopwatch</ThemedText>

        <ThemedText
          style={styles.time}
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={`Time ${formatStopwatch(elapsed)}`}>
          {formatStopwatch(elapsed)}
        </ThemedText>

        <View style={styles.buttons}>
          {/* Left button: Lap while running, Reset once stopped. */}
          <Pressable
            onPress={running ? addLap : resetStopwatch}
            disabled={isZero}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.backgroundElement },
              isZero && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.buttonText}>{running ? 'Lap' : 'Reset'}</ThemedText>
          </Pressable>

          {/* Right button: Start, or Stop while running. */}
          <Pressable
            onPress={running ? stopStopwatch : startStopwatch}
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

        <FlatList
          data={laps}
          keyExtractor={(lap) => String(lap.number)}
          contentContainerStyle={styles.laps}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.lap,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.separator,
                },
              ]}>
              <ThemedText style={[styles.lapText, styles.lapName]}>Lap {item.number}</ThemedText>
              <ThemedText style={[styles.lapText, styles.lapNumber]}>
                {formatStopwatch(item.length)}
              </ThemedText>
              <ThemedText style={[styles.lapText, styles.lapNumber]} themeColor="textSecondary">
                {formatStopwatch(item.total)}
              </ThemedText>
            </View>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  heading: {
    fontFamily: Fonts?.rounded,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 700,
  },
  time: {
    fontFamily: Fonts?.rounded,
    fontSize: 68,
    lineHeight: 80,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    marginTop: Spacing.four,
    marginBottom: Spacing.three,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 600,
  },
  laps: {
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  lap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  lapText: {
    fontSize: 16,
    lineHeight: 22,
  },
  lapName: {
    flex: 1,
    fontWeight: 600,
  },
  lapNumber: {
    width: 104,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.6,
  },
});
