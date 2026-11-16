/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  // The look the app actually uses (it is always light, see `src/app/_layout.tsx`):
  // "Sand" — warm sand pages, cream cards, and one deep green accent.
  light: {
    text: '#1F1F1C',
    background: '#E6E1D7',
    backgroundElement: '#F6F3EC',
    backgroundSelected: '#D9D3C4',
    textSecondary: '#6C685F',
    /** The app's one accent colour: deep green. Text on top of it is light (`background`). */
    accent: '#2E5A44',
    /** A tan fill, for workout days and soft buttons. Text on it is the accent or `text`. */
    accentSoft: '#D6CFBD',
    /** Thin lines between rows. */
    separator: '#DDD8CB',
  },
  // An earlier dark look (near-black with a lime accent). Not used at the moment.
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
