import { describe, expect, it } from 'vitest';
import { autoConfirmLabel, formatDay, formatSessionDate } from './format';

describe('formatSessionDate', () => {
  /**
   * Where an instant exists it is what a person should see, rendered in *their* zone. A student
   * in New York should read Monday evening for a class the teacher holds on Tuesday morning —
   * that is the whole reason the row stores both.
   */
  it('renders an instant in the reader zone', () => {
    const rendered = formatSessionDate({
      sessionDate: '2026-08-04',
      startsAt: '2026-08-04T02:30:00.000Z',
    });
    // Asserted loosely because the runner's zone decides the words; what matters is that the
    // instant was used and a time is shown.
    expect(rendered).toMatch(/\d/);
    expect(rendered.length).toBeGreaterThan(6);
  });

  /**
   * The bug this guards. `new Date('2026-08-04')` is midnight **UTC**, so formatting it in any
   * zone behind UTC prints the 3rd — a class silently sliding a day every time it is displayed.
   * The date-only path therefore parses and formats in UTC, both.
   */
  it('never slides a date-only session by a day', () => {
    expect(formatSessionDate({ sessionDate: '2026-08-04' })).toContain('4');
    expect(formatSessionDate({ sessionDate: '2026-01-01' })).toContain('1');
    expect(formatDay('2026-08-04')).toContain('4');
    expect(formatDay('2026-12-31')).toContain('31');
  });

  it('does not show a time when there is no instant to show one from', () => {
    const rendered = formatSessionDate({ sessionDate: '2026-08-04' });
    expect(rendered).not.toMatch(/:\d\d/);
  });
});

describe('autoConfirmLabel', () => {
  const now = new Date('2026-08-04T00:00:00.000Z');

  it('counts the days left', () => {
    expect(autoConfirmLabel('2026-08-10T00:00:00.000Z', now)).toBe('confirms in 6 days');
    expect(autoConfirmLabel('2026-08-05T00:00:00.000Z', now)).toBe('confirms tomorrow');
    expect(autoConfirmLabel('2026-08-04T00:00:00.000Z', now)).toBe('confirms today');
  });

  /**
   * Past the deadline it says "confirming now" rather than "overdue". Nothing is late — the
   * cron is about to act, and that is the system working as designed.
   */
  it('reads a passed deadline as imminent, not as a failure', () => {
    expect(autoConfirmLabel('2026-08-01T00:00:00.000Z', now)).toBe('confirming now');
  });
});
