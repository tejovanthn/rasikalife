import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ClassLearnerAccessEntity: {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    query: { primary: vi.fn(), byUser: vi.fn() },
  },
}));

vi.mock('../class-learner', () => ({
  getClassLearner: vi.fn(),
}));

import {
  checkRevokeLearnerAccess,
  grantLearnerAccess,
  hasLearnerAccess,
  listUserLearnerAccess,
  revokeLearnerAccess,
} from '.';
import { getClassLearner } from '../class-learner';
import { ClassLearnerAccessEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

const GUARDIAN = { userId: 'parent', relation: 'guardian' as const };
const CHILD = { userId: 'teen', relation: 'self' as const };

describe('checkRevokeLearnerAccess', () => {
  const base = {
    targetUserId: 'parent',
    actorUserId: 'teacher',
    actorIsTeacher: true,
    isMinor: false,
  };

  /**
   * A learner nobody can see is a learner whose session notes are gone and whose balance
   * nobody can question. The guru can still delete the learner outright; they cannot orphan it.
   */
  it('refuses to remove the only account with access', () => {
    expect(checkRevokeLearnerAccess({ ...base, rows: [GUARDIAN] })).toEqual({
      allowed: false,
      refusal: 'lastAccess',
    });
  });

  it('refuses to remove an account that does not have access', () => {
    expect(
      checkRevokeLearnerAccess({ ...base, rows: [GUARDIAN, CHILD], targetUserId: 'stranger' })
    ).toEqual({ allowed: false, refusal: 'notFound' });
  });

  /**
   * The asymmetry that matters. Without it a fifteen year old removes the parent who is paying
   * for the classes, and the guru ends up refereeing a family argument through a support
   * request.
   */
  it('will not let a student remove their own guardian', () => {
    expect(
      checkRevokeLearnerAccess({
        rows: [GUARDIAN, CHILD],
        targetUserId: 'parent',
        actorUserId: 'teen',
        actorIsTeacher: false,
        isMinor: false,
      })
    ).toEqual({ allowed: false, refusal: 'selfCannotRemoveGuardian' });
  });

  it('lets a guardian remove a self row, which is the other direction', () => {
    expect(
      checkRevokeLearnerAccess({
        rows: [GUARDIAN, CHILD],
        targetUserId: 'teen',
        actorUserId: 'parent',
        actorIsTeacher: false,
        isMinor: false,
      })
    ).toEqual({ allowed: true });
  });

  // The teacher is the one who cleans up after a wrong email address.
  it('exempts a teacher from that rule', () => {
    expect(
      checkRevokeLearnerAccess({
        rows: [GUARDIAN, CHILD],
        targetUserId: 'parent',
        actorUserId: 'teacher',
        actorIsTeacher: true,
        isMinor: false,
      })
    ).toEqual({ allowed: true });
  });

  it('keeps the last guardian while the learner is a minor', () => {
    expect(checkRevokeLearnerAccess({ ...base, rows: [GUARDIAN, CHILD], isMinor: true })).toEqual({
      allowed: false,
      refusal: 'lastGuardianOfMinor',
    });
  });

  it('allows removing one of two guardians of a minor', () => {
    expect(
      checkRevokeLearnerAccess({
        ...base,
        rows: [GUARDIAN, { userId: 'parent2', relation: 'guardian' }, CHILD],
        isMinor: true,
      })
    ).toEqual({ allowed: true });
  });

  /**
   * The young adult standing alone. Both rows coexist until the guru clears `isMinor`, at
   * which point the block lifts — nothing is migrated and nothing is duplicated.
   */
  it('lifts the block once the learner is no longer a minor', () => {
    expect(checkRevokeLearnerAccess({ ...base, rows: [GUARDIAN, CHILD], isMinor: false })).toEqual({
      allowed: true,
    });
  });

  it('does not treat removing a self row as a guardian question', () => {
    expect(
      checkRevokeLearnerAccess({
        ...base,
        rows: [GUARDIAN, CHILD],
        targetUserId: 'teen',
        isMinor: true,
      })
    ).toEqual({ allowed: true });
  });
});

describe('revokeLearnerAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the row when the rules allow it', async () => {
    vi.mocked(getClassLearner).mockResolvedValue({ isMinor: false } as never);
    vi.mocked(ClassLearnerAccessEntity.query.primary).mockReturnValue(
      goResolves([GUARDIAN, CHILD]) as never
    );
    vi.mocked(ClassLearnerAccessEntity.delete).mockReturnValue(goResolves(undefined) as never);

    const result = await revokeLearnerAccess({
      learnerId: 'learn1',
      targetUserId: 'teen',
      actorUserId: 'parent',
      actorIsTeacher: false,
    });

    expect(result).toEqual({ allowed: true });
    expect(ClassLearnerAccessEntity.delete).toHaveBeenCalledWith({
      learnerId: 'learn1',
      userId: 'teen',
    });
  });

  it('writes nothing when the rules refuse, and says why', async () => {
    vi.mocked(getClassLearner).mockResolvedValue({ isMinor: true } as never);
    vi.mocked(ClassLearnerAccessEntity.query.primary).mockReturnValue(
      goResolves([GUARDIAN, CHILD]) as never
    );

    const result = await revokeLearnerAccess({
      learnerId: 'learn1',
      targetUserId: 'parent',
      actorUserId: 'teacher',
      actorIsTeacher: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.message).toBe('A learner under 18 must keep at least one guardian');
    expect(ClassLearnerAccessEntity.delete).not.toHaveBeenCalled();
  });

  /**
   * Guessing wrong in this direction costs a retry. Guessing the other way drops a parent off
   * a child's account.
   */
  it('treats a learner it could not read as a minor', async () => {
    vi.mocked(getClassLearner).mockResolvedValue(null as never);
    vi.mocked(ClassLearnerAccessEntity.query.primary).mockReturnValue(
      goResolves([GUARDIAN, CHILD]) as never
    );

    const result = await revokeLearnerAccess({
      learnerId: 'learn1',
      targetUserId: 'parent',
      actorUserId: 'teacher',
      actorIsTeacher: true,
    });

    expect(result.allowed).toBe(false);
    expect(ClassLearnerAccessEntity.delete).not.toHaveBeenCalled();
  });
});

describe('grantLearnerAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // put, not upsert: the row is the pair's complete state, and CLAUDE.md rule 8 means an
  // upsert would leave a corrected relation showing the old value.
  it('puts the row', async () => {
    vi.mocked(ClassLearnerAccessEntity.put).mockReturnValue(goResolves(GUARDIAN) as never);

    await grantLearnerAccess({ learnerId: 'learn1', userId: 'parent', relation: 'guardian' });

    expect(ClassLearnerAccessEntity.put).toHaveBeenCalledWith({
      learnerId: 'learn1',
      userId: 'parent',
      relation: 'guardian',
    });
  });
});

describe('hasLearnerAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is true when a row exists', async () => {
    vi.mocked(ClassLearnerAccessEntity.get).mockReturnValue(goResolves(GUARDIAN) as never);
    expect(await hasLearnerAccess('learn1', 'parent')).toBe(true);
  });

  it('is false when it does not', async () => {
    vi.mocked(ClassLearnerAccessEntity.get).mockReturnValue(goResolves(null) as never);
    expect(await hasLearnerAccess('learn1', 'stranger')).toBe(false);
  });

  // A blank argument must never read as "matches everything" — see CLAUDE.md rule 9 for what
  // that costs on an authorisation lookup.
  it('is false for a blank id without asking the database', async () => {
    expect(await hasLearnerAccess('learn1', '')).toBe(false);
    expect(await hasLearnerAccess('', 'parent')).toBe(false);
    expect(ClassLearnerAccessEntity.get).not.toHaveBeenCalled();
  });
});

describe('listUserLearnerAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves one sign-in to every learner it can see', async () => {
    vi.mocked(ClassLearnerAccessEntity.query.byUser).mockReturnValue(
      goResolves([{ learnerId: 'a' }, { learnerId: 'b' }]) as never
    );

    const result = await listUserLearnerAccess('parent');

    expect(ClassLearnerAccessEntity.query.byUser).toHaveBeenCalledWith({ userId: 'parent' });
    expect(result).toHaveLength(2);
  });
});
