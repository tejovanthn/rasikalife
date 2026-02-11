# ADR-008: Testing Strategy

## Status
Accepted

## Context
We needed a testing strategy that provides:
- Type-safe testing with Vitest
- Mocking for DynamoDB
- Collocated tests
- Fast test execution

## Decision
Use Vitest with ElectroDB mocking for unit tests.

## Consequences

### Positive
- ✅ **Type safety**: Vitest with TypeScript
- ✅ **Fast execution**: Vitest is significantly faster than Jest
- ✅ **Mocking**: Excellent mocking capabilities
- ✅ **Collocated tests**: Tests next to source code

### Negative
- ❌ **Learning curve**: Team needs to learn Vitest patterns

## Implementation

### Test Structure

```
packages/core/src/domain/artist/
├── entity.ts
├── schema.ts
├── index.ts
└── index.test.ts
```

### Test Setup

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createArtist, getArtist, listArtists, updateArtist } from '.';

vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-id-123'),
}));

vi.mock('./entity', () => ({
  ArtistEntity: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      byName: vi.fn(),
      list: vi.fn(),
    },
  },
}));
```

### Example Test

```typescript
describe('createArtist', () => {
  it('should create artist with generated ID', async () => {
    const input = { name: 'M.S. Subbulakshmi' };

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
});
```

## Results

- **Test execution**: Fast with Vitest
- **Type safety**: 100% TypeScript coverage
- **Developer experience**: Excellent with hot reload

## References

- [Vitest Documentation](https://vitest.dev/)
- [Vitest Guide](https://vitest.dev/guide/)
