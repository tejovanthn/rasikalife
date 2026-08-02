import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ClassSessionEntity: {
    create: vi.fn(),
    patch: vi.fn(),
    query: {
      primary: vi.fn(),
      byInstitutionStatus: vi.fn(),
      byGroup: vi.fn(),
      byDue: vi.fn(),
    },
  },
}));

// The Service is built at import time and rejects anything that is not a real entity, so a
// suite that mocks the entity has to replace it wholesale. `outcome.ts` stays real — reading a
// cancelled transaction is the logic under test here.
vi.mock('../class-enrollment/ledger', () => ({
  ClassLedgerService: { transaction: { write: vi.fn() } },
}));

vi.mock('../class-enrollment', () => ({
  listProgramEnrollments: vi.fn(),
  touchLastSession: vi.fn(),
}));

import {
  autoConfirmDeadline,
  confirmClassSession,
  confirmClassSessions,
  disputeClassSession,
  listPendingSessions,
  listSessionsDueForAutoConfirm,
  markClassSession,
  markClassSessionAbsent,
  markGroupClassSession,
} from '.';
import { listProgramEnrollments, touchLastSession } from '../class-enrollment';
import { ClassLedgerService } from '../class-enrollment/ledger';
import { ClassSessionEntity } from './entity';

const REF = {
  programId: 'prog1',
  learnerId: 'learn1',
  sessionDate: '2026-08-04',
  id: 'sess1',
  institutionId: 'inst1',
};

const MARK_INPUT = {
  programId: 'prog1',
  learnerId: 'learn1',
  institutionId: 'inst1',
  sessionDate: '2026-08-04',
  timezone: 'Asia/Kolkata',
  mode: 'online' as const,
  programType: 'regular' as const,
};

/** The write chain: `.patch(ref).set(fields).where(...).go()` / `.commit()`. */
function patchChain(result: unknown = { data: {} }) {
  const go = vi.fn().mockResolvedValue(result);
  const commit = vi.fn().mockReturnValue({ committed: true });
  const chain: Record<string, unknown> = { go, commit };
  chain.set = vi.fn().mockReturnValue(chain);
  chain.add = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.composite = vi.fn().mockReturnValue(chain);
  return { chain, go, commit };
}

function transactionResolves(value: { canceled: boolean; data?: unknown }) {
  vi.mocked(ClassLedgerService.transaction.write).mockReturnValue({
    go: vi.fn().mockResolvedValue(value),
  } as never);
}

/** Runs the callback the transaction was built with, so the built chain can be inspected. */
function transactionEntities() {
  const session = patchChain();
  const enrollment = patchChain();
  const build = vi.mocked(ClassLedgerService.transaction.write).mock.calls[0]?.[0] as (
    entities: unknown
  ) => unknown;
  build?.({
    classSession: { patch: () => session.chain },
    classEnrollment: { patch: () => enrollment.chain },
  });
  return { session, enrollment };
}

describe('class-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('autoConfirmDeadline', () => {
    it('is midnight seven days later on the teacher wall, not 168 hours later', () => {
      // 2026-08-04 + 7 = 2026-08-11, which begins at 18:30Z the previous day in Chennai.
      expect(autoConfirmDeadline('2026-08-04', 'Asia/Kolkata')).toBe('2026-08-10T18:30:00.000Z');
    });

    it('follows the zone across a DST change rather than drifting an hour', () => {
      // 2026-10-26 + 7 = 2026-11-02, by which point New York is back on standard time.
      expect(autoConfirmDeadline('2026-10-26', 'America/New_York')).toBe(
        '2026-11-02T05:00:00.000Z'
      );
    });
  });

  describe('markClassSession', () => {
    it('creates a pending row and computes its own deadline', async () => {
      vi.mocked(ClassSessionEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: {} }),
      } as never);

      await markClassSession(MARK_INPUT);

      expect(ClassSessionEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          autoConfirmAt: '2026-08-10T18:30:00.000Z',
        })
      );
    });

    /**
     * CLAUDE.md rule 9. A blank composite writes `class_group_session#` for every solo session
     * on the platform — one hot partition that a lookup with a blank id then matches in full.
     */
    it('makes a solo class a group of one rather than leaving the key blank', async () => {
      vi.mocked(ClassSessionEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: {} }),
      } as never);

      await markClassSession(MARK_INPUT);

      const written = vi.mocked(ClassSessionEntity.create).mock.calls[0]?.[0] as {
        id: string;
        groupSessionId: string;
      };
      expect(written.groupSessionId).toBe(written.id);
      expect(written.groupSessionId).toBeTruthy();
    });

    /**
     * Display-only, and deliberately outside the create. A failure here leaves the roster's
     * "Last class" column stale and nothing else — it decides no credit.
     */
    it('records the date on the enrollment for the roster column', async () => {
      vi.mocked(ClassSessionEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: {} }),
      } as never);

      await markClassSession(MARK_INPUT);

      expect(touchLastSession).toHaveBeenCalledWith('prog1', 'learn1', '2026-08-04');
    });

    it('keeps the supplied group id when there is one', async () => {
      vi.mocked(ClassSessionEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: {} }),
      } as never);

      await markClassSession({ ...MARK_INPUT, groupSessionId: 'grp9' });

      expect(ClassSessionEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({ groupSessionId: 'grp9' })
      );
    });
  });

  describe('markGroupClassSession', () => {
    it('fans out one row per active enrollment, sharing a group id', async () => {
      vi.mocked(listProgramEnrollments).mockResolvedValue([
        { learnerId: 'a' },
        { learnerId: 'b' },
        { learnerId: 'c' },
      ] as never);
      vi.mocked(ClassSessionEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: {} }),
      } as never);

      const { groupSessionId, sessions } = await markGroupClassSession(MARK_INPUT);

      expect(sessions).toHaveLength(3);
      expect(listProgramEnrollments).toHaveBeenCalledWith('prog1', { activeOnly: true });

      const written = vi
        .mocked(ClassSessionEntity.create)
        .mock.calls.map(call => call[0] as { learnerId: string; groupSessionId: string });
      expect(written.map(w => w.learnerId)).toEqual(['a', 'b', 'c']);
      expect(new Set(written.map(w => w.groupSessionId))).toEqual(new Set([groupSessionId]));
    });

    it('moves no credit — every row lands pending', async () => {
      vi.mocked(listProgramEnrollments).mockResolvedValue([{ learnerId: 'a' }] as never);
      vi.mocked(ClassSessionEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: {} }),
      } as never);

      await markGroupClassSession(MARK_INPUT);

      expect(ClassLedgerService.transaction.write).not.toHaveBeenCalled();
      expect(ClassSessionEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' })
      );
    });

    it('skips learners whose enrollment has ended', async () => {
      vi.mocked(listProgramEnrollments).mockResolvedValue([] as never);

      const { sessions } = await markGroupClassSession(MARK_INPUT);

      expect(sessions).toEqual([]);
      expect(ClassSessionEntity.create).not.toHaveBeenCalled();
    });
  });

  describe('confirmClassSession', () => {
    it('writes the status and the credit in one transaction', async () => {
      transactionResolves({ canceled: false, data: [] });

      const outcome = await confirmClassSession(REF, {
        confirmedBy: 'user9',
        notes: 'Varnam in Kalyani',
      });

      expect(outcome).toEqual({
        applied: true,
        result: { ...REF, status: 'confirmed' },
      });

      const { session, enrollment } = transactionEntities();
      expect(session.chain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'confirmed', notes: 'Varnam in Kalyani' })
      );
      // Exactly one credit, and via ADD so two writers cannot lose one another's decrement.
      expect(enrollment.chain.add).toHaveBeenCalledWith({ creditsRemaining: -1 });
    });

    /**
     * `status` is a composite of two GSI partition keys and `institutionId` is not in the primary
     * key, so without this ElectroDB cannot re-format them and the write throws outright. It
     * reached a deploy: every test in this file mocks the entity, so they could only ever agree
     * about which methods were called. `keys.test.ts` exercises the real one.
     */
    it('supplies the institution the status keys are re-formatted from', async () => {
      transactionResolves({ canceled: false, data: [] });

      await confirmClassSession(REF, { confirmedBy: 'user9', notes: 'ok' });

      const { session } = transactionEntities();
      expect(session.chain.composite).toHaveBeenCalledWith({ institutionId: 'inst1' });
    });

    /**
     * The cron and the guru's thumb race for this row every week. Guarding on the button press
     * rather than on the transition means the loser decrements a second credit, and the
     * learner is charged twice for one class with nothing in the ledger to say why.
     */
    it('guards the transition on the row still being pending', async () => {
      transactionResolves({ canceled: false, data: [] });

      await confirmClassSession(REF, { confirmedBy: 'system' });

      const { session } = transactionEntities();
      expect(session.chain.where).toHaveBeenCalled();

      const predicate = vi.mocked(session.chain.where as never).mock.calls[0]?.[0] as (
        attr: unknown,
        op: unknown
      ) => unknown;
      const eq = vi.fn().mockReturnValue('status = pending');
      predicate({ status: 'STATUS_ATTR' }, { eq });
      expect(eq).toHaveBeenCalledWith('STATUS_ATTR', 'pending');
    });

    it('is a no-op, not an error, when somebody already confirmed it', async () => {
      transactionResolves({
        canceled: true,
        data: [{ rejected: true, code: 'ConditionalCheckFailed' }, { rejected: false }],
      });

      const outcome = await confirmClassSession(REF, { confirmedBy: 'user9', notes: 'ok' });

      expect(outcome).toEqual({ applied: false, reason: 'already-settled' });
    });

    it('tells a settled session apart from a learner who is not enrolled', async () => {
      transactionResolves({
        canceled: true,
        data: [{ rejected: false }, { rejected: true, code: 'ConditionalCheckFailed' }],
      });

      const outcome = await confirmClassSession(REF, { confirmedBy: 'user9', notes: 'ok' });

      expect(outcome).toEqual({ applied: false, reason: 'no-enrollment' });
    });

    /**
     * ElectroDB drops undefined values out of an UpdateExpression entirely (CLAUDE.md rule 8).
     * Here that is the behaviour wanted — the cron has nothing to add and must leave whatever
     * the student wrote standing — so the field is never sent rather than sent as undefined.
     */
    it('does not blank the student note when the cron confirms without one', async () => {
      transactionResolves({ canceled: false, data: [] });

      await confirmClassSession(REF, { confirmedBy: 'system' });

      const { session } = transactionEntities();
      const fields = vi.mocked(session.chain.set as never).mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(fields).not.toHaveProperty('notes');
      expect(fields).toEqual({ status: 'confirmed', confirmedBy: 'system' });
    });
  });

  describe('markClassSessionAbsent', () => {
    it('burns a credit under the default policy', async () => {
      transactionResolves({ canceled: false, data: [] });

      await markClassSessionAbsent(REF, { confirmedBy: 'user9', skipPolicy: 'burn' });

      const { enrollment } = transactionEntities();
      expect(enrollment.chain.add).toHaveBeenCalledWith({ creditsRemaining: -1 });
    });

    /**
     * With nothing to move there is no second write, so a transaction would buy nothing and
     * cost double the write units. It still has to be conditional, though — a race with the
     * cron would otherwise mark a confirmed class absent.
     */
    it('takes no credit under no-burn, and skips the transaction entirely', async () => {
      const { chain, go } = patchChain({ data: { status: 'absent' } });
      vi.mocked(ClassSessionEntity.patch).mockReturnValue(chain as never);

      const outcome = await markClassSessionAbsent(REF, {
        confirmedBy: 'user9',
        skipPolicy: 'no-burn',
      });

      expect(ClassLedgerService.transaction.write).not.toHaveBeenCalled();
      expect(ClassSessionEntity.patch).toHaveBeenCalledWith(REF);
      expect(chain.where).toHaveBeenCalled();
      expect(go).toHaveBeenCalled();
      expect(outcome).toEqual({ applied: true, result: { ...REF, status: 'absent' } });
    });

    it('reports a lost race on the unguarded path too', async () => {
      const chain = patchChain().chain;
      chain.go = vi.fn().mockRejectedValue(new Error('ConditionalCheckFailed'));
      vi.mocked(ClassSessionEntity.patch).mockReturnValue(chain as never);

      const outcome = await markClassSessionAbsent(REF, {
        confirmedBy: 'user9',
        skipPolicy: 'no-burn',
      });

      expect(outcome).toEqual({ applied: false, reason: 'already-settled' });
    });

    it('lets an unrelated failure through rather than reporting it as a lost race', async () => {
      const chain = patchChain().chain;
      chain.go = vi.fn().mockRejectedValue(new Error('ProvisionedThroughputExceeded'));
      vi.mocked(ClassSessionEntity.patch).mockReturnValue(chain as never);

      await expect(
        markClassSessionAbsent(REF, { confirmedBy: 'user9', skipPolicy: 'no-burn' })
      ).rejects.toThrow('ProvisionedThroughputExceeded');
    });
  });

  describe('disputeClassSession', () => {
    it('moves no credit until somebody resolves it', async () => {
      const { chain } = patchChain({ data: { status: 'disputed' } });
      vi.mocked(ClassSessionEntity.patch).mockReturnValue(chain as never);

      const outcome = await disputeClassSession(REF, { confirmedBy: 'user9', notes: 'Not held' });

      expect(ClassLedgerService.transaction.write).not.toHaveBeenCalled();
      expect(chain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'disputed', notes: 'Not held' })
      );
      expect(outcome.applied).toBe(true);
    });
  });

  describe('confirmClassSessions', () => {
    it('caps the selection at fifty', async () => {
      transactionResolves({ canceled: false, data: [] });
      const refs = Array.from({ length: 80 }, (_, i) => ({ ...REF, id: `sess${i}` }));

      const results = await confirmClassSessions(refs, { confirmedBy: 'user9', notes: 'ok' });

      expect(results).toHaveLength(50);
    });

    /**
     * A loop of transactions, not one BatchWrite. BatchWrite cannot carry a condition, so it
     * would confirm rows the cron had already taken and decrement twice — and one failure in
     * a selection of fifty must not silently drop the other forty-nine.
     */
    it('returns a per-row result so one failure does not hide the rest', async () => {
      const go = vi
        .fn()
        .mockResolvedValueOnce({ canceled: false, data: [] })
        .mockResolvedValueOnce({
          canceled: true,
          data: [{ rejected: true, code: 'ConditionalCheckFailed' }],
        })
        .mockResolvedValueOnce({ canceled: false, data: [] });
      vi.mocked(ClassLedgerService.transaction.write).mockReturnValue({ go } as never);

      const results = await confirmClassSessions(
        [
          { ...REF, id: 'a' },
          { ...REF, id: 'b' },
          { ...REF, id: 'c' },
        ],
        { confirmedBy: 'user9', notes: 'ok' }
      );

      expect(results.map(r => r.applied)).toEqual([true, false, true]);
      expect(results.map(r => r.ref.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('listPendingSessions', () => {
    it('queries only the pending partition, newest first', async () => {
      vi.mocked(ClassSessionEntity.query.byInstitutionStatus).mockReturnValue({
        go: vi.fn().mockResolvedValue({
          data: [
            { id: 'old', sessionDate: '2026-08-01' },
            { id: 'new', sessionDate: '2026-08-04' },
          ],
        }),
      } as never);

      const result = await listPendingSessions('inst1');

      expect(ClassSessionEntity.query.byInstitutionStatus).toHaveBeenCalledWith({
        institutionId: 'inst1',
        status: 'pending',
      });
      // Newest first: this is a review queue, not an approval queue. Everything here confirms
      // itself in seven days, so the guru opens it to catch mistakes she can still remember.
      expect(result.map(s => s.id)).toEqual(['new', 'old']);
    });
  });

  describe('listSessionsDueForAutoConfirm', () => {
    it('asks for pending rows whose deadline has passed, across every institution', async () => {
      const lte = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [] }) });
      vi.mocked(ClassSessionEntity.query.byDue).mockReturnValue({ lte } as never);

      await listSessionsDueForAutoConfirm('2026-08-11T00:00:00.000Z');

      expect(ClassSessionEntity.query.byDue).toHaveBeenCalledWith({ status: 'pending' });
      expect(lte).toHaveBeenCalledWith({ autoConfirmAt: '2026-08-11T00:00:00.000Z' });
    });
  });
});
