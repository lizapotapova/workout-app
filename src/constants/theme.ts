/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    /** The app's one accent colour: a cobalt blue, like a 20 kg competition plate. */
    accent: '#2457D6',
    /** A pale wash of the accent, used to fill the days that have a workout. */
    accentSoft: '#E1E9FC',
    /** Thin lines between rows. */
    separator: '#D8D9DE',
  },
  // The look the app actually uses (it is always dark, see `src/app/_layout.tsx`):
  // near-black pages, slightly lighter cards, and one lime accent.
  dark: {
    text: '#F4F5F6',
    background: '#0B0C0F',
    backgroundElement: '#17191E',
    backgroundSelected: '#24272E',
    textSecondary: '#9499A3',
    /** The app's one accent colour: lime. Text on top of it is dark (`background`). */
    accent: '#D3F36B',
    /** A dark olive wash of the accent, for workout days and soft buttons. */
    accentSoft: '#2B3218',
    separator: '#272A31',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Room left at the bottom of scrolling pages for the floating stopwatch bar. */
export const StopwatchBarSpace = 56;
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
