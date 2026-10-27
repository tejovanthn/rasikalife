import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adjustPerformanceCount,
  createRaga,
  deleteRaga,
  getRaga,
  getRagaByName,
  mergeRaga,
  updateRaga,
} from './index';
import type { CreateRagaInput, UpdateRagaInput } from './index';

vi.mock('../cascade', () => ({
  cascadeRagaMerge: vi.fn(),
  cascadeRagaNameUpdate: vi.fn(),
}));

vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-raga-id'),
}));

vi.mock('./entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./entity')>();
  return {
    RagaEntity: {
      // Real conversions so keyOfEntity derives the true (lowercased) key.
      conversions: actual.RagaEntity.conversions,
      create: vi.fn(),
      get: vi.fn(),
      scan: vi.fn(),
      query: {
        byName: vi.fn(),
        list: vi.fn(),
      },
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
});

describe('Raga', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // updateRaga reads the stored record before a rename or a cited-field change.
    const { RagaEntity } = await import('./entity');
    vi.mocked(RagaEntity.get).mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: null }),
    } as any);
  });

  describe('createRaga', () => {
    it('should create raga with generated ID and timestamps', async () => {
      const input: CreateRagaInput = {
        name: 'Bhairavi',
      };

      const mockRaga = {
        id: 'test-raga-id',
        ...input,
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { RagaEntity } = await import('./entity');
      vi.mocked(RagaEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockRaga }),
      } as any);

      const raga = await createRaga(input);

      expect(RagaEntity.create).toHaveBeenCalledWith({
        id: 'test-raga-id',
        ...input,
      });
      expect(raga).toEqual(mockRaga);
    });

    it('should throw error when creation fails', async () => {
      const input: CreateRagaInput = { name: 'Test Raga' };

      const { RagaEntity } = await import('./entity');
      vi.mocked(RagaEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      await expect(createRaga(input)).rejects.toThrow('Failed to create raga');
    });
  });

  describe('getRaga', () => {
    it('should return raga when found', async () => {
      const mockRaga = {
        id: 'raga-123',
        name: 'Bhairavi',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { RagaEntity } = await import('./entity');
      vi.mocked(RagaEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockRaga }),
      } as any);

      const raga = await getRaga('raga-123');

      expect(RagaEntity.get).toHaveBeenCalledWith({ id: 'raga-123' });
      expect(raga).toEqual(mockRaga);
    });

    it('should return null when raga not found', async () => {
      const { RagaEntity } = await import('./entity');
      vi.mocked(RagaEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      const raga = await getRaga('non-existent-id');

      expect(raga).toBeNull();
    });
  });

  describe('getRagaByName', () => {
    it('should return raga when found by name', async () => {
      const mockRaga = {
        id: 'raga-123',
        name: 'Bhairavi',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { RagaEntity } = await import('./entity');
      vi.mocked(RagaEntity.query.byName).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: [mockRaga] }),
      } as any);

      const raga = await getRagaByName('Bhairavi');

      expect(RagaEntity.query.byName).toHaveBeenCalledWith({ name: 'Bhairavi' });
      expect(raga).toEqual(mockRaga);
    });

    it('should return null when raga not found by name', async () => {
      const { RagaEntity } = await import('./entity');
      vi.mocked(RagaEntity.query.byName).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: [] }),
      } as any);

      const raga = await getRagaByName('NonExistentRaga');

      expect(raga).toBeNull();
    });
  });

  describe('updateRaga', () => {
    it('should update raga successfully', async () => {
      const updateInput: UpdateRagaInput = { name: 'Updated Raga' };
      const mockUpdatedRaga = {
        id: 'raga-123',
        name: 'Updated Raga',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T01:00:00.000Z',
      };

      const { RagaEntity } = await import('./entity');
      vi.mocked(RagaEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: mockUpdatedRaga }),
        }),
      } as any);

      const raga = await updateRaga('raga-123', updateInput);

      expect(RagaEntity.update).toHaveBeenCalledWith({ id: 'raga-123' });
      expect(raga).toEqual(mockUpdatedRaga);
    });

    it('should throw error when update fails', async () => {
      const updateInput: UpdateRagaInput = { name: 'Updated Raga' };

      const { RagaEntity } = await import('./entity');
      vi.mocked(RagaEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: null }),
        }),
      } as any);

      await expect(updateRaga('raga-123', updateInput)).rejects.toThrow(
        'raga with ID raga-123 not found'
      );
    });

    it('drops the citation of a field the update empties', async () => {
      const { RagaEntity } = await import('./entity');
      vi.mocked(RagaEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({
          data: {
            id: 'raga-123',
            rasa: 'karuna',
            timeOfDay: 'evening',
            citations: [
              { field: 'rasa', sourceSlug: 'sambamoorthy-5', locator: 'p. 117' },
              { field: 'timeOfDay', sourceSlug: 'ssp-1963-tamil', locator: 'p. 375' },
            ],
          },
        }),
      } as any);
      const set = vi.fn().mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: { id: 'raga-123' } }),
      });
      vi.mocked(RagaEntity.update).mockReturnValue({ set } as any);

      await updateRaga('raga-123', { rasa: '' });

      expect(set).toHaveBeenCalledWith({
        rasa: '',
        citations: [{ field: 'timeOfDay', sourceSlug: 'ssp-1963-tamil', locator: 'p. 375' }],
      });
    });

    it('reads nothing when the update touches no cited field and no name', async () => {
      const { RagaEntity } = await import('./entity');
      vi.mocked(RagaEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({ data: { id: 'r' } }) }),
      } as any);

      await updateRaga('r', { performanceCount: 1 } as never);

      expect(RagaEntity.get).not.toHaveBeenCalled();
    });

    it('runs the rename cascade only when the name really changes', async () => {
      const { RagaEntity } = await import('./entity');
      const { cascadeRagaNameUpdate } = await import('../cascade');
      vi.mocked(RagaEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: { id: 'r', name: 'bhairavi' } }),
      } as any);
      vi.mocked(RagaEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({ data: { id: 'r' } }) }),
      } as any);

      await updateRaga('r', { name: 'bhairavi' });
      expect(cascadeRagaNameUpdate).not.toHaveBeenCalled();

      await updateRaga('r', { name: 'bhairavi (raga)' });
      expect(cascadeRagaNameUpdate).toHaveBeenCalledWith('r', 'bhairavi (raga)');
    });
  });

  describe('deleteRaga', () => {
    it('should delete raga successfully', async () => {
      const { RagaEntity } = await import('./entity');
      vi.mocked(RagaEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      await expect(deleteRaga('raga-123')).resolves.not.toThrow();

      expect(RagaEntity.delete).toHaveBeenCalledWith({ id: 'raga-123' });
    });
  });

  describe('adjustPerformanceCount', () => {
    it('derives the counter key from RagaEntity instead of hand-building it in uppercase', async () => {
      // Regression test: the counter used to write Key: { pk: 'RAGA#raga-123', sk: '#METADATA' }
      // directly. ElectroDB lowercases composite key values, so that uppercase key
      // pointed at a row the real raga never occupies, leaving performanceCount at
      // zero on the actual raga record. `dynamoClient` is the real module here (not
      // mocked) so we spy on `send` rather than replacing the client wholesale.
      const { RagaEntity } = await import('./entity');
      const { dynamoClient } = await import('../../db/client');

      const sendSpy = vi.spyOn(dynamoClient, 'send').mockResolvedValueOnce({} as never);

      await adjustPerformanceCount('raga-123', 1);

      const command = sendSpy.mock.calls[0][0] as unknown as { Key: unknown };
      expect(command.Key).toEqual({ pk: 'raga#raga-123', sk: '#metadata' });

      sendSpy.mockRestore();
    });
  });

  describe('mergeRaga', () => {
    it('fills survivor blanks from the loser, re-parents janyas, then soft-deletes', async () => {
      const { RagaEntity } = await import('./entity');
      const records: Record<string, unknown> = {
        keep: { id: 'keep', name: 'keeravaaNi', arohanam: 'S R2 G2 M1 P D1 N3 S' },
        lose: {
          id: 'lose',
          name: 'kIravANi',
          arohanam: 'other',
          avarohanam: 'S N3 D1 P M1 G2 R2 S',
          melaNumber: 21,
        },
      };
      vi.mocked(RagaEntity.get).mockImplementation(
        (key: { id: string }) =>
          ({ go: vi.fn().mockResolvedValue({ data: records[key.id] }) }) as never
      );
      vi.mocked(RagaEntity.query.list).mockReturnValue({
        where: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({
            data: [
              { id: 'child', name: 'hamsapancama', parentRaga: { id: 'lose', name: 'kIravANi' } },
              { id: 'other', name: 'todi' },
            ],
            cursor: null,
          }),
        }),
      } as never);
      const sets: Array<{ id: string; values: unknown }> = [];
      vi.mocked(RagaEntity.update).mockImplementation(
        (key: { id: string }) =>
          ({
            set: (values: unknown) => {
              sets.push({ id: key.id, values });
              return { go: vi.fn().mockResolvedValue({ data: {} }) };
            },
          }) as never
      );

      await mergeRaga('lose', 'keep');

      expect(sets[0]).toEqual({
        id: 'keep',
        values: { avarohanam: 'S N3 D1 P M1 G2 R2 S', melaNumber: 21 },
      });
      expect(sets[1]).toEqual({
        id: 'child',
        values: { parentRaga: { id: 'keep', name: 'keeravaaNi' } },
      });
      expect(sets[2].id).toBe('lose');
      expect(sets[2].values).toMatchObject({ mergedIntoId: 'keep' });
      expect(sets).toHaveLength(3);
    });
  });
});
