import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ClassPackEntity: {
    create: vi.fn(),
    query: { primary: vi.fn() },
  },
}));

vi.mock('../class-enrollment/ledger', () => ({
  ClassLedgerService: { transaction: { write: vi.fn() } },
}));

import { GrantClassPackSchema, grantClassPack, listClassPacks, sumPackDeltas } from '.';
import { ClassLedgerService } from '../class-enrollment/ledger';
import { ClassPackEntity } from './entity';

const INPUT = {
  programId: 'prog1',
  learnerId: 'learn1',
  delta: 8,
  grantedBy: 'user9',
};

function transactionResolves(value: { canceled: boolean; data?: unknown }) {
  vi.mocked(ClassLedgerService.transaction.write).mockReturnValue({
    go: vi.fn().mockResolvedValue(value),
  } as never);
}

function transactionEntities() {
  const pack = { create: vi.fn().mockReturnValue({ commit: vi.fn() }) };
  const enrollmentChain: Record<string, unknown> = { commit: vi.fn() };
  enrollmentChain.add = vi.fn().mockReturnValue(enrollmentChain);
  enrollmentChain.set = vi.fn().mockReturnValue(enrollmentChain);
  const enrollment = { patch: vi.fn().mockReturnValue(enrollmentChain) };

  const build = vi.mocked(ClassLedgerService.transaction.write).mock.calls[0]?.[0] as (
    entities: unknown
  ) => unknown;
  build?.({ classPack: pack, classEnrollment: enrollment });
  return { pack, enrollment, enrollmentChain };
}

describe('class-pack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('grantClassPack', () => {
    /**
     * The row and the running total have to land together. As two calls, a crash between them
     * leaves a balance that disagrees with the ledger it summarises — and since nothing else
     * ever writes `creditsRemaining`, nothing would put it right again.
     */
    it('writes the row and the balance in one transaction', async () => {
      transactionResolves({ canceled: false, data: [] });

      const outcome = await grantClassPack(INPUT);

      expect(outcome.applied).toBe(true);
      const { pack, enrollment, enrollmentChain } = transactionEntities();
      expect(pack.create).toHaveBeenCalledWith(expect.objectContaining({ delta: 8 }));
      expect(enrollment.patch).toHaveBeenCalledWith({
        programId: 'prog1',
        learnerId: 'learn1',
      });
      expect(enrollmentChain.add).toHaveBeenCalledWith({ creditsRemaining: 8 });
    });

    /**
     * `add`, not `set`. An atomic ADD is what makes two gurus granting packs at the same moment
     * produce both packs rather than one, and non-negotiable 5 forbids assigning the number at
     * all — it is a denormalized sum, not a field.
     *
     * The chain does call `.set` now, for the display-only `lastPaidAt`, so the assertion is
     * about the *attribute* rather than the method: nothing may ever assign `creditsRemaining`.
     */
    it('never assigns the balance, only adds to it', async () => {
      transactionResolves({ canceled: false, data: [] });

      await grantClassPack(INPUT);

      const { enrollmentChain } = transactionEntities();
      expect(enrollmentChain.add).toHaveBeenCalledWith({ creditsRemaining: 8 });
      for (const call of vi.mocked(enrollmentChain.set as never).mock.calls) {
        expect(call[0]).not.toHaveProperty('creditsRemaining');
      }
    });

    // A correction is not a payment, so it must not move the roster's "Last paid" column.
    it('stamps lastPaidAt for a payment and not for a correction', async () => {
      transactionResolves({ canceled: false, data: [] });
      await grantClassPack(INPUT);
      expect(transactionEntities().enrollmentChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ lastPaidAt: expect.any(String) })
      );

      vi.clearAllMocks();
      transactionResolves({ canceled: false, data: [] });
      await grantClassPack({ ...INPUT, delta: -2, reason: 'Counted twice' });
      expect(transactionEntities().enrollmentChain.set).toHaveBeenCalledWith({});
    });

    it('carries a negative delta through as a correction', async () => {
      transactionResolves({ canceled: false, data: [] });

      const outcome = await grantClassPack({ ...INPUT, delta: -2, reason: 'Counted twice' });

      const { enrollmentChain } = transactionEntities();
      expect(enrollmentChain.add).toHaveBeenCalledWith({ creditsRemaining: -2 });
      expect(outcome.applied && outcome.result.reason).toBe('Counted twice');
    });

    /**
     * `patch` carries an `attribute_exists` condition where `update` would upsert. Without it,
     * granting a pack to a learner who is not enrolled conjures an enrollment row with a
     * balance and no roster entry — a phantom the guru can never see or correct.
     */
    it('refuses rather than conjuring an enrollment that does not exist', async () => {
      transactionResolves({
        canceled: true,
        data: [{ rejected: false }, { rejected: true, code: 'ConditionalCheckFailed' }],
      });

      const outcome = await grantClassPack(INPUT);

      expect(outcome).toEqual({ applied: false, reason: 'no-enrollment' });
    });

    it('returns the row it wrote, with an id and a timestamp', async () => {
      transactionResolves({ canceled: false, data: [] });

      const outcome = await grantClassPack(INPUT);

      expect(outcome.applied).toBe(true);
      if (outcome.applied) {
        expect(outcome.result.id).toBeTruthy();
        expect(outcome.result.createdAt).toBeTruthy();
        expect(outcome.result.grantedBy).toBe('user9');
      }
    });
  });

  describe('listClassPacks', () => {
    it('reads the learner ledger partition', async () => {
      vi.mocked(ClassPackEntity.query.primary).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: [{ id: 'p1' }] }),
      } as never);

      const result = await listClassPacks('prog1', 'learn1');

      expect(ClassPackEntity.query.primary).toHaveBeenCalledWith({
        programId: 'prog1',
        learnerId: 'learn1',
      });
      expect(result).toHaveLength(1);
    });

    it('returns an empty array when there is no data', async () => {
      vi.mocked(ClassPackEntity.query.primary).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: undefined }),
      } as never);

      expect(await listClassPacks('prog1', 'learn1')).toEqual([]);
    });
  });

  describe('sumPackDeltas', () => {
    it('sums signed rows', () => {
      expect(sumPackDeltas([{ delta: 8 }, { delta: 4 }, { delta: -2 }])).toBe(10);
    });

    it('is zero for no rows', () => {
      expect(sumPackDeltas([])).toBe(0);
    });
  });

  describe('GrantClassPackSchema', () => {
    it('accepts a plain grant with no reason', () => {
      expect(() => GrantClassPackSchema.parse(INPUT)).not.toThrow();
    });

    /**
     * Taking credits away is the one movement a learner will dispute, so it may not be
     * anonymous. A positive grant needs no justification — the screenshot is the justification.
     */
    it('demands a reason before removing credits', () => {
      expect(() => GrantClassPackSchema.parse({ ...INPUT, delta: -2 })).toThrow();
      expect(() => GrantClassPackSchema.parse({ ...INPUT, delta: -2, reason: '   ' })).toThrow();
      expect(() =>
        GrantClassPackSchema.parse({ ...INPUT, delta: -2, reason: 'Counted twice' })
      ).not.toThrow();
    });

    it('rejects a zero delta, which would record an event that did not happen', () => {
      expect(() => GrantClassPackSchema.parse({ ...INPUT, delta: 0 })).toThrow();
    });

    it('rejects a fractional pack', () => {
      expect(() => GrantClassPackSchema.parse({ ...INPUT, delta: 2.5 })).toThrow();
    });

    // A private S3 key, never a URL. Payment screenshots are people's UPI transaction records
    // and must not go near the public image pipeline.
    it('takes a screenshot key', () => {
      expect(() =>
        GrantClassPackSchema.parse({ ...INPUT, screenshotKey: 'private/classes/abc/shot.png' })
      ).not.toThrow();
    });
  });
});
