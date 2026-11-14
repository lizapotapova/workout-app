import * as Haptics from 'expo-haptics';

/** A short "done" buzz, felt when a set is saved. Does nothing on devices without it. */
export function buzzSaved() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** A light tap, felt when something is deleted or brought back. */
export function buzzLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
