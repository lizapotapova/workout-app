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
import { groupByExercise, type ExerciseGroup } from '@/lib/exercises';
import {
  addSets,
  deleteExerciseNotesOnDay,
  deleteSet,
  deleteSets,
  deleteSetsOnDay,
  exerciseKey,
  loadExerciseNotes,
  loadSets,
  loadWorkoutName,
  saveExerciseNote,
  saveWorkoutName,
  type SetChanges,
  updateSet,
  type WorkoutSet,
} from '@/lib/sets-storage';

const DELETE_COLOR = '#E5484D';

/** The page for one day, opened by tapping a date in the calendar. */
export default function DayScreen() {
  // The date comes from the page address, e.g. /day/2026-11-13.
  const { date } = useLocalSearchParams<{ date: string }>();
  const day = parseDayKey(date);
  const theme = useTheme();

  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  // The general note of each exercise on this day, e.g. { squat: "felt easy" }.
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  // Whether the add-exercise form is showing. `null` means the user hasn't chosen yet:
  // then it shows only while the day is still empty, to leave room for the workout.
  const [formChoice, setFormChoice] = useState<boolean | null>(null);

  const nameAutosave = useAutosave((name: string) => {
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
    loadExerciseNotes(date)
      .then(setExerciseNotes)
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
  const formOpen = formChoice ?? (loaded && daySets.length === 0);

  function saveSetChanges(set: WorkoutSet, changes: SetChanges) {
    updateSet(set.id, changes)
      .then(setSets)
      .catch(() => Alert.alert('Could not save the change', 'Please try again.'));
  }

  // Adds one more set to an exercise, as a copy of its last set (without the note).
  // It is stamped just after that set so it lands at the end of the same exercise.
  function addAnotherSet(last: WorkoutSet) {
    addSets([
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        exercise: last.exercise,
        weight: last.weight,
        unit: last.unit,
        reps: last.reps,
        createdAt: new Date(new Date(last.createdAt).getTime() + 1).toISOString(),
      },
    ])
      .then(setSets)
      .catch(() => Alert.alert('Could not add the set', 'Please try again.'));
  }

  function changeExerciseNote(exercise: string, note: string) {
    setExerciseNotes((notes) => ({ ...notes, [exerciseKey(exercise)]: note }));
  }

  function saveNoteForExercise(exercise: string, note: string) {
    saveExerciseNote(date, exercise, note).catch(() =>
      Alert.alert('Could not save the note', 'Please try typing it again.'),
    );
  }

  function showDeleteError() {
    Alert.alert('Could not delete', 'Please try again.');
  }

  // Every delete asks first, because there is no undo.
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

  function confirmDeleteExercise(exercise: ExerciseGroup) {
    const count = exercise.sets.length;
    Alert.alert(
      `Delete ${exercise.name}?`,
      `This removes the exercise and ${count === 1 ? 'its 1 set' : `all ${count} of its sets`}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete exercise',
          style: 'destructive',
          onPress: () =>
            deleteSets(exercise.sets.map((set) => set.id))
              .then(setSets)
              .then(() => saveExerciseNote(date, exercise.name, ''))
              .then(() => changeExerciseNote(exercise.name, ''))
              .catch(showDeleteError),
        },
      ],
    );
  }

  function confirmDeleteWorkout() {
    const count = daySets.length;
    Alert.alert(
      'Delete this workout?',
      `This removes ${count === 1 ? 'the 1 set' : `all ${count} sets`} on ${title}, with the workout name and notes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete workout',
          style: 'destructive',
          onPress: () =>
            deleteSetsOnDay(date)
              .then(setSets)
              .then(() => saveWorkoutName(date, ''))
              .then(() => deleteExerciseNotesOnDay(date))
              .then(() => {
                setWorkoutName('');
                setExerciseNotes({});
              })
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
            <View style={styles.nameRow}>
              <TextInput
                style={[styles.workoutName, { color: theme.text }]}
                placeholder="Workout name"
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
              <Pressable
                onPress={() => setFormChoice(!formOpen)}
                hitSlop={8}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.formToggle,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold">{formOpen ? 'Hide form' : '+ Exercise'}</ThemedText>
              </Pressable>
            </View>
            {/* The form is hidden rather than removed, so a half-entered exercise is kept. */}
            <View style={!formOpen && styles.hidden}>
              <AddSetForm day={date} onSaved={setSets} />
            </View>
          </View>
        }
        ListHeaderComponentStyle={styles.headerSpacing}
        renderItem={({ item, index }) => (
          <ExerciseCard
            number={index + 1}
            name={item.name}
            sets={item.sets}
            note={exerciseNotes[exerciseKey(item.name)] ?? ''}
            onNoteChange={(note) => changeExerciseNote(item.name, note)}
            onNoteSave={(note) => saveNoteForExercise(item.name, note)}
            onDeleteSet={confirmDeleteSet}
            onDeleteExercise={() => confirmDeleteExercise(item)}
            onChangeSet={saveSetChanges}
            onAddSet={addAnotherSet}
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
              No workout on this day yet. Add an exercise above.
            </ThemedText>
          ) : undefined
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Spacing here is deliberately tight so a whole workout fits on screen with little scrolling.
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: 6,
  },
  header: {
    gap: Spacing.two,
  },
  headerSpacing: {
    marginBottom: Spacing.one,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  workoutName: {
    flex: 1,
    fontSize: 20,
    fontWeight: 600,
    paddingVertical: Spacing.one,
  },
  formToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  hidden: {
    display: 'none',
  },
  deleteWorkout: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.5,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
});
