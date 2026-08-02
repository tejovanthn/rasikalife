import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ClassTeacherEntity: {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    query: { primary: vi.fn(), byUser: vi.fn() },
  },
}));

import { addClassTeacher, cascadeInstitutionNameUpdate, isClassTeacher, listUserTeaching } from '.';
import { ClassTeacherEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

describe('class-teacher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // put, not upsert: the row is the pair's complete state, and CLAUDE.md rule 8 means an upsert
  // would leave a corrected role showing the old value.
  it('puts the row', async () => {
    vi.mocked(ClassTeacherEntity.put).mockReturnValue(goResolves({}) as never);

    await addClassTeacher({
      institutionId: 'inst1',
      userId: 'guru',
      institutionName: 'Smt Radha',
      role: 'owner',
    });

    expect(ClassTeacherEntity.put).toHaveBeenCalledWith({
      institutionId: 'inst1',
      userId: 'guru',
      institutionName: 'Smt Radha',
      role: 'owner',
    });
  });

  /**
   * The lookup this entity exists for. A list attribute on the institution could not answer it,
   * which is why `teacherIds` is gone — a co-teacher owns nothing, so resolving on ownership
   * alone sent them to the "do you teach?" screen for ever.
   */
  it('lists every institution a user teaches at, owned or not', async () => {
    vi.mocked(ClassTeacherEntity.query.byUser).mockReturnValue(
      goResolves([
        { institutionId: 'inst1', role: 'owner', institutionName: 'Mine' },
        { institutionId: 'inst2', role: 'teacher', institutionName: 'Theirs' },
      ]) as never
    );

    const result = await listUserTeaching('guru');

    expect(ClassTeacherEntity.query.byUser).toHaveBeenCalledWith({ userId: 'guru' });
    expect(result.map(r => r.institutionId)).toEqual(['inst1', 'inst2']);
  });

  it('is empty for a blank user without asking the database', async () => {
    expect(await listUserTeaching('')).toEqual([]);
    expect(ClassTeacherEntity.query.byUser).not.toHaveBeenCalled();
  });

  describe('isClassTeacher', () => {
    it('is true when a row exists', async () => {
      vi.mocked(ClassTeacherEntity.get).mockReturnValue(goResolves({ userId: 'guru' }) as never);
      expect(await isClassTeacher('inst1', 'guru')).toBe(true);
    });

    it('is false when it does not', async () => {
      vi.mocked(ClassTeacherEntity.get).mockReturnValue(goResolves(null) as never);
      expect(await isClassTeacher('inst1', 'stranger')).toBe(false);
    });

    // A blank argument must never read as "matches everything" on an authorisation lookup —
    // CLAUDE.md rule 9's failure mode, and this is the check that gates every teaching write.
    it('refuses a blank id without asking the database', async () => {
      expect(await isClassTeacher('', 'guru')).toBe(false);
      expect(await isClassTeacher('inst1', '')).toBe(false);
      expect(ClassTeacherEntity.get).not.toHaveBeenCalled();
    });
  });

  /**
   * The obligation that denormalizing `institutionName` bought. Without it a renamed institution
   * keeps its old name in every teacher's context switcher.
   */
  it('mirrors a rename onto every teacher row', async () => {
    vi.mocked(ClassTeacherEntity.query.primary).mockReturnValue(
      goResolves([{ userId: 'guru' }, { userId: 'sub1' }]) as never
    );
    const chain: Record<string, unknown> = { go: vi.fn().mockResolvedValue({ data: {} }) };
    chain.set = vi.fn().mockReturnValue(chain);
    vi.mocked(ClassTeacherEntity.patch).mockReturnValue(chain as never);

    const count = await cascadeInstitutionNameUpdate('inst1', 'Radha Vidyalaya');

    expect(count).toBe(2);
    expect(chain.set).toHaveBeenCalledWith({ institutionName: 'Radha Vidyalaya' });
  });
});
