import { useEffect, useRef } from 'react';

/** How long to wait after the last keystroke before saving. */
const SAVE_DELAY_MS = 600;

/**
 * Saves a value shortly after typing stops, rather than on every single keystroke.
 * Call `change(value)` whenever the value changes, and `flush()` to save straight away
 * (for example when the box loses focus). Anything still waiting is saved when the
 * component goes away.
 */
export function useAutosave<T>(save: (value: T) => void) {
  // The value that has been typed but not saved yet, wrapped so "nothing waiting" is null.
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSave = useRef(save);
  useEffect(() => {
    latestSave.current = save;
  });

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current !== null) {
      latestSave.current(pending.current.value);
      pending.current = null;
    }
  }

  function change(value: T) {
    pending.current = { value };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null) latestSave.current(pending.current.value);
    };
  }, []);

  return { change, flush };
}
