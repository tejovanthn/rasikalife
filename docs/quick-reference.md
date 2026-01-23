# Quick Reference - Types, Constants & Utilities

## Core Types

### Base Entity
```typescript
interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
```

### Common Interfaces
```typescript
interface PaginationParams {
  limit?: number;
  nextToken?: string;
}

interface PaginatedResult<T> {
  items: T[];
  nextToken?: string;
  hasMore: boolean;
  totalCount?: number;
}
```

## Core Enums

### Entity Types
```typescript
enum EntityType {
  ARTIST = 'artist',
  COMPOSITION = 'composition',
  RAGA = 'raga',
  TALA = 'tala'
}

enum EntityPrefix {
  ARTIST = 'ARTIST',
  COMPOSITION = 'COMPOSITION',
  RAGA = 'RAGA',
  TALA = 'TALA'
}

enum SecondaryPrefix {
  METADATA = '#METADATA'
}
```

### Domain Enums
```typescript
enum Tradition {
  CARNATIC = 'carnatic',
  HINDUSTANI = 'hindustani'
}
```

## Entity Interfaces

### Artist
```typescript
interface Artist extends BaseEntity {
  name: string;
}
```

### CompositionWithRelations
```typescript
interface CompositionWithRelations {
  id: string;
  title: string;
  artistId: string;
  createdAt: string;
  updatedAt: string;
  ragas: Array<{ id: string; name: string }>;
  talas: Array<{ id: string; name: string }>;
  artist: { id: string; name: string } | null;
}
```

### Raga
```typescript
interface Raga extends BaseEntity {
  name: string;
}
```

### Tala
```typescript
interface Tala extends BaseEntity {
  name: string;
}
```

## Error Constants

### Error Codes
```typescript
enum ErrorCode {
  ARTIST_NOT_FOUND = 'ARTIST_NOT_FOUND',
  COMPOSITION_NOT_FOUND = 'COMPOSITION_NOT_FOUND',
  RAGA_NOT_FOUND = 'RAGA_NOT_FOUND',
  TALA_NOT_FOUND = 'TALA_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR'
}
```

## Basic Utility Functions

### ID Generation
```typescript
// Generate entity IDs
generatePrefixedId(prefix: string): Promise<string>

// Examples:
const artistId = await generatePrefixedId('artist'); // artist_01FQMQZX...
const compositionId = await generatePrefixedId('composition');
```

### Date/Time Utilities
```typescript
getCurrentISOString(): string  // Current ISO datetime
```

### Pagination Helpers
```typescript
createPaginatedResponse<T>(items: T[]): PaginatedResult<T>
```

## Basic Repository Pattern
```typescript
interface Repository<T extends BaseEntity> {
  create(item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  getById(id: string): Promise<T | null>;
  list(params?: PaginationParams): Promise<PaginatedResult<T>>;
}
```

## API Response Types

### Composition Queries
```typescript
// Get single composition with all relations
composition.get(id) // Returns CompositionWithRelations

// Get compositions by artist with relations
composition.byArtist(artistId) // Returns CompositionWithRelations[]
```

## Basic Testing Helpers
```typescript
// Mock entity creation
createMockArtist(overrides?: Partial<Artist>): Artist
createMockComposition(overrides?: Partial<Composition>): Composition
createMockRaga(overrides?: Partial<Raga>): Raga
createMockTala(overrides?: Partial<Tala>): Tala
```