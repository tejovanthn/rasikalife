# Wiki-Style Edit System - Collaborative Content Management

## Introduction

Building collaborative platforms requires a robust system for managing user contributions, edits, and moderation. Wikipedia pioneered this approach with their edit-review-approve workflow, enabling millions of contributors while maintaining quality. This blog post explores our implementation of a generic wiki-style edit system for the Rasika.life platform, covering draft management, submission workflows, moderation patterns, and extensibility.

## The Content Management Challenge

### Requirements
- **User contributions**: Allow any authenticated user to propose edits
- **Draft management**: Let users save work-in-progress edits
- **Moderation workflow**: Review and approve/reject edits before applying
- **Change tracking**: Maintain history of all proposed and applied changes
- **Entity flexibility**: Support edits across multiple entity types (artists, compositions, ragas, talas)
- **Validation**: Ensure proposed changes meet entity-specific rules
- **Conflict resolution**: Handle concurrent edits gracefully

### Traditional Approaches and Limitations

```typescript
// Naive approach - direct updates
export async function updateArtist(id: string, data: UpdateData): Promise<Artist> {
  return await ArtistEntity.update({ id }).set(data).go();
}

// Problems:
// - No review process
// - No change history
// - No validation tracking
// - No way to undo bad edits
// - No attribution for changes
```

## Edit System Architecture

### Core Edit Entity

```typescript
// Edit status lifecycle
export enum EditStatus {
  DRAFT = 'DRAFT',           // User is still working on it
  SUBMITTED = 'SUBMITTED',   // Awaiting moderator review
  APPROVED = 'APPROVED',     // Applied to entity
  REJECTED = 'REJECTED',     // Rejected by moderator
  WITHDRAWN = 'WITHDRAWN',   // Withdrawn by user
}

// Generic edit structure
export interface Edit {
  id: string;
  entityType: string;        // 'artist', 'composition', 'raga', 'tala'
  entityId: string;          // Target entity ID
  userId: string;            // User who created the edit
  status: EditStatus;
  proposedValues: unknown;   // Entity-specific changes
  userNote?: string;         // User's explanation for changes
  moderatorId?: string;      // Moderator who processed the edit
  moderatorNote?: string;    // Moderator's reason for rejection
  submittedAt?: string;      // When submitted for review
  processedAt?: string;      // When approved/rejected
  createdAt: string;
  updatedAt: string;
}
```

### ElectroDB Entity Definition

```typescript
// packages/core/src/domain/edit/entity.ts
export const EditEntity = new Entity({
  model: {
    entity: 'edit',
    version: '1',
    service: 'rasikalife',
  },
  attributes: {
    id: { type: 'string', required: true },
    entityType: { type: 'string', required: true },
    entityId: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    status: {
      type: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const,
      required: true
    },
    proposedValues: { type: 'any', required: true },
    userNote: { type: 'string', required: false },
    moderatorId: { type: 'string', required: false },
    moderatorNote: { type: 'string', required: false },
    submittedAt: { type: 'string', required: false },
    processedAt: { type: 'string', required: false },
    createdAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString()
    },
    updatedAt: {
      type: 'string',
      required: true,
      watch: '*',
      set: () => new Date().toISOString()
    },
  },
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['id'], template: 'EDIT#${id}' },
      sk: { field: 'sk', composite: [], template: '#METADATA' },
    },
    byUser: {
      index: 'gsi1',
      pk: { field: 'gsi1pk', composite: ['userId'], template: 'USER#${userId}' },
      sk: {
        field: 'gsi1sk',
        composite: ['createdAt', 'id'],
        template: 'EDIT#${createdAt}#${id}'
      },
    },
    byEntity: {
      index: 'gsi2',
      pk: {
        field: 'gsi2pk',
        composite: ['entityType', 'entityId'],
        template: '${entityType}#${entityId}'
      },
      sk: {
        field: 'gsi2sk',
        composite: ['createdAt', 'id'],
        template: 'EDIT#${createdAt}#${id}'
      },
    },
    byStatus: {
      index: 'gsi3',
      pk: { field: 'gsi3pk', composite: ['status'], template: 'STATUS#${status}' },
      sk: {
        field: 'gsi3sk',
        composite: ['createdAt', 'id'],
        template: '${createdAt}#${id}'
      },
    },
    byPendingType: {
      index: 'gsi4',
      pk: {
        field: 'gsi4pk',
        composite: ['status', 'entityType'],
        template: 'STATUS#${status}#${entityType}'
      },
      sk: {
        field: 'gsi4sk',
        composite: ['createdAt', 'id'],
        template: '${createdAt}#${id}'
      },
    },
  },
}, { client: dynamoClient, table: process.env.DYNAMODB_TABLE });
```

## Registry Pattern for Extensibility

### Entity Handler Interface

```typescript
// packages/core/src/domain/edit/types.ts
export interface EditEntityHandler<T = any> {
  entityType: EditEntityType;
  updateSchema: z.ZodSchema;
  getEntity: (entityId: string) => Promise<T | null>;
  updateEntity: (entityId: string, data: unknown) => Promise<T>;
}

export enum EditEntityType {
  ARTIST = 'artist',
  COMPOSITION = 'composition',
  RAGA = 'raga',
  TALA = 'tala',
}
```

### Handler Registry

```typescript
// packages/core/src/domain/edit/registry.ts
import type { EditEntityHandler, EditEntityType } from './types';

const handlers = new Map<EditEntityType, EditEntityHandler>();

export function registerHandler(handler: EditEntityHandler): void {
  handlers.set(handler.entityType, handler);
}

export async function getHandler(entityType: EditEntityType): Promise<EditEntityHandler> {
  const handler = handlers.get(entityType);

  if (!handler) {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      `No handler registered for entity type: ${entityType}`
    );
  }

  return handler;
}

export function listHandlers(): EditEntityType[] {
  return Array.from(handlers.keys());
}
```

### Implementing Entity Handlers

```typescript
// packages/core/src/domain/artist/edit-handler.ts
import { EditEntityType } from '../edit/types';
import type { EditEntityHandler } from '../edit/types';
import { UpdateArtistSchema } from './schema';
import { getArtist, updateArtist } from './service';

export const artistEditHandler: EditEntityHandler = {
  entityType: EditEntityType.ARTIST,
  updateSchema: UpdateArtistSchema,

  async getEntity(entityId: string) {
    return await getArtist(entityId);
  },

  async updateEntity(entityId: string, data: unknown) {
    const validated = UpdateArtistSchema.parse(data);
    return await updateArtist(entityId, validated);
  },
};

// Register handler on module load
import { registerHandler } from '../edit/registry';
registerHandler(artistEditHandler);
```

## Edit Workflow Implementation

### Creating Draft Edits

```typescript
// packages/core/src/domain/edit/service.ts
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

  // Validate proposed values against entity-specific update schema
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

  const result = await EditEntity.create({
    id: generateId(),
    entityType: input.entityType,
    entityId: input.entityId,
    userId: input.userId,
    status: EditStatus.DRAFT,
    proposedValues: input.proposedValues,
    userNote: input.userNote,
  }).go();

  if (!result.data) {
    throw new ApplicationError(ErrorCode.DATABASE_ERROR, 'Failed to create draft edit');
  }

  return result.data;
}
```

### Submitting Edits for Review

```typescript
export async function submitEdit(editId: string, userId: string): Promise<Edit> {
  const edit = await getEditById(editId);

  if (!edit) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, `Edit ${editId} not found`);
  }

  if (edit.userId !== userId) {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      'You can only submit your own edits'
    );
  }

  if (edit.status !== EditStatus.DRAFT) {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      'Only draft edits can be submitted'
    );
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
```

### Approving Edits

```typescript
export async function approveEdit(editId: string, moderatorId: string): Promise<Edit> {
  const edit = await getEditById(editId);

  if (!edit) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, `Edit ${editId} not found`);
  }

  if (edit.status !== EditStatus.SUBMITTED) {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      'Only submitted edits can be approved'
    );
  }

  // Apply changes to the target entity
  const handler = await getHandler(edit.entityType as EditEntityType);
  await handler.updateEntity(edit.entityId, edit.proposedValues);

  // Mark edit as approved
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
```

### Rejecting Edits

```typescript
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
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      'Only submitted edits can be rejected'
    );
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
```

## Query Patterns

### Get User's Edits

```typescript
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
    order: 'desc', // Most recent first
  });

  let items = result.data || [];

  // Optional status filtering
  if (params.status) {
    items = items.filter(e => e.status === params.status);
  }

  return {
    items,
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}
```

### Get Pending Edits for Moderation

```typescript
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
    // Filter by both status and entity type
    query = EditEntity.query.byPendingType({
      status: EditStatus.SUBMITTED,
      entityType: params.entityType,
    });
  } else {
    // All pending edits
    query = EditEntity.query.byStatus({ status: EditStatus.SUBMITTED });
  }

  const result = await query.go({
    limit,
    cursor: params.nextToken,
    order: 'asc', // Oldest first (FIFO)
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}
```

### Get Entity's Edit History

```typescript
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
    order: 'desc', // Most recent first
  });

  let items = result.data || [];

  // Optional status filtering
  if (params.status) {
    items = items.filter(e => e.status === params.status);
  }

  return {
    items,
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}
```

## Advanced Features

### Conflict Detection

```typescript
export async function getActiveEditForEntity(
  userId: string,
  entityType: string,
  entityId: string
): Promise<Edit | null> {
  // Query entity's edit history
  const result = await EditEntity.query.byEntity({ entityType, entityId }).go({
    order: 'desc',
  });

  // Find user's active edits (DRAFT or SUBMITTED)
  const activeEdit = (result.data || []).find(
    edit =>
      edit.userId === userId &&
      (edit.status === EditStatus.DRAFT || edit.status === EditStatus.SUBMITTED)
  );

  return activeEdit || null;
}

// Usage: Prevent duplicate edits
export async function createDraftWithConflictCheck(input: EditInput): Promise<Edit> {
  // Check for existing active edit
  const existing = await getActiveEditForEntity(
    input.userId,
    input.entityType,
    input.entityId
  );

  if (existing) {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      `You already have an active ${existing.status.toLowerCase()} edit for this ${input.entityType}`
    );
  }

  return await createDraft(input);
}
```

### Diff Generation

```typescript
// packages/core/src/domain/edit/diff.ts
export interface DiffResult {
  added: Record<string, unknown>;
  modified: Record<string, { old: unknown; new: unknown }>;
  removed: Record<string, unknown>;
}

export function generateDiff(
  original: Record<string, unknown>,
  proposed: Record<string, unknown>
): DiffResult {
  const added: Record<string, unknown> = {};
  const modified: Record<string, { old: unknown; new: unknown }> = {};
  const removed: Record<string, unknown> = {};

  // Find added and modified fields
  for (const [key, newValue] of Object.entries(proposed)) {
    if (!(key in original)) {
      added[key] = newValue;
    } else if (JSON.stringify(original[key]) !== JSON.stringify(newValue)) {
      modified[key] = { old: original[key], new: newValue };
    }
  }

  // Find removed fields
  for (const [key, oldValue] of Object.entries(original)) {
    if (!(key in proposed)) {
      removed[key] = oldValue;
    }
  }

  return { added, modified, removed };
}

// Usage in UI
export async function getEditDiff(editId: string): Promise<DiffResult> {
  const edit = await getEditById(editId);
  if (!edit) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, 'Edit not found');
  }

  const handler = await getHandler(edit.entityType as EditEntityType);
  const entity = await handler.getEntity(edit.entityId);

  if (!entity) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, 'Entity not found');
  }

  return generateDiff(entity, edit.proposedValues as Record<string, unknown>);
}
```

### Batch Operations

```typescript
export async function approveBatch(
  editIds: string[],
  moderatorId: string
): Promise<{ succeeded: Edit[]; failed: Array<{ id: string; error: string }> }> {
  const succeeded: Edit[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const editId of editIds) {
    try {
      const approved = await approveEdit(editId, moderatorId);
      succeeded.push(approved);
    } catch (error) {
      failed.push({
        id: editId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { succeeded, failed };
}
```

## tRPC Integration

```typescript
// packages/trpc/src/routers/edit.ts
import { z } from 'zod';
import { Edit } from '@rasika/core';
import { protectedProcedure, moderatorProcedure, router } from '../trpc';

export const editRouter = router({
  // User operations
  createDraft: protectedProcedure
    .input(
      z.object({
        entityType: z.string(),
        entityId: z.string(),
        proposedValues: z.unknown(),
        userNote: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await Edit.createDraft({
        ...input,
        userId: ctx.user.id,
      });
    }),

  submitEdit: protectedProcedure
    .input(z.object({ editId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return await Edit.submitEdit(input.editId, ctx.user.id);
    }),

  getUserEdits: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
        status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN']).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await Edit.getUserEdits(ctx.user.id, input);
    }),

  // Moderator operations
  getPendingEdits: moderatorProcedure
    .input(
      z.object({
        entityType: z.string().optional(),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return await Edit.getPendingEdits(input);
    }),

  approveEdit: moderatorProcedure
    .input(z.object({ editId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return await Edit.approveEdit(input.editId, ctx.user.id);
    }),

  rejectEdit: moderatorProcedure
    .input(
      z.object({
        editId: z.string(),
        moderatorNote: z.string().min(10),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await Edit.rejectEdit(input.editId, ctx.user.id, input.moderatorNote);
    }),
});
```

## Frontend Integration

### Edit Form Component

```tsx
// packages/web/app/components/EditForm.tsx
import { trpc } from '~/lib/trpc';

export function EditForm({ entityType, entityId, currentData }) {
  const [proposedValues, setProposedValues] = useState(currentData);
  const [userNote, setUserNote] = useState('');

  const createDraft = trpc.edit.createDraft.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createDraft.mutateAsync({
      entityType,
      entityId,
      proposedValues,
      userNote,
    });

    // Redirect or show success
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Edit fields */}
      <textarea
        value={userNote}
        onChange={e => setUserNote(e.target.value)}
        placeholder="Explain your changes..."
      />
      <button type="submit">Save Draft</button>
    </form>
  );
}
```

### Moderation Queue

```tsx
// packages/web/app/routes/moderator.edits.tsx
export default function ModerationQueue() {
  const { data: pending } = trpc.edit.getPendingEdits.useQuery({ limit: 20 });
  const approveEdit = trpc.edit.approveEdit.useMutation();
  const rejectEdit = trpc.edit.rejectEdit.useMutation();

  return (
    <div>
      <h1>Pending Edits</h1>
      {pending?.items.map(edit => (
        <div key={edit.id}>
          <h3>{edit.entityType} - {edit.entityId}</h3>
          <p>{edit.userNote}</p>
          <button onClick={() => approveEdit.mutate({ editId: edit.id })}>
            Approve
          </button>
          <button onClick={() => {
            const note = prompt('Rejection reason:');
            if (note) rejectEdit.mutate({ editId: edit.id, moderatorNote: note });
          }}>
            Reject
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Best Practices

### 1. Validation at Multiple Layers
- **Schema validation**: Use Zod for structure validation
- **Business logic validation**: Check entity-specific rules
- **Authorization validation**: Verify user permissions

### 2. Clear Status Transitions
- **Draft → Submitted**: User submits for review
- **Submitted → Approved**: Moderator approves and applies changes
- **Submitted → Rejected**: Moderator rejects with explanation
- **Draft/Submitted → Withdrawn**: User cancels their edit

### 3. Comprehensive Error Messages
- Include entity context in error messages
- Provide actionable feedback for validation failures
- Log all state transitions for debugging

### 4. Performance Optimization
- Use appropriate GSI for each query pattern
- Implement pagination for all list operations
- Cache frequently accessed entity data

## Conclusion

A well-designed edit system enables collaborative content management while maintaining quality and accountability. By implementing a generic, extensible architecture with proper validation, moderation workflows, and change tracking, you can build platforms that scale with community contributions.

For the Rasika.life platform, this edit system provides the foundation for crowdsourced content curation, ensuring accuracy while encouraging participation from the classical arts community.

## Resources

- [Wikipedia: Edit Workflow](https://en.wikipedia.org/wiki/Wikipedia:Edit_requests)
- [Content Moderation Patterns](https://www.nngroup.com/articles/content-moderation/)
- [Collaborative Editing Systems](https://martinfowler.com/articles/patterns-of-distributed-systems/)
- [Change Tracking Strategies](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/implement-version-control-using-amazon-dynamodb.html)
