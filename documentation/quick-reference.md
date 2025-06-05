# Quick Reference - Types, Constants & Utilities

## Phase 1 Types (Current Implementation)

### Core Types

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

interface SearchResult<T> extends PaginatedResult<T> {
  facets?: Record<string, Array<{ value: string; count: number }>>;
  suggestions?: string[];
}

interface Location {
  city?: string;
  state?: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

interface SocialLinks {
  website?: string;
  youtube?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  spotify?: string;
  appleMusic?: string;
  other?: Record<string, string>;
}
```

## Core Enums

### Entity Types
```typescript
enum EntityType {
  // Phase 1 - Implemented ✅
  ARTIST = 'artist',
  COMPOSITION = 'composition',
  RAGA = 'raga',
  TALA = 'tala',
  
  // Phase 2 - Planned 🚧
  USER = 'user',
  EVENT = 'event',
  VENUE = 'venue',
  PERFORMANCE = 'performance',
  
  // Phase 3+ - Future 🔮
  THREAD = 'thread',
  RECORDING = 'recording'
}

enum EntityPrefix {
  // Phase 1 - Implemented ✅
  ARTIST = 'ARTIST',
  COMPOSITION = 'COMPOSITION',
  RAGA = 'RAGA',
  TALA = 'TALA',
  
  // Phase 2 - Planned 🚧
  USER = 'USER',
  EVENT = 'EVENT',
  VENUE = 'VENUE',
  PERFORMANCE = 'PERFORMANCE',
  
  // Phase 3+ - Future 🔮
  THREAD = 'THREAD',
  RECORDING = 'RECORDING'
}

enum SecondaryPrefix {
  METADATA = '#METADATA',        // Phase 1 ✅
  VERSION = 'VERSION',          // Phase 1 partial, Phase 2 full 🚧
  DATE = 'DATE',               // Phase 2 🚧
  FOLLOWS = 'FOLLOWS',         // Phase 2 🚧
  MANAGES = 'MANAGES',         // Phase 2 🚧
  PERFORMS = 'PERFORMS',       // Phase 2 🚧
  ATTRIBUTION = 'ATTRIBUTION'  // Phase 2 🚧
}
```

### Domain Enums
```typescript
enum Tradition {
  CARNATIC = 'carnatic',
  HINDUSTANI = 'hindustani'
}

enum ArtistType {                    // Phase 1 ✅
  VOCALIST = 'vocalist',
  INSTRUMENTALIST = 'instrumentalist',
  DANCER = 'dancer',
  COMPOSER = 'composer',
  GROUP = 'group'
}

enum AttributionType {              // Phase 2 🚧  
  PRIMARY = 'primary',
  DISPUTED = 'disputed',
  ALTERNATIVE = 'alternative',
  TRADITIONAL = 'traditional'
}
```

---

## 🚧 **PHASE 2+ TYPES** 
*The following types are planned for future development phases.*

```typescript
enum UserRole {                     // Phase 2 🚧
  USER = 'user',
  ARTIST = 'artist',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  CURATOR = 'curator'
}

enum EventType {                    // Phase 2 🚧
  CONCERT = 'concert',
  LECTURE = 'lecture',
  WORKSHOP = 'workshop',
  COMPETITION = 'competition',
  FESTIVAL = 'festival'
}

enum VoteType {                     // Phase 3 🔮
  UP = 'up',
  DOWN = 'down'
}
```

## Phase 1 Entity Interfaces (Current)

### Artist
```typescript
interface Artist extends BaseEntity {
  name: string;
  bio?: string;
  artistType: ArtistType;
  instruments: string[];
  gurus?: string[];
  lineage?: string;
  formationYear?: number;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  viewCount: number;
  favoriteCount: number;
  popularityScore: number;
  location?: Location;
  profileImage?: string;
  socialLinks?: SocialLinks;
  website?: string;
  traditions: Tradition[];
}
```

### Composition
```typescript
interface Composition extends BaseEntity {
  version: string;
  title: string;
  canonicalTitle?: string;
  alternativeTitles?: string[];
  language: string;
  verses?: string;
  meaning?: string;
  notation?: string;
  audioSamples?: string[];
  videoSamples?: string[];
  addedBy: string;
  editedBy: string[];
  viewCount: number;
  favoriteCount: number;
  popularityScore: number;
  sourceAttribution?: string;
  tradition: Tradition;
  isLatest: boolean;
}
```

## Error Constants

### Error Codes
```typescript
enum ErrorCode {
  // Phase 1 - Artist/Composition errors ✅
  ARTIST_NOT_FOUND = 'ARTIST_NOT_FOUND',
  ARTIST_ALREADY_EXISTS = 'ARTIST_ALREADY_EXISTS',
  COMPOSITION_NOT_FOUND = 'COMPOSITION_NOT_FOUND',
  COMPOSITION_VERSION_NOT_FOUND = 'COMPOSITION_VERSION_NOT_FOUND',
  
  // Phase 2 - User/Permission errors 🚧
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  INVALID_USER_CREDENTIALS = 'INVALID_USER_CREDENTIALS',
  INVALID_ARTIST_PERMISSIONS = 'INVALID_ARTIST_PERMISSIONS',
  INSUFFICIENT_KARMA = 'INSUFFICIENT_KARMA',
  INVALID_PERMISSIONS = 'INVALID_PERMISSIONS',
  ACCESS_DENIED = 'ACCESS_DENIED',
  
  // Common - Core system ✅
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  DATABASE_ERROR = 'DATABASE_ERROR',
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED'
}
```

---

## 🚧 **PHASE 2+ ENTITY INTERFACES** 
*The following interfaces are planned for future development phases.*

### User (Phase 2)
```typescript
interface User extends BaseEntity {
  username: string;
  email: string;
  displayName: string;
  bio?: string;
  profileImage?: string;
  roles: UserRole[];
  karma: number;
  isVerified: boolean;
  preferences: UserPreferences;
  notificationSettings: UserNotificationSettings;
  privacySettings: UserPrivacySettings;
  lastLoginAt?: string;
}

interface UserPreferences {
  defaultLanguage: string;
  preferredTraditions: Tradition[];
  favoriteInstruments: string[];
  favoriteRagas: string[];
  themeName: 'light' | 'dark' | 'system';
}
```

## Utility Functions (Common to All Phases)

### ID Generation
```typescript
// Generate entity IDs
generateId(): Promise<string>
generatePrefixedId(prefix: string): Promise<string>
generateIdSync(): string

// Examples:
const userId = await generatePrefixedId('user');     // user_01FQMQZX...
const artistId = await generatePrefixedId('artist'); // artist_01FQMQZX...
```

### Key Formatting
```typescript
// Format primary keys
formatKey(prefix: EntityPrefix, id: string): string
formatDateSortKey(prefix: string, date: string, id?: string): string
formatVersionKey(version: string, timestamp?: string): string

// Examples:
formatKey(EntityPrefix.USER, "123")                    // "USER#123"
formatDateSortKey("DATE", "2023-01-01", "EVENT#123")  // "DATE#2023-01-01#EVENT#123"
formatVersionKey("v1", "2023-01-01T10:00:00.000Z")    // "VERSION#v1#2023-01-01T10:00:00.000Z"
```

### Date/Time Utilities
```typescript
getCurrentISOString(): string                    // Current ISO datetime
formatDateYYYYMMDD(date: Date): string          // Format as YYYY-MM-DD
toISOString(date: Date | string | number): string
addDays(date: Date, days: number): Date
isPast(date: Date | string): boolean
isFuture(date: Date | string): boolean
daysBetween(dateA: Date, dateB: Date): number
```

### Pagination Helpers
```typescript
createNextToken(lastEvaluatedKey?: Record<string, any>): string | undefined
parseNextToken(nextToken?: string): Record<string, any> | undefined
createPaginatedResponse<T>(items: T[], lastEvaluatedKey?: Record<string, any>): PaginatedResult<T>
```

## Database Access Patterns

### Primary Access
```typescript
// Get entity by primary key
getByPrimaryKey<T>(entityType: EntityPrefix, id: string): Promise<T | null>

// Get all items for a partition
getAllByPartitionKey<T>(
  entityType: EntityPrefix, 
  id: string, 
  options?: {
    limit?: number;
    exclusiveStartKey?: Record<string, any>;
    sortKeyPrefix?: string;
    sortKeyBetween?: { start: string; end: string };
    scanIndexForward?: boolean;
  }
): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }>
```

### Secondary Access
```typescript
// Query by Global Secondary Index
getByGlobalIndex<T>(
  indexName: string,
  partitionKeyName: string,
  partitionKeyValue: string,
  options?: {
    sortKeyName?: string;
    sortKeyValue?: string;
    sortKeyPrefix?: string;
    sortKeyBetween?: { start: string; end: string };
    limit?: number;
    exclusiveStartKey?: Record<string, any>;
    scanIndexForward?: boolean;
  }
): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }>

// Date range queries
getByDateRange<T>(
  entityType: EntityPrefix,
  id: string,
  sortKeyPrefix: string,
  dateRange: { start: string; end: string },
  options?: {
    limit?: number;
    exclusiveStartKey?: Record<string, any>;
    scanIndexForward?: boolean;
  }
): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }>
```

### Query Builder
```typescript
const query = createQuery<T>()
  .withPartitionKey('pk', partitionKey)
  .withSortKeyBeginsWith('sk', sortKeyPrefix)
  .withIndex('GSI1')
  .withFilter('attribute', '=', value)
  .withLimit(20)
  .withStartKey(exclusiveStartKey)
  .execute();
```

## Validation Schemas

### Common Schema Builders
```typescript
// String schemas
createStringSchema({
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  trim?: boolean;
}): ZodSchema

// Pre-built schemas
emailSchema: ZodSchema
usernameSchema: ZodSchema
passwordSchema: ZodSchema
dateStringSchema: ZodSchema
isoDateStringSchema: ZodSchema

// Array schemas
createArraySchema<T>(
  schema: T,
  {
    required?: boolean;
    minItems?: number;
    maxItems?: number;
    unique?: boolean;
    nonEmpty?: boolean;
  }
): ZodSchema
```

### Common Patterns
```typescript
// Input validation
const CreateEntitySchema = z.object({
  name: createStringSchema({ minLength: 2, maxLength: 100 }),
  email: emailSchema,
  tags: createArraySchema(z.string(), { maxItems: 10 })
});

// Parse and validate
const validated = CreateEntitySchema.parse(input);
```

## Repository Interface
```typescript
interface Repository<T extends BaseEntity, K = string> {
  create(item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  getById(id: K): Promise<T | null>;
  update(id: K, item: Partial<T>): Promise<T>;
  delete(id: K): Promise<void>;
  list(params?: PaginationParams): Promise<PaginatedResult<T>>;
}
```

## Service Pattern
```typescript
class EntityService {
  constructor(
    private entityRepo: EntityRepository,
    private karmaService: KarmaService
  ) {}

  async create(input: CreateEntityInput, userId: string): Promise<Entity> {
    // 1. Check permissions
    await this.karmaService.checkPermission(userId, 'create_entity');
    
    // 2. Validate input
    const validated = CreateEntitySchema.parse(input);
    
    // 3. Create entity
    const entity = await this.entityRepo.create(validated);
    
    // 4. Award karma
    await this.karmaService.awardKarma(userId, 5, 'create_entity');
    
    return entity;
  }
}
```

## Testing Helpers
```typescript
// Mock entity creation
createMockUser(overrides?: Partial<User>): User
createMockArtist(overrides?: Partial<Artist>): Artist
createMockComposition(overrides?: Partial<Composition>): Composition

// Mock repository
createMockRepository<T>(): jest.Mocked<Repository<T>>

// Test utilities
const mockDate = '2023-01-01T00:00:00.000Z';
const mockId = 'test_01FQMQZX3K9Y8J7H6G5F4D3C2B';
```

## tRPC Patterns
```typescript
// Public procedure
publicProcedure
  .input(InputSchema)
  .query(async ({ input, ctx }) => {
    return ctx.service.method(input);
  });

// Protected procedure
protectedProcedure
  .input(InputSchema)
  .mutation(async ({ input, ctx }) => {
    return ctx.service.method(input, ctx.user.id);
  });

// Karma-protected procedure
karmaProtectedProcedure('action_name')
  .input(InputSchema)
  .mutation(async ({ input, ctx }) => {
    return ctx.service.method(input, ctx.user.id);
  });
```