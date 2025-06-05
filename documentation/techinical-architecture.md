# Technical Architecture & Design Patterns

## Tech Stack (Phase 1 Implemented ✅)
- **Framework**: SST.dev monorepo with React/Remix frontend
- **Database**: AWS DynamoDB with single-table design
- **Backend**: tRPC for type-safe API
- **ID Generation**: KSUID for time-sortable unique identifiers
- **Validation**: Zod for runtime type checking
- **Testing**: Vitest with comprehensive coverage
- **Language**: TypeScript with strict type checking

## Phase 2+ Additions 🚧
- **Authentication**: Google OAuth (Phase 2)
- **Search**: Elasticsearch integration (Phase 1-2)
- **Notifications**: Real-time system (Phase 2)
- **Payments**: Stripe integration (Phase 4)

## Core Design Patterns

### 1. Single-Table Design (DynamoDB)
All entities stored in one table using composite keys and GSIs:
```typescript
// Key Format: PREFIX#ID
PK: "USER#123"
SK: "#METADATA" | "FOLLOWS#ARTIST#456" | "EVENT#789#DATE#2023-01-01"

// GSI patterns for different access patterns
GSI1PK: "EMAIL#user@example.com"
GSI1SK: "USER#123"
```

### 2. Entity Prefixes
```typescript
enum EntityPrefix {
  // Phase 1 - Implemented ✅
  ARTIST = 'ARTIST', 
  COMPOSITION = 'COMPOSITION',
  RAGA = 'RAGA',
  TALA = 'TALA',
  
  // Phase 2 - Planned 🚧
  USER = 'USER',
  EVENT = 'EVENT',
  VENUE = 'VENUE'
}
```

### 3. Versioned Content (Phase 1 Partial, Phase 2 Full 🚧)
Wiki-style versioning for collaborative content:
```typescript
// Latest version pointer
PK: "COMPOSITION#123"
SK: "VERSION#LATEST"

// Specific versions
PK: "COMPOSITION#123" 
SK: "VERSION#v1#2023-01-01T10:00:00.000Z"
```

### 4. Access Control Lists (ACL) - Phase 2 🚧
Granular permissions for artist management:
```typescript
interface ArtistManagement {
  artistId: string;
  userId: string;
  permissions: {
    editProfile: boolean;
    manageBiography: boolean;
    addPerformances: boolean;
    manageEvents: boolean;
    approveChanges: boolean;
    addManagers: boolean;
  };
  permissionSource: 'explicit' | 'karma' | 'combined';
}
```

### 5. Karma-Based Permissions - Phase 3 📋
Community self-moderation through reputation:
```typescript
interface KarmaPermissionRule {
  entityType: EntityType;
  action: string;
  minKarma: number;
  scope: 'all' | 'community' | 'unverified';
}
```

## Directory Structure
```
packages/core/src/
├── constants/           # Error codes, validation messages
├── types/              # TypeScript interfaces and enums
├── utils/              # ID generation, date/time, validation
├── db/                 # DynamoDB operations and query builder
├── shared/             # Single-table utilities, access patterns
└── domain/             # Business logic by domain
    ├── user/
    ├── artist/
    ├── composition/
    ├── performance/
    ├── event/
    └── karma/
```

## Key Architectural Decisions

### Artists as Managed Entities
- Artists are profile pages, not user accounts
- Multiple users can manage one artist profile
- Supports both self-managed and community-managed artists
- Historical figures (e.g., Purandaradasa) managed by community

### Performance-Centric Data Model
- Specific performances link artists, compositions, and events
- Enables tracking of "what was played when and by whom"
- Supports analytics on repertoire and performance frequency

### Flexible Attribution System
- Multiple/disputed attributions with confidence levels
- Traditional works vs. known composers
- Community verification process

### Group and Individual Artists
- Groups are first-class artist entities
- Members have relationships to group entities
- Example: Ganesh-Kumaresh (group) vs. Ganesh (individual)

## Database Access Patterns

### Primary Access
```typescript
// Get entity by ID
getByPrimaryKey<T>(entityType: EntityPrefix, id: string): Promise<T | null>

// Get all related items
getAllByPartitionKey<T>(entityType: EntityPrefix, id: string): Promise<T[]>
```

### Secondary Access (GSI)
```typescript
// By email, username, name variants
getByGlobalIndex<T>(indexName: string, partitionKey: string, sortKey?: string): Promise<T[]>

// Date range queries
getByDateRange<T>(entityType: EntityPrefix, id: string, dateRange: {start: string, end: string}): Promise<T[]>
```

### Relationships
```typescript
// Many-to-many relationships
createRelatedItems<T>(primaryItem: T, relatedItems: DynamoItem[]): Promise<T>
```

## Error Handling
```typescript
// Standardized error codes
enum ErrorCode {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  ARTIST_ALREADY_EXISTS = 'ARTIST_ALREADY_EXISTS',
  INSUFFICIENT_KARMA = 'INSUFFICIENT_KARMA'
}

// Custom error class
class ApplicationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
```

## Testing Strategy
- Unit tests collocated with implementation
- Mock DynamoDB client for consistent testing
- Deterministic ID and date generation in tests
- Domain-specific test fixtures