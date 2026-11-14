import { Stack } from 'expo-router/stack';

/** The Today tab. It is a one-page "stack" so the page gets a title bar at the top. */
export default function TodayLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Today' }} />
    </Stack>
  );
}
