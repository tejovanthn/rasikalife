import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-id-123'),
}));

vi.mock('../../db/client', () => ({
  dynamoClient: { send: vi.fn() },
}));

vi.mock('./entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./entity')>();
  return {
    EditEntity: {
      // Real conversions so keyOfEntity derives the true (lowercased) key.
      conversions: actual.EditEntity.conversions,
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      query: {
        byPendingType: vi.fn(),
        byStatus: vi.fn(),
        byUser: vi.fn(),
        byEntity: vi.fn(),
      },
    },
  };
});

vi.mock('./registry', () => ({
  getHandler: vi.fn(),
}));

import { dynamoClient } from '../../db/client';
import { EditEntity } from './entity';
import { getHandler } from './registry';
import {
  approveEdit,
  createDraft,
  getActiveEditForEntity,
  getEditById,
  getEntityEdits,
  getPendingEdits,
  getUserEdits,
  rejectEdit,
  requestDeletion,
  requestMerge,
  submitEdit,
  updateDraft,
  withdrawEdit,
} from './service';
import { EditOperation, EditStatus } from './types';
import type { Edit } from './types';

function makeEdit(overrides: Partial<Edit> = {}): Edit {
  return {
    id: 'edit-1',
    entityType: 'artist',
    entityId: 'artist-1',
    userId: 'user-1',
    status: EditStatus.DRAFT,
    operation: EditOperation.UPDATE,
    proposedValues: { name: 'New Name' },
    createdAt: '2025-01-15T12:00:00.000Z',
    updatedAt: '2025-01-15T12:00:00.000Z',
    ...overrides,
  } as Edit;
}

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

function updateChainResolves(data: unknown) {
  return {
    set: vi.fn().mockReturnValue({
      composite: vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({ data }) }),
    }),
  };
}

function makeHandler(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    getEntity: vi.fn().mockResolvedValue({ id: 'artist-1', name: 'Old Name' }),
    updateEntity: vi.fn().mockResolvedValue({ id: 'artist-1', name: 'New Name' }),
    deleteEntity: vi.fn().mockResolvedValue(undefined),
    mergeEntity: vi.fn().mockResolvedValue(undefined),
    updateSchema: { safeParse: vi.fn().mockReturnValue({ success: true }) },
    ...overrides,
  };
}

describe('edit/service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDraft', () => {
    it('creates a draft edit after validating proposed values', async () => {
      const handler = makeHandler();
      vi.mocked(getHandler).mockResolvedValue(handler as never);
      const created = makeEdit();
      vi.mocked(EditEntity.create).mockReturnValue(goResolves(created) as never);

      const result = await createDraft({
        entityType: 'artist',
        entityId: 'artist-1',
        userId: 'user-1',
        proposedValues: { name: 'New Name' },
      });

      expect(handler.getEntity).toHaveBeenCalledWith('artist-1');
      expect(handler.updateSchema.safeParse).toHaveBeenCalledWith({ name: 'New Name' });
      expect(EditEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-id-123',
          status: EditStatus.DRAFT,
          operation: EditOperation.UPDATE,
          proposedValues: { name: 'New Name' },
        })
      );
      expect(result).toEqual(created);
    });

    it('throws when the target entity does not exist', async () => {
      const handler = makeHandler({ getEntity: vi.fn().mockResolvedValue(null) });
      vi.mocked(getHandler).mockResolvedValue(handler as never);

      await expect(
        createDraft({
          entityType: 'artist',
          entityId: 'missing',
          userId: 'user-1',
          proposedValues: {},
        })
      ).rejects.toThrow('artist with id missing not found');
    });

    it('throws when proposed values fail schema validation', async () => {
      const handler = makeHandler({
        updateSchema: {
          safeParse: vi.fn().mockReturnValue({
            success: false,
            error: { errors: [{ path: ['name'], message: 'Required' }] },
          }),
        },
      });
      vi.mocked(getHandler).mockResolvedValue(handler as never);

      await expect(
        createDraft({
          entityType: 'artist',
          entityId: 'artist-1',
          userId: 'user-1',
          proposedValues: {},
        })
      ).rejects.toThrow('Invalid proposed values for artist: name: Required');
    });

    it('skips schema validation and clears proposedValues for a DELETE operation', async () => {
      const handler = makeHandler();
      vi.mocked(getHandler).mockResolvedValue(handler as never);
      vi.mocked(EditEntity.create).mockReturnValue(goResolves(makeEdit()) as never);

      await createDraft({
        entityType: 'artist',
        entityId: 'artist-1',
        userId: 'user-1',
        proposedValues: { name: 'ignored' },
        operation: EditOperation.DELETE,
      });

      expect(handler.updateSchema.safeParse).not.toHaveBeenCalled();
      expect(EditEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({ proposedValues: {} })
      );
    });

    it('throws a database error when create returns no data', async () => {
      const handler = makeHandler();
      vi.mocked(getHandler).mockResolvedValue(handler as never);
      vi.mocked(EditEntity.create).mockReturnValue(goResolves(undefined) as never);

      await expect(
        createDraft({
          entityType: 'artist',
          entityId: 'artist-1',
          userId: 'user-1',
          proposedValues: { name: 'x' },
        })
      ).rejects.toThrow('Failed to create draft edit');
    });
  });

  describe('submitEdit', () => {
    it('moves a draft edit to submitted', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(goResolves(makeEdit()) as never);
      const submitted = makeEdit({ status: EditStatus.SUBMITTED });
      vi.mocked(EditEntity.update).mockReturnValue(updateChainResolves(submitted) as never);

      const result = await submitEdit('edit-1', 'user-1');

      expect(result).toEqual(submitted);
    });

    it('throws when the edit does not exist', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(goResolves(undefined) as never);

      await expect(submitEdit('missing', 'user-1')).rejects.toThrow('Edit missing not found');
    });

    it('throws when a different user tries to submit', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(goResolves(makeEdit({ userId: 'other' })) as never);

      await expect(submitEdit('edit-1', 'user-1')).rejects.toThrow(
        'You can only submit your own edits'
      );
    });

    it('throws when the edit is not in draft status', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(
        goResolves(makeEdit({ status: EditStatus.APPROVED })) as never
      );

      await expect(submitEdit('edit-1', 'user-1')).rejects.toThrow(
        'Only draft edits can be submitted'
      );
    });
  });

  describe('withdrawEdit', () => {
    it.each([EditStatus.DRAFT, EditStatus.SUBMITTED])(
      'withdraws an edit that is %s',
      async status => {
        vi.mocked(EditEntity.get).mockReturnValue(goResolves(makeEdit({ status })) as never);
        const withdrawn = makeEdit({ status: EditStatus.WITHDRAWN });
        vi.mocked(EditEntity.update).mockReturnValue(updateChainResolves(withdrawn) as never);

        const result = await withdrawEdit('edit-1', 'user-1');

        expect(result).toEqual(withdrawn);
      }
    );

    it('throws when the edit is already approved', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(
        goResolves(makeEdit({ status: EditStatus.APPROVED })) as never
      );

      await expect(withdrawEdit('edit-1', 'user-1')).rejects.toThrow(
        'Only draft or submitted edits can be withdrawn'
      );
    });

    it('throws when a different user tries to withdraw', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(goResolves(makeEdit({ userId: 'other' })) as never);

      await expect(withdrawEdit('edit-1', 'user-1')).rejects.toThrow(
        'You can only withdraw your own edits'
      );
    });
  });

  describe('approveEdit', () => {
    it('applies an UPDATE operation via the handler', async () => {
      const handler = makeHandler();
      vi.mocked(getHandler).mockResolvedValue(handler as never);
      vi.mocked(EditEntity.get).mockReturnValue(
        goResolves(makeEdit({ status: EditStatus.SUBMITTED })) as never
      );
      vi.mocked(EditEntity.update).mockReturnValue(
        updateChainResolves(makeEdit({ status: EditStatus.APPROVED })) as never
      );

      await approveEdit('edit-1', 'mod-1');

      expect(handler.updateEntity).toHaveBeenCalledWith('artist-1', { name: 'New Name' });
      expect(handler.deleteEntity).not.toHaveBeenCalled();
      expect(handler.mergeEntity).not.toHaveBeenCalled();
    });

    it('applies a DELETE operation via the handler', async () => {
      const handler = makeHandler();
      vi.mocked(getHandler).mockResolvedValue(handler as never);
      vi.mocked(EditEntity.get).mockReturnValue(
        goResolves(
          makeEdit({ status: EditStatus.SUBMITTED, operation: EditOperation.DELETE })
        ) as never
      );
      vi.mocked(EditEntity.update).mockReturnValue(
        updateChainResolves(makeEdit({ status: EditStatus.APPROVED })) as never
      );

      await approveEdit('edit-1', 'mod-1');

      expect(handler.deleteEntity).toHaveBeenCalledWith('artist-1');
      expect(handler.updateEntity).not.toHaveBeenCalled();
    });

    it('applies a MERGE operation via the handler using mergeTargetId', async () => {
      const handler = makeHandler();
      vi.mocked(getHandler).mockResolvedValue(handler as never);
      vi.mocked(EditEntity.get).mockReturnValue(
        goResolves(
          makeEdit({
            status: EditStatus.SUBMITTED,
            operation: EditOperation.MERGE,
            proposedValues: { mergeTargetId: 'artist-2' },
          })
        ) as never
      );
      vi.mocked(EditEntity.update).mockReturnValue(
        updateChainResolves(makeEdit({ status: EditStatus.APPROVED })) as never
      );

      await approveEdit('edit-1', 'mod-1');

      expect(handler.mergeEntity).toHaveBeenCalledWith('artist-1', 'artist-2');
    });

    it('throws when the edit is not submitted', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(
        goResolves(makeEdit({ status: EditStatus.DRAFT })) as never
      );

      await expect(approveEdit('edit-1', 'mod-1')).rejects.toThrow(
        'Only submitted edits can be approved'
      );
    });

    it('throws when the edit does not exist', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(goResolves(undefined) as never);

      await expect(approveEdit('missing', 'mod-1')).rejects.toThrow('Edit missing not found');
    });
  });

  describe('rejectEdit', () => {
    it('rejects a submitted edit with a moderator note', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(
        goResolves(makeEdit({ status: EditStatus.SUBMITTED })) as never
      );
      const rejected = makeEdit({ status: EditStatus.REJECTED, moderatorNote: 'Not accurate' });
      vi.mocked(EditEntity.update).mockReturnValue(updateChainResolves(rejected) as never);

      const result = await rejectEdit('edit-1', 'mod-1', 'Not accurate');

      expect(result).toEqual(rejected);
    });

    it('throws when the note is empty or whitespace', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(
        goResolves(makeEdit({ status: EditStatus.SUBMITTED })) as never
      );

      await expect(rejectEdit('edit-1', 'mod-1', '   ')).rejects.toThrow(
        'Rejection requires a moderator note explaining the reason'
      );
    });

    it('throws when the edit is not submitted', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(
        goResolves(makeEdit({ status: EditStatus.DRAFT })) as never
      );

      await expect(rejectEdit('edit-1', 'mod-1', 'reason')).rejects.toThrow(
        'Only submitted edits can be rejected'
      );
    });
  });

  describe('getEditById', () => {
    it('returns the edit when found', async () => {
      const edit = makeEdit();
      vi.mocked(EditEntity.get).mockReturnValue(goResolves(edit) as never);

      expect(await getEditById('edit-1')).toEqual(edit);
    });

    it('returns null when not found', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(goResolves(undefined) as never);

      expect(await getEditById('missing')).toBeNull();
    });
  });

  describe('getPendingEdits', () => {
    it('queries byPendingType when entityType is provided', async () => {
      const queryFn = vi.fn().mockReturnValue(goResolves([makeEdit()]));
      vi.mocked(EditEntity.query.byPendingType).mockImplementation(queryFn as never);

      const result = await getPendingEdits({ entityType: 'artist' });

      expect(EditEntity.query.byPendingType).toHaveBeenCalledWith({
        status: EditStatus.SUBMITTED,
        entityType: 'artist',
      });
      expect(EditEntity.query.byStatus).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('queries byStatus when no entityType is provided, defaulting limit to 20', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [], cursor: 'next-token' });
      vi.mocked(EditEntity.query.byStatus).mockReturnValue({ go: goSpy } as never);

      const result = await getPendingEdits();

      expect(EditEntity.query.byStatus).toHaveBeenCalledWith({ status: EditStatus.SUBMITTED });
      expect(goSpy).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, order: 'asc' }));
      expect(result.hasMore).toBe(true);
      expect(result.nextToken).toBe('next-token');
    });
  });

  describe('getUserEdits', () => {
    it('returns all of a user edits when no status filter is given', async () => {
      const edits = [
        makeEdit({ status: EditStatus.DRAFT }),
        makeEdit({ status: EditStatus.APPROVED }),
      ];
      vi.mocked(EditEntity.query.byUser).mockReturnValue(goResolves(edits) as never);

      const result = await getUserEdits('user-1');

      expect(result.items).toHaveLength(2);
    });

    it('filters by status client-side when provided', async () => {
      const edits = [
        makeEdit({ status: EditStatus.DRAFT }),
        makeEdit({ status: EditStatus.APPROVED }),
      ];
      vi.mocked(EditEntity.query.byUser).mockReturnValue(goResolves(edits) as never);

      const result = await getUserEdits('user-1', { status: EditStatus.APPROVED });

      expect(result.items).toEqual([edits[1]]);
    });
  });

  describe('getEntityEdits', () => {
    it('queries by entity and filters by status client-side when provided', async () => {
      const edits = [
        makeEdit({ status: EditStatus.DRAFT }),
        makeEdit({ status: EditStatus.APPROVED }),
      ];
      vi.mocked(EditEntity.query.byEntity).mockReturnValue(goResolves(edits) as never);

      const result = await getEntityEdits('artist', 'artist-1', { status: EditStatus.DRAFT });

      expect(EditEntity.query.byEntity).toHaveBeenCalledWith({
        entityType: 'artist',
        entityId: 'artist-1',
      });
      expect(result.items).toEqual([edits[0]]);
    });
  });

  describe('updateDraft', () => {
    it('sends an UpdateCommand and returns the refreshed edit', async () => {
      vi.mocked(EditEntity.get)
        .mockReturnValueOnce(goResolves(makeEdit()) as never)
        .mockReturnValueOnce(goResolves(makeEdit({ userNote: 'updated note' })) as never);
      vi.mocked(dynamoClient.send).mockResolvedValue({} as never);

      const result = await updateDraft('edit-1', 'user-1', { userNote: 'updated note' });

      expect(dynamoClient.send).toHaveBeenCalledTimes(1);
      const command = vi.mocked(dynamoClient.send).mock.calls[0][0] as unknown as {
        Key: { pk: string; sk: string };
        UpdateExpression: string;
      };
      expect(command.Key).toEqual({ pk: 'edit#edit-1', sk: '#metadata' });
      expect(command.UpdateExpression).toContain('SET');
      expect(result?.userNote).toBe('updated note');
    });

    it('validates proposedValues against the handler schema when provided', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(goResolves(makeEdit()) as never);
      const handler = makeHandler({
        updateSchema: {
          safeParse: vi.fn().mockReturnValue({
            success: false,
            error: { errors: [{ path: ['name'], message: 'Too short' }] },
          }),
        },
      });
      vi.mocked(getHandler).mockResolvedValue(handler as never);

      await expect(
        updateDraft('edit-1', 'user-1', { proposedValues: { name: '' } })
      ).rejects.toThrow('Invalid proposed values for artist: name: Too short');
      expect(dynamoClient.send).not.toHaveBeenCalled();
    });

    it('throws when a different user tries to update the draft', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(goResolves(makeEdit({ userId: 'other' })) as never);

      await expect(updateDraft('edit-1', 'user-1', { userNote: 'x' })).rejects.toThrow(
        'You can only update your own drafts'
      );
    });

    it('throws when the edit is no longer a draft', async () => {
      vi.mocked(EditEntity.get).mockReturnValue(
        goResolves(makeEdit({ status: EditStatus.SUBMITTED })) as never
      );

      await expect(updateDraft('edit-1', 'user-1', { userNote: 'x' })).rejects.toThrow(
        'Only draft edits can be updated'
      );
    });
  });

  describe('requestDeletion', () => {
    it('creates and immediately submits a delete draft', async () => {
      const handler = makeHandler();
      vi.mocked(getHandler).mockResolvedValue(handler as never);
      vi.mocked(EditEntity.query.byEntity).mockReturnValue(goResolves([]) as never);
      const draft = makeEdit({ operation: EditOperation.DELETE, userId: 'mod-1' });
      vi.mocked(EditEntity.create).mockReturnValue(goResolves(draft) as never);
      vi.mocked(EditEntity.get).mockReturnValue(goResolves(draft) as never);
      const submitted = makeEdit({
        operation: EditOperation.DELETE,
        status: EditStatus.SUBMITTED,
        userId: 'mod-1',
      });
      vi.mocked(EditEntity.update).mockReturnValue(updateChainResolves(submitted) as never);

      const result = await requestDeletion('artist', 'artist-1', 'mod-1', 'spam');

      expect(result).toEqual(submitted);
    });

    it('throws when a delete request is already pending for the entity', async () => {
      const pendingDelete = makeEdit({
        operation: EditOperation.DELETE,
        status: EditStatus.SUBMITTED,
      });
      vi.mocked(EditEntity.query.byEntity).mockReturnValue(goResolves([pendingDelete]) as never);

      await expect(requestDeletion('artist', 'artist-1', 'mod-1')).rejects.toThrow(
        'A deletion request is already pending for this entity'
      );
    });
  });

  describe('requestMerge', () => {
    it('creates a merge draft without schema validation and submits it', async () => {
      vi.mocked(EditEntity.query.byEntity).mockReturnValue(goResolves([]) as never);
      const draft = makeEdit({ operation: EditOperation.MERGE, id: 'edit-2', userId: 'mod-1' });
      vi.mocked(EditEntity.create).mockReturnValue(goResolves(draft) as never);
      vi.mocked(EditEntity.get).mockReturnValue(goResolves(draft) as never);
      const submitted = makeEdit({
        operation: EditOperation.MERGE,
        id: 'edit-2',
        status: EditStatus.SUBMITTED,
        userId: 'mod-1',
      });
      vi.mocked(EditEntity.update).mockReturnValue(updateChainResolves(submitted) as never);

      const result = await requestMerge('artist', 'artist-1', 'artist-2', 'mod-1');

      expect(EditEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: EditOperation.MERGE,
          proposedValues: { mergeTargetId: 'artist-2' },
        })
      );
      expect(getHandler).not.toHaveBeenCalled();
      expect(result).toEqual(submitted);
    });

    it('throws when a merge request is already pending for the entity', async () => {
      const pendingMerge = makeEdit({ operation: EditOperation.MERGE, status: EditStatus.DRAFT });
      vi.mocked(EditEntity.query.byEntity).mockReturnValue(goResolves([pendingMerge]) as never);

      await expect(requestMerge('artist', 'artist-1', 'artist-2', 'mod-1')).rejects.toThrow(
        'A merge request is already pending for this entity'
      );
    });
  });

  describe('getActiveEditForEntity', () => {
    it('returns the user active draft or submitted edit', async () => {
      const edits = [
        makeEdit({ userId: 'other', status: EditStatus.SUBMITTED }),
        makeEdit({ userId: 'user-1', status: EditStatus.DRAFT, id: 'edit-2' }),
      ];
      vi.mocked(EditEntity.query.byEntity).mockReturnValue(goResolves(edits) as never);

      const result = await getActiveEditForEntity('user-1', 'artist', 'artist-1');

      expect(result?.id).toBe('edit-2');
    });

    it('returns null when the user has no active edit', async () => {
      const edits = [makeEdit({ userId: 'user-1', status: EditStatus.APPROVED })];
      vi.mocked(EditEntity.query.byEntity).mockReturnValue(goResolves(edits) as never);

      expect(await getActiveEditForEntity('user-1', 'artist', 'artist-1')).toBeNull();
    });

    it('returns null when there are no edits at all', async () => {
      vi.mocked(EditEntity.query.byEntity).mockReturnValue(goResolves([]) as never);

      expect(await getActiveEditForEntity('user-1', 'artist', 'artist-1')).toBeNull();
    });
  });
});
