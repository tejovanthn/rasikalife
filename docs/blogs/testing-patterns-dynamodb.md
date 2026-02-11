# Testing Patterns for DynamoDB Applications

## Introduction

Comprehensive testing is essential for building reliable DynamoDB applications. This document covers testing patterns for DynamoDB applications using Vitest, including unit tests, mocking strategies, and best practices for testing single-table designs.

**Related ADRs:**
- [ADR-005: ElectroDB for Type-Safe Database Operations](../adrs/adr-005-electrodb-type-safe-database-operations.md)
- [ADR-008: Testing Strategy and Framework Selection](../adrs/adr-008-testing-strategy-framework-selection.md)

## Test Structure

### Collocated Tests

Tests are placed next to the code they test with the `.test.ts` extension:

```
packages/core/src/domain/artist/
├── entity.ts
├── schema.ts
├── index.ts
└── index.test.ts
```

## Unit Testing Patterns

### Test Setup

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createArtist, deleteArtist, getArtist, listArtists, updateArtist } from '.';
import type { CreateArtistInput } from '.';

vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-id-123'),
}));

vi.mock('./entity', () => ({
  ArtistEntity: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    scan: {
      go: vi.fn(),
    },
    query: {
      byName: vi.fn(),
      list: vi.fn(),
    },
  },
}));
```

### Mocking ElectroDB Entities

```typescript
const { ArtistEntity } = await import('./entity');
vi.mocked(ArtistEntity.create).mockReturnValue({
  go: vi.fn().mockResolvedValue({ data: mockArtist }),
} as any);
```

### Testing CRUD Operations

```typescript
describe('createArtist', () => {
  it('should create artist with generated ID and timestamps', async () => {
    const input: CreateArtistInput = {
      name: 'M.S. Subbulakshmi',
    };

    const mockArtist = {
      id: 'test-id-123',
      ...input,
      createdAt: '2025-01-09T00:00:00.000Z',
      updatedAt: '2025-01-09T00:00:00.000Z',
    };

    const { ArtistEntity } = await import('./entity');
    vi.mocked(ArtistEntity.create).mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: mockArtist }),
    } as any);

    const artist = await createArtist(input);

    expect(ArtistEntity.create).toHaveBeenCalledWith({
      id: 'test-id-123',
      ...input,
    });
    expect(artist).toEqual(mockArtist);
  });

  it('should throw error when creation fails', async () => {
    const input: CreateArtistInput = { name: 'Test Artist' };

    const { ArtistEntity } = await import('./entity');
    vi.mocked(ArtistEntity.create).mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: null }),
    } as any);

    await expect(createArtist(input)).rejects.toThrow('Failed to create artist');
  });
});
```

### Testing Get Operations

```typescript
describe('getArtist', () => {
  it('should return artist when found', async () => {
    const mockArtist = {
      id: 'test-id-123',
      name: 'Test Artist',
      createdAt: '2025-01-09T00:00:00.000Z',
      updatedAt: '2025-01-09T00:00:00.000Z',
    };

    const { ArtistEntity } = await import('./entity');
    vi.mocked(ArtistEntity.get).mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: mockArtist }),
    } as any);

    const artist = await getArtist('test-id-123');

    expect(ArtistEntity.get).toHaveBeenCalledWith({ id: 'test-id-123' });
    expect(artist).toEqual(mockArtist);
  });

  it('should return null when artist not found', async () => {
    const { ArtistEntity } = await import('./entity');
    vi.mocked(ArtistEntity.get).mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: null }),
    } as any);

    const artist = await getArtist('non-existent-id');

    expect(artist).toBeNull();
  });
});
```

### Testing Update Operations

```typescript
describe('updateArtist', () => {
  it('should update artist successfully', async () => {
    const updateInput = { name: 'Updated Name' };
    const mockUpdatedArtist = {
      id: 'test-id-123',
      name: 'Updated Name',
      createdAt: '2025-01-09T00:00:00.000Z',
      updatedAt: '2025-01-09T01:00:00.000Z',
    };

    const { ArtistEntity } = await import('./entity');
    vi.mocked(ArtistEntity.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockUpdatedArtist }),
      }),
    } as any);

    const artist = await updateArtist('test-id-123', updateInput);

    expect(ArtistEntity.update).toHaveBeenCalledWith({ id: 'test-id-123' });
    expect(artist).toEqual(mockUpdatedArtist);
  });
});
```

### Testing List Operations with Pagination

```typescript
describe('listArtists', () => {
  it('should return paginated artists', async () => {
    const mockArtists = [
      {
        id: 'artist-1',
        name: 'Artist 1',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      },
    ];

    const { ArtistEntity } = await import('./entity');
    vi.mocked(ArtistEntity.query.list).mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: mockArtists,
        cursor: 'next-token-123',
      }),
    } as any);

    const result = await listArtists({ limit: 10, nextToken: 'prev-token' });

    expect(result).toEqual({
      items: mockArtists,
      nextToken: 'next-token-123',
      hasMore: true,
    });
  });
});
```

## Best Practices

### 1. Mock External Dependencies
Mock DynamoDB client and utilities.

### 2. Test All CRUD Operations
Ensure all database operations are tested.

### 3. Test Error Cases
Test both success and failure scenarios.

### 4. Test Pagination
Verify pagination works correctly.

### 5. Use Descriptive Names
Use clear test names that describe what's being tested.

## Conclusion

Following these testing patterns ensures reliable, maintainable code. Vitest provides excellent support for testing DynamoDB applications with clean, readable tests. Combined with proper mocking strategies and comprehensive test coverage, you can build confidence in your data layer.

**Related Reading:**
- [ElectroDB Type-Safe DynamoDB](./electrodb-type-safe-dynamodb.md) - Entity patterns to test
- [Single-Table Design Patterns](./single-table-design-patterns.md) - Testing access patterns
- [Cursor-Based Pagination](./cursor-pagination-dynamodb.md) - Testing pagination logic
- [Error Handling Patterns](./error-handling-validation-patterns.md) - Testing error scenarios
- [Wiki-Style Edit System](./wiki-style-edit-system.md) - Testing complex workflows
- [Monorepo Package Organization](./monorepo-package-organization.md) - Running tests in monorepo
