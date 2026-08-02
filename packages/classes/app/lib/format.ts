import type { SessionStatus } from '@rasika/core/domain/class-session/client';
import type { BadgeTone } from '@rasika/ui';

/**
 * Rendering a session's date, in the reader's own zone.
 *
 * A session stores two things: `sessionDate`, the teacher's calendar day, which is the ledger
 * key; and `startsAt`, the instant. Where an instant exists it is what a *person* should see,
 * because a student in New York should read "Mon 8:30pm", not the teacher's Tuesday. Where it
 * does not — a class the guru reconstructed from memory — the stored date is all there is, and
 * it must be rendered without a zone conversion or it will slide a day.
 */
export function formatSessionDate(session: {
  sessionDate: string;
  startsAt?: string;
}): string {
  if (session.startsAt) {
    return new Date(session.startsAt).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // Parsed as UTC and formatted as UTC. `new Date('2026-08-04')` is midnight UTC, and formatting
  // that in a zone behind UTC prints the 3rd.
  return new Date(`${session.sessionDate}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The zone-free *and* locale-free form of a session, for the server and the first client render.
 *
 * Pinning `timeZone: 'UTC'` is only half of it: `toLocaleDateString(undefined, …)` still resolves
 * the **locale** from the environment, so a Lambda on `en-US` writes "Aug 4" into the HTML and a
 * browser on `en-GB` renders "4 Aug" from the same input — a hydration mismatch with no timezone
 * involved at all. Assembling the string by hand removes the last ambient input.
 *
 * `sessionDate` is the teacher's own calendar day and carries no zone, so this is a real fact
 * rather than a placeholder. `LocalTime` swaps in the precise local time after mount.
 */
export function formatSessionDateStable(session: { sessionDate: string }): string {
  const [year, month, day] = session.sessionDate.split('-').map(Number);
  const name = MONTHS[(month ?? 1) - 1] ?? '';
  return `${day} ${name} ${year}`;
}

/** The same, for a full ISO instant. */
export function formatInstantStable(iso: string): string {
  return formatSessionDateStable({ sessionDate: iso.slice(0, 10) });
}

export function formatDay(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatInstant(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  pending: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  disputed: 'Disputed',
  absent: 'Missed',
};

export const SESSION_STATUS_TONES: Record<SessionStatus, BadgeTone> = {
  pending: 'warning',
  confirmed: 'success',
  disputed: 'destructive',
  absent: 'neutral',
};

/**
 * The date an unconfirmed class settles itself.
 *
 * The absolute date, where the review queue uses the relative one. Both are the same fact told to
 * different jobs: the queue is scanned, so "in 6 days" sorts and triages at a glance, while one
 * session on a history page is being *read*, and "the 11th" is what somebody plans around.
 *
 * Rendered in the viewer's own zone, like `startsAt` and for the same reason — this is a real
 * instant, and it is when the thing will actually happen *to them*. A student far enough west of
 * their guru may see the previous date, which is not a discrepancy: it is genuinely their
 * Monday afternoon and her Tuesday midnight.
 */
export function autoConfirmOnLabel(autoConfirmAt: string): string {
  const on = new Date(autoConfirmAt).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `confirms automatically on ${on}`;
}

/** "in 6 days", "today", "overdue" — what the guru needs to know about an auto-confirm. */
export function autoConfirmLabel(autoConfirmAt: string, now: Date = new Date()): string {
  const due = new Date(autoConfirmAt).getTime();
  const days = Math.round((due - now.getTime()) / 86_400_000);
  if (days < 0) {
    return 'confirming now';
  }
  if (days === 0) {
    return 'confirms today';
  }
  if (days === 1) {
    return 'confirms tomorrow';
  }
  return `confirms in ${days} days`;
}

export function modeLabel(mode: string): string {
  return mode === 'online' ? 'Online' : 'In person';
}
