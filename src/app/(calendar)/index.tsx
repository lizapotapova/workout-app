import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WorkoutSummary } from '@/components/workout-summary';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/dates';
import { groupByExercise } from '@/lib/exercises';
import { loadSets, loadWorkoutName, type WorkoutSet } from '@/lib/sets-storage';

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

  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [todayName, setTodayName] = useState('');
  // The month being shown, stored as the 1st of that month.
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // Re-read the saved sets every time this screen is shown, including when
  // coming back from a day page, so newly added sets get their dot.
  useFocusEffect(
    useCallback(() => {
      loadSets()
        .then(setSets)
        .catch(() => {});
      loadWorkoutName(dayKey(new Date()))
        .then(setTodayName)
        .catch(() => {});
    }, []),
  );

  const cells = buildMonthCells(month.getFullYear(), month.getMonth());
  const todayKey = dayKey(today);
  // The days that have at least one logged set, e.g. "2026-11-13".
  const workoutDays = new Set(sets.map((set) => dayKey(new Date(set.createdAt))));
  // Today's workout, shown below the calendar if there is one.
  const todayExercises = groupByExercise(
    sets.filter((set) => dayKey(new Date(set.createdAt)) === todayKey),
  );

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

  const todaySetCount = todayExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* The month name is the page's headline. Tapping it jumps back to today. */}
          <View style={styles.monthHeader}>
            <Pressable
              onPress={goToToday}
              accessibilityLabel="Go to today"
              style={styles.monthTitle}>
              <ThemedText style={styles.monthName}>
                {month.toLocaleDateString(undefined, { month: 'long' })}
              </ThemedText>
              <ThemedText style={styles.year} themeColor="textSecondary">
                {month.getFullYear()}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => changeMonth(-1)}
              hitSlop={8}
              accessibilityLabel="Previous month"
              style={({ pressed }) => [
                styles.arrow,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={[styles.arrowText, { color: theme.accent }]}>‹</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => changeMonth(1)}
              hitSlop={8}
              accessibilityLabel="Next month"
              style={({ pressed }) => [
                styles.arrow,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={[styles.arrowText, { color: theme.accent }]}>›</ThemedText>
            </Pressable>
          </View>

          <View>
            <View style={styles.week}>
              {WEEKDAYS.map((name) => (
                <ThemedText key={name} themeColor="textSecondary" style={styles.weekday}>
                  {name}
                </ThemedText>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((date, index) => {
                if (!date) return <View key={`blank-${index}`} style={styles.cell} />;

                const key = dayKey(date);
                const hasWorkout = workoutDays.has(key);
                const isToday = key === todayKey;
                return (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
                    onPress={() => openDay(key)}
                    accessibilityLabel={`${date.toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'long',
                    })}${hasWorkout ? ', has a workout' : ''}${isToday ? ', today' : ''}`}>
                    {/* A day with a workout is filled in; today has a ring around it. */}
                    <View
                      style={[
                        styles.dayCircle,
                        hasWorkout && { backgroundColor: theme.accentSoft },
                        isToday && { borderWidth: 2, borderColor: theme.accent },
                      ]}>
                      <ThemedText
                        style={[
                          styles.dayNumber,
                          hasWorkout && { color: theme.accent, fontWeight: 700 },
                        ]}>
                        {date.getDate()}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {todayExercises.length > 0 && (
            // Tapping today's workout opens today's page, where it can be changed.
            <Pressable
              onPress={() => openDay(todayKey)}
              accessibilityRole="button"
              accessibilityLabel="Open today's workout"
              style={({ pressed }) => [styles.today, pressed && styles.pressed]}>
              <View style={styles.todayHeader}>
                <ThemedText style={styles.todayTitle}>
                  {todayName.trim() !== '' ? todayName.trim() : "Today's workout"}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {todayName.trim() !== '' ? 'Today, ' : ''}
                  {todaySetCount} {todaySetCount === 1 ? 'set' : 'sets'}
                </ThemedText>
              </View>
              <WorkoutSummary exercises={todayExercises} />
            </Pressable>
          )}
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
  // Spacing is kept tight so the month and today's workout fit on one screen.
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.two,
    gap: Spacing.three,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  monthTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  monthName: {
    fontFamily: Fonts?.rounded,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 700,
  },
  year: {
    fontFamily: Fonts?.rounded,
    fontSize: 18,
    lineHeight: 36,
    fontWeight: 500,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: 600,
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 500,
    paddingBottom: Spacing.one,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    // 7 cells per row.
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 3,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontFamily: Fonts?.rounded,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 500,
    fontVariant: ['tabular-nums'],
  },
  today: {
    gap: Spacing.two,
  },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  todayTitle: {
    flexShrink: 1,
    fontFamily: Fonts?.rounded,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.6,
  },
});
