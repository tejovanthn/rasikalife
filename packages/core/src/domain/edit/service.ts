import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ApplicationError, ErrorCode } from '../../constants';
import { dynamoClient } from '../../db/client';
import { generateId } from '../../utils';
import { EditEntity } from './entity';
import { getHandler } from './registry';
import { EditOperation, EditStatus } from './types';
import type { Edit, EditEntityType, EditFilters, EditInput, PendingEditFilters } from './types';

export type { Edit };

export async function createDraft(input: EditInput): Promise<Edit> {
  // Get handler to access validation schema and entity operations
  const handler = await getHandler(input.entityType as EditEntityType);

  // Verify that the target entity exists
  const entity = await handler.getEntity(input.entityId);
  if (!entity) {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      `Cannot create edit: ${input.entityType} with id ${input.entityId} not found`
    );
  }

  const isDelete = input.operation === EditOperation.DELETE;

  // For update operations, validate proposed values against entity-specific update schema
  if (!isDelete) {
    const validationResult = handler.updateSchema.safeParse(input.proposedValues);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new ApplicationError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid proposed values for ${input.entityType}: ${errorMessages}`
      );
    }
  }

  const result = await EditEntity.create({
    id: generateId(),
    entityType: input.entityType,
    entityId: input.entityId,
    userId: input.userId,
    status: EditStatus.DRAFT,
    operation: input.operation ?? EditOperation.UPDATE,
    proposedValues: isDelete ? {} : input.proposedValues,
    userNote: input.userNote,
  }).go();

  if (!result.data) {
    throw new ApplicationError(ErrorCode.DATABASE_ERROR, 'Failed to create draft edit');
  }

  return result.data;
}

export async function submitEdit(editId: string, userId: string): Promise<Edit> {
  const edit = await getEditById(editId);

  if (!edit) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, `Edit ${editId} not found`);
  }

  if (edit.userId !== userId) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, 'You can only submit your own edits');
  }

  if (edit.status !== EditStatus.DRAFT) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, 'Only draft edits can be submitted');
  }

  const result = await EditEntity.update({ id: editId })
    .set({
      status: EditStatus.SUBMITTED,
      submittedAt: new Date().toISOString(),
    })
    .composite({ entityType: edit.entityType })
    .go();

  if (!result.data) {
    throw new ApplicationError(ErrorCode.DATABASE_ERROR, 'Failed to submit edit');
  }

  return result.data as Edit;
}

export async function withdrawEdit(editId: string, userId: string): Promise<Edit> {
  const edit = await getEditById(editId);

  if (!edit) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, `Edit ${editId} not found`);
  }

  if (edit.userId !== userId) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, 'You can only withdraw your own edits');
  }

  if (edit.status !== EditStatus.DRAFT && edit.status !== EditStatus.SUBMITTED) {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      'Only draft or submitted edits can be withdrawn'
    );
  }

  const result = await EditEntity.update({ id: editId })
    .set({
      status: EditStatus.WITHDRAWN,
      processedAt: new Date().toISOString(),
    })
    .composite({ entityType: edit.entityType })
    .go();

  if (!result.data) {
    throw new ApplicationError(ErrorCode.DATABASE_ERROR, 'Failed to withdraw edit');
  }

  return result.data as unknown as Edit;
}

export async function approveEdit(editId: string, moderatorId: string): Promise<Edit> {
  const edit = await getEditById(editId);

  if (!edit) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, `Edit ${editId} not found`);
  }

  if (edit.status !== EditStatus.SUBMITTED) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, 'Only submitted edits can be approved');
  }

  const handler = await getHandler(edit.entityType as EditEntityType);
  if (edit.operation === EditOperation.DELETE) {
    await handler.deleteEntity(edit.entityId);
  } else {
    await handler.updateEntity(edit.entityId, edit.proposedValues);
  }

  const result = await EditEntity.update({ id: editId })
    .set({
      status: EditStatus.APPROVED,
      moderatorId,
      processedAt: new Date().toISOString(),
    })
    .composite({ entityType: edit.entityType })
    .go();

  if (!result.data) {
    throw new ApplicationError(ErrorCode.DATABASE_ERROR, 'Failed to approve edit');
  }

  return result.data as unknown as Edit;
}

export async function rejectEdit(
  editId: string,
  moderatorId: string,
  moderatorNote: string
): Promise<Edit> {
  const edit = await getEditById(editId);

  if (!edit) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, `Edit ${editId} not found`);
  }

  if (edit.status !== EditStatus.SUBMITTED) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, 'Only submitted edits can be rejected');
  }

  if (!moderatorNote || moderatorNote.trim().length === 0) {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      'Rejection requires a moderator note explaining the reason'
    );
  }

  const result = await EditEntity.update({ id: editId })
    .set({
      status: EditStatus.REJECTED,
      moderatorId,
      moderatorNote,
      processedAt: new Date().toISOString(),
    })
    .composite({ entityType: edit.entityType })
    .go();

  if (!result.data) {
    throw new ApplicationError(ErrorCode.DATABASE_ERROR, 'Failed to reject edit');
  }

  return result.data as unknown as Edit;
}

export async function getEditById(editId: string): Promise<Edit | null> {
  const result = await EditEntity.get({ id: editId }).go();
  return result.data || null;
}

export async function getPendingEdits(params: PendingEditFilters = {}): Promise<{
  items: Edit[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params.limit || 20;

  let query:
    | ReturnType<typeof EditEntity.query.byPendingType>
    | ReturnType<typeof EditEntity.query.byStatus>;
  if (params.entityType) {
    query = EditEntity.query.byPendingType({
      status: EditStatus.SUBMITTED,
      entityType: params.entityType,
    });
  } else {
    query = EditEntity.query.byStatus({ status: EditStatus.SUBMITTED });
  }

  const result = await query.go({
    limit,
    cursor: params.nextToken,
    order: 'asc',
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function getUserEdits(
  userId: string,
  params: EditFilters = {}
): Promise<{
  items: Edit[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params.limit || 20;

  const result = await EditEntity.query.byUser({ userId }).go({
    limit,
    cursor: params.nextToken,
    order: 'desc',
  });

  let items = result.data || [];
  if (params.status) {
    items = items.filter(e => e.status === params.status);
  }

  return {
    items,
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function getEntityEdits(
  entityType: string,
  entityId: string,
  params: EditFilters = {}
): Promise<{
  items: Edit[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params.limit || 20;

  const result = await EditEntity.query.byEntity({ entityType, entityId }).go({
    limit,
    cursor: params.nextToken,
    order: 'desc',
  });

  let items = result.data || [];
  if (params.status) {
    items = items.filter(e => e.status === params.status);
  }

  return {
    items,
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function updateDraft(
  editId: string,
  userId: string,
  updates: { proposedValues?: unknown; userNote?: string }
): Promise<Edit> {
  const edit = await getEditById(editId);

  if (!edit) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, `Edit ${editId} not found`);
  }

  if (edit.userId !== userId) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, 'You can only update your own drafts');
  }

  if (edit.status !== EditStatus.DRAFT) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, 'Only draft edits can be updated');
  }

  // Validate proposed values if they're being updated
  if (updates.proposedValues !== undefined) {
    const handler = await getHandler(edit.entityType as EditEntityType);
    const validationResult = handler.updateSchema.safeParse(updates.proposedValues);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new ApplicationError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid proposed values for ${edit.entityType}: ${errorMessages}`
      );
    }
  }

  const setData: Record<string, unknown> = {};
  if (updates.proposedValues !== undefined) {
    setData.proposedValues = updates.proposedValues;
  }
  if (updates.userNote !== undefined) {
    setData.userNote = updates.userNote;
  }

  const tableName = process.env.DYNAMODB_TABLE || 'RasikaLifeTable';

  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  let i = 0;
  for (const [key, value] of Object.entries(setData)) {
    const attrName = `#attr${i}`;
    const attrValue = `:val${i}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = value;
    i++;
  }

  updateExpressions.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  const command = new UpdateCommand({
    TableName: tableName,
    Key: {
      pk: `EDIT#${editId}`,
      sk: '#METADATA',
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  });

  await dynamoClient.send(command);

  return (await getEditById(editId)) as Edit;
}

export async function requestDeletion(
  entityType: EditEntityType,
  entityId: string,
  moderatorId: string,
  userNote?: string
): Promise<Edit> {
  // Check for any existing draft or submitted delete edit for this entity
  const existingEdits = await getEntityEdits(entityType, entityId);
  const existingDeleteEdit = existingEdits.items.find(
    e =>
      e.operation === EditOperation.DELETE &&
      (e.status === EditStatus.SUBMITTED || e.status === EditStatus.DRAFT)
  );
  if (existingDeleteEdit) {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      'A deletion request is already pending for this entity'
    );
  }

  // Create draft with delete operation
  const draft = await createDraft({
    entityType,
    entityId,
    userId: moderatorId,
    proposedValues: {},
    operation: EditOperation.DELETE,
    userNote,
  });

  // Immediately submit
  const submitted = await submitEdit(draft.id, moderatorId);
  return submitted;
}

export async function getActiveEditForEntity(
  userId: string,
  entityType: string,
  entityId: string
): Promise<Edit | null> {
  // Use byEntity GSI for efficient query - entities typically have few edits
  const result = await EditEntity.query.byEntity({ entityType, entityId }).go({
    order: 'desc',
  });

  // Filter for user's active edits (DRAFT or SUBMITTED)
  const activeEdit = (result.data || []).find(
    edit =>
      edit.userId === userId &&
      (edit.status === EditStatus.DRAFT || edit.status === EditStatus.SUBMITTED)
  );

  return activeEdit || null;
}
