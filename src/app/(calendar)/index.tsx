import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/dates';
import { loadSets } from '@/lib/sets-storage';

// Weeks start on Monday. For Sunday-first, move 'Sun' to the front and set this to 0.
const WEEK_STARTS_ON = 1;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * The cells of the month grid, row by row. `null` is an empty cell before the 1st
 * or after the last day, so every row has exactly 7 cells.
 */
function buildMonthCells(year: number, month: number): (Date | null)[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (new Date(year, month, 1).getDay() - WEEK_STARTS_ON + 7) % 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarScreen() {
  const theme = useTheme();
  const today = new Date();

  // The days that have at least one logged set, e.g. "2026-11-13".
  const [workoutDays, setWorkoutDays] = useState<Set<string>>(new Set());
  // The month being shown, stored as the 1st of that month.
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // Re-read the saved sets every time this screen is shown, including when
  // coming back from a day page, so newly added sets get their dot.
  useFocusEffect(
    useCallback(() => {
      loadSets()
        .then((sets) =>
          setWorkoutDays(new Set(sets.map((set) => dayKey(new Date(set.createdAt))))),
        )
        .catch(() => {});
    }, []),
  );

  const cells = buildMonthCells(month.getFullYear(), month.getMonth());
  const todayKey = dayKey(today);

  function changeMonth(step: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + step, 1));
  }

  // Open the page for one day, where its sets are listed and new ones can be added.
  function openDay(key: string) {
    router.push({ pathname: '/day/[date]', params: { date: key } });
  }

  function goToToday() {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">Calendar</ThemedText>

          <View style={styles.monthHeader}>
            <Pressable
              onPress={() => changeMonth(-1)}
              hitSlop={8}
              accessibilityLabel="Previous month"
              style={[styles.arrow, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText>‹</ThemedText>
            </Pressable>
            <Pressable onPress={goToToday} accessibilityLabel="Go to today">
              <ThemedText type="smallBold">
                {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => changeMonth(1)}
              hitSlop={8}
              accessibilityLabel="Next month"
              style={[styles.arrow, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText>›</ThemedText>
            </Pressable>
          </View>

          <View>
            <View style={styles.week}>
              {WEEKDAYS.map((name) => (
                <ThemedText
                  key={name}
                  type="small"
                  themeColor="textSecondary"
                  style={styles.weekday}>
                  {name}
                </ThemedText>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((date, index) => {
                if (!date) return <View key={`blank-${index}`} style={styles.cell} />;

                const key = dayKey(date);
                const hasWorkout = workoutDays.has(key);
                return (
                  <Pressable key={key} style={styles.cell} onPress={() => openDay(key)}>
                    <View
                      style={[
                        styles.dayCircle,
                        key === todayKey && { borderWidth: 1, borderColor: theme.textSecondary },
                      ]}>
                      <ThemedText type={hasWorkout ? 'smallBold' : 'small'}>
                        {date.getDate()}
                      </ThemedText>
                    </View>
                    {/* The dot marks a day that has at least one logged set. */}
                    <View
                      style={[styles.dot, hasWorkout && { backgroundColor: theme.text }]}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
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
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    paddingBottom: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    // 7 cells per row.
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: Spacing.one,
    gap: Spacing.half,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
