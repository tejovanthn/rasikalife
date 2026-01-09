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

### Core Package (`packages/core`)
```bash
cd packages/core && pnpm test                    # Run all tests
cd packages/core && pnpm test:watch              # Watch mode
cd packages/core && pnpm test:coverage           # With coverage
cd packages/core && pnpm typecheck               # Type check only
vitest src/domain/artist/repository.test.ts      # Single test file
```

### tRPC Package (`packages/trpc`)
```bash
cd packages/trpc && sst shell vitest run         # Run all tests (requires SST context)
cd packages/trpc && sst shell vitest             # Watch mode
cd packages/trpc && pnpm test:coverage           # With coverage
sst shell vitest src/routers/artist.test.ts      # Single test file
```

### Web Package (`packages/web`)
```bash
cd packages/web && pnpm build                    # Build for production
cd packages/web && pnpm typecheck                # Type check only
```

## Code Style Guidelines

### Formatting (Biome)
- **Indentation**: 2 spaces
- **Quotes**: Single quotes (`'`)
- **Semicolons**: Required (`;`)
- **Line width**: 100 characters
- **Trailing commas**: ES5 style
- **Arrow parens**: As needed (`x => x`)

### Import Conventions
```typescript
// Use import type for type-only imports (enforced by Biome)
import type { Artist, CreateArtistInput } from './schema';
import { ArtistRepository } from './repository';

// Absolute imports with @ alias within packages
import { formatKey, EntityPrefix } from '@/shared/singleTable';
import { ApplicationError, ErrorCode } from '@/constants';

// Relative imports only within same domain
import { validateArtistInput } from './validation';
```

### TypeScript Rules
- **NO explicit `any`** (error in production code, allowed in tests)
- **NO non-null assertions** (`!` operator - use proper null checks)
- **NO `forEach` loops** (use `for...of`, `map`, `filter` instead)
- **Import type enforcement**: Biome auto-organizes and enforces `import type`
- **Strict mode enabled**: All strict TypeScript checks active

### Naming Conventions
```typescript
// Files: camelCase
userRepository.ts, artistService.ts

// Components: PascalCase
ArtistCard.tsx, EventDetails.tsx

// Test files: collocated with .test.ts suffix
repository.test.ts, service.test.ts

// Interfaces: PascalCase with descriptive suffixes
interface CreateArtistInput { }
interface ArtistSearchResult { }
interface ArtistRepository { }

// Enums: PascalCase with string values
enum ArtistType {
  VOCALIST = 'vocalist',
  INSTRUMENTALIST = 'instrumentalist',
  GROUP = 'group'
}

// Constants: SCREAMING_SNAKE_CASE
const DEFAULT_PAGE_SIZE = 20;
const MAX_RETRIES = 3;
```

### Error Handling
```typescript
// Use ApplicationError from @/constants
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
// Use Zod schemas consistently
import { z } from 'zod';

const CreateArtistSchema = z.object({
  name: z.string().min(1).max(200),
  artistType: z.nativeEnum(ArtistType),
  traditions: z.array(z.nativeEnum(Tradition)),
});

// Validate at service/repository boundaries
export const create = async (input: unknown): Promise<Artist> => {
  const validated = CreateArtistSchema.parse(input);
  // ... implementation
};
```

## Architecture Patterns

### Domain Structure
Each domain in `packages/core/src/domain/[entity]/` follows this pattern:
```
domain/artist/
├── index.ts              # Barrel exports
├── types.ts              # TypeScript interfaces and types
├── schema.ts             # Zod validation schemas
├── repository.ts         # Data access layer (DB operations)
├── repository.test.ts    # Repository tests
├── service.ts            # Business logic layer
└── service.test.ts       # Service tests
```

### Repository Pattern
```typescript
export class ArtistRepository {
  static async create(input: unknown): Promise<ArtistDynamoItem> {
    const validated = createArtistSchema.parse(input);
    const baseItem = await createBaseItem(EntityPrefix.ARTIST);
    // ... implementation
    await putItem(artistItem);
    return artistItem;
  }

  static async getById(id: string): Promise<Artist | null> {
    return getByPrimaryKey<Artist>(EntityPrefix.ARTIST, id, SecondaryPrefix.METADATA);
  }

  static async update(id: string, input: unknown): Promise<Artist> {
    const validated = updateArtistSchema.parse({ id, ...input });
    // ... implementation
    return updateItem(/* ... */);
  }
}
```

### Service Pattern
```typescript
// Service functions for business logic
export const createArtist = async (input: CreateArtistInput): Promise<Artist> => {
  // Business logic, validation, enrichment
  return ArtistRepository.create(input);
};

export const updateArtist = async (id: string, input: UpdateArtistInput): Promise<Artist> => {
  const existing = await getArtist(id);
  if (!existing) {
    throw new ApplicationError(ErrorCode.ARTIST_NOT_FOUND, `Artist ${id} not found`);
  }
  
  const updated = await ArtistRepository.update(id, input);
  
  // Cache invalidation
  cache.delete(CacheKeys.artist(id));
  
  return updated;
};
```

### Database Conventions (Single-Table DynamoDB)
```typescript
// Key formatting with helper functions
const artistKey = formatKey(EntityPrefix.ARTIST, artistId);
const metadataKey = SecondaryPrefix.METADATA;

// GSI patterns for search/filtering
GSI1PK: formatIndexKey('ARTIST_NAME', name.toLowerCase())
GSI1SK: formatKey(EntityPrefix.ARTIST, id)

// Use query builder for DynamoDB queries
const artists = await createQuery<Artist>()
  .withPartitionKey('PK', formatKey(EntityPrefix.ARTIST, artistId))
  .withSortKeyBeginsWith('SK', SecondaryPrefix.FOLLOWS)
  .withLimit(20)
  .execute();
```

## Testing Patterns

### Test Structure
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ArtistRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create artist with generated ID and timestamps', async () => {
      const input: CreateArtistInput = {
        name: 'M.S. Subbulakshmi',
        artistType: ArtistType.VOCALIST,
        traditions: [Tradition.CARNATIC],
      };

      const artist = await ArtistRepository.create(input);

      expect(artist.name).toBe(input.name);
      expect(artist.PK).toMatch(/^ARTIST#/);
      expect(artist.isVerified).toBe(false);
      expect(artist.viewCount).toBe(0);
    });
  });
});
```

### Test Configuration
- **Framework**: Vitest with globals enabled
- **Mocking**: Global DynamoDB mock in `test/setup.ts`
- **Deterministic**: Fixed dates/times and predictable IDs via mocks
- **Coverage**: Excludes `node_modules`, `test/`, `*.test.ts`, type files

### Running Single Tests
```bash
# Core package (standard vitest)
vitest src/domain/artist/repository.test.ts

# tRPC package (requires SST context)
sst shell vitest src/routers/artist.test.ts
```

## Development Workflow

1. **Start development**: `pnpm run dev` (starts SST with all services)
2. **Make changes**: Edit code, tests run automatically in watch mode
3. **Format before commit**: `pnpm run check` (formats + lints)
4. **Type check**: `pnpm typecheck` in relevant package
5. **Run tests**: `pnpm test` in relevant package

## Key Dependencies
- **SST v3**: Infrastructure and serverless deployment
- **DynamoDB**: Single-table design with AWS SDK v3
- **tRPC v11**: Type-safe API layer
- **Zod**: Schema validation
- **KSUID**: Time-sortable unique IDs
- **Vitest**: Testing framework
- **Biome**: Fast formatter and linter
- **Remix v2**: Frontend framework (web package)

## Important Notes
- Always run `pnpm check` before committing
- tRPC tests MUST use `sst shell vitest` for proper AWS environment
- Use static methods in repositories (`ArtistRepository.create()`)
- Export service functions directly (`export const createArtist`)
- Tests relax some rules: explicit `any`, non-null assertions, `forEach` allowed
