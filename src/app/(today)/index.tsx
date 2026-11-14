import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { DayPage } from '@/components/day-page';
import { dayKey } from '@/lib/dates';

/** The first screen of the app: today's workout, ready to log into. */
export default function TodayScreen() {
  const [today, setToday] = useState(() => dayKey(new Date()));

  // Check the date each time the tab is shown, so the page moves on after midnight.
  useFocusEffect(
    useCallback(() => {
      setToday(dayKey(new Date()));
    }, []),
  );

  // `key` starts the page afresh when the date changes.
  return <DayPage key={today} date={today} titlePrefix="Today" />;
}
