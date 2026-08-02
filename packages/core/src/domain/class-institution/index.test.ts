import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ClassInstitutionEntity: {
    create: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    query: { byOwner: vi.fn() },
  },
}));

vi.mock('../class-teacher', () => ({
  addClassTeacher: vi.fn(),
  isClassTeacher: vi.fn(),
  removeClassTeacher: vi.fn(),
  cascadeInstitutionNameUpdate: vi.fn(),
}));

import {
  addInstitutionTeacher,
  createClassInstitution,
  ensureClassInstitution,
  removeInstitutionTeacher,
} from '.';
import { addClassTeacher, isClassTeacher } from '../class-teacher';
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
     * The institution and the owner's teacher row are one act. Without the second, the
     * institution belongs to nobody: `assertClassAccess` reads the junction and so does the
     * context resolver, so its owner would be locked out of their own ledger.
     */
    it('writes the owner a teacher row', async () => {
      vi.mocked(ClassInstitutionEntity.create).mockReturnValue(
        goResolves({ id: 'inst1', name: 'Smt Radha' }) as never
      );

      await createClassInstitution({
        name: 'Smt Radha',
        ownerUserId: 'user9',
        timezone: 'Asia/Kolkata',
      });

      expect(addClassTeacher).toHaveBeenCalledWith({
        institutionId: 'inst1',
        userId: 'user9',
        institutionName: 'Smt Radha',
        role: 'owner',
      });
    });

    // Institution first. The reverse order would leave a teacher row pointing at nothing, which
    // is a phantom entry in the context switcher that navigates to a 404.
    it('creates the institution before the teacher row', async () => {
      const order: string[] = [];
      vi.mocked(ClassInstitutionEntity.create).mockReturnValue({
        go: vi.fn().mockImplementation(async () => {
          order.push('institution');
          return { data: { id: 'inst1', name: 'Smt Radha' } };
        }),
      } as never);
      vi.mocked(addClassTeacher).mockImplementation(async () => {
        order.push('teacher');
        return {} as never;
      });

      await createClassInstitution({
        name: 'Smt Radha',
        ownerUserId: 'user9',
        timezone: 'Asia/Kolkata',
      });

      expect(order).toEqual(['institution', 'teacher']);
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
    it('writes a junction row carrying the institution name', async () => {
      vi.mocked(ClassInstitutionEntity.get).mockReturnValue(
        goResolves({ id: 'inst1', ownerUserId: 'user9', name: 'Smt Radha' }) as never
      );
      vi.mocked(isClassTeacher).mockResolvedValue(false);

      await addInstitutionTeacher('inst1', 'sub1');

      expect(addClassTeacher).toHaveBeenCalledWith({
        institutionId: 'inst1',
        userId: 'sub1',
        institutionName: 'Smt Radha',
        role: 'teacher',
      });
    });

    it('does nothing when they are already a teacher', async () => {
      vi.mocked(ClassInstitutionEntity.get).mockReturnValue(
        goResolves({ id: 'inst1', ownerUserId: 'user9', name: 'Smt Radha' }) as never
      );
      vi.mocked(isClassTeacher).mockResolvedValue(true);

      await addInstitutionTeacher('inst1', 'sub1');

      expect(addClassTeacher).not.toHaveBeenCalled();
    });
  });

  /**
   * An institution whose owner cannot reach it has a credit ledger nobody can correct, and there
   * is no ownership-transfer path yet to fix it with. Refused rather than allowed and repaired.
   */
  describe('removeInstitutionTeacher', () => {
    it('refuses to remove the owner', async () => {
      vi.mocked(ClassInstitutionEntity.get).mockReturnValue(
        goResolves({ id: 'inst1', ownerUserId: 'user9' }) as never
      );

      expect(await removeInstitutionTeacher('inst1', 'user9')).toEqual({
        removed: false,
        reason: 'owner',
      });
    });

    it('removes anybody else', async () => {
      vi.mocked(ClassInstitutionEntity.get).mockReturnValue(
        goResolves({ id: 'inst1', ownerUserId: 'user9' }) as never
      );

      expect(await removeInstitutionTeacher('inst1', 'sub1')).toEqual({ removed: true });
    });
  });
});
