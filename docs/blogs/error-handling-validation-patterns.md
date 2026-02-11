# Error Handling and Validation Patterns

## Introduction

Building robust applications requires comprehensive error handling and validation. This document covers our approach to error handling using custom error classes, Zod-based validation, and consistent error response patterns across the entire stack.

**Related ADRs:**
- [ADR-003: tRPC v11 for Type-Safe APIs](../adrs/adr-003-trpc-v11-type-safe-api.md)
- [ADR-009: Overall Architecture Patterns](../adrs/adr-009-overall-architecture-patterns.md)

## Error Architecture

### Error Codes

```typescript
export enum ErrorCode {
  ARTIST_NOT_FOUND = 'ARTIST_NOT_FOUND',
  COMPOSITION_NOT_FOUND = 'COMPOSITION_NOT_FOUND',
  RAGA_NOT_FOUND = 'RAGA_NOT_FOUND',
  TALA_NOT_FOUND = 'TALA_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  ARTIST_FETCH_FAILED = 'ARTIST_FETCH_FAILED',
  ARTIST_CREATE_FAILED = 'ARTIST_CREATE_FAILED',
  ARTIST_UPDATE_FAILED = 'ARTIST_UPDATE_FAILED',
  RAGA_CREATE_FAILED = 'RAGA_CREATE_FAILED',
  RAGA_UPDATE_FAILED = 'RAGA_UPDATE_FAILED',
  TALA_CREATE_FAILED = 'TALA_CREATE_FAILED',
  TALA_UPDATE_FAILED = 'TALA_UPDATE_FAILED',
  USER_CREATE_FAILED = 'USER_CREATE_FAILED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SEARCH_INDEX_ERROR = 'SEARCH_INDEX_ERROR',
  SEARCH_INDEX_BUILD_FAILED = 'SEARCH_INDEX_BUILD_FAILED',
  SEARCH_QUERY_FAILED = 'SEARCH_QUERY_FAILED',
}
```

### Application Error Class

```typescript
export class ApplicationError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}
```

### Error Helper Functions

```typescript
export function notFoundError(entity: string, id: string): ApplicationError {
  const code = `${entity.toUpperCase()}_NOT_FOUND` as ErrorCode;
  return new ApplicationError(code, `${entity} with ID ${id} not found`);
}

export function createFailedError(entity: string, name: string): ApplicationError {
  const code = `${entity.toUpperCase()}_CREATE_FAILED` as ErrorCode;
  return new ApplicationError(code, `Failed to create ${entity}: ${name}`);
}

export function updateFailedError(entity: string, id: string): ApplicationError {
  const code = `${entity.toUpperCase()}_UPDATE_FAILED` as ErrorCode;
  return new ApplicationError(code, `${entity} with ID ${id} update failed`);
}
```

## Validation with Zod

### Schema Definitions

```typescript
import { z } from 'zod';

export const CreateArtistSchema = z.object({
  name: z.string().min(1).max(100),
});

export const UpdateArtistSchema = CreateArtistSchema.partial();
```

### Type Inference

```typescript
export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;
export type UpdateArtistInput = z.infer<typeof UpdateArtistSchema>;
```

## Usage Patterns

### In Domain Functions

```typescript
import { notFoundError, createFailedError } from '../helpers';
import { generateId } from '../../utils';
import { ArtistEntity } from './entity';
import type { Artist } from './entity';
import type { CreateArtistSchema, UpdateArtistSchema } from './schema';

export async function createArtist(input: CreateArtistInput): Promise<Artist> {
  const id = generateId();
  const result = await ArtistEntity.create({
    id,
    ...input,
  }).go();

  if (!result.data) {
    throw createFailedError('artist', input.name);
  }

  return result.data as Artist;
}

export async function getArtist(id: string): Promise<Artist | null> {
  const result = await ArtistEntity.get({ id }).go();
  return result.data as Artist | null;
}

export async function updateArtist(id: string, input: UpdateArtistInput): Promise<Artist> {
  const result = await ArtistEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw notFoundError('artist', id);
  }

  return result.data as Artist;
}
```

## Best Practices

### 1. Consistent Error Codes
Use consistent naming conventions for error codes.

### 2. Helper Functions
Create domain-specific error helper functions.

### 3. Include Context
Provide sufficient context in error messages.

### 4. Type Safety
Always use typed error codes and classes.

### 5. Error Recovery
Design for graceful error recovery where possible.

## Conclusion

Consistent error handling and validation patterns ensure robust, maintainable code. By following these patterns combined with type-safe APIs and proper domain modeling, we create predictable and debuggable applications.

**Related Reading:**
- [tRPC Type-Safe API Layer](./trpc-type-safe-api-layer.md) - Error handling in tRPC
- [ElectroDB Type-Safe DynamoDB](./electrodb-type-safe-dynamodb.md) - Database error patterns
- [Wiki-Style Edit System](./wiki-style-edit-system.md) - Validation in edit workflows
- [Monorepo Package Organization](./monorepo-package-organization.md) - Shared error types
