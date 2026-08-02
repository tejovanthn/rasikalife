import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./index', () => ({
  confirmClassSession: vi.fn(),
  listSessionsDueForAutoConfirm: vi.fn(),
  sessionRef: (session: Record<string, string>) => ({
    programId: session.programId,
    learnerId: session.learnerId,
    sessionDate: session.sessionDate,
    id: session.id,
  }),
}));

import { autoConfirmDueSessions } from './auto-confirm';
import { confirmClassSession, listSessionsDueForAutoConfirm } from './index';

function session(id: string) {
  return { id, programId: 'prog1', learnerId: `learn-${id}`, sessionDate: '2026-08-04' };
}

describe('autoConfirmDueSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when nothing is due', async () => {
    vi.mocked(listSessionsDueForAutoConfirm).mockResolvedValue([]);

    const result = await autoConfirmDueSessions();

    expect(result).toEqual({ due: 0, confirmed: 0, alreadySettled: 0, failed: 0 });
    expect(confirmClassSession).not.toHaveBeenCalled();
  });

  /**
   * `system`, not a user id, and no notes. A learner reading their history should be able to
   * tell a class the guru looked at from one the clock let through — and inventing a note would
   * put words in her mouth in the one field students actually read.
   */
  it('confirms as system, with nothing to say', async () => {
    vi.mocked(listSessionsDueForAutoConfirm).mockResolvedValue([session('a')] as never);
    vi.mocked(confirmClassSession).mockResolvedValue({ applied: true, result: {} } as never);

    await autoConfirmDueSessions();

    expect(confirmClassSession).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), {
      confirmedBy: 'system',
    });
    const input = vi.mocked(confirmClassSession).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(input).not.toHaveProperty('notes');
  });

  /**
   * A lost race is the system working, not a failure to repair. The guru got there first, which
   * is exactly what the conditional transition exists to allow.
   */
  it('counts a session the guru already settled without retrying it', async () => {
    vi.mocked(listSessionsDueForAutoConfirm).mockResolvedValue([
      session('a'),
      session('b'),
    ] as never);
    vi.mocked(confirmClassSession)
      .mockResolvedValueOnce({ applied: true, result: {} } as never)
      .mockResolvedValueOnce({ applied: false, reason: 'already-settled' } as never);

    const result = await autoConfirmDueSessions();

    expect(result).toEqual({ due: 2, confirmed: 1, alreadySettled: 1, failed: 0 });
    expect(confirmClassSession).toHaveBeenCalledTimes(2);
  });

  it('counts anything else as a failure rather than swallowing it', async () => {
    vi.mocked(listSessionsDueForAutoConfirm).mockResolvedValue([session('a')] as never);
    vi.mocked(confirmClassSession).mockResolvedValue({
      applied: false,
      reason: 'no-enrollment',
    } as never);

    expect(await autoConfirmDueSessions()).toEqual({
      due: 1,
      confirmed: 0,
      alreadySettled: 0,
      failed: 1,
    });
  });

  /**
   * Sequential, not `Promise.all`. Each confirm is a two-item transaction against one enrollment
   * row; firing a week's worth at once puts many writers on the same partition and the losers
   * come back as cancelled transactions this would then have to reason about.
   */
  it('confirms one at a time', async () => {
    const inFlight: string[] = [];
    let concurrent = 0;
    let peak = 0;

    vi.mocked(listSessionsDueForAutoConfirm).mockResolvedValue([
      session('a'),
      session('b'),
      session('c'),
    ] as never);
    vi.mocked(confirmClassSession).mockImplementation(async ref => {
      concurrent++;
      peak = Math.max(peak, concurrent);
      await new Promise(resolve => setTimeout(resolve, 1));
      inFlight.push((ref as { id: string }).id);
      concurrent--;
      return { applied: true, result: {} } as never;
    });

    await autoConfirmDueSessions();

    expect(peak).toBe(1);
    expect(inFlight).toEqual(['a', 'b', 'c']);
  });

  it('passes the caller clock through, so a sweep can be tested against a fixed time', async () => {
    vi.mocked(listSessionsDueForAutoConfirm).mockResolvedValue([]);

    await autoConfirmDueSessions({ now: '2026-08-11T00:00:00.000Z' });

    expect(listSessionsDueForAutoConfirm).toHaveBeenCalledWith('2026-08-11T00:00:00.000Z');
  });

  it('honours a limit, so one run cannot be unbounded', async () => {
    vi.mocked(listSessionsDueForAutoConfirm).mockResolvedValue([
      session('a'),
      session('b'),
      session('c'),
    ] as never);
    vi.mocked(confirmClassSession).mockResolvedValue({ applied: true, result: {} } as never);

    const result = await autoConfirmDueSessions({ limit: 2 });

    expect(result.due).toBe(2);
    expect(confirmClassSession).toHaveBeenCalledTimes(2);
  });
});
