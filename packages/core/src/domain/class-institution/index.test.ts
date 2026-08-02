import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ClassInstitutionEntity: {
    create: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    query: { byOwner: vi.fn() },
  },
}));

import {
  addInstitutionTeacher,
  createClassInstitution,
  ensureClassInstitution,
  isInstitutionTeacher,
} from '.';
import { ClassInstitutionEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

describe('class-institution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createClassInstitution', () => {
    /**
     * One list to read means one thing to get wrong. A substitute teacher added later is then
     * indistinguishable from the owner at the point of use, which is the whole reason credits
     * belong to an institution rather than to a guru.
     */
    it('seeds the owner into the teacher list', async () => {
      vi.mocked(ClassInstitutionEntity.create).mockReturnValue(goResolves({}) as never);

      await createClassInstitution({
        name: 'Smt Radha',
        ownerUserId: 'user9',
        timezone: 'Asia/Kolkata',
      });

      expect(ClassInstitutionEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerUserId: 'user9', teacherIds: ['user9'] })
      );
    });
  });

  /**
   * Onboarding a guru is "add your first student", not "set up your organisation". The MVP UI
   * never says the word, so nothing may block on it existing.
   */
  describe('ensureClassInstitution', () => {
    it('creates one on first use', async () => {
      vi.mocked(ClassInstitutionEntity.query.byOwner).mockReturnValue(goResolves([]) as never);
      vi.mocked(ClassInstitutionEntity.create).mockReturnValue(goResolves({ id: 'new' }) as never);

      const result = await ensureClassInstitution({ ownerUserId: 'user9', name: 'Smt Radha' });

      expect(result).toEqual({ id: 'new' });
    });

    it('returns the existing one rather than making a second', async () => {
      vi.mocked(ClassInstitutionEntity.query.byOwner).mockReturnValue(
        goResolves([{ id: 'existing' }]) as never
      );

      const result = await ensureClassInstitution({ ownerUserId: 'user9', name: 'Smt Radha' });

      expect(result).toEqual({ id: 'existing' });
      expect(ClassInstitutionEntity.create).not.toHaveBeenCalled();
    });

    it('defaults the zone when none is given', async () => {
      vi.mocked(ClassInstitutionEntity.query.byOwner).mockReturnValue(goResolves([]) as never);
      vi.mocked(ClassInstitutionEntity.create).mockReturnValue(goResolves({}) as never);

      await ensureClassInstitution({ ownerUserId: 'user9', name: 'Smt Radha' });

      expect(ClassInstitutionEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: 'Asia/Kolkata' })
      );
    });
  });

  describe('addInstitutionTeacher', () => {
    it('appends a teacher', async () => {
      vi.mocked(ClassInstitutionEntity.get).mockReturnValue(
        goResolves({ id: 'inst1', ownerUserId: 'user9', teacherIds: ['user9'] }) as never
      );
      const chain: Record<string, unknown> = { go: vi.fn().mockResolvedValue({ data: {} }) };
      chain.append = vi.fn().mockReturnValue(chain);
      vi.mocked(ClassInstitutionEntity.patch).mockReturnValue(chain as never);

      await addInstitutionTeacher('inst1', 'sub1');

      expect(chain.append).toHaveBeenCalledWith({ teacherIds: ['sub1'] });
    });

    it('does nothing when they are already a teacher', async () => {
      vi.mocked(ClassInstitutionEntity.get).mockReturnValue(
        goResolves({ id: 'inst1', ownerUserId: 'user9', teacherIds: ['user9', 'sub1'] }) as never
      );

      await addInstitutionTeacher('inst1', 'sub1');

      expect(ClassInstitutionEntity.patch).not.toHaveBeenCalled();
    });
  });
});

describe('isInstitutionTeacher', () => {
  const institution = { ownerUserId: 'user9', teacherIds: ['user9', 'sub1'] };

  it('is true for anyone on the list', () => {
    expect(isInstitutionTeacher(institution, 'user9')).toBe(true);
    expect(isInstitutionTeacher(institution, 'sub1')).toBe(true);
  });

  it('is false for anyone else', () => {
    expect(isInstitutionTeacher(institution, 'stranger')).toBe(false);
  });

  /**
   * A row written before the list was seeded, or one whose list a form rebuilt, must not lock
   * the owner out of their own institution.
   */
  it('is true for the owner even when the list has lost them', () => {
    expect(isInstitutionTeacher({ ownerUserId: 'user9', teacherIds: [] }, 'user9')).toBe(true);
    expect(isInstitutionTeacher({ ownerUserId: 'user9' }, 'user9')).toBe(true);
  });

  // A blank id must never read as "matches everything" — CLAUDE.md rule 9's failure mode,
  // applied to an in-memory check rather than an index.
  it('is false for a blank user id', () => {
    expect(isInstitutionTeacher({ ownerUserId: '', teacherIds: [] }, '')).toBe(false);
  });
});
