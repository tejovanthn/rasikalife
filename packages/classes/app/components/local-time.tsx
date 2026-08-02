import { useEffect, useState } from 'react';

/**
 * Renders a time in the reader's own zone without lying to the server about what that is.
 *
 * Every helper in `~/lib/format` calls `toLocaleString(undefined, …)`, which resolves against the
 * *ambient* zone and locale. That is the right answer in a browser and an accident on the server:
 * the Lambda runs in UTC, so it rendered "Mon 3 Aug, 8:30 pm" into the HTML while a phone in
 * Chennai rendered "Tue 4 Aug, 2:00 am" from the same instant. React sees two different text
 * nodes, logs a hydration error and throws away the server markup for that subtree — on every
 * session row, every pack row and every auto-confirm label.
 *
 * So: render something the server and the first client pass agree on, then swap after mount.
 * `fallback` is the teacher's own date, which is a real fact rather than a placeholder — it is
 * what `sessionDate` stores and what the ledger sorts on — so the pre-hydration text is correct,
 * just less precise than what replaces it.
 *
 * `suppressHydrationWarning` would silence the console and leave the *wrong* time on screen; this
 * costs a re-render and shows the right one.
 */
export function LocalTime({
  fallback,
  children,
}: {
  fallback: string;
  children: () => string;
}) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return <>{hydrated ? children() : fallback}</>;
}
