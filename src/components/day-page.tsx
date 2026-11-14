import { useFocusEffect } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddSetForm } from '@/components/add-set-form';
import { ExerciseCard } from '@/components/exercise-card';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, StopwatchBarSpace, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAutosave } from '@/hooks/use-autosave';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, parseDayKey, timeOnDay } from '@/lib/dates';
import { buzzLight, buzzSaved } from '@/lib/haptics';
import { exerciseKey, groupByExercise, type ExerciseGroup } from '@/lib/exercises';
import {
  DEFAULT_SETTINGS,
  formatLastTime,
  stepsFor,
  suggestNext,
  type ProgressionSettings,
} from '@/lib/progression';
import { loadProgressionSettings } from '@/lib/progression-storage';
import {
  addSets,
  copyWorkout,
  deleteExerciseNotesOnDay,
  deleteSet,
  deleteSets,
  deleteSetsOnDay,
  loadExerciseNotes,
  loadCopiedWorkout,
  inUnit,
  loadSets,
  loadUnit,
  loadWorkoutName,
  saveExerciseNote,
  pasteWorkout,
  saveWorkoutName,
  type SetChanges,
  type CopiedWorkout,
  updateSet,
  type WeightUnit,
  type WorkoutSet,
} from '@/lib/sets-storage';

const DELETE_COLOR = '#E5484D';
/** How long the "Undo" bar stays after a delete. */
const UNDO_SECONDS = 6;
// The height of the iPhone tab bar plus the floating stopwatch bar above it.
const BARS_BELOW = 49 + StopwatchBarSpace;

/** "Nov 12" for "2026-11-12". */
function formatShortDay(day: string): string {
  const parsed = parseDayKey(day);
  return parsed ? parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : day;
}

type DayPageProps = {
  /** The day to show, e.g. "2026-11-13". */
  date: string;
  /** Put in front of the title, e.g. "Today" gives "Today, Nov 13". */
  titlePrefix?: string;
};

/**
 * The page for one day: its workout and the form to add to it. Used for the Today tab
 * and for the page that opens when a date is tapped in the calendar.
 */
export function DayPage({ date, titlePrefix }: DayPageProps) {
  const day = parseDayKey(date);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // The sets exactly as they are saved on the phone, each in the unit it was logged in.
  const [savedSets, setSets] = useState<WorkoutSet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  // The general note of each exercise on this day, e.g. { squat: "felt easy" }.
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  // Whether the add-exercise form is showing. `null` means the user hasn't chosen yet:
  // then it shows only while the day is still empty, to leave room for the workout.
  const [formChoice, setFormChoice] = useState<boolean | null>(null);

  // The progression formula's numbers. Re-read whenever this page comes back into view,
  // in case they were changed on the Settings tab.
  const [settings, setSettings] = useState<ProgressionSettings | null>(null);
  // The workout that was last copied (on any day), waiting to be pasted. Also re-read
  // whenever this page comes back into view.
  const [copied, setCopied] = useState<CopiedWorkout | null>(null);
  // The weight unit chosen in Settings (`null` until it has been read).
  const [unit, setUnit] = useState<WeightUnit | null>(null);
  // Everything on this page works with the sets converted to that unit, so a set logged
  // as 170 lb shows as 77.1 kg after switching to kg.
  const sets = unit ? savedSets.map((set) => inUnit(set, unit)) : savedSets;
  useFocusEffect(
    useCallback(() => {
      loadProgressionSettings()
        .then(setSettings)
        .catch(() => {});
      loadCopiedWorkout()
        .then(setCopied)
        .catch(() => {});
      loadUnit()
        .then(setUnit)
        .catch(() => {});
      // The `set…` functions never change; they are listed because the code checker asks.
    }, [setCopied, setUnit]),
  );

  // The "Undo" bar shown after a delete, or `null` when there is nothing to undo.
  const [undo, setUndo] = useState<{ label: string; restore: () => void } | null>(null);
  // The bar goes away by itself after a few seconds.
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [undo]);

  const nameAutosave = useAutosave((name: string) => {
    saveWorkoutName(date, name).catch(() =>
      Alert.alert('Could not save the workout name', 'Please try typing it again.'),
    );
  });

  // Re-read the day every time this page comes into view. The same day can be open in
  // two places (the Today tab and the calendar), and each must show the other's changes.
  useFocusEffect(
    useCallback(() => {
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
      // The `set…` functions never change; they are listed because the code checker asks.
    }, [date, setSets, setLoaded, setWorkoutName, setExerciseNotes]),
  );

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
  const title = titlePrefix
    ? `${titlePrefix}, ${day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const daySets = sets.filter((set) => dayKey(new Date(set.createdAt)) === date);
  const exercises = groupByExercise(daySets);
  const formOpen = formChoice ?? (loaded && daySets.length === 0);

  // What was done the last time before this day, shown on each exercise's card.
  const formula = settings ?? DEFAULT_SETTINGS;
  function lastTimeOf(exercise: string): string | undefined {
    const last = suggestNext(sets, exercise, date, formula);
    return last ? formatLastTime(last.lastDay, last.lastSets) : undefined;
  }

  function saveSetChanges(set: WorkoutSet, changes: SetChanges) {
    const next = { ...changes };
    // `set` is in the unit shown on screen. An untouched weight is left as it was saved;
    // a changed weight is saved together with the unit it was typed in.
    if (next.weight === set.weight) delete next.weight;
    else if (next.weight !== undefined) next.unit = set.unit;
    updateSet(set.id, next)
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
      .then(buzzSaved)
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

  // Deleting happens straight away, without asking first. Instead an "Undo" bar shows
  // for a few seconds; `restore` puts back exactly what was deleted.
  function offerUndo(label: string, restore: () => Promise<unknown>) {
    buzzLight();
    setUndo({
      label,
      restore: () => {
        setUndo(null);
        buzzLight();
        restore().catch(() => Alert.alert('Could not undo', 'Please add it again by hand.'));
      },
    });
  }

  /** The sets with these ids exactly as saved on the phone (not converted to another unit). */
  function savedCopies(ids: string[]): WorkoutSet[] {
    return savedSets.filter((set) => ids.includes(set.id));
  }

  function deleteSetWithUndo(set: WorkoutSet) {
    const removed = savedCopies([set.id]);
    deleteSet(set.id)
      .then(setSets)
      .then(() => offerUndo('Set deleted', () => addSets(removed).then(setSets)))
      .catch(showDeleteError);
  }

  function deleteExerciseWithUndo(exercise: ExerciseGroup) {
    const removed = savedCopies(exercise.sets.map((set) => set.id));
    const note = exerciseNotes[exerciseKey(exercise.name)] ?? '';
    deleteSets(removed.map((set) => set.id))
      .then(setSets)
      .then(() => saveExerciseNote(date, exercise.name, ''))
      .then(() => {
        changeExerciseNote(exercise.name, '');
        offerUndo(`${exercise.name} deleted`, () =>
          addSets(removed)
            .then(setSets)
            .then(() => saveExerciseNote(date, exercise.name, note))
            .then(() => changeExerciseNote(exercise.name, note)),
        );
      })
      .catch(showDeleteError);
  }

  function copyThisWorkout() {
    copyWorkout(date)
      .then((workout) => {
        setCopied(workout);
        Alert.alert('Workout copied', 'Open another date and tap Paste to add it there.');
      })
      .catch(() => Alert.alert('Could not copy the workout', 'Please try again.'));
  }

  // Pasting asks first, and adds to whatever is already on this day.
  function confirmPasteWorkout(workout: CopiedWorkout) {
    const count = workout.sets.length;
    Alert.alert(
      'Paste workout here?',
      `This adds ${count === 1 ? '1 set' : `${count} sets`} from ${formatShortDay(workout.fromDay)} to ${title}.${
        daySets.length > 0 ? ' The sets already on this day stay.' : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Paste',
          onPress: () =>
            pasteWorkout(workout, timeOnDay(date))
              .then(setSets)
              .then(() => {
                // Bring the workout's name along if this day doesn't have one yet.
                if (workoutName.trim() !== '' || workout.name.trim() === '') return;
                setWorkoutName(workout.name);
                return saveWorkoutName(date, workout.name);
              })
              .catch(() => Alert.alert('Could not paste the workout', 'Please try again.')),
        },
      ],
    );
  }

  function deleteWorkoutWithUndo() {
    const removed = savedCopies(daySets.map((set) => set.id));
    const name = workoutName;
    const notes = exerciseNotes;
    deleteSetsOnDay(date)
      .then(setSets)
      .then(() => saveWorkoutName(date, ''))
      .then(() => deleteExerciseNotesOnDay(date))
      .then(() => {
        setWorkoutName('');
        setExerciseNotes({});
        offerUndo('Workout deleted', async () => {
          setSets(await addSets(removed));
          await saveWorkoutName(date, name);
          setWorkoutName(name);
          // The notes are saved under each exercise's name, so match them up again.
          for (const exercise of groupByExercise(removed)) {
            const note = notes[exerciseKey(exercise.name)];
            if (note) await saveExerciseNote(date, exercise.name, note);
          }
          setExerciseNotes(notes);
        });
      })
      .catch(showDeleteError);
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
                  { backgroundColor: theme.accentSoft },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  {formOpen ? 'Hide form' : '+ Exercise'}
                </ThemedText>
              </Pressable>
            </View>
            {/* Offered on every day except the one the workout was copied from. */}
            {copied && copied.fromDay !== date && copied.sets.length > 0 && (
              <View style={[styles.pasteBar, { backgroundColor: theme.accentSoft }]}>
                <ThemedText type="small" style={styles.pasteText}>
                  Copied: {copied.name.trim() !== '' ? `${copied.name.trim()}, ` : ''}
                  {formatShortDay(copied.fromDay)}
                </ThemedText>
                <Pressable
                  onPress={() => confirmPasteWorkout(copied)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Paste the copied workout onto this day"
                  style={({ pressed }) => [
                    styles.pasteButton,
                    { backgroundColor: theme.accent },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.background }}>
                    Paste
                  </ThemedText>
                </Pressable>
              </View>
            )}
            {/* The form is hidden rather than removed, so a half-entered exercise is kept. */}
            <View style={!formOpen && styles.hidden}>
              <AddSetForm
                day={date}
                history={sets}
                unit={unit ?? 'kg'}
                settings={settings}
                onSaved={setSets}
              />
            </View>
          </View>
        }
        ListHeaderComponentStyle={styles.headerSpacing}
        renderItem={({ item, index }) => (
          <ExerciseCard
            number={index + 1}
            lastTime={lastTimeOf(item.name)}
            weightStep={stepsFor(formula, item.name).weight}
            name={item.name}
            sets={item.sets}
            note={exerciseNotes[exerciseKey(item.name)] ?? ''}
            onNoteChange={(note) => changeExerciseNote(item.name, note)}
            onNoteSave={(note) => saveNoteForExercise(item.name, note)}
            onDeleteSet={deleteSetWithUndo}
            onDeleteExercise={() => deleteExerciseWithUndo(item)}
            onChangeSet={saveSetChanges}
            onAddSet={addAnotherSet}
          />
        )}
        ListFooterComponent={
          daySets.length > 0 ? (
            <View style={styles.footer}>
              <Pressable
                onPress={copyThisWorkout}
                accessibilityRole="button"
                style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  Copy workout
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={deleteWorkoutWithUndo}
                accessibilityRole="button"
                style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold" style={{ color: DELETE_COLOR }}>
                  Delete workout
                </ThemedText>
              </Pressable>
            </View>
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
      {undo && (
        <View
          pointerEvents="box-none"
          style={[styles.undoWrap, { bottom: insets.bottom + BARS_BELOW + Spacing.two }]}>
          <View style={[styles.undoBar, { backgroundColor: theme.text }]}>
            <ThemedText style={[styles.undoLabel, { color: theme.background }]} numberOfLines={1}>
              {undo.label}
            </ThemedText>
            <Pressable
              onPress={undo.restore}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Undo: ${undo.label}`}
              style={({ pressed }) => [
                styles.undoButton,
                { backgroundColor: theme.background },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">Undo</ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  undoWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  undoBar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: 6,
  },
  undoLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 600,
  },
  undoButton: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    justifyContent: 'center',
  },
  // Spacing here is deliberately tight so a whole workout fits on screen with little scrolling.
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + StopwatchBarSpace + Spacing.three,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.two,
  },
  footerButton: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
  },
  pasteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pasteText: {
    flex: 1,
  },
  pasteButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.5,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
});
