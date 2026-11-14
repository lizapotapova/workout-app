import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AddSetForm } from '@/components/add-set-form';
import { ExerciseCard } from '@/components/exercise-card';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAutosave } from '@/hooks/use-autosave';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, parseDayKey } from '@/lib/dates';
import {
  deleteSet,
  deleteSetsOnDay,
  loadSets,
  loadWorkoutName,
  saveSetNote,
  saveWorkoutName,
  type WorkoutSet,
} from '@/lib/sets-storage';

const DELETE_COLOR = '#E5484D';

type ExerciseGroup = { name: string; sets: WorkoutSet[] };

/**
 * Groups a day's sets by exercise, like a written workout: exercises in the order they
 * were first done, and each exercise's sets in the order they were done.
 * "squat" and "Squat" count as the same exercise.
 */
function groupByExercise(sets: WorkoutSet[]): ExerciseGroup[] {
  const oldestFirst = [...sets].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const groups = new Map<string, ExerciseGroup>();
  for (const set of oldestFirst) {
    const key = set.exercise.trim().toLowerCase();
    const group = groups.get(key);
    if (group) group.sets.push(set);
    else groups.set(key, { name: set.exercise, sets: [set] });
  }
  return [...groups.values()];
}

/** The page for one day, opened by tapping a date in the calendar. */
export default function DayScreen() {
  // The date comes from the page address, e.g. /day/2026-11-13.
  const { date } = useLocalSearchParams<{ date: string }>();
  const day = parseDayKey(date);
  const theme = useTheme();

  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [workoutName, setWorkoutName] = useState('');

  const nameAutosave = useAutosave((name) => {
    saveWorkoutName(date, name).catch(() =>
      Alert.alert('Could not save the workout name', 'Please try typing it again.'),
    );
  });

  useEffect(() => {
    loadSets()
      .then(setSets)
      .catch(() => {})
      .finally(() => setLoaded(true));
    loadWorkoutName(date)
      .then(setWorkoutName)
      .catch(() => {});
  }, [date]);

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
  const exercises = groupByExercise(daySets);

  function saveNote(set: WorkoutSet, note: string) {
    saveSetNote(set.id, note)
      .then(setSets)
      .catch(() => Alert.alert('Could not save the note', 'Please try typing it again.'));
  }

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
      `This removes ${count === 1 ? 'the 1 set' : `all ${count} sets`} on ${title}, and the workout name.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete workout',
          style: 'destructive',
          onPress: () =>
            deleteSetsOnDay(date)
              .then(setSets)
              .then(() => saveWorkoutName(date, ''))
              .then(() => setWorkoutName(''))
              .catch(showDeleteError),
        },
      ],
    );
  }

  // The whole page is one scrolling list: the workout name and add form first, then one
  // card per exercise. contentInsetAdjustmentBehavior="automatic" tells iOS to start the
  // content below the (see-through) header and status bar instead of underneath them.
  return (
    <>
      <Stack.Screen options={{ title }} />
      <FlatList
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        // Moves the list up when the keyboard opens, so the note being typed stays visible.
        automaticallyAdjustKeyboardInsets
        data={exercises}
        keyExtractor={(item) => item.name.trim().toLowerCase()}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <TextInput
              style={[styles.workoutName, { color: theme.text }]}
              placeholder="Workout name (e.g. Glutes)"
              placeholderTextColor={theme.textSecondary}
              value={workoutName}
              onChangeText={(text) => {
                setWorkoutName(text);
                nameAutosave.change(text);
              }}
              onBlur={nameAutosave.flush}
              autoCapitalize="sentences"
              returnKeyType="done"
            />
            <AddSetForm day={date} onSaved={setSets} />
          </View>
        }
        ListHeaderComponentStyle={styles.headerSpacing}
        renderItem={({ item, index }) => (
          <ExerciseCard
            number={index + 1}
            name={item.name}
            sets={item.sets}
            onDeleteSet={confirmDeleteSet}
            onNoteChange={saveNote}
          />
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
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.two,
  },
  header: {
    gap: Spacing.three,
  },
  headerSpacing: {
    marginBottom: Spacing.two,
  },
  workoutName: {
    fontSize: 24,
    fontWeight: 600,
    paddingVertical: Spacing.one,
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
