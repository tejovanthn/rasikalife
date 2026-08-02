import { describe, expect, it } from 'vitest';
import {
  ConfirmClassSessionSchema,
  MarkClassSessionSchema,
  consumesCredit,
  expectedCredits,
  groupSessions,
} from './schema';

const MARK_INPUT = {
  programId: 'prog1',
  learnerId: 'learn1',
  institutionId: 'inst1',
  sessionDate: '2026-08-04',
  mode: 'online',
  programType: 'regular',
};

describe('consumesCredit', () => {
  it('takes a credit for a confirmed class, whatever the policy', () => {
    expect(consumesCredit({ status: 'confirmed' }, 'burn')).toBe(true);
    expect(consumesCredit({ status: 'confirmed' }, 'no-burn')).toBe(true);
  });

  it('takes a credit for a missed class only under burn', () => {
    expect(consumesCredit({ status: 'absent' }, 'burn')).toBe(true);
    expect(consumesCredit({ status: 'absent' }, 'no-burn')).toBe(false);
  });

  it('takes nothing while a class is pending or disputed', () => {
    expect(consumesCredit({ status: 'pending' }, 'burn')).toBe(false);
    // Disputed means the two people disagree about whether the class happened. No default is
    // right, so nothing moves until somebody resolves it by hand.
    expect(consumesCredit({ status: 'disputed' }, 'burn')).toBe(false);
  });
});

/**
 * The invariant `creditsRemaining` is a cache of. Every movement is an atomic ADD driven by
 * one of these rows, so the running total must always equal what the rows say — and this is
 * the sum a repair would rebuild a drifted balance from.
 */
describe('expectedCredits', () => {
  it('is grants minus the sessions that consumed one', () => {
    expect(
      expectedCredits({
        packs: [{ delta: 8 }, { delta: 4 }],
        sessions: [
          { status: 'confirmed' },
          { status: 'confirmed' },
          { status: 'confirmed' },
          { status: 'pending' },
        ],
        skipPolicy: 'burn',
      })
    ).toBe(9);
  });

  it('counts a correction row like any other grant', () => {
    expect(
      expectedCredits({
        packs: [{ delta: 8 }, { delta: -2 }],
        sessions: [],
        skipPolicy: 'burn',
      })
    ).toBe(6);
  });

  it('leaves skipped classes out of the sum under no-burn', () => {
    const sessions = [{ status: 'confirmed' as const }, { status: 'absent' as const }];
    expect(expectedCredits({ packs: [{ delta: 8 }], sessions, skipPolicy: 'burn' })).toBe(6);
    expect(expectedCredits({ packs: [{ delta: 8 }], sessions, skipPolicy: 'no-burn' })).toBe(7);
  });

  /**
   * A workshop sold as ten routinely runs to thirteen. Nothing blocks at zero, no "completed"
   * state appears, and no new pack is forced — a tool that stops the guru marking the eleventh
   * class is a tool she stops opening.
   */
  it('goes negative when a workshop runs long, rather than clamping', () => {
    expect(
      expectedCredits({
        packs: [{ delta: 10 }],
        sessions: Array.from({ length: 13 }, () => ({ status: 'confirmed' as const })),
        skipPolicy: 'burn',
      })
    ).toBe(-3);
  });
});

describe('groupSessions', () => {
  it('collapses a fan-out to one row and keeps its members', () => {
    const collapsed = groupSessions([
      { groupSessionId: 'g1', learnerId: 'a' },
      { groupSessionId: 'g1', learnerId: 'b' },
      { groupSessionId: 'g2', learnerId: 'c' },
    ]);

    expect(collapsed).toHaveLength(2);
    expect(collapsed[0]?.sessions).toHaveLength(2);
    expect(collapsed[1]?.sessions).toHaveLength(1);
  });

  // Solo classes are groups of one, so the queue's grouping has no special case to get wrong.
  it('leaves a solo class as a group of one', () => {
    const collapsed = groupSessions([{ groupSessionId: 'sess1', learnerId: 'a' }]);
    expect(collapsed).toEqual([
      { groupSessionId: 'sess1', sessions: [{ groupSessionId: 'sess1', learnerId: 'a' }] },
    ]);
  });

  it('keeps the order the rows arrived in', () => {
    const collapsed = groupSessions([
      { groupSessionId: 'g2' },
      { groupSessionId: 'g1' },
      { groupSessionId: 'g2' },
    ]);
    expect(collapsed.map(g => g.groupSessionId)).toEqual(['g2', 'g1']);
  });
});

describe('ConfirmClassSessionSchema', () => {
  /**
   * The note is what a learner still reads two years later and what survives a program being
   * archived. Confirming is the one moment the tool asks for something in exchange for moving
   * a credit, so it asks then.
   */
  it('requires a note from a person', () => {
    expect(() => ConfirmClassSessionSchema.parse({ confirmedBy: 'user9' })).toThrow();
    expect(() => ConfirmClassSessionSchema.parse({ confirmedBy: 'user9', notes: '  ' })).toThrow();
    expect(() =>
      ConfirmClassSessionSchema.parse({ confirmedBy: 'user9', notes: 'Varnam in Kalyani' })
    ).not.toThrow();
  });

  // The cron has nothing to say and must not be made to invent something.
  it('does not require one from the cron', () => {
    expect(() => ConfirmClassSessionSchema.parse({ confirmedBy: 'system' })).not.toThrow();
  });
});

describe('MarkClassSessionSchema', () => {
  it('accepts a full input and defaults the zone', () => {
    const parsed = MarkClassSessionSchema.parse(MARK_INPUT);
    expect(parsed.timezone).toBe('Asia/Kolkata');
  });

  /**
   * The date must be the teacher's local one, computed by `todayInTimeZone`. A loose parse
   * would let a caller's own midnight through, which is the whole cross-timezone bug.
   */
  it('rejects anything that is not a bare YYYY-MM-DD', () => {
    expect(() =>
      MarkClassSessionSchema.parse({ ...MARK_INPUT, sessionDate: '2026-08-04T00:00:00Z' })
    ).toThrow();
    expect(() =>
      MarkClassSessionSchema.parse({ ...MARK_INPUT, sessionDate: '2026-8-4' })
    ).toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() => MarkClassSessionSchema.parse({ ...MARK_INPUT, mode: 'hybrid' })).toThrow();
  });
});
