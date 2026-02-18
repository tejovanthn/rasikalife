# AGENTS.md

Guidelines for AI coding agents working in the Rasika.life codebase.

## Build, Lint & Test Commands

### Root Level
```bash
pnpm run dev          # Start SST dev environment (all services)
pnpm run format       # Format code with Biome
pnpm run lint         # Lint and auto-fix with Biome
pnpm run check        # Run all Biome checks (lint + format)
```

### Packages
```bash
# Core package
cd packages/core && pnpm test && pnpm test:watch && pnpm test:coverage && pnpm typecheck

# tRPC package (requires SST context)
cd packages/trpc && sst shell vitest run && sst shell vitest

# Web package
cd packages/web && pnpm build && pnpm typecheck

# Auth package
cd packages/auth && pnpm test && pnpm typecheck

# Search package
cd packages/search && pnpm test && pnpm typecheck
```

### Running Single Tests
```bash
# Core package (standard vitest)
vitest src/domain/artist/repository.test.ts

# tRPC package (requires SST context)
sst shell vitest src/routers/artist.test.ts
```

## Code Style Guidelines

### Formatting (Biome)
- **Indentation**: 2 spaces
- **Quotes**: Single quotes (`'`)
- **Semicolons**: Required (`;`)
- **Line width**: 100 characters
- **Trailing commas**: ES5 style

### Import Conventions
```typescript
// Use import type for type-only imports
import type { Artist, CreateArtistInput } from './schema';
import { ArtistRepository } from './repository';

// Absolute imports with @ alias
import { formatKey, EntityPrefix } from '@/shared/singleTable';
import { ApplicationError, ErrorCode } from '@/constants';

// Relative imports within same domain
import { validateArtistInput } from './validation';
```

### TypeScript Rules
- **NO explicit `any`** (error in production, allowed in tests)
- **NO non-null assertions** (`!` operator - use proper null checks)
- **NO `forEach` loops** (use `for...of`, `map`, `filter` instead)
- **Import type enforcement**: Biome auto-organizes imports
- **Strict mode enabled**

### Naming Conventions
```typescript
// Files: camelCase
userRepository.ts, artistService.ts

// Components: PascalCase
ArtistCard.tsx, EventDetails.tsx

// Test files: .test.ts suffix collocated
repository.test.ts, service.test.ts

// Interfaces: PascalCase with suffixes
interface CreateArtistInput { }

// Enums: PascalCase with string values
enum ArtistType { VOCALIST = 'vocalist' }

// Constants: SCREAMING_SNAKE_CASE
const DEFAULT_PAGE_SIZE = 20;
```

### Error Handling
```typescript
throw new ApplicationError(
  ErrorCode.ARTIST_NOT_FOUND,
  `Artist with ID ${artistId} not found`
);

// In services, catch and re-throw with context
try {
  return await repository.getById(id);
} catch (error) {
  throw new ApplicationError(
    ErrorCode.ARTIST_FETCH_FAILED,
    `Failed to fetch artist: ${error.message}`
  );
}
```

### Validation
```typescript
import { z } from 'zod';

const CreateArtistSchema = z.object({
  name: z.string().min(1).max(200),
  artistType: z.nativeEnum(ArtistType),
});

export const create = async (input: unknown): Promise<Artist> => {
  const validated = CreateArtistSchema.parse(input);
};
```

## Architecture Patterns

### Domain Structure
```
domain/artist/
├── index.ts              # Barrel exports
├── types.ts              # TypeScript interfaces
├── schema.ts             # Zod validation schemas
├── repository.ts         # Data access layer
├── repository.test.ts    # Repository tests
├── service.ts            # Business logic
└── service.test.ts       # Service tests
```

### Repository Pattern
```typescript
export class ArtistRepository {
  static async create(input: unknown): Promise<Artist> {
    const validated = createArtistSchema.parse(input);
    await putItem(artistItem);
    return artistItem;
  }

  static async getById(id: string): Promise<Artist | null> {
    return getByPrimaryKey<Artist>(EntityPrefix.ARTIST, id);
  }
}
```

### Database Conventions (DynamoDB Single-Table)
```typescript
const artistKey = formatKey(EntityPrefix.ARTIST, artistId);
const metadataKey = SecondaryPrefix.METADATA;

// GSI patterns
GSI1PK: formatIndexKey('ARTIST_NAME', name.toLowerCase())
GSI1SK: formatKey(EntityPrefix.ARTIST, id)
```

## Testing Patterns

### Test Structure
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ArtistRepository', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('create', () => {
    it('should create artist with generated ID', async () => {
 await ArtistRepository.create      const artist =(input);
      expect(artist.PK).toMatch(/^ARTIST#/);
    });
  });
});
```

### Test Configuration
- **Framework**: Vitest with globals
- **Mocking**: Global DynamoDB mock in `test/setup.ts`
- **Rules relaxed in tests**: `any`, `!`, `forEach` allowed
- **Coverage excludes**: `node_modules`, `test/`, `*.test.ts`, type files

## Key Dependencies
- **SST v3**: Infrastructure and serverless deployment
- **DynamoDB**: Single-table design with AWS SDK v3
- **tRPC v11**: Type-safe API layer
- **Zod**: Schema validation
- **KSUID**: Time-sortable unique IDs
- **Vitest**: Testing framework
- **Biome**: Formatter and linter
- **Remix/React Router v7**: Frontend framework

## Important Notes
- Always run `pnpm check` before committing
- tRPC tests MUST use `sst shell vitest`
- Use static methods in repositories (`ArtistRepository.create()`)
- Export service functions directly (`export const createArtist`)
