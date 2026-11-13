import { Stack } from 'expo-router/stack';

/**
 * The Calendar tab is a "stack" of pages: the month view is the first page, and tapping
 * a date slides that day's page on top of it, with a back button to return.
 */
export default function CalendarLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Calendar', headerShown: false }} />
      <Stack.Screen name="day/[date]" options={{ title: '' }} />
    </Stack>
  );
}
