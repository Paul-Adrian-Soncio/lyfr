// The current local calendar day, as a value that changes when the day
// does. Screens that query "today" must take their day from here rather
// than calling new Date() once on mount: Android keeps the app alive in the
// background, so a screen opened at 10pm and resumed at 7am would otherwise
// still be showing yesterday.

import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";

function dayKey(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function msUntilMidnight(): number {
  const next = new Date();
  next.setHours(24, 0, 0, 0);
  return next.getTime() - Date.now();
}

/** Start of the current local day. Re-renders the caller at midnight and on return to foreground. */
export function useToday(): Date {
  const [key, setKey] = useState(dayKey);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` re-arms the timer for the next midnight once this one fires. Without it the rollover works once, then never again.
  useEffect(() => {
    // Timers don't run while the app is suspended, so the foreground
    // check below is what actually catches most rollovers; the timer
    // covers the app being open on screen across midnight.
    const timer = setTimeout(() => setKey(dayKey()), msUntilMidnight() + 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setKey(dayKey());
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [key]);

  return useMemo(() => new Date(key), [key]);
}

/**
 * The current time, refreshed every minute and on return to foreground.
 * For labels that depend on how late a dose is — a screen only otherwise
 * re-renders when its data changes, so a dose crossing the missed
 * threshold while the app sat open would keep its old label.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}
