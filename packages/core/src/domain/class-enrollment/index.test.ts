import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ClassEnrollmentEntity: {
    put: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    query: { primary: vi.fn(), byLearner: vi.fn() },
  },
}));

vi.mock('./ledger', () => ({ ClassLedgerService: {} }));

import {
  cascadeLearnerNameUpdate,
  cascadeProgramTitleUpdate,
  creditBalanceLabel,
  enrollLearner,
  isLowBalance,
  listLearnerEnrollments,
  listProgramEnrollments,
  rejectedIndices,
} from '.';
import { ClassEnrollmentEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

function patchChain() {
  const go = vi.fn().mockResolvedValue({ data: {} });
  const chain: Record<string, unknown> = { go };
  chain.set = vi.fn().mockReturnValue(chain);
  chain.remove = vi.fn().mockReturnValue(chain);
  return chain;
}

const ENROLLMENT = {
  programId: 'prog1',
  learnerId: 'learn1',
  institutionId: 'inst1',
  learnerName: 'Priya R',
  programType: 'regular' as const,
};

describe('class-enrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enrollLearner', () => {
    it('puts, so a re-enroll writes a clean row rather than merging', async () => {
      vi.mocked(ClassEnrollmentEntity.put).mockReturnValue(goResolves(ENROLLMENT) as never);

      await enrollLearner(ENROLLMENT);

      expect(ClassEnrollmentEntity.put).toHaveBeenCalledWith(ENROLLMENT);
    });

    /**
     * Non-negotiable 5: `creditsRemaining` is a denormalized sum of immutable pack rows and is
     * never assigned. Enrolling must not carry a balance in — it would be a credit with no row
     * in the ledger to explain it.
     */
    it('does not let a caller set a balance', async () => {
      vi.mocked(ClassEnrollmentEntity.put).mockReturnValue(goResolves(ENROLLMENT) as never);

      await enrollLearner(ENROLLMENT);

      const written = vi.mocked(ClassEnrollmentEntity.put).mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(written).not.toHaveProperty('creditsRemaining');
    });
  });

  describe('listProgramEnrollments', () => {
    it('sorts a roster by name', async () => {
      vi.mocked(ClassEnrollmentEntity.query.primary).mockReturnValue(
        goResolves([
          { ...ENROLLMENT, learnerName: 'Ravi S', status: 'active' },
          { ...ENROLLMENT, learnerName: 'Anika M', status: 'active' },
        ]) as never
      );

      const result = await listProgramEnrollments('prog1');

      expect(result.map(e => e.learnerName)).toEqual(['Anika M', 'Ravi S']);
    });

    it('drops ended enrollments when asked', async () => {
      vi.mocked(ClassEnrollmentEntity.query.primary).mockReturnValue(
        goResolves([
          { ...ENROLLMENT, learnerName: 'A', status: 'active' },
          { ...ENROLLMENT, learnerName: 'B', status: 'ended' },
        ]) as never
      );

      const result = await listProgramEnrollments('prog1', { activeOnly: true });

      expect(result.map(e => e.learnerName)).toEqual(['A']);
    });
  });

  /**
   * A program the guru archived still holds that learner's session notes, and hiding it would
   * delete the record from the only person it belongs to. So this reads the GSI and filters
   * nothing.
   */
  describe('listLearnerEnrollments', () => {
    it('returns archived and ended programs too', async () => {
      vi.mocked(ClassEnrollmentEntity.query.byLearner).mockReturnValue(
        goResolves([
          { ...ENROLLMENT, status: 'active' },
          { ...ENROLLMENT, programId: 'old', status: 'ended' },
        ]) as never
      );

      const result = await listLearnerEnrollments('learn1');

      expect(result).toHaveLength(2);
      expect(ClassEnrollmentEntity.query.byLearner).toHaveBeenCalledWith({ learnerId: 'learn1' });
    });
  });

  describe('cascades', () => {
    it('mirrors a program rename onto every roster row', async () => {
      vi.mocked(ClassEnrollmentEntity.query.primary).mockReturnValue(
        goResolves([
          { ...ENROLLMENT, learnerId: 'a' },
          { ...ENROLLMENT, learnerId: 'b' },
        ]) as never
      );
      const chain = patchChain();
      vi.mocked(ClassEnrollmentEntity.patch).mockReturnValue(chain as never);

      const count = await cascadeProgramTitleUpdate('prog1', 'Tyagaraja intensive');

      expect(count).toBe(2);
      expect(chain.set).toHaveBeenCalledWith({ programTitle: 'Tyagaraja intensive' });
    });

    /**
     * CLAUDE.md rule 8. `.set({ programTitle: undefined })` drops out of the UpdateExpression
     * entirely, so clearing a workshop's title back to a plain weekly class would leave the old
     * title on every roster row while the code read as though it cleared it.
     */
    it('removes a cleared title rather than setting it to undefined', async () => {
      vi.mocked(ClassEnrollmentEntity.query.primary).mockReturnValue(
        goResolves([ENROLLMENT]) as never
      );
      const chain = patchChain();
      vi.mocked(ClassEnrollmentEntity.patch).mockReturnValue(chain as never);

      await cascadeProgramTitleUpdate('prog1', undefined);

      expect(chain.remove).toHaveBeenCalledWith(['programTitle']);
      expect(chain.set).not.toHaveBeenCalled();
    });

    it('mirrors a learner rename onto every program they are on', async () => {
      vi.mocked(ClassEnrollmentEntity.query.byLearner).mockReturnValue(
        goResolves([
          { ...ENROLLMENT, programId: 'p1' },
          { ...ENROLLMENT, programId: 'p2' },
        ]) as never
      );
      const chain = patchChain();
      vi.mocked(ClassEnrollmentEntity.patch).mockReturnValue(chain as never);

      const count = await cascadeLearnerNameUpdate('learn1', 'Priya Raman');

      expect(count).toBe(2);
      expect(ClassEnrollmentEntity.patch).toHaveBeenCalledWith({
        programId: 'p1',
        learnerId: 'learn1',
      });
      expect(chain.set).toHaveBeenCalledWith({ learnerName: 'Priya Raman' });
    });
  });
});

/**
 * A negative number where people look for money reads as a debt owed, and it is not one — it is
 * a workshop that ran long, which is normal and which the guru sorts out in conversation.
 */
describe('creditBalanceLabel', () => {
  it('reads an overrun as classes over, not as a negative', () => {
    expect(creditBalanceLabel(-3)).toBe('3 classes over');
    expect(creditBalanceLabel(-1)).toBe('1 class over');
  });

  it('reads a balance plainly', () => {
    expect(creditBalanceLabel(7)).toBe('7 classes left');
    expect(creditBalanceLabel(1)).toBe('1 class left');
    expect(creditBalanceLabel(0)).toBe('No classes left');
  });
});

describe('isLowBalance', () => {
  it('flags the last class and anything past it', () => {
    expect(isLowBalance(2)).toBe(false);
    expect(isLowBalance(1)).toBe(true);
    expect(isLowBalance(0)).toBe(true);
    expect(isLowBalance(-3)).toBe(true);
  });
});

describe('rejectedIndices', () => {
  it('reports which guard tripped, since both raise the same code', () => {
    expect(
      rejectedIndices([{ rejected: false }, { rejected: true, code: 'ConditionalCheckFailed' }])
    ).toEqual([1]);
    expect(rejectedIndices([{ code: 'ConditionalCheckFailed' }, { rejected: false }])).toEqual([0]);
  });

  it('is empty for a transaction that committed', () => {
    expect(rejectedIndices([{ rejected: false }, { rejected: false }])).toEqual([]);
    expect(rejectedIndices(undefined)).toEqual([]);
  });
});
