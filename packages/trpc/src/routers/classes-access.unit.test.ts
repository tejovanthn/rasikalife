import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A unit test in a package whose `test/setup.ts` is written for integration tests against real
 * DynamoDB. That setup reaches into `@rasika/core` for `rateLimiter` and `scan`, so mocking the
 * module wholesale has to keep those alive — otherwise the suite fails in `beforeEach` and every
 * assertion below is never reached.
 *
 * `scan` returns nothing, so the setup's cleanup pass finds no test rows and touches no table:
 * this file talks to no infrastructure and needs no `sst shell`.
 */
vi.mock('@rasika/core', () => ({
  rateLimiter: { clear: vi.fn() },
  scan: vi.fn().mockResolvedValue([]),
  deleteItem: vi.fn(),
  ClassProgram: { getClassProgram: vi.fn() },
  ClassLearner: { getClassLearner: vi.fn() },
  ClassInstitution: {
    getClassInstitution: vi.fn(),
    // The real predicate, not a stub: it is half of what is under test.
    isInstitutionTeacher: (
      institution: { ownerUserId: string; teacherIds?: string[] },
      userId: string
    ) =>
      Boolean(userId) &&
      (institution.ownerUserId === userId || (institution.teacherIds ?? []).includes(userId)),
  },
  ClassLearnerAccess: { hasLearnerAccess: vi.fn() },
  ClassEnrollment: { getEnrollment: vi.fn() },
}));

import {
  ClassEnrollment,
  ClassInstitution,
  ClassLearner,
  ClassLearnerAccess,
  ClassProgram,
} from '@rasika/core';
import { assertClassAccess, assertEnrollmentAccess, assertTeacher } from './classes-access';

const TEACHER = { user: { id: 'guru' } };
const PARENT = { user: { id: 'parent' } };
const STRANGER = { user: { id: 'stranger' } };

const institution = { id: 'inst1', ownerUserId: 'guru', teacherIds: ['guru'] };

describe('assertClassAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ClassInstitution.getClassInstitution).mockResolvedValue(institution as never);
    vi.mocked(ClassProgram.getClassProgram).mockResolvedValue({
      id: 'prog1',
      institutionId: 'inst1',
    } as never);
    vi.mocked(ClassLearner.getClassLearner).mockResolvedValue({
      id: 'learn1',
      institutionId: 'inst1',
    } as never);
    vi.mocked(ClassLearnerAccess.hasLearnerAccess).mockResolvedValue(false);
  });

  it('lets a teacher in on any handle', async () => {
    await expect(assertClassAccess(TEACHER, { institutionId: 'inst1' })).resolves.toEqual({
      kind: 'teacher',
      userId: 'guru',
      institutionId: 'inst1',
    });
    await expect(assertClassAccess(TEACHER, { programId: 'prog1' })).resolves.toMatchObject({
      kind: 'teacher',
    });
    await expect(assertClassAccess(TEACHER, { learnerId: 'learn1' })).resolves.toMatchObject({
      kind: 'teacher',
    });
  });

  it('lets a guardian in on their own learner', async () => {
    vi.mocked(ClassLearnerAccess.hasLearnerAccess).mockResolvedValue(true);

    await expect(assertClassAccess(PARENT, { learnerId: 'learn1' })).resolves.toEqual({
      kind: 'learner',
      userId: 'parent',
      institutionId: 'inst1',
      learnerId: 'learn1',
    });
  });

  /**
   * A program is a roster. "This user can see *some* learner on this program" would let one
   * family read another's session notes, so a learner-scoped call has to name the learner and
   * the check runs against that row.
   */
  it('never admits a learner viewer on a programId alone', async () => {
    vi.mocked(ClassLearnerAccess.hasLearnerAccess).mockResolvedValue(true);

    await expect(assertClassAccess(PARENT, { programId: 'prog1' })).rejects.toThrow();
  });

  it('refuses everyone else', async () => {
    await expect(assertClassAccess(STRANGER, { learnerId: 'learn1' })).rejects.toThrow();
    await expect(assertClassAccess(STRANGER, { institutionId: 'inst1' })).rejects.toThrow();
  });

  /**
   * The pair is exactly what an attacker would mismatch: send a `programId` they cannot touch
   * alongside an `institutionId` they own, and have the teacher check pass while the write lands
   * somewhere else. The institution is therefore resolved from the specific handle, and a
   * supplied one that disagrees is refused rather than ignored.
   */
  it('refuses a programId and institutionId that disagree', async () => {
    vi.mocked(ClassProgram.getClassProgram).mockResolvedValue({
      id: 'prog1',
      institutionId: 'someone-else',
    } as never);

    await expect(
      assertClassAccess(TEACHER, { programId: 'prog1', institutionId: 'inst1' })
    ).rejects.toThrow();
  });

  it('refuses a learnerId and institutionId that disagree', async () => {
    vi.mocked(ClassLearner.getClassLearner).mockResolvedValue({
      id: 'learn1',
      institutionId: 'someone-else',
    } as never);

    await expect(
      assertClassAccess(TEACHER, { learnerId: 'learn1', institutionId: 'inst1' })
    ).rejects.toThrow();
  });

  it('refuses an empty target rather than resolving to anything', async () => {
    await expect(assertClassAccess(TEACHER, {})).rejects.toThrow();
  });

  it('resolves the institution from the program, not from the caller', async () => {
    await assertClassAccess(TEACHER, { programId: 'prog1' });

    expect(ClassProgram.getClassProgram).toHaveBeenCalledWith('prog1');
    expect(ClassInstitution.getClassInstitution).toHaveBeenCalledWith('inst1');
  });
});

describe('assertTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ClassInstitution.getClassInstitution).mockResolvedValue(institution as never);
    vi.mocked(ClassLearner.getClassLearner).mockResolvedValue({
      id: 'learn1',
      institutionId: 'inst1',
    } as never);
  });

  it('narrows to a teacher', async () => {
    await expect(assertTeacher(TEACHER, { institutionId: 'inst1' })).resolves.toMatchObject({
      kind: 'teacher',
    });
  });

  // A guardian may read their own learner and mark a class. Granting a pack, confirming a
  // session or adding a student are not theirs, and this is the line.
  it('refuses a guardian who does have learner access', async () => {
    vi.mocked(ClassLearnerAccess.hasLearnerAccess).mockResolvedValue(true);

    await expect(assertTeacher(PARENT, { learnerId: 'learn1' })).rejects.toThrow();
  });
});

describe('assertEnrollmentAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ClassInstitution.getClassInstitution).mockResolvedValue(institution as never);
    vi.mocked(ClassProgram.getClassProgram).mockResolvedValue({
      id: 'prog1',
      institutionId: 'inst1',
    } as never);
    vi.mocked(ClassLearner.getClassLearner).mockResolvedValue({
      id: 'learn1',
      institutionId: 'inst1',
    } as never);
    vi.mocked(ClassLearnerAccess.hasLearnerAccess).mockResolvedValue(true);
  });

  it('returns the enrollment once access holds', async () => {
    vi.mocked(ClassEnrollment.getEnrollment).mockResolvedValue({
      programId: 'prog1',
      learnerId: 'learn1',
      institutionId: 'inst1',
    } as never);

    const { actor, enrollment } = await assertEnrollmentAccess(PARENT, {
      programId: 'prog1',
      learnerId: 'learn1',
    });

    expect(actor.kind).toBe('learner');
    expect(enrollment.programId).toBe('prog1');
  });

  /**
   * A caller could otherwise pair a learner they can see with a program they cannot and read a
   * balance across the boundary. Both sides were cleared separately, so the enrollment itself
   * has to agree it is inside the institution.
   */
  it('refuses an enrollment from another institution', async () => {
    vi.mocked(ClassEnrollment.getEnrollment).mockResolvedValue({
      programId: 'prog1',
      learnerId: 'learn1',
      institutionId: 'somewhere-else',
    } as never);

    await expect(
      assertEnrollmentAccess(PARENT, { programId: 'prog1', learnerId: 'learn1' })
    ).rejects.toThrow();
  });

  it('is NOT_FOUND when the learner is not on that program', async () => {
    vi.mocked(ClassEnrollment.getEnrollment).mockResolvedValue(null as never);

    await expect(
      assertEnrollmentAccess(PARENT, { programId: 'prog1', learnerId: 'learn1' })
    ).rejects.toThrow();
  });
});
