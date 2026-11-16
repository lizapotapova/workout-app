import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Appearance, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { StopwatchBar } from '@/components/stopwatch-bar';

SplashScreen.preventAutoHideAsync();

// The app is always light ("Sand"), whatever the phone is set to. This also keeps the
// keyboard, the tab bar and the title bars light.
Appearance.setColorScheme?.('light');

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
      {/* Drawn last so it floats on top of every screen. */}
      <StopwatchBar />
    </ThemeProvider>
  );
}
