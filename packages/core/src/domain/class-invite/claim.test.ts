import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./index', () => ({
  listUnclaimedInvites: vi.fn(),
  markInviteClaimed: vi.fn(),
}));

vi.mock('../class-learner', () => ({
  createClassLearner: vi.fn(),
  getClassLearner: vi.fn(),
  learnerDisplayName: (l: { firstName: string }) => l.firstName,
}));

vi.mock('../class-learner-access', () => ({ grantLearnerAccess: vi.fn() }));
vi.mock('../class-enrollment', () => ({ enrollLearner: vi.fn() }));
vi.mock('../class-program', () => ({ getClassProgram: vi.fn() }));

import { enrollLearner } from '../class-enrollment';
import { createClassLearner, getClassLearner } from '../class-learner';
import { grantLearnerAccess } from '../class-learner-access';
import { getClassProgram } from '../class-program';
import { claimClassInvites } from './claim';
import { listUnclaimedInvites, markInviteClaimed } from './index';

const BASE = {
  id: 'inv1',
  normalizedEmail: 'priyaraman@gmail.com',
  rawEmail: 'Priya.Raman@gmail.com',
  institutionId: 'inst1',
  relation: 'guardian' as const,
  invitedBy: 'user9',
  createdAt: '2026-08-01T00:00:00.000Z',
};

describe('claimClassInvites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(markInviteClaimed).mockResolvedValue({ ...BASE } as never);
  });

  it('does nothing and writes nothing when there are no invites', async () => {
    vi.mocked(listUnclaimedInvites).mockResolvedValue([]);

    const result = await claimClassInvites({ userId: 'u1', email: 'priya@gmail.com' });

    expect(result).toEqual([]);
    expect(grantLearnerAccess).not.toHaveBeenCalled();
    expect(createClassLearner).not.toHaveBeenCalled();
  });

  /**
   * The path the guru's "add learner" flow uses. The learner and the enrollment already exist,
   * because money changes hands before the student ever opens the app.
   */
  it('grants access against an existing learner without creating one', async () => {
    vi.mocked(listUnclaimedInvites).mockResolvedValue([
      { ...BASE, learnerId: 'learn1', programId: 'prog1' },
    ] as never);
    vi.mocked(getClassLearner).mockResolvedValue({ id: 'learn1', firstName: 'Anika' } as never);

    const result = await claimClassInvites({ userId: 'u1', email: 'priya@gmail.com' });

    expect(grantLearnerAccess).toHaveBeenCalledWith({
      learnerId: 'learn1',
      userId: 'u1',
      relation: 'guardian',
    });
    expect(createClassLearner).not.toHaveBeenCalled();
    expect(enrollLearner).not.toHaveBeenCalled();
    expect(result).toEqual([
      { inviteId: 'inv1', learnerId: 'learn1', programId: 'prog1', createdLearner: false },
    ]);
  });

  it('creates the learner, the access row and the enrollment for a name invite', async () => {
    vi.mocked(listUnclaimedInvites).mockResolvedValue([
      { ...BASE, learnerName: 'Anika', programId: 'prog1' },
    ] as never);
    vi.mocked(createClassLearner).mockResolvedValue({ id: 'new1', firstName: 'Anika' } as never);
    vi.mocked(getClassProgram).mockResolvedValue({
      id: 'prog1',
      title: 'Weekly',
      type: 'regular',
    } as never);

    const result = await claimClassInvites({ userId: 'u1', email: 'priya@gmail.com' });

    expect(createClassLearner).toHaveBeenCalledWith(
      expect.objectContaining({ institutionId: 'inst1', firstName: 'Anika' })
    );
    expect(grantLearnerAccess).toHaveBeenCalledWith({
      learnerId: 'new1',
      userId: 'u1',
      relation: 'guardian',
    });
    expect(enrollLearner).toHaveBeenCalledWith(
      expect.objectContaining({ programId: 'prog1', learnerId: 'new1', programType: 'regular' })
    );
    expect(result[0]?.createdLearner).toBe(true);
  });

  it('skips the enrollment for an access-only invite', async () => {
    vi.mocked(listUnclaimedInvites).mockResolvedValue([{ ...BASE, learnerName: 'Anika' }] as never);
    vi.mocked(createClassLearner).mockResolvedValue({ id: 'new1', firstName: 'Anika' } as never);

    await claimClassInvites({ userId: 'u1', email: 'priya@gmail.com' });

    expect(grantLearnerAccess).toHaveBeenCalled();
    expect(enrollLearner).not.toHaveBeenCalled();
  });

  /**
   * Claim first, then work. The retry is not idempotent in the case that matters:
   * `createClassLearner` mints a KSUID, so a second pass would produce a second child with the
   * same name, a second enrollment and a second balance. An invite that achieved nothing is a
   * far better failure than a family's history split across two records.
   */
  it('claims the invite before doing any work', async () => {
    const order: string[] = [];
    vi.mocked(listUnclaimedInvites).mockResolvedValue([{ ...BASE, learnerName: 'Anika' }] as never);
    vi.mocked(markInviteClaimed).mockImplementation(async () => {
      order.push('claim');
      return { ...BASE } as never;
    });
    vi.mocked(createClassLearner).mockImplementation(async () => {
      order.push('create');
      return { id: 'new1', firstName: 'Anika' } as never;
    });

    await claimClassInvites({ userId: 'u1', email: 'priya@gmail.com' });

    expect(order).toEqual(['claim', 'create']);
  });

  /**
   * Two tabs signing in at once both read the same unclaimed invite. The conditional claim is
   * what stops both of them creating a learner.
   */
  it('does nothing when another tab claimed it first', async () => {
    vi.mocked(listUnclaimedInvites).mockResolvedValue([{ ...BASE, learnerName: 'Anika' }] as never);
    vi.mocked(markInviteClaimed).mockResolvedValue(null);

    const result = await claimClassInvites({ userId: 'u1', email: 'priya@gmail.com' });

    expect(result).toEqual([]);
    expect(createClassLearner).not.toHaveBeenCalled();
    expect(grantLearnerAccess).not.toHaveBeenCalled();
  });

  it('claims several invites in one sign-in', async () => {
    vi.mocked(listUnclaimedInvites).mockResolvedValue([
      { ...BASE, id: 'a', learnerId: 'learn1' },
      { ...BASE, id: 'b', learnerId: 'learn2' },
    ] as never);
    vi.mocked(getClassLearner).mockResolvedValue({ id: 'x', firstName: 'A' } as never);

    const result = await claimClassInvites({ userId: 'u1', email: 'priya@gmail.com' });

    // A parent with two children gets two rows, and the app shows a profile switcher.
    expect(result).toHaveLength(2);
    expect(grantLearnerAccess).toHaveBeenCalledTimes(2);
  });

  it('ignores an invite pointing at a learner that is gone', async () => {
    vi.mocked(listUnclaimedInvites).mockResolvedValue([{ ...BASE, learnerId: 'deleted' }] as never);
    vi.mocked(getClassLearner).mockResolvedValue(null);

    const result = await claimClassInvites({ userId: 'u1', email: 'priya@gmail.com' });

    expect(result).toEqual([]);
    expect(grantLearnerAccess).not.toHaveBeenCalled();
  });

  it('ignores a row carrying neither handle', async () => {
    vi.mocked(listUnclaimedInvites).mockResolvedValue([{ ...BASE }] as never);

    expect(await claimClassInvites({ userId: 'u1', email: 'priya@gmail.com' })).toEqual([]);
    expect(createClassLearner).not.toHaveBeenCalled();
  });
});
