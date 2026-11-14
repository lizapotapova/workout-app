import { useEffect, useRef } from 'react';

/** How long to wait after the last keystroke before saving. */
const SAVE_DELAY_MS = 600;

/**
 * Saves text shortly after typing stops, rather than on every single keystroke.
 * Call `change(text)` whenever the text changes, and `flush()` to save straight away
 * (for example when the box loses focus). Anything still waiting is saved when the
 * component goes away.
 */
export function useAutosave(save: (text: string) => void) {
  // Text that has been typed but not saved yet.
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSave = useRef(save);
  useEffect(() => {
    latestSave.current = save;
  });

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current !== null) {
      latestSave.current(pending.current);
      pending.current = null;
    }
  }

  function change(text: string) {
    pending.current = text;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null) latestSave.current(pending.current);
    };
  }, []);

  return { change, flush };
}
