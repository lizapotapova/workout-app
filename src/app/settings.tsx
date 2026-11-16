import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, StopwatchBarSpace, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAutosave } from '@/hooks/use-autosave';
import { exportWorkouts, pickBackup } from '@/lib/backup';
import { useTheme } from '@/hooks/use-theme';
import { parseNumber } from '@/lib/numbers';
import { type ProgressionSettings, type Steps } from '@/lib/progression';
import { loadProgressionSettings, saveProgressionSettings } from '@/lib/progression-storage';
import { loadUnit, saveUnit, type WeightUnit } from '@/lib/sets-storage';

const WARNING_COLOR = '#E5484D';
const UNITS: WeightUnit[] = ['kg', 'lb'];
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

/** The Settings tab: the weight unit and the three numbers of the progression formula. */
export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<ProgressionSettings | null>(null);
  const [unit, setUnit] = useState<WeightUnit>('kg');

  function chooseUnit(next: WeightUnit) {
    setUnit(next);
    saveUnit(next).catch(() => Alert.alert('Could not save the weight unit', 'Please try again.'));
  }

  const autosave = useAutosave((next: ProgressionSettings) => {
    saveProgressionSettings(next).catch(() =>
      Alert.alert('Could not save the settings', 'Please change the number again.'),
    );
  });

  const reload = useCallback(() => {
    loadProgressionSettings()
      .then(setSettings)
      .catch(() => Alert.alert('Could not load the settings'));
    loadUnit()
      .then(setUnit)
      .catch(() => {});
  }, []);

  // Re-read everything each time this tab is opened.
  useFocusEffect(reload);

  function exportData() {
    exportWorkouts().catch(() => Alert.alert('Could not export', 'Please try again.'));
  }

  // Importing replaces everything, so it shows what is in the file and asks first.
  async function importData() {
    try {
      const backup = await pickBackup();
      if (!backup) return;
      const sets = backup.setCount === 1 ? '1 set' : `${backup.setCount} sets`;
      const days = backup.dayCount === 1 ? '1 day' : `${backup.dayCount} days`;
      Alert.alert(
        'Replace all your data?',
        `This file${backup.exportedOn ? ` from ${backup.exportedOn}` : ''} has ${sets} on ${days}. Everything in the app now (workouts, names, notes and settings) will be replaced by it.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: () =>
              backup
                .restore()
                .then(() => {
                  reload();
                  Alert.alert('Import finished', `Restored ${sets} on ${days}.`);
                })
                .catch(() => Alert.alert('Could not import', 'Please try again.')),
          },
        ],
      );
    } catch (error) {
      Alert.alert('Could not import', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  if (!settings) return <ThemedView style={styles.container} />;

  function update(next: ProgressionSettings) {
    setSettings(next);
    autosave.change(next);
  }

  function updateSteps(changes: Partial<Steps>) {
    if (!settings) return;
    update({ ...settings, steps: { ...settings.steps, ...changes } });
  }

  const ownCount = Object.keys(settings.exercises).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          // The bottom padding leaves room for the tab bar and the floating stopwatch bar,
          // so the last item can be scrolled clear of them.
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + BottomTabInset + StopwatchBarSpace + Spacing.three },
          ]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <ThemedText style={styles.heading}>Settings</ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>Weight unit</ThemedText>
              <View style={[styles.toggle, { backgroundColor: theme.background }]}>
                {UNITS.map((option) => {
                  const selected = option === unit;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => chooseUnit(option)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Weight unit: ${option}`}
                      style={[styles.toggleOption, selected && { backgroundColor: theme.accent }]}>
                      <ThemedText
                        type="small"
                        style={{ color: selected ? theme.background : theme.textSecondary }}>
                        {option}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Every weight is shown in this unit. Sets logged in the other unit are converted,
              for example 170 lb shows as 77.1 kg, and switching back shows 170 lb again.
            </ThemedText>
          </ThemedView>

          <ThemedText style={styles.subheading}>Progression</ThemedText>

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
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>Reps added per step</ThemedText>
              <NumberBox
                label="Reps added per step"
                value={settings.steps.reps}
                whole
                min={0}
                onChange={(value) => value !== undefined && updateSteps({ reps: value })}
              />
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>Weight added per step ({unit})</ThemedText>
              <NumberBox
                label="Weight added per step"
                value={settings.steps.weight}
                min={0}
                onChange={(value) => value !== undefined && updateSteps({ weight: value })}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              After this many weeks at the same weight and reps, an exercise takes one step up.
              Steps take turns: more reps, then more weight, then more reps again. These numbers
              apply to every exercise and save by themselves.
              {ownCount > 0 &&
                ` ${ownCount === 1 ? '1 exercise has' : `${ownCount} exercises have`} their own step sizes, which are kept.`}
            </ThemedText>
          </ThemedView>

          <ThemedText style={styles.subheading}>Your data</ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            <Pressable
              onPress={exportData}
              accessibilityRole="button"
              style={({ pressed }) => [styles.dataRow, pressed && styles.pressed]}>
              <ThemedText style={styles.rowLabel}>Export my workouts</ThemedText>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Pressable>
            <View style={[styles.line, { backgroundColor: theme.separator }]} />
            <Pressable
              onPress={importData}
              accessibilityRole="button"
              style={({ pressed }) => [styles.dataRow, pressed && styles.pressed]}>
              <ThemedText style={styles.rowLabel}>Import from a file</ThemedText>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              Export saves all your workouts, names, notes and settings as one file. Import
              replaces everything in the app with the contents of such a file.
            </ThemedText>
          </ThemedView>
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
    gap: Spacing.two,
  },
  heading: {
    fontFamily: Fonts?.rounded,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 700,
  },
  subheading: {
    fontFamily: Fonts?.rounded,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
    marginTop: Spacing.two,
  },
  card: {
    gap: Spacing.two,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  line: {
    height: StyleSheet.hairlineWidth,
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
  pressed: {
    opacity: 0.6,
  },
});
