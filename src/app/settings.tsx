import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, StopwatchBarSpace, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAutosave } from '@/hooks/use-autosave';
import { useTheme } from '@/hooks/use-theme';
import { exerciseKey } from '@/lib/exercises';
import { parseNumber } from '@/lib/numbers';
import {
  DEFAULT_BODY_PART,
  type BodyPart,
  type ExerciseRule,
  type ProgressionSettings,
  type Steps,
} from '@/lib/progression';
import { loadProgressionSettings, saveProgressionSettings } from '@/lib/progression-storage';
import { loadSets } from '@/lib/sets-storage';

const WARNING_COLOR = '#E5484D';
const BODY_PARTS: { value: BodyPart; label: string }[] = [
  { value: 'lower', label: 'Lower' },
  { value: 'upper', label: 'Upper' },
];

type NumberBoxProps = {
  label: string;
  /** The saved number. `undefined` means "not set" (only allowed with `emptyMeans`). */
  value: number | undefined;
  /** Shown in grey when the box is empty: the number that applies instead. */
  emptyMeans?: number;
  /** Whole numbers only (for reps and weeks). */
  whole?: boolean;
  /** The smallest allowed number. */
  min: number;
  onChange: (value: number | undefined) => void;
};

/**
 * A small box for typing one number. It passes the number on as soon as it is valid;
 * while it isn't, the box gets a red outline and the old number is kept.
 */
function NumberBox({ label, value, emptyMeans, whole, min, onChange }: NumberBoxProps) {
  const theme = useTheme();
  const [text, setText] = useState(value === undefined ? '' : String(value));

  function parse(input: string): { ok: boolean; value?: number } {
    if (input.trim() === '') return { ok: emptyMeans !== undefined, value: undefined };
    const number = parseNumber(input);
    if (number === null || number < min || (whole && !Number.isInteger(number))) {
      return { ok: false };
    }
    return { ok: true, value: number };
  }

  const valid = parse(text).ok;

  return (
    <TextInput
      style={[
        styles.numberBox,
        { backgroundColor: theme.background, color: theme.text },
        !valid && { borderColor: WARNING_COLOR },
      ]}
      accessibilityLabel={label}
      placeholder={emptyMeans === undefined ? '' : String(emptyMeans)}
      placeholderTextColor={theme.textSecondary}
      value={text}
      onChangeText={(input) => {
        setText(input);
        const result = parse(input);
        if (result.ok) onChange(result.value);
      }}
      keyboardType={whole ? 'number-pad' : 'decimal-pad'}
      selectTextOnFocus
    />
  );
}

/** The Settings tab: the numbers used by the progression formula. */
export default function SettingsScreen() {
  const theme = useTheme();
  const [settings, setSettings] = useState<ProgressionSettings | null>(null);
  // Names of the exercises that have been logged, to list alongside the ones with settings.
  const [loggedNames, setLoggedNames] = useState<string[]>([]);
  const [newName, setNewName] = useState('');

  const autosave = useAutosave((next: ProgressionSettings) => {
    saveProgressionSettings(next).catch(() =>
      Alert.alert('Could not save the settings', 'Please change the number again.'),
    );
  });

  // Re-read everything each time this tab is opened, so newly logged exercises show up.
  useFocusEffect(
    useCallback(() => {
      loadProgressionSettings()
        .then(setSettings)
        .catch(() => Alert.alert('Could not load the settings'));
      loadSets()
        .then((sets) => setLoggedNames(sets.map((set) => set.exercise.trim())))
        .catch(() => {});
    }, []),
  );

  if (!settings) return <ThemedView style={styles.container} />;

  function update(next: ProgressionSettings) {
    setSettings(next);
    autosave.change(next);
  }

  function updateSteps(bodyPart: BodyPart, changes: Partial<Steps>) {
    if (!settings) return;
    update({ ...settings, [bodyPart]: { ...settings[bodyPart], ...changes } });
  }

  function updateExercise(name: string, changes: Partial<ExerciseRule>) {
    if (!settings) return;
    const key = exerciseKey(name);
    const current = settings.exercises[key] ?? { name, bodyPart: DEFAULT_BODY_PART };
    update({ ...settings, exercises: { ...settings.exercises, [key]: { ...current, ...changes } } });
  }

  function addExercise() {
    const name = newName.trim();
    if (name === '') return;
    updateExercise(name, {});
    setNewName('');
  }

  // Every exercise that has its own settings or has been logged, in alphabetical order.
  const names = new Map<string, string>();
  for (const rule of Object.values(settings.exercises)) names.set(exerciseKey(rule.name), rule.name);
  for (const name of loggedNames) {
    if (!names.has(exerciseKey(name))) names.set(exerciseKey(name), name);
  }
  const exercises = [...names.values()].sort((a, b) => a.localeCompare(b));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <ThemedText style={styles.heading}>Progression</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            After staying at the same weight and reps for the number of weeks below, an exercise
            takes one step up. Steps take turns: first more reps, then more weight, then more reps
            again. Changes here save by themselves.
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>Weeks between steps</ThemedText>
              <NumberBox
                label="Weeks between steps"
                value={settings.periodWeeks}
                whole
                min={1}
                onChange={(value) => value !== undefined && update({ ...settings, periodWeeks: value })}
              />
            </View>
          </ThemedView>

          {BODY_PARTS.map(({ value: bodyPart, label }) => (
            <ThemedView key={bodyPart} type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{label} body</ThemedText>
              <View style={styles.row}>
                <ThemedText style={styles.rowLabel}>Reps added per step</ThemedText>
                <NumberBox
                  label={`${label} body reps added per step`}
                  value={settings[bodyPart].reps}
                  whole
                  min={0}
                  onChange={(value) => value !== undefined && updateSteps(bodyPart, { reps: value })}
                />
              </View>
              <View style={styles.row}>
                <ThemedText style={styles.rowLabel}>Weight added per step</ThemedText>
                <NumberBox
                  label={`${label} body weight added per step`}
                  value={settings[bodyPart].weight}
                  min={0}
                  onChange={(value) =>
                    value !== undefined && updateSteps(bodyPart, { weight: value })
                  }
                />
              </View>
            </ThemedView>
          ))}

          <View style={styles.sectionText}>
            <ThemedText type="smallBold">Exercises</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Pick lower or upper body for each exercise. Fill in Reps or Weight only if that
              exercise uses a different number; the grey number is what applies otherwise.
            </ThemedText>
          </View>

          {exercises.map((name) => {
            const rule = settings.exercises[exerciseKey(name)];
            const bodyPart = rule?.bodyPart ?? DEFAULT_BODY_PART;
            return (
              <ThemedView key={exerciseKey(name)} type="backgroundElement" style={styles.card}>
                <View style={styles.row}>
                  <ThemedText type="smallBold" style={styles.rowLabel}>
                    {name}
                  </ThemedText>
                  <View style={[styles.toggle, { backgroundColor: theme.background }]}>
                    {BODY_PARTS.map((option) => {
                      const selected = option.value === bodyPart;
                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => updateExercise(name, { bodyPart: option.value })}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`${name}: ${option.label} body`}
                          style={[styles.toggleOption, selected && { backgroundColor: theme.accent }]}>
                          <ThemedText
                            type="small"
                            style={{ color: selected ? theme.background : theme.textSecondary }}>
                            {option.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.row}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
                    Reps per step
                  </ThemedText>
                  {/* `key` resets the box so its grey number follows the body part. */}
                  <NumberBox
                    key={`reps-${bodyPart}`}
                    label={`${name} reps added per step`}
                    value={rule?.reps}
                    emptyMeans={settings[bodyPart].reps}
                    whole
                    min={0}
                    onChange={(value) => updateExercise(name, { reps: value })}
                  />
                  <ThemedText type="small" themeColor="textSecondary">
                    Weight
                  </ThemedText>
                  <NumberBox
                    key={`weight-${bodyPart}`}
                    label={`${name} weight added per step`}
                    value={rule?.weight}
                    emptyMeans={settings[bodyPart].weight}
                    min={0}
                    onChange={(value) => updateExercise(name, { weight: value })}
                  />
                </View>
              </ThemedView>
            );
          })}

          <View style={styles.row}>
            <TextInput
              style={[
                styles.nameInput,
                { backgroundColor: theme.backgroundElement, color: theme.text },
              ]}
              placeholder="Add an exercise by name"
              placeholderTextColor={theme.textSecondary}
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={addExercise}
              autoCapitalize="sentences"
              autoCorrect={false}
              returnKeyType="done"
            />
            <Pressable
              onPress={addExercise}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: theme.accent },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                Add
              </ThemedText>
            </Pressable>
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
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + StopwatchBarSpace + Spacing.three,
    gap: Spacing.two,
  },
  heading: {
    fontFamily: Fonts?.rounded,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 700,
  },
  sectionText: {
    gap: Spacing.half,
    paddingTop: Spacing.two,
  },
  card: {
    gap: Spacing.two,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  numberBox: {
    width: 64,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    fontVariant: ['tabular-nums'],
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  toggleOption: {
    paddingHorizontal: 10,
    paddingVertical: Spacing.one,
    borderRadius: 6,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  addButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  pressed: {
    opacity: 0.6,
  },
});
