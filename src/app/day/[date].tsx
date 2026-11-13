import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet } from 'react-native';

import { AddSetForm } from '@/components/add-set-form';
import { SetRow } from '@/components/set-row';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { dayKey, parseDayKey } from '@/lib/dates';
import { deleteSet, deleteSetsOnDay, loadSets, type WorkoutSet } from '@/lib/sets-storage';

const DELETE_COLOR = '#E5484D';

/** The page for one day, opened by tapping a date in the calendar. */
export default function DayScreen() {
  // The date comes from the page address, e.g. /day/2026-11-13.
  const { date } = useLocalSearchParams<{ date: string }>();
  const day = parseDayKey(date);
  const theme = useTheme();

  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSets()
      .then(setSets)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!day) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic">
        <ThemedText style={styles.empty}>This date could not be opened.</ThemedText>
      </ScrollView>
    );
  }

  // Short title such as "Fri, Nov 13" so it fits next to the back button.
  const title = day.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const daySets = sets.filter((set) => dayKey(new Date(set.createdAt)) === date);

  function showDeleteError() {
    Alert.alert('Could not delete', 'Please try again.');
  }

  // Both deletes ask first, because there is no undo.
  function confirmDeleteSet(set: WorkoutSet) {
    Alert.alert('Delete this set?', `${set.exercise}, ${set.reps} reps`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteSet(set.id).then(setSets).catch(showDeleteError),
      },
    ]);
  }

  function confirmDeleteWorkout() {
    const count = daySets.length;
    Alert.alert(
      'Delete this workout?',
      `This removes ${count === 1 ? 'the 1 set' : `all ${count} sets`} on ${title}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete workout',
          style: 'destructive',
          onPress: () => deleteSetsOnDay(date).then(setSets).catch(showDeleteError),
        },
      ],
    );
  }

  // The whole page is one scrolling list, with the add-set form as its first item.
  // contentInsetAdjustmentBehavior="automatic" tells iOS to start the content below the
  // (see-through) header and status bar instead of underneath them.
  return (
    <>
      <Stack.Screen options={{ title }} />
      <FlatList
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        data={daySets}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<AddSetForm day={date} onSaved={setSets} />}
        ListHeaderComponentStyle={styles.form}
        renderItem={({ item }) => (
          <SetRow set={item} onDelete={() => confirmDeleteSet(item)} />
        )}
        ListFooterComponent={
          daySets.length > 0 ? (
            <Pressable
              onPress={confirmDeleteWorkout}
              accessibilityRole="button"
              style={({ pressed }) => [styles.deleteWorkout, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={{ color: DELETE_COLOR }}>
                Delete workout
              </ThemedText>
            </Pressable>
          ) : undefined
        }
        ListEmptyComponent={
          loaded ? (
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              No workout on this day yet. Add a set above.
            </ThemedText>
          ) : undefined
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  form: {
    marginBottom: Spacing.two,
  },
  deleteWorkout: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: Spacing.three,
  },
  pressed: {
    opacity: 0.5,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
});
