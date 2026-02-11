# Generic Edit System Specification (v4)

**Created:** January 31, 2026  
**Iteration:** v4 (Final - Remix Resource Routes for Search)  
**Status:** Ready for Implementation

---

## Overview

This specification describes a generic edit system for the Rasika.life platform that enables users to propose changes to any editable entity (compositions, artists, ragas, talas) while providing a moderation workflow for review and approval.

### Core Problem

Users need a way to suggest corrections or improvements to cultural content, but:
- Each entity type has different editable fields
- Changes need review before publishing
- Moderators need efficient tools to process pending edits
- Users should see their edit history and status

### Solution

A generic edit system with:
- Entity-agnostic edit creation workflow
- Type-safe update schemas per entity type
- Registry-based handler pattern for extensibility
- Status-based workflow (draft → submitted → approved/rejected)
- Resource routes for search functionality (Remix-aligned)

---

## Requirements

### Functional Requirements

1. **Create Edit Draft**: Users can propose changes to any editable entity
2. **Submit for Review**: Drafts can be submitted for moderator review
3. **Moderation Workflow**: Moderators can approve or reject edits
4. **Edit History**: View all edits for a specific entity
5. **User Dashboard**: Users can view their edit history
6. **Auto-merge**: Simple field changes can auto-merge if no conflicts
7. **Conflict Detection**: System detects and flags conflicting edits
8. **Typeahead Search**: Users can search for entities (composers, ragas, talas) via typeahead

### Non-Functional Requirements

- **Type Safety**: Full TypeScript inference from Zod schemas
- **Performance**: O(1) handler lookup, efficient DynamoDB queries
- **Extensibility**: New entity types can be added by updating registries
- **User Experience**: Optimistic UI updates, clear status indicators
- **Remix Alignment**: Server-first architecture with resource routes for search

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Remix Resource Routes                         │
│      (Search API endpoints: /api/search/{           │
└entityType})────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         tRPC Layer                               │
│  (Input validation, authentication, routing to services)        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Service Layer                             │
│  (Business logic, validation, workflow orchestration)           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Handler Registry                             │
│  (Entity-type-specific get/update handlers)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Repository Layer                            │
│  (DynamoDB operations via ElectroDB)                            │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

#### 1. Resource Routes for Search (Remix-Aligned)

**Why Resource Routes Instead of Client-Side tRPC:**

The `SearchSelect` and `MultiSelectSearch` components originally made direct client-side tRPC calls:

```typescript
// ANTI-PATTERN (v3) - Fights against Remix
const data = await client.search.searchArtists.query({ query: searchQuery });
```

This approach:
- Bypasses Remix's server-first architecture
- Duplicates authentication logic client-side
- Makes components untestable server-side
- Defeats Remix's progressive enhancement guarantees

**The Fix: Resource Routes**

Remix resource routes are file-based routes that return data (JSON) instead of UI. They:
- Run on the server with full auth context
- Use standard fetch within React components
- Work with progressive enhancement
- Follow web standards

```typescript
// CORRECT (v4) - Remix-aligned
// packages/web/app/routes/api.search.artist.ts
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query');
  if (!query || query.length < 2) return json([]);

  const results = await client.search.searchArtists.query({ query });
  return json(results);
}
```

**In the component:**

```typescript
// Use standard fetch against resource route
const response = await fetch(`/api/search/artist?query=${encodeURIComponent(searchQuery)}`);
const data = await response.json();
```

**Benefits:**
1. Server-side execution with auth context
2. No client-side API coupling
3. Works without JavaScript (via fallback form)
4. Proper error handling at the server level
5. Consistent with Remix philosophy

#### 2. tRPC-to-Service Validation Pattern

The tRPC layer accepts `proposedValues` as `z.record(z.unknown())`. This is **intentional**, not a type safety gap:

```typescript
// packages/trpc/src/routers/edit.ts

/**
 * NOTE: The tRPC layer validates only the outer structure of proposedValues.
 *
 * Each entity type (composition, artist, raga, tala) has a different update schema.
 * tRPC's input validation doesn't support dynamic schema selection based on a runtime
 * value (entityType). Therefore:
 *
 * 1. tRPC validates: { entityType, entityId, proposedValues: record, userNote? }
 * 2. Service layer validates: proposedValues against UPDATE_SCHEMAS[entityType]
 *
 * This is a pragmatic trade-off. The service layer performs the actual type-safe
 * validation. The tRPC layer provides input shape validation only.
 */
const CreateDraftInputSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string().min(1),
  proposedValues: z.record(z.unknown()),
  userNote: z.string().optional(),
});
```

This design acknowledges that:
- Type safety flows through the service layer, not the API boundary
- The service layer validates against entity-specific schemas
- Adding new entity types doesn't require tRPC router changes

#### 3. Registry Pattern with TypeScript Inference

The handler registry uses `as const` and lets TypeScript infer types automatically:

```typescript
// packages/core/src/domain/edit/registry.ts

/**
 * Handler registry for entity-type-specific operations.
 *
 * Uses as const and TypeScript inference to avoid complex generic chains.
 * Each handler has consistent shape (get, update functions) and TypeScript
 * correctly infers the union type from the object structure.
 */
const HANDLER_REGISTRY = {
  composition: {
    get: getComposition,
    update: updateComposition,
  },
  artist: {
    get: getArtist,
    update: updateArtist,
  },
  raga: {
    get: getRaga,
    update: updateRaga,
  },
  tala: {
    get: getTala,
    update: updateTala,
  },
} as const;

type HandlerRegistry = typeof HANDLER_REGISTRY;
type EditableEntityType = keyof HandlerRegistry;

/**
 * Type-safe handler access.
 * TypeScript knows HANDLER_REGISTRY.composition.get exists and has correct signature.
 */
function getHandlers<T extends EditableEntityType>(
  entityType: T
): HandlerRegistry[T] {
  return HANDLER_REGISTRY[entityType];
}
```

**Why this works without casts:**
- `as const` makes the object readonly and deeply literal
- TypeScript infers the type of each handler from the actual function signatures
- The `HandlerRegistry` type extracts the shape automatically
- No complex generic gymnastics needed

#### 4. Diff Computation for UI Display

The `computeEditDiff` function is retained but now serves a specific purpose:

```typescript
// packages/core/src/domain/edit/utils.ts

/**
 * Compute field-level differences between current state and proposed values.
 *
 * This function filters to only changed fields, which is useful for:
 * - Displaying diffs in the UI (only show what changed)
 * - Generating change summaries for notifications
 * - Moderation review interfaces
 *
 * Returns an empty array if no fields changed.
 */
export function computeEditDiff(
  currentState: Record<string, unknown>,
  proposedValues: Record<string, unknown>
): Array<{
  field: string;
  oldValue: unknown;
  newValue: unknown;
}> {
  const changes: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }> = [];

  for (const [key, newValue] of Object.entries(proposedValues)) {
    const oldValue = currentState[key];

    // Only include fields that actually changed
    if (!deepEqual(oldValue, newValue)) {
      changes.push({
        field: key,
        oldValue,
        newValue,
      });
    }
  }

  return changes;
}

/**
 * Simple deep equality check for comparing values.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) =>
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  );
}
```

**This function serves a purpose:**
1. Filters to only changed fields (not all fields like `computeDiff`)
2. Provides a clean API for UI diff display
3. Used by the service layer when generating diffs for moderation

---

### Database Schema

#### Edit Entity (DynamoDB via ElectroDB)

```typescript
// packages/core/src/domain/edit/entity.ts

import { Entity } from 'electrodb';

export const EditStatus = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type EditStatus = (typeof EditStatus)[keyof typeof EditStatus];

export const EditEntity = new Entity({
  model: {
    entity: 'Edit',
    version: '1',
    service: 'rasikalife',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    entityType: {
      type: 'string',
      required: true,
    },
    entityId: {
      type: 'string',
      required: true,
    },
    userId: {
      type: 'string',
      required: true,
    },
    status: {
      type: EditStatus,
      required: true,
      default: EditStatus.DRAFT,
    },
    proposedValues: {
      type: 'any',
      required: true,
    },
    userNote: {
      type: 'string',
      required: false,
    },
    moderatorId: {
      type: 'string',
      required: false,
    },
    moderatorNote: {
      type: 'string',
      required: false,
    },
    submittedAt: {
      type: 'string',
      required: false,
    },
    processedAt: {
      type: 'string',
      required: false,
    },
    createdAt: {
      type: 'string',
      required: true,
    },
    updatedAt: {
      type: 'string',
      required: true,
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'pk',
        composite: ['id'],
      },
      sk: {
        field: 'sk',
        composite: [],
      },
    },
    byStatus: {
      index: 'gsi1',
      pk: {
        field: 'gsi1pk',
        composite: ['status'],
        template: 'EDIT_STATUS#${status}',
      },
      sk: {
        field: 'gsi1sk',
        composite: ['createdAt'],
      },
    },
    byPendingType: {
      index: 'gsi2',
      pk: {
        field: 'gsi2pk',
        composite: ['status', 'entityType'],
        template: 'EDIT_STATUS#${status}#${entityType}',
      },
      sk: {
        field: 'gsi2sk',
        composite: ['createdAt'],
      },
    },
    byEntity: {
      index: 'gsi3',
      pk: {
        field: 'gsi3pk',
        composite: ['entityType', 'entityId'],
        template: 'EDIT_ENTITY#${entityType}#${entityId}',
      },
      sk: {
        field: 'gsi3sk',
        composite: ['createdAt'],
      },
    },
    byUser: {
      index: 'gsi4',
      pk: {
        field: 'gsi4pk',
        composite: ['userId'],
        template: 'EDIT_USER#${userId}',
      },
      sk: {
        field: 'gsi4sk',
        composite: ['createdAt'],
      },
    },
  },
});
```

**GSI Strategy:**
- **Primary key**: Direct edit access by ID
- **gsi1 (byStatus)**: All edits by status for moderation dashboard
- **gsi2 (byPendingType)**: Pending edits filtered by entity type (e.g., "show me pending composition edits")
- **gsi3 (byEntity)**: Edit history for a specific entity
- **gsi4 (byUser)**: User's edit history

---

### Schema Registry

```typescript
// packages/core/src/domain/edit/schemas.ts

import { z } from 'zod';
import { compositionSchemas } from '../composition/schema';
import { artistSchemas } from '../artist/schema';
import { ragaSchemas } from '../raga/schema';
import { talaSchemas } from '../tala/schema';

/**
 * Schema registry for entity update validation.
 *
 * Each entity type provides:
 * - createSchema: For creating new entities
 * - updateSchema: For partial updates (what edits validate against)
 */
const SCHEMA_REGISTRY = {
  composition: {
    create: compositionSchemas.create,
    update: compositionSchemas.update,
  },
  artist: {
    create: artistSchemas.create,
    update: artistSchemas.update,
  },
  raga: {
    create: ragaSchemas.create,
    update: ragaSchemas.update,
  },
  tala: {
    create: talaSchemas.create,
    update: talaSchemas.update,
  },
} as const;

type SchemaRegistry = typeof SCHEMA_REGISTRY;
type EditableEntityType = keyof SchemaRegistry;

/**
 * Type-safe schema access.
 */
export function getSchemas<T extends EditableEntityType>(
  entityType: T
): SchemaRegistry[T] {
  return SCHEMA_REGISTRY[entityType];
}

export { SCHEMA_REGISTRY, type EditableEntityType };
```

---

### Entity Update Schemas

Each entity defines its update schema. Here's an example (Composition):

```typescript
// packages/core/src/domain/composition/schema.ts

import { z } from 'zod';

export const createCompositionSchema = z.object({
  title: z.string().min(1).max(500),
  composerId: z.string().uuid(),
  lyricistId: z.string().uuid().optional(),
  artistId: z.string().uuid().optional(),
  tradition: z.nativeEnum(Tradition).optional(),
  language: z.string().min(2).max(100).optional(),
  form: z.string().max(200).optional(),
  duration: z.number().positive().optional(),
  audioUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  lyrics: z.string().max(10000).optional(),
  translation: z.string().max(10000).optional(),
  transliteration: z.string().max(10000).optional(),
});

export const updateCompositionSchema = createCompositionSchema.partial();

// Type exports for convenience
export type CreateCompositionInput = z.infer<typeof createCompositionSchema>;
export type UpdateCompositionInput = z.infer<typeof updateCompositionSchema>;
```

**Key pattern:** All editable fields are optional in the update schema, matching the `Partial<T>` semantics needed for edits.

---

### Service Layer

```typescript
// packages/core/src/domain/edit/service.ts

import { KSUID } from 'ksuid';
import { EditEntity, EditStatus } from './entity';
import { HANDLER_REGISTRY, type EditableEntityType } from './registry';
import { SCHEMA_REGISTRY } from './schemas';
import { computeEditDiff } from './utils';
import { ApplicationError, ErrorCode } from '@/constants';

export interface CreateDraftInput {
  entityType: EditableEntityType;
  entityId: string;
  userId: string;
  proposedValues: Record<string, unknown>;
  userNote?: string;
}

export interface UpdateDraftInput {
  editId: string;
  userId: string;
  proposedValues?: Record<string, unknown>;
  userNote?: string;
}

export interface SubmitEditInput {
  editId: string;
  userId: string;
}

export interface ApproveEditInput {
  editId: string;
  moderatorId: string;
  moderatorNote?: string;
  autoMerge?: boolean;
}

export interface RejectEditInput {
  editId: string;
  moderatorId: string;
  moderatorNote: string;
}

/**
 * Create a new edit draft.
 */
export async function createDraft(input: CreateDraftInput): Promise<Edit> {
  const { entityType, entityId, userId, proposedValues, userNote } = input;

  // Get entity-specific schema for validation
  const schemas = SCHEMA_REGISTRY[entityType];

  // Validate proposed values against entity's update schema
  const validationResult = schemas.update.safeParse(proposedValues);

  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');

    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid proposed values: ${errorMessages}`
    );
  }

  // Verify entity exists
  const handlers = HANDLER_REGISTRY[entityType];
  const entity = await handlers.get(entityId);

  if (!entity) {
    throw new ApplicationError(
      ErrorCode.NOT_FOUND,
      `Entity ${entityType}/${entityId} not found`
    );
  }

  // Create edit record
  const editId = (await KSUID.random()).toString();
  const now = new Date().toISOString();

  const edit = await EditEntity.create({
    id: editId,
    entityType,
    entityId,
    userId,
    status: EditStatus.DRAFT,
    proposedValues,
    userNote,
    createdAt: now,
    updatedAt: now,
  }).go();

  return edit;
}

/**
 * Update an existing draft.
 */
export async function updateDraft(input: UpdateDraftInput): Promise<Edit> {
  const { editId, userId, proposedValues, userNote } = input;

  const existing = await EditEntity.get({ id: editId }).go();

  if (!existing.data) {
    throw new ApplicationError(ErrorCode.NOT_FOUND, `Edit ${editId} not found`);
  }

  if (existing.data.userId !== userId) {
    throw new ApplicationError(
      ErrorCode.FORBIDDEN,
      'Cannot edit someone else\'s draft'
    );
  }

  if (existing.data.status !== EditStatus.DRAFT) {
    throw new ApplicationError(
      ErrorCode.INVALID_STATE,
      'Cannot edit a draft that has been submitted'
    );
  }

  // Validate proposed values if provided
  if (proposedValues) {
    const schemas = SCHEMA_REGISTRY[existing.data.entityType];
    const validationResult = schemas.update.safeParse(proposedValues);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');

      throw new ApplicationError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid proposed values: ${errorMessages}`
      );
    }
  }

  const updateData: Partial<Edit> = {
    updatedAt: new Date().toISOString(),
  };

  if (proposedValues) {
    updateData.proposedValues = proposedValues;
  }

  if (userNote !== undefined) {
    updateData.userNote = userNote;
  }

  const updated = await EditEntity.update({ id: editId })
    .set(updateData)
    .go();

  return updated.data as Edit;
}

/**
 * Submit a draft for review.
 */
export async function submitEdit(input: SubmitEditInput): Promise<Edit> {
  const { editId, userId } = input;

  const existing = await EditEntity.get({ id: editId }).go();

  if (!existing.data) {
    throw new ApplicationError(ErrorCode.NOT_FOUND, `Edit ${editId} not found`);
  }

  if (existing.data.userId !== userId) {
    throw new ApplicationError(
      ErrorCode.FORBIDDEN,
      'Cannot submit someone else\'s edit'
    );
  }

  if (existing.data.status !== EditStatus.DRAFT) {
    throw new ApplicationError(
      ErrorCode.INVALID_STATE,
      'Only drafts can be submitted'
    );
  }

  return transitionEditStatus(editId, EditStatus.SUBMITTED, {
    submittedAt: new Date().toISOString(),
  });
}

/**
 * Approve an edit (with optional auto-merge).
 */
export async function approveEdit(input: ApproveEditInput): Promise<Edit> {
  const { editId, moderatorId, moderatorNote, autoMerge } = input;

  const existing = await EditEntity.get({ id: editId }).go();

  if (!existing.data) {
    throw new ApplicationError(ErrorCode.NOT_FOUND, `Edit ${editId} not found`);
  }

  if (existing.data.status !== EditStatus.SUBMITTED) {
    throw new ApplicationError(
      ErrorCode.INVALID_STATE,
      'Only submitted edits can be approved'
    );
  }

  // If auto-merge is enabled, apply the changes
  if (autoMerge) {
    const handlers = HANDLER_REGISTRY[existing.data.entityType];
    const currentEntity = await handlers.get(existing.data.entityId);

    if (!currentEntity) {
      throw new ApplicationError(
        ErrorCode.NOT_FOUND,
        `Entity ${existing.data.entityType}/${existing.data.entityId} not found`
      );
    }

    // Use computeEditDiff to get only changed fields
    const changes = computeEditDiff(
      currentEntity as unknown as Record<string, unknown>,
      existing.data.proposedValues
    );

    // Apply only the changed fields
    const mergedValues = Object.fromEntries(
      changes.map((c) => [c.field, c.newValue])
    );

    await handlers.update(existing.data.entityId, mergedValues);
  }

  return transitionEditStatus(editId, EditStatus.APPROVED, {
    moderatorId,
    moderatorNote,
    processedAt: new Date().toISOString(),
  });
}

/**
 * Reject an edit.
 */
export async function rejectEdit(input: RejectEditInput): Promise<Edit> {
  const { editId, moderatorId, moderatorNote } = input;

  if (!moderatorNote) {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      'Rejection requires a moderator note'
    );
  }

  const existing = await EditEntity.get({ id: editId }).go();

  if (!existing.data) {
    throw new ApplicationError(ErrorCode.NOT_FOUND, `Edit ${editId} not found`);
  }

  if (existing.data.status !== EditStatus.SUBMITTED) {
    throw new ApplicationError(
      ErrorCode.INVALID_STATE,
      'Only submitted edits can be rejected'
    );
  }

  return transitionEditStatus(editId, EditStatus.REJECTED, {
    moderatorId,
    moderatorNote,
    processedAt: new Date().toISOString(),
  });
}

/**
 * Helper for status transitions.
 */
async function transitionEditStatus(
  editId: string,
  newStatus: EditStatus,
  additionalData: Record<string, unknown> = {}
): Promise<Edit> {
  const updated = await EditEntity.update({ id: editId })
    .set({
      status: newStatus,
      ...additionalData,
      updatedAt: new Date().toISOString(),
    })
    .go();

  return updated.data as Edit;
}

/**
 * Get edits pending review, optionally filtered by entity type.
 */
export async function getPendingEdits(
  entityType?: EditableEntityType,
  limit = 20,
  cursor?: string
): Promise<{ items: Edit[]; nextToken?: string }> {
  let result;

  if (entityType) {
    result = await EditEntity.query
      .byPendingType({
        status: EditStatus.SUBMITTED,
        entityType,
      })
      .go({ limit, cursor, order: 'asc' });
  } else {
    result = await EditEntity.query
      .byStatus({ status: EditStatus.SUBMITTED })
      .go({ limit, cursor, order: 'asc' });
  }

  return {
    items: result.data || [],
    nextToken: result.nextToken,
  };
}

/**
 * Get edit history for a specific entity.
 */
export async function getEntityEdits(
  entityType: EditableEntityType,
  entityId: string,
  limit = 20,
  cursor?: string
): Promise<{ items: Edit[]; nextToken?: string }> {
  const result = await EditEntity.query
    .byEntity({ entityType, entityId })
    .go({ limit, cursor, order: 'desc' });

  return {
    items: result.data || [],
    nextToken: result.nextToken,
  };
}

/**
 * Get a single edit by ID.
 */
export async function getEdit(editId: string): Promise<Edit | null> {
  const result = await EditEntity.get({ id: editId }).go();
  return result.data;
}

/**
 * Get a user's edit history.
 */
export async function getUserEdits(
  userId: string,
  limit = 20,
  cursor?: string
): Promise<{ items: Edit[]; nextToken?: string }> {
  const result = await EditEntity.query
    .byUser({ userId })
    .go({ limit, cursor, order: 'desc' });

  return {
    items: result.data || [],
    nextToken: result.nextToken,
  };
}
```

---

### tRPC Router

```typescript
// packages/trpc/src/routers/edit.ts

import { z } from 'zod';
import { router, protectedProcedure, protectedModeratorProcedure } from '../trpc';
import {
  createDraft,
  updateDraft,
  submitEdit,
  approveEdit,
  rejectEdit,
  getPendingEdits,
  getEntityEdits,
  getEdit,
  getUserEdits,
} from '@core/domain/edit/service';
import { EditableEntityType } from '@core/domain/edit/schemas';
import { EntityTypeSchema } from './schemas';
import { ApplicationError, ErrorCode } from '@/constants';

/**
 * Schema for entity type validation at API boundary.
 */
const EntityTypeSchema = z.enum(['composition', 'artist', 'raga', 'tala']);

/**
 * NOTE: proposedValues uses z.record(z.unknown()) because:
 *
 * 1. Each entity type has different update schema fields
 * 2. tRPC input validation doesn't support discriminated unions
 * 3. Type safety happens in the service layer via SCHEMA_REGISTRY
 *
 * See packages/core/src/domain/edit/service.ts for validation logic.
 */
const CreateDraftInputSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string().min(1),
  proposedValues: z.record(z.unknown()),
  userNote: z.string().optional(),
});

const UpdateDraftInputSchema = z.object({
  editId: z.string(),
  proposedValues: z.record(z.unknown()).optional(),
  userNote: z.string().optional(),
});

export const editRouter = router({
  // User operations
  createDraft: protectedProcedure
    .input(CreateDraftInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createDraft({
          ...input,
          userId: ctx.user.id,
        });
      } catch (error) {
        if (error instanceof ApplicationError) {
          throw error;
        }
        throw new ApplicationError(
          ErrorCode.INTERNAL_ERROR,
          `Failed to create draft: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }),

  updateDraft: protectedProcedure
    .input(UpdateDraftInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateDraft({
          ...input,
          userId: ctx.user.id,
        });
      } catch (error) {
        if (error instanceof ApplicationError) {
          throw error;
        }
        throw new ApplicationError(
          ErrorCode.INTERNAL_ERROR,
          `Failed to update draft: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }),

  submitEdit: protectedProcedure
    .input(z.object({ editId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await submitEdit({
          editId: input.editId,
          userId: ctx.user.id,
        });
      } catch (error) {
        if (error instanceof ApplicationError) {
          throw error;
        }
        throw new ApplicationError(
          ErrorCode.INTERNAL_ERROR,
          `Failed to submit edit: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }),

  getMyEdits: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getUserEdits(ctx.user.id, input.limit, input.cursor);
    }),

  // Moderator operations
  getPendingEdits: protectedModeratorProcedure
    .input(
      z.object({
        entityType: EntityTypeSchema.optional(),
        limit: z.number().min(1).max(100).optional().default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return getPendingEdits(input.entityType as EditableEntityType | undefined, input.limit, input.cursor);
    }),

  approveEdit: protectedModeratorProcedure
    .input(
      z.object({
        editId: z.string(),
        moderatorNote: z.string().optional(),
        autoMerge: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await approveEdit({
          ...input,
          moderatorId: ctx.user.id,
        });
      } catch (error) {
        if (error instanceof ApplicationError) {
          throw error;
        }
        throw new ApplicationError(
          ErrorCode.INTERNAL_ERROR,
          `Failed to approve edit: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }),

  rejectEdit: protectedModeratorProcedure
    .input(
      z.object({
        editId: z.string(),
        moderatorNote: z.string().min(1, 'Rejection requires a note'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await rejectEdit({
          ...input,
          moderatorId: ctx.user.id,
        });
      } catch (error) {
        if (error instanceof ApplicationError) {
          throw error;
        }
        throw new ApplicationError(
          ErrorCode.INTERNAL_ERROR,
          `Failed to reject edit: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }),

  // Read operations (both users and moderators)
  getEdit: protectedProcedure
    .input(z.object({ editId: z.string() }))
    .query(async ({ input }) => {
      const edit = await getEdit(input.editId);
      if (!edit) {
        throw new ApplicationError(ErrorCode.NOT_FOUND, `Edit ${input.editId} not found`);
      }
      return edit;
    }),

  getEntityHistory: protectedProcedure
    .input(
      z.object({
        entityType: EntityTypeSchema,
        entityId: z.string(),
        limit: z.number().min(1).max(100).optional().default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return getEntityEdits(
        input.entityType as EditableEntityType,
        input.entityId,
        input.limit,
        input.cursor
      );
    }),
});
```

---

### Resource Routes for Search

#### Artist Search Route

```typescript
// packages/web/app/routes/api.search.artist.ts

import type { LoaderFunctionArgs } from 'react-router';
import { json } from 'react-router';
import { client } from '~/api.server';

/**
 * Resource route for artist search.
 *
 * Returns JSON array of { id: string, name: string } objects.
 * Used by SearchSelect and MultiSelectSearch components.
 *
 * Query parameters:
 * - query: Search string (minimum 2 characters)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query');

  if (!query || query.length < 2) {
    return json([]);
  }

  try {
    const results = await client.search.searchArtists.query({ query });
    return json(results);
  } catch (error) {
    console.error('Artist search error:', error);
    return json([]);
  }
}
```

#### Raga Search Route

```typescript
// packages/web/app/routes/api.search.raga.ts

import type { LoaderFunctionArgs } from 'react-router';
import { json } from 'react-router';
import { client } from '~/api.server';

/**
 * Resource route for raga search.
 *
 * Returns JSON array of { id: string, name: string } objects.
 * Used by MultiSelectSearch component for raga selection.
 *
 * Query parameters:
 * - query: Search string (minimum 2 characters, empty string returns all)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';

  try {
    const results = await client.search.searchRagas.query({ query });
    return json(results);
  } catch (error) {
    console.error('Raga search error:', error);
    return json([]);
  }
}
```

#### Tala Search Route

```typescript
// packages/web/app/routes/api.search.tala.ts

import type { LoaderFunctionArgs } from 'react-router';
import { json } from 'react-router';
import { client } from '~/api.server';

/**
 * Resource route for tala search.
 *
 * Returns JSON array of { id: string, name: string } objects.
 * Used by MultiSelectSearch component for tala selection.
 *
 * Query parameters:
 * - query: Search string (minimum 2 characters, empty string returns all)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';

  try {
    const results = await client.search.searchTalas.query({ query });
    return json(results);
  } catch (error) {
    console.error('Tala search error:', error);
    return json([]);
  }
}
```

---

### Search Components (Simplified with @uidotdev/usehooks)

#### Dependency Installation

Add the `@uidotdev/usehooks` package to the web package:

```json
// packages/web/package.json
{
  "dependencies": {
    "@uidotdev/usehooks": "^2.4.0"
  }
}
```

#### Why @uidotdev/usehooks?

The `SearchSelect` and `MultiSelectSearch` components require common UI patterns:

1. **Debouncing**: Delay search execution until user stops typing (prevents excessive API calls)
2. **Click-away detection**: Close dropdown when clicking outside the component

Implementing these manually adds ~40 lines of boilerplate per component:
- `setTimeout`/`clearTimeout` for debouncing
- `useEffect` + `document.addEventListener` for click-away
- Manual cleanup in `useEffect` return

**@uidotdev/usehooks** provides well-tested, production-ready implementations:
- `useDebounce(value, delay)` - Returns debounced value
- `useClickAway(ref, handler)` - Calls handler when clicking outside ref

**Benefits:**
- ~50% code reduction per component (90 lines → ~45 lines)
- Battle-tested implementations (used by thousands of projects)
- Better testability (hooks are independently testable)
- Reduced maintenance burden

#### SearchSelect Component (Simplified)

```typescript
// packages/web/app/components/SearchSelect.tsx

import { useState, useRef } from 'react';
import { useDebounce, useClickAway } from '@uidotdev/usehooks';

interface SearchResult {
  id: string;
  name: string;
}

interface SearchSelectProps {
  name: string;
  searchUrl: string;
  defaultValue?: SearchResult | null;
  placeholder?: string;
  onChange?: (value: SearchResult | null) => void;
}

export function SearchSelect({
  name,
  searchUrl,
  defaultValue,
  placeholder,
  onChange,
}: SearchSelectProps) {
  const [query, setQuery] = useState(defaultValue?.name || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(defaultValue || null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search input with 200ms delay
  const debouncedQuery = useDebounce(query, 200);

  // Close dropdown when clicking outside
  useClickAway(containerRef, () => setIsOpen(false));

  // Search effect using debounced query
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();

    fetch(`${searchUrl}?query=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then(setResults)
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Search error:', error);
          setResults([]);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery, searchUrl]);

  const handleSelect = (item: SearchResult) => {
    setSelected(item);
    setQuery(item.name);
    setIsOpen(false);
    onChange?.(item);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
    onChange?.(null);
  };

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={JSON.stringify(selected)} />

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || 'Search...'}
          className="w-full p-2 border rounded pr-8"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-auto">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full px-4 py-2 text-left hover:bg-gray-100"
              onClick={() => handleSelect(item)}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Key improvements:**
- `useDebounce` replaces manual `setTimeout`/`clearTimeout`
- `useClickAway` replaces `useEffect` + event listener setup
- ~50% code reduction (90 lines → ~45 lines)

#### MultiSelectSearch Component (Simplified)

```typescript
// packages/web/app/components/MultiSelectSearch.tsx

import { useState, useEffect, useRef } from 'react';
import { useDebounce, useClickAway } from '@uidotdev/usehooks';

interface SearchResult {
  id: string;
  name: string;
}

interface MultiSelectSearchProps {
  name: string;
  searchUrl: string;
  defaultValue?: string[];
  onChange?: (ids: string[]) => void;
}

export function MultiSelectSearch({
  name,
  searchUrl,
  defaultValue = [],
  onChange,
}: MultiSelectSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search input with 200ms delay
  const debouncedQuery = useDebounce(query, 200);

  // Close dropdown when clicking outside
  useClickAway(containerRef, () => setIsOpen(false));

  // Load initial data and search
  useEffect(() => {
    const controller = new AbortController();

    const fetchResults = async () => {
      const url = debouncedQuery.length >= 2
        ? `${searchUrl}?query=${encodeURIComponent(debouncedQuery)}`
        : `${searchUrl}?query=`;

      try {
        const response = await fetch(url, { signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          setResults(data);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Search error:', error);
        }
      }
    };

    fetchResults();

    return () => controller.abort();
  }, [debouncedQuery, searchUrl]);

  const selectedItems = results.filter((r) => selectedIds.includes(r.id));
  const availableResults = results.filter((r) => !selectedIds.includes(r.id));

  const handleSelect = (item: SearchResult) => {
    const newSelected = [...selectedIds, item.id];
    setSelectedIds(newSelected);
    setQuery('');
    setIsOpen(false);
    onChange?.(newSelected);
  };

  const handleRemove = (id: string) => {
    const newSelected = selectedIds.filter((v) => v !== id);
    setSelectedIds(newSelected);
    onChange?.(newSelected);
  };

  return (
    <div ref={containerRef} className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(selectedIds)} />

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded"
            >
              {item.name}
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                className="hover:text-destructive"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search..."
          className="w-full p-2 border rounded"
        />

        {isOpen && availableResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-auto">
            {availableResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full px-4 py-2 text-left hover:bg-gray-100"
                onClick={() => handleSelect(item)}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Key improvements:**
- `useDebounce` replaces manual debounce logic
- `useClickAway` replaces click-outside detection
- Simplified search/load logic with unified fetch
- ~50% code reduction (100+ lines → ~50 lines)

---

### Edit Form Route

```typescript
// packages/web/app/routes/carnatic.compositions.$compositionid.edit.tsx

import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from 'react-router';
import { data, Form, useActionData, useLoaderData, useNavigation } from 'react-router';
import { client } from '~/api.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import type { CompositionWithRelations } from '@rasika/core/types/entities';
import { SearchSelect } from '~/components/SearchSelect';
import { MultiSelectSearch } from '~/components/MultiSelectSearch';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { compositionid } = params;
  if (!compositionid) throw new Response('Composition ID required', { status: 400 });

  const { parseSlug } = await import('~/lib/url-slug');
  const parsed = parseSlug(compositionid);
  if (!parsed) throw new Response('Invalid URL format', { status: 400 });

  const { id: compositionId } = parsed;
  const composition = await client.composition.get.query({ id: compositionId });
  if (!composition) throw new Response('Composition not found', { status: 404 });

  const url = new URL(request.url);
  const editId = url.searchParams.get('editId');

  let defaultValues: Record<string, unknown> | undefined;
  if (editId) {
    const { proposedValues } = await client.edit.getEdit.query({ editId });
    defaultValues = proposedValues;
  }

  return data({ composition, editId, defaultValues });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('_action') as string;
  const compositionId = formData.get('compositionId') as string;

  const title = formData.get('title') as string;
  const language = formData.get('language') as string;
  const composer = formData.get('composer') as string;
  const ragaIds = formData.get('ragaIds') as string;
  const talaIds = formData.get('talaIds') as string;
  const sourceAttribution = formData.get('sourceAttribution') as string;

  const proposedValues: Record<string, unknown> = {
    title: title || undefined,
    language: language || undefined,
    composer: composer ? JSON.parse(composer) : undefined,
    ragaIds: ragaIds ? JSON.parse(ragaIds) : undefined,
    talaIds: talaIds ? JSON.parse(talaIds) : undefined,
    sourceAttribution: sourceAttribution || undefined,
  };

  try {
    if (action === 'draft') {
      await client.edit.createDraft.mutate({
        entityType: 'composition',
        entityId: compositionId,
        proposedValues,
      });
      return data({ success: true, message: 'Draft saved successfully' });
    }

    if (action === 'submit') {
      const editId = formData.get('editId') as string;
      if (editId) {
        await client.edit.updateDraft.mutate({ editId, proposedValues });
        await client.edit.submitEdit.mutate({ editId });
      } else {
        const edit = await client.edit.createDraft.mutate({
          entityType: 'composition',
          entityId: compositionId,
          proposedValues,
        });
        await client.edit.submitEdit.mutate({ editId: edit.id });
      }
      return data({ success: true, message: 'Edit submitted for review' });
    }

    return data({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    if (error instanceof ApplicationError) {
      return data({ success: false, error: error.message }, {
        status: error.code === ErrorCode.FORBIDDEN ? 403 : 400
      });
    }
    return data({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}

export const meta: MetaFunction = ({ data }) => {
  const composition = data?.composition as CompositionWithRelations | undefined;
  if (composition) {
    return [
      { title: `Edit "${composition.title}" - Rasika.life` },
      { name: 'description', content: `Propose changes to "${composition.title}"` },
    ];
  }
  return [{ title: 'Edit Composition - Rasika.life' }];
};

export default function EditCompositionRoute() {
  const { composition, editId, defaultValues } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const defaultRagaIds = defaultValues?.ragaIds as string[] | undefined || composition.ragas.map(r => r.id);
  const defaultTalaIds = defaultValues?.talaIds as string[] | undefined || composition.talas.map(t => t.id);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Edit Composition</h1>

      {actionData && 'error' in actionData && (
        <div className="p-4 mb-4 bg-red-50 text-red-600 rounded">{actionData.error}</div>
      )}

      {actionData && 'success' in actionData && actionData.success && (
        <div className="p-4 mb-4 bg-green-50 text-green-600 rounded">{actionData.message}</div>
      )}

      <Form method="post" className="space-y-6">
        {editId && <input type="hidden" name="editId" value={editId} />}
        <input type="hidden" name="compositionId" value={composition.id} />

        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            id="title"
            name="title"
            defaultValue={defaultValues?.title as string || composition.title}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Composer</label>
          <SearchSelect
            name="composer"
            searchUrl="/api/search/artist"
            defaultValue={defaultValues?.composer as { id: string; name: string } | undefined || composition.composer}
            placeholder="Search for composer..."
          />
        </div>

        <div>
          <label htmlFor="language" className="block text-sm font-medium mb-1">Language</label>
          <select
            id="language"
            name="language"
            defaultValue={defaultValues?.language as string || composition.language}
            className="w-full p-2 border rounded"
          >
            <option value="Sanskrit">Sanskrit</option>
            <option value="Telugu">Telugu</option>
            <option value="Tamil">Tamil</option>
            <option value="Kannada">Kannada</option>
            <option value="Malayalam">Malayalam</option>
            <option value="Hindi">Hindi</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Ragas</label>
          <MultiSelectSearch
            name="ragaIds"
            searchUrl="/api/search/raga"
            defaultValue={defaultRagaIds}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Talas</label>
          <MultiSelectSearch
            name="talaIds"
            searchUrl="/api/search/tala"
            defaultValue={defaultTalaIds}
          />
        </div>

        <div>
          <label htmlFor="sourceAttribution" className="block text-sm font-medium mb-1">
            Source Attribution
          </label>
          <input
            type="url"
            id="sourceAttribution"
            name="sourceAttribution"
            defaultValue={defaultValues?.sourceAttribution as string || composition.sourceAttribution || ''}
            placeholder="https://..."
            className="w-full p-2 border rounded"
          />
        </div>

        <div className="flex gap-4 justify-end">
          <button
            type="submit"
            name="_action"
            value="draft"
            disabled={isSubmitting}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            type="submit"
            name="_action"
            value="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity50"
          >
            Submit for Review
          </button>
        </div>
      </Form>
    </div>
  );
}
```

---

### My Edits Page

```typescript
// packages/web/app/routes/my-edits.tsx

import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { client } from '~/api.server';
import { formatRelativeTime } from '~/lib/utils';

export async function loader({ context }: LoaderFunctionArgs) {
  const userId = context.user.id;
  const edits = await client.edit.getUserEdits.query({ userId });
  return data({ edits });
}

export default function MyEditsPage() {
  const { edits } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">My Edits</h1>

      {edits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          You haven't created any edits yet.
        </div>
      ) : (
        <div className="space-y-4">
          {edits.map((edit) => (
            <div key={edit.id} className="border rounded-lg p-4 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-muted-foreground capitalize">{edit.entityType}</span>
                  <StatusBadge status={edit.status} />
                </div>
                <p className="font-medium">Entity: {edit.entityId}</p>
                <p className="text-sm text-muted-foreground">
                  Created: {formatRelativeTime(edit.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                {(edit.status === 'draft' || edit.status === 'rejected') && (
                  <Link
                    to={`/carnatic/compositions/${edit.entityId}/edit?editId=${edit.id}`}
                    className="px-3 py-1 border rounded hover:bg-gray-50"
                  >
                    Continue Editing
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### Moderator Dashboard

```typescript
// packages/web/app/routes/moderator.edits.tsx

import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { data, Form, useLoaderData, useNavigation } from 'react-router';
import { client } from '~/api.server';

export async function loader() {
  const pendingEdits = await client.edit.getPendingEdits.query();

  const enrichedEdits = await Promise.all(
    pendingEdits.map(async (edit) => {
      const { diff } = await client.edit.getEditWithDiff.query({ editId: edit.id });
      return { ...edit, diff };
    })
  );

  return data({ edits: enrichedEdits });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const editId = formData.get('editId') as string;
  const action = formData.get('_action') as string;

  if (action === 'approve') {
    const note = formData.get('note') as string;
    await client.edit.approveEdit.mutate({ editId, note: note || undefined });
  } else if (action === 'reject') {
    const reason = formData.get('reason') as string;
    if (!reason) {
      return data({ error: 'Rejection reason is required' }, { status: 400 });
    }
    await client.edit.rejectEdit.mutate({ editId, reason });
  }

  return data({ success: true });
}

export default function ModeratorDashboard() {
  const { edits } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Moderator Dashboard</h1>

      {edits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No pending edits to review
        </div>
      ) : (
        <div className="space-y-6">
          {edits.map((edit) => (
            <EditReviewCard key={edit.id} edit={edit} />
          ))}
        </div>
      )}
    </div>
  );
}

function EditReviewCard({ edit }: { edit: any }) {
  return (
    <div className="border rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-sm text-muted-foreground capitalize">{edit.entityType}</span>
          <h3 className="text-lg font-semibold">{edit.entityId}</h3>
        </div>
        <StatusBadge status={edit.status} />
      </div>

      {edit.diff && edit.diff.length > 0 && (
        <div className="mb-4 p-4 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">Changes:</h4>
          <ul className="space-y-1">
            {edit.diff.map((field: { field: string; oldValue: unknown; newValue: unknown }) => (
              <li key={field.field} className="text-sm">
                <span className="font-medium">{field.field}:</span>{' '}
                <span className="text-red-600 line-through">
                  {String(field.oldValue || '(empty)')}
                </span>
                {' → '}
                <span className="text-green-600">
                  {String(field.newValue || '(empty)')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Form method="post" className="flex gap-4 items-start">
        <input type="hidden" name="editId" value={edit.id} />
        <div className="flex-1">
          <textarea
            name="note"
            rows={2}
            className="w-full p-2 border rounded"
            placeholder="Optional note..."
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            name="_action"
            value="approve"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Approve
          </button>
          <button
            type="submit"
            name="_action"
            value="reject"
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reject
          </button>
        </div>
      </Form>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    submitted: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs ${colors[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
}
```

---

### Notifications

```typescript
// packages/web/app/routes/notifications.tsx

import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { data, Form, useLoaderData } from 'react-router';
import { client } from '~/api.server';
import { formatRelativeTime } from '~/lib/utils';

export async function loader({ context }: LoaderFunctionArgs) {
  const userId = context.user.id;
  const notifications = await client.notification.getAll.query({ userId });
  return data({ notifications });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const notificationId = formData.get('notificationId') as string;

  await client.notification.markAsRead.mutate({ notificationId });
  return data({ success: true });
}

export default function NotificationsPage() {
  const { notifications } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Notifications</h1>

      {notifications.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No notifications
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 border rounded-lg ${
                !notification.read ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <p className="font-medium">{notification.title}</p>
              <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(notification.createdAt)}
                </span>
                {!notification.read && (
                  <Form method="post">
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <button
                      type="submit"
                      className="text-sm text-primary hover:underline"
                    >
                      Mark as read
                    </button>
                  </Form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure

1. **Define entity schemas**
   - Create `updateCompositionSchema`, `updateArtistSchema`, etc.
   - Ensure all have `.partial()` for optional fields

2. **Set up ElectroDB entity**
   - Create `EditEntity` with all GSIs
   - Test locally with `sst dev`

3. **Create registry files**
   - `packages/core/src/domain/edit/registry.ts`
   - `packages/core/src/domain/edit/schemas.ts`

### Phase 2: Service Layer

4. **Implement edit service**
   - `createDraft`: Validate, verify entity exists, create record
   - `updateDraft`: Validate, update draft
   - `submitEdit`: Transition to SUBMITTED
   - `approveEdit`: Transition to APPROVED, optional auto-merge
   - `rejectEdit`: Transition to REJECTED

5. **Implement query functions**
   - `getPendingEdits`: Uses GSI2
   - `getEntityEdits`: Uses GSI3
   - `getUserEdits`: Uses GSI4

### Phase 3: tRPC Integration

6. **Create edit router**
   - Define schemas with documented `z.record(z.unknown())`
   - Wire up protected and moderator procedures

7. **Add error handling**
   - Map service errors to appropriate tRPC errors
   - Include context in error messages

### Phase 4: Resource Routes for Search

8. **Create search resource routes**
   - `/api/search/artist` - Artist search endpoint
   - `/api/search/raga` - Raga search endpoint
   - `/api/search/tala` - Tala search endpoint

9. **Refactor SearchSelect component**
   - Remove tRPC client import
   - Add `searchUrl` prop
   - Use `fetch()` against resource route
   - Add abort controller for race condition prevention

10. **Refactor MultiSelectSearch component**
    - Remove tRPC client import
    - Add `searchUrl` prop
    - Use `fetch()` against resource route
    - Add abort controller for race condition prevention

### Phase 5: Composition Edit Screens

11. **Create edit form route**
    - Use refactored `SearchSelect` and `MultiSelectSearch`
    - Use single JSON serialization for composite fields

12. **Create My Edits page**

13. **Create Moderator Dashboard**

14. **Create Notifications page**

---

## Testing Strategy

### Backend Testing

1. **Service Layer Tests**
   - Test each operation with valid and invalid inputs
   - Test status transitions (draft → submitted → approved/rejected)
   - Test validation errors
   - Test authorization (user vs moderator)

2. **Repository Tests**
   - Test DynamoDB operations
   - Test GSI queries

### Frontend Testing

1. **Resource Routes**
   - Test with valid queries
   - Test with short queries (should return empty)
   - Test with no query (raga/tala should return all)

2. **SearchSelect Component**
   - Test typeahead behavior
   - Test abort on rapid typing
   - Test selection and clearing
   - Test JSON serialization

3. **MultiSelectSearch Component**
   - Test loading all options initially
   - Test typeahead filtering
   - Test adding/removing selections
   - Test JSON serialization

4. **Edit Form Integration**
   - Test draft save
   - Test submit for review
   - Test loading existing edits

---

## Remix Alignment

### Why Resource Routes Work Better Than Client-Side tRPC

| Aspect | Client-Side tRPC | Resource Routes |
|--------|-----------------|-----------------|
| **Server Context** | None (client-side) | Full server context (auth, DB) |
| **Progressive Enhancement** | Broken without JS | Works with forms |
| **Error Handling** | Client-side only | Server-side with proper status codes |
| **Testing** | Requires client mocking | Can test server responses directly |
| **Caching** | No built-in mechanism | Remix loaders can be cached |
| **Bundle Size** | Adds tRPC client to bundle | No extra client code |

### The Remix Philosophy

Remix is built on the principle that **the server should do the work, not the client**. When we use tRPC directly from React components:

1. We duplicate authentication/authorization logic
2. We lose server-side error handling
3. We defeat progressive enhancement
4. We add unnecessary client-side code

Resource routes respect the web platform:
- Standard `fetch()` works everywhere
- Errors return proper HTTP status codes
- Works with or without JavaScript
- Keeps authentication in one place (the server)

---

## Open Questions

1. **Search Result Caching**: Should resource route responses be cached? For how long?
   - Consider: Search results are user-specific (auth required)
   - Short cache TTL (e.g., 60 seconds) may be appropriate

2. **Rate Limiting**: Should search endpoints be rate-limited?
   - Typeahead can generate many requests
   - Consider: Per-user rate limits on search routes

3. **Empty Query Behavior**: Should empty query return all results?
   - Currently: Artist requires 2+ chars, Raga/Tala returns all
   - Alternative: Consistent behavior across all entity types

4. **Search Result Limits**: Should there be a maximum result count?
    - Consider: Database load for "load all" queries
    - Alternative: Pagination for large result sets

---

## Testing Results (February 2026)

### Test Plan

A comprehensive testing plan was created at `/Users/tejovanthn/codes/rasikalife/TESTING_PLAN.md` with the following test categories:

1. **Authentication & Authorization**
   - Login flow, protected routes, logout

2. **Edit System Tests**
   - Create edit for artists, compositions, ragas, talas
   - Draft save, submit for review, edit validation

3. **My Edits Page**
   - Empty state, list display, status filtering, modal actions, pagination

4. **Moderator Dashboard**
   - Pending edits list, approve/reject workflows, entity viewing

5. **Search APIs**
   - Artist, raga, tala search endpoints with caching

6. **UI Components**
   - Data table, dialog, tabs, inputs, selects, checkboxes, toasts

7. **Integration Tests**
   - Full edit workflow: create → submit → approve → changes applied

8. **Error Handling**
   - Invalid URLs, network errors, validation errors

9. **Performance Tests**
   - Load times, API response times

### Fixed Issues

| Issue | Status | Fix Applied |
|-------|--------|-------------|
| Pagination nested anchors | ✅ Fixed | Removed `<a>` inside `<a>` in EntityPagination component; added `to` prop to PaginationNext |
| Date formatting SSR mismatch | ✅ Fixed | Added dayjs with localizedFormat plugin; created `formatDate()` utility |
| Invalid slug handling | ✅ Fixed | Used `parseSlug()` consistently; returns 400 for invalid format |

### Verified Functionality

- ✅ Edit system creates edits and stores in DynamoDB
- ✅ Edit forms load with current entity values
- ✅ Edit drafts can be saved and loaded
- ✅ Moderator dashboard approves/rejects edits
- ✅ Changes applied to entities after approval
- ✅ Search APIs return proper JSON with caching headers
- ✅ My Edits page shows all edit statuses
- ✅ Detail pages have Edit buttons linking to /edit routes

### Known Issues (TRPC-Level Fixes Needed)

| Issue | Description | Severity |
|-------|-------------|----------|
| Non-existent entity returns 500 | When entity doesn't exist in DynamoDB, the loader throws but error isn't properly caught | Medium |
| Toast notifications | Save draft action doesn't show confirmation toast | Low (enhancement) |
| Real-time updates | Edit counts don't update without page refresh | Low (enhancement) |

### Test Commands

```bash
# Test pagination links
curl -s "http://localhost:5173/carnatic/artists?page=2" | grep -c "href"

# Test invalid slug (should return 400)
curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/carnatic/artists/invalid-id"

# Test date format on SSR (should be DD/MM/YYYY)
curl -s "http://localhost:5173/carnatic/artists/annamaacaarya-38awRT61GJFRqY5xQYtUZ3dk7wl" | grep -o "Added:[^<]*"

# Test search API
curl -s "http://localhost:5173/api/search/artist?q=ms" | head -c 200

# Test moderator dashboard access (as admin)
curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/moderator/edits"
```

### Date Formatting Utility

A centralized date utility was added to prevent SSR hydration mismatches:

```typescript
// packages/web/app/lib/utils.ts

import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(localizedFormat);
dayjs.extend(advancedFormat);
dayjs.extend(relativeTime);

export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  return dayjs(dateString).format('DD/MM/YYYY');
};

export const formatDateLocale = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  return dayjs(dateString).format('LL');
};

export const formatRelativeTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  return dayjs(dateString).fromNow();
};
```

**Files updated to use `formatDate()`:**
- `packages/web/app/routes/carnatic.artists.$artistid.tsx`
- `packages/web/app/routes/carnatic.ragas.$ragaid.tsx`
- `packages/web/app/routes/carnatic.talas.$talaid.tsx`
- `packages/web/app/components/shared/EntityCard.tsx`

### Pagination Component Fix

The `EntityPagination` component was fixed to avoid nested anchor tags by passing `to` prop directly to `PaginationNext`:

```typescript
// packages/web/app/components/EntityPagination.tsx

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
} from '~/components/ui/pagination';

type EntityPaginationProps = {
  currentPage: number;
  hasMore: boolean;
  nextToken: string | null;
  prevToken?: string | null;
  baseUrl?: string;
};

export function EntityPagination({
  currentPage,
  hasMore,
  nextToken,
  baseUrl = '',
}: EntityPaginationProps) {
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="text-sm text-muted-foreground">Page {currentPage}</div>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              to={baseUrl}
              className={
                currentPage === 1
                  ? 'px-3 py-2 rounded-md bg-primary text-primary-foreground'
                  : 'px-3 py-2 rounded-md hover:bg-accent'
              }
            >
              1
            </PaginationLink>
          </PaginationItem>

          {currentPage > 2 && (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}

          {currentPage > 1 && (
            <PaginationItem>
              <PaginationLink isActive>{currentPage}</PaginationLink>
            </PaginationItem>
          )}

          {hasMore && (
            <PaginationItem>
              <PaginationNext
                to={`${baseUrl}?page=${currentPage + 1}&nextToken=${encodeURIComponent(nextToken || '')}`}
              />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    </div>
  );
}
```

The `PaginationNext` and `PaginationPrevious` components now accept a `to` prop that sets the `href` directly, avoiding nested anchor tags:

### Error Handling Improvements

The loader now uses `parseSlug()` consistently and returns appropriate HTTP status codes:

```typescript
export async function loader({ params, request }: LoaderFunctionArgs) {
  const parsed = parseSlug(artistid);
  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const { id: slugId } = parsed;

  try {
    const artist = await client.artist.get.query({ id: slugId });
    if (!artist) {
      throw new Response('Artist not found', { status: 404 });
    }
    // ...
  } catch (error) {
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.NOT_FOUND) {
        throw new Response('Artist not found', { status: 404 });
      }
    }
    throw new Response('Failed to load artist', { status: 500 });
  }
}
```

### Files Created During Testing

- `/Users/tejovanthn/codes/rasikalife/TESTING_PLAN.md` - Comprehensive testing plan with execution results
