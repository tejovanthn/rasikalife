# Coding Standards & Conventions

## File Naming & Organization

### File Naming
- Domain directories: kebab-case (`artist-award/`, `change-history/`, `composition_raga/`)
- Source files: kebab-case (`entity.ts`, `client.ts`, `schema.ts`)
- React components: PascalCase (`ArtistCard.tsx`, `EventDetails.tsx`)
- Test files: `index.test.ts` (or `<feature>.test.ts`), collocated with implementation

### Domain Directory Structure
```
domain/artist/
├── entity.ts         # ElectroDB entity definition & type export
├── schema.ts         # Zod schemas for create/update inputs
├── client.ts         # Browser-safe re-exports (types + schemas only, no AWS deps)
├── index.ts          # All exports (functions + types)
└── index.test.ts     # Tests
```

Some domains include additional files for specific concerns (for example, `gemini.ts`, `extraction.ts`, `s3.ts` for the event domain).

## TypeScript Conventions

### Entity Types
Entity types are derived from ElectroDB, not hand-written interfaces:

```typescript
// entity.ts
import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';

export const ArtistEntity = new Entity({ ... }, { client: dynamoClient, table: ... });
export type Artist = EntityItem<typeof ArtistEntity>;
```

### Input Types
Input types are inferred from Zod schemas:

```typescript
// schema.ts
export const CreateArtistSchema = z.object({ name: z.string(), ... });

// index.ts
import type { z } from 'zod';
export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;
```

### No Class-Based Patterns
All domain operations are standalone exported async functions — no Repository or Service classes:

```typescript
// index.ts
export async function createArtist(input: CreateArtistInput): Promise<Artist> { ... }
export async function getArtist(id: string): Promise<Artist | null> { ... }
export async function listArtists(params?: { limit?: number; nextToken?: string }) { ... }
```

## Database Conventions

### ElectroDB Queries
Use ElectroDB's fluent API directly — no custom query builder:

```typescript
// Get by primary key
const result = await ArtistEntity.get({ id }).go();

// Query by index
const result = await ArtistEntity.query.byName({ name }).go();

// List with filter
const result = await ArtistEntity.query
  .list({})
  .where((attr, op) => op.notExists(attr.deletedAt))
  .go({ limit, cursor: nextToken });
```

### Pagination
All list functions return `{ items, nextToken?, hasMore }`. The `cursor` from ElectroDB maps to `nextToken`:

```typescript
return {
  items: result.data || [],
  nextToken: result.cursor || undefined,
  hasMore: !!result.cursor,
};
```

### Key Templates
Keys are defined in ElectroDB entity templates — never constructed manually:
```
pk: `ARTIST#${id}`, sk: `#METADATA`
gsi1pk: `ARTIST_NAME#${name}`, gsi1sk: `ARTIST#${id}`
```

## Error Handling

Use `ApplicationError` for all domain errors:

```typescript
import { ApplicationError, ErrorCode } from '../../constants';

throw new ApplicationError(ErrorCode.ARTIST_NOT_FOUND, `artist with ID ${id} not found`);
```

Use the shared helpers in `domain/helpers.ts` where applicable:

```typescript
import { notFoundError, createFailedError } from '../helpers';

if (!result.data) throw notFoundError('artist', id);
```

## Linting & Formatting

- **Biome** handles all formatting and linting (no ESLint, no Prettier)
- Run `pnpm check` before committing
- Key rules enforced: no `forEach`, no non-null assertions (`!`), `import type` for type-only imports, no explicit `any`

## Testing Patterns

Tests use **Vitest** with a mock DynamoDB client. Tests are plain functions — no class instantiation:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createArtist, getArtist } from '.';

describe('artist', () => {
  it('creates and retrieves an artist', async () => {
    const artist = await createArtist({ name: 'Test Artist' });
    expect(artist.id).toBeDefined();

    const fetched = await getArtist(artist.id);
    expect(fetched?.name).toBe('Test Artist');
  });
});
```

## Import Conventions

```typescript
// External packages first (auto-organized by Biome)
import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';

// Internal packages with @rasika/* alias
import { ApplicationError, ErrorCode } from '@rasika/core';

// Relative imports within same domain
import { ArtistEntity } from './entity';
import type { Artist } from './entity';
import type { CreateArtistSchema } from './schema';
```

Always use `import type` for type-only imports — Biome enforces this.

## Export Patterns

```typescript
// Re-export types alongside functions
export type { Artist } from './entity';
export { CreateArtistSchema, UpdateArtistSchema } from './schema';

// Named function exports (no default exports for domain functions)
export async function createArtist(...) { ... }
export async function getArtist(...) { ... }
```
