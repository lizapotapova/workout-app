import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'stopwatch-v1';

/**
 * The stopwatch does not count by itself. It only remembers the clock time at which it
 * was started; the time shown is "now minus then". That is why it keeps going while
 * another tab is open, and even while the app is closed.
 */
export type StopwatchState = {
  /** Clock time (ms) of the last Start press, or `null` while stopped. */
  startedAt: number | null;
  /** Time (ms) collected before the last Start press. */
  elapsedBefore: number;
  /** Total stopwatch time (ms) at each Lap press, oldest first. */
  laps: number[];
};

const EMPTY: StopwatchState = { startedAt: null, elapsedBefore: 0, laps: [] };

let state: StopwatchState = EMPTY;
// True once a button was pressed, so a slow load from storage can't undo the press.
let touched = false;
const listeners = new Set<() => void>();

function setState(next: StopwatchState) {
  state = next;
  touched = true;
  listeners.forEach((listener) => listener());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

// Bring back the stopwatch from the last time the app was open.
AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw || touched) return;
    const saved = JSON.parse(raw);
    if (
      saved &&
      (saved.startedAt === null || typeof saved.startedAt === 'number') &&
      typeof saved.elapsedBefore === 'number' &&
      Array.isArray(saved.laps) &&
      saved.laps.every((lap: unknown) => typeof lap === 'number')
    ) {
      state = {
        startedAt: saved.startedAt,
        elapsedBefore: saved.elapsedBefore,
        laps: saved.laps,
      };
      listeners.forEach((listener) => listener());
    }
  })
  .catch(() => {});

/** The stopwatch's time (ms) at clock time `now`. */
export function elapsedAt(current: StopwatchState, now: number): number {
  if (current.startedAt === null) return current.elapsedBefore;
  return current.elapsedBefore + Math.max(0, now - current.startedAt);
}

export function startStopwatch() {
  if (state.startedAt !== null) return;
  setState({ ...state, startedAt: Date.now() });
}

export function stopStopwatch() {
  if (state.startedAt === null) return;
  setState({ ...state, startedAt: null, elapsedBefore: elapsedAt(state, Date.now()) });
}

export function addLap() {
  if (state.startedAt === null) return;
  setState({ ...state, laps: [...state.laps, elapsedAt(state, Date.now())] });
}

export function resetStopwatch() {
  setState(EMPTY);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getState() {
  return state;
}

/** The current stopwatch; the screen redraws whenever a button changes it. */
export function useStopwatch(): StopwatchState {
  return useSyncExternalStore(subscribe, getState, getState);
}

/**
 * The stopwatch's time (ms) right now. While it runs, this refreshes many times a
 * second, which is what makes the digits move.
 */
export function useElapsed(stopwatch: StopwatchState): number {
  const running = stopwatch.startedAt !== null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 40);
    return () => clearInterval(timer);
  }, [running]);
  return elapsedAt(stopwatch, now);
}

/** 83450 → "01:23.45"; from one hour on, "1:02:03.45". */
export function formatStopwatch(ms: number): string {
  const hundredths = Math.floor(ms / 10);
  const two = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(hundredths / 360000);
  const minutes = Math.floor(hundredths / 6000) % 60;
  const seconds = Math.floor(hundredths / 100) % 60;
  const rest = `${two(minutes)}:${two(seconds)}.${two(hundredths % 100)}`;
  return hours > 0 ? `${hours}:${rest}` : rest;
}
