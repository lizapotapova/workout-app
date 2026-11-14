import { useLocalSearchParams } from 'expo-router';

import { DayPage } from '@/components/day-page';

/** The page that opens when a date is tapped in the calendar. */
export default function CalendarDayScreen() {
  // The date comes from the page address, e.g. /calendar/day/2026-11-13.
  const { date } = useLocalSearchParams<{ date: string }>();
  return <DayPage key={date} date={date} />;
}
