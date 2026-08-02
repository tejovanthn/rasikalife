import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ClassProgramEntity: {
    create: vi.fn(),
    patch: vi.fn(),
    query: { primary: vi.fn(), byId: vi.fn() },
  },
}));

import {
  CreateClassProgramSchema,
  archiveClassProgram,
  createClassProgram,
  listInstitutionPrograms,
  programDisplayTitle,
  unarchiveClassProgram,
} from '.';
import { ClassProgramEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

function patchChain() {
  const chain: Record<string, unknown> = { go: vi.fn().mockResolvedValue({ data: {} }) };
  chain.set = vi.fn().mockReturnValue(chain);
  chain.remove = vi.fn().mockReturnValue(chain);
  return chain;
}

const PROGRAM = {
  id: 'prog1',
  institutionId: 'inst1',
  createdAt: '2026-08-01T00:00:00.000Z',
  type: 'regular' as const,
};

describe('class-program', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createClassProgram', () => {
    it('defaults a weekly 1:1 to burn, in-person and not a group', async () => {
      vi.mocked(ClassProgramEntity.create).mockReturnValue(goResolves({}) as never);

      const input = CreateClassProgramSchema.parse({ institutionId: 'inst1' });
      await createClassProgram(input);

      expect(ClassProgramEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'regular',
          isGroup: false,
          defaultMode: 'in-person',
          skipPolicy: 'burn',
        })
      );
    });
  });

  describe('listInstitutionPrograms', () => {
    it('hides archived programs from the roster by default, newest first', async () => {
      vi.mocked(ClassProgramEntity.query.primary).mockReturnValue(
        goResolves([
          { ...PROGRAM, id: 'old' },
          { ...PROGRAM, id: 'archived', archivedAt: '2026-07-01T00:00:00.000Z' },
          { ...PROGRAM, id: 'new' },
        ]) as never
      );

      const result = await listInstitutionPrograms('inst1');

      expect(result.map(p => p.id)).toEqual(['new', 'old']);
    });

    it('shows them when asked', async () => {
      vi.mocked(ClassProgramEntity.query.primary).mockReturnValue(
        goResolves([
          { ...PROGRAM, id: 'a' },
          { ...PROGRAM, id: 'archived', archivedAt: '2026-07-01T00:00:00.000Z' },
        ]) as never
      );

      const result = await listInstitutionPrograms('inst1', { includeArchived: true });

      expect(result).toHaveLength(2);
    });
  });

  describe('archive', () => {
    it('stamps a time', async () => {
      vi.mocked(ClassProgramEntity.query.byId).mockReturnValue(goResolves([PROGRAM]) as never);
      const chain = patchChain();
      vi.mocked(ClassProgramEntity.patch).mockReturnValue(chain as never);

      await archiveClassProgram('prog1');

      // The sort key carries createdAt, so the patch needs more than the id the caller has.
      expect(ClassProgramEntity.patch).toHaveBeenCalledWith({
        institutionId: 'inst1',
        createdAt: '2026-08-01T00:00:00.000Z',
        id: 'prog1',
      });
      expect(chain.set).toHaveBeenCalledWith(
        expect.objectContaining({ archivedAt: expect.any(String) })
      );
    });

    /**
     * CLAUDE.md rule 8. `.set({ archivedAt: undefined })` drops out of the UpdateExpression
     * entirely, so the program would stay archived while the code read as though it unarchived
     * it — and the test asserting the `.set` call shape would have passed throughout.
     */
    it('removes the stamp rather than setting it to undefined', async () => {
      vi.mocked(ClassProgramEntity.query.byId).mockReturnValue(
        goResolves([{ ...PROGRAM, archivedAt: '2026-07-01T00:00:00.000Z' }]) as never
      );
      const chain = patchChain();
      vi.mocked(ClassProgramEntity.patch).mockReturnValue(chain as never);

      await unarchiveClassProgram('prog1');

      expect(chain.remove).toHaveBeenCalledWith(['archivedAt']);
      expect(chain.set).not.toHaveBeenCalled();
    });
  });
});

/**
 * Asking a guru to name her weekly Tuesday lesson is asking her to invent something. The
 * fallback lives in core so both apps say the same words.
 */
describe('programDisplayTitle', () => {
  it('names an untitled regular program', () => {
    expect(programDisplayTitle({ type: 'regular' })).toBe('Weekly class');
    expect(programDisplayTitle({ type: 'workshop' })).toBe('Workshop');
  });

  it('prefers a real title', () => {
    expect(programDisplayTitle({ type: 'workshop', title: 'Tyagaraja intensive' })).toBe(
      'Tyagaraja intensive'
    );
  });

  it('treats a blank title as no title', () => {
    expect(programDisplayTitle({ type: 'regular', title: '   ' })).toBe('Weekly class');
  });
});

describe('CreateClassProgramSchema', () => {
  it('rejects an unknown skip policy', () => {
    expect(() =>
      CreateClassProgramSchema.parse({ institutionId: 'inst1', skipPolicy: 'refund' })
    ).toThrow();
  });

  // Reference only, never a constraint — a workshop sold as ten routinely runs to thirteen.
  it('takes a nominal count without making it a limit', () => {
    const parsed = CreateClassProgramSchema.parse({ institutionId: 'inst1', nominalCount: 10 });
    expect(parsed.nominalCount).toBe(10);
  });
});
