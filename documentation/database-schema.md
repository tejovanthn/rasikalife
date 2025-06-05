# Database Schema & Access Patterns

## Single-Table Design Overview

All entities are stored in one DynamoDB table with the following structure:

### Primary Table
- **PK** (Partition Key): Entity type and ID
- **SK** (Sort Key): Metadata or relationship identifier
- **GSI1PK/GSI1SK**: First Global Secondary Index
- **GSI2PK/GSI2SK**: Second Global Secondary Index  
- **GSI3PK/GSI3SK**: Third Global Secondary Index
- **GSI4PK/GSI4SK**: Fourth Global Secondary Index
- **LSI1SK**: Local Secondary Index

## Entity Prefixes

```typescript
enum EntityPrefix {
  // Phase 1 - Implemented ✅
  ARTIST = 'ARTIST',
  COMPOSITION = 'COMPOSITION', 
  RAGA = 'RAGA',
  TALA = 'TALA',
  
  // Phase 2 - User Engagement 🚧
  USER = 'USER',
  EVENT = 'EVENT',
  VENUE = 'VENUE',
  PERFORMANCE = 'PERFORMANCE',
  
  // Phase 3 - Community 📋
  THREAD = 'THREAD',
  COLLECTION = 'COLLECTION',
  
  // Future Phases 🔮
  RECORDING = 'RECORDING'
}

enum SecondaryPrefix {
  METADATA = '#METADATA',
  VERSION = 'VERSION',          // Phase 1 - Partial, Phase 2 - Full
  DATE = 'DATE',               // Phase 2
  FOLLOWS = 'FOLLOWS',         // Phase 2
  MANAGES = 'MANAGES',         // Phase 2
  PERFORMS = 'PERFORMS',       // Phase 2
  ATTRIBUTION = 'ATTRIBUTION'  // Phase 2
}
```

## Core Entity Patterns

### Phase 1 Entities (Implemented)

### Artist Entity
```typescript
// Primary record
PK: "ARTIST#456"
SK: "#METADATA"
GSI1PK: "ARTIST_NAME#ravi_shankar"
GSI1SK: "ARTIST#456"
GSI2PK: "INSTRUMENT#sitar"
GSI2SK: "ARTIST#456"
GSI3PK: "TRADITION#hindustani"
GSI3SK: "ARTIST#456"

// Managed by users
PK: "ARTIST#456"
SK: "MANAGER#123"

// Group members
PK: "ARTIST#456"
SK: "MEMBER#789"
```

### Composition Entity (Versioned)
```typescript
// Latest version pointer
PK: "COMPOSITION#789"
SK: "VERSION#LATEST"

// Specific versions
PK: "COMPOSITION#789"
SK: "VERSION#v1#2023-01-01T10:00:00.000Z"
GSI1PK: "RAGA#yaman"
GSI1SK: "COMPOSITION#789"
GSI2PK: "COMPOSER#ravi_shankar"
GSI2SK: "COMPOSITION#789"

// Attributions
PK: "COMPOSITION#789"
SK: "ATTRIBUTION#456"
```

---

## 🚧 **PHASE 2+ ENTITIES** 
*The following entity patterns are planned for future development phases.*

### User Entity (Phase 2)
```typescript
// Primary record
PK: "USER#123"
SK: "#METADATA"
GSI1PK: "EMAIL#user@example.com"
GSI1SK: "USER#123"
GSI2PK: "USERNAME#johndoe"
GSI2SK: "USER#123"

// Relationships
PK: "USER#123"
SK: "FOLLOWS#ARTIST#456"

PK: "USER#123"
SK: "MANAGES#ARTIST#789"
```

## Key Access Patterns

### Phase 1 Access Patterns (Current)

### 1. Get Entity by ID
```typescript
// Get artist by ID  
const artist = await getByPrimaryKey<Artist>(EntityPrefix.ARTIST, "456");

// Get composition by ID
const composition = await getByPrimaryKey<Composition>(EntityPrefix.COMPOSITION, "789");
```

### 2. Get Entity by Unique Field
```typescript
// Get artist by name
const artists = await getByGlobalIndex<Artist>(
  'GSI1', 
  'ARTIST_NAME#ravi_shankar',
  'ARTIST#'
);

// Get raga by name
const ragas = await getByGlobalIndex<Raga>(
  'GSI1',
  'RAGA_NAME#yaman',
  'RAGA#'
);
```

### 3. Search by Category
```typescript
// Get artists by instrument (Phase 1 pattern)
const violinists = await getByGlobalIndex<Artist>(
  'GSI2',
  'INSTRUMENT#violin',
  'ARTIST#'
);

// Get compositions by raga
const yamanComps = await getByGlobalIndex<Composition>(
  'GSI1',
  'RAGA#yaman', 
  'COMPOSITION#'
);
```

---

## 🚧 **PHASE 2+ ACCESS PATTERNS** 
*The following patterns require User domain and relationship entities.*

### User Relationships (Phase 2)
```typescript
// Get user's followed artists
const follows = await getAllByPartitionKey<UserFollow>(
  EntityPrefix.USER,
  "123",
  { sortKeyPrefix: SecondaryPrefix.FOLLOWS }
);

// Get artist's managers
const managers = await getAllByPartitionKey<ArtistManagement>(
  EntityPrefix.ARTIST,
  "456", 
  { sortKeyPrefix: "MANAGER#" }
);
```

### Date Range Queries (Phase 2)
```typescript
// Get events in date range
const events = await getByDateRange<Event>(
  EntityPrefix.EVENT,
  "upcoming",
  'DATE#',
  { start: '2023-01-01', end: '2023-12-31' }
);
```

## Complex Relationships

### Artist-Event-Performance Chain
```typescript
// Event has performances
PK: "EVENT#123"
SK: "PERFORMANCE#456"

// Performance has artists
PK: "PERFORMANCE#456" 
SK: "ARTIST#789"

// Performance has compositions
PK: "PERFORMANCE#456"
SK: "COMPOSITION#101#order"

// Reverse lookups via GSI
GSI1PK: "ARTIST#789"
GSI1SK: "PERFORMS#456#2023-01-01"

GSI2PK: "COMPOSITION#101"
GSI2SK: "PERFORMANCE#456"
```

### Karma and Permissions
```typescript
// Karma history
PK: "USER#123"
SK: "KARMA#2023-01-01T10:00:00.000Z"

// Karma permissions
PK: "USER#123" 
SK: "KARMA_PERMISSION#artist#edit"

// Permission rules
PK: "KARMA_RULE#artist"
SK: "PERMISSION#create"
```

## Query Builder Examples

### Basic Query
```typescript
const users = await createQuery<User>()
  .withPartitionKey('pk', formatKey(EntityPrefix.USER, userId))
  .withSortKeyBeginsWith('sk', SecondaryPrefix.FOLLOWS)
  .withLimit(20)
  .execute();
```

### Index Query
```typescript
const artists = await createQuery<Artist>()
  .withIndex('GSI2')
  .withPartitionKey('GSI2PK', 'INSTRUMENT#violin')
  .withSortKeyBeginsWith('GSI2SK', 'ARTIST#')
  .withLimit(50)
  .execute();
```

### Complex Query with Filters
```typescript
const events = await createQuery<Event>()
  .withIndex('GSI1')
  .withPartitionKey('GSI1PK', 'STATUS#scheduled')
  .withSortKeyBetween('GSI1SK', 'DATE#2023-01-01', 'DATE#2023-12-31')
  .withFilter('location.country', '=', 'India')
  .withLimit(25)
  .execute();
```

## Helper Functions

### Key Formatting
```typescript
// Entity keys
const userKey = formatKey(EntityPrefix.USER, "123");
// Returns: "USER#123"

// Date sort keys
const dateKey = formatDateSortKey(SecondaryPrefix.DATE, "2023-01-01", "EVENT#123");
// Returns: "DATE#2023-01-01#EVENT#123"

// Version keys
const versionKey = formatVersionKey("v1", "2023-01-01T10:00:00.000Z");
// Returns: "VERSION#v1#2023-01-01T10:00:00.000Z"
```

### ID Generation
```typescript
// Generate entity IDs
const userId = await generatePrefixedId('user');
// Returns: "user_01FQMQZX3K9Y8J7H6G5F4D3C2B"

const artistId = await generatePrefixedId('artist');
// Returns: "artist_01FQMQZX3K9Y8J7H6G5F4D3C2B"
```

## Transaction Patterns

### Create Related Items
```typescript
// Create artist with management relationship
const artist = await createRelatedItems(artistData, [
  {
    pk: formatKey(EntityPrefix.ARTIST, artistId),
    sk: `MANAGER#${userId}`,
    permissions: { editProfile: true, /* ... */ },
    grantedBy: userId,
    grantedAt: getCurrentISOString()
  }
]);
```

### Update with Version
```typescript
// Create new version of composition
const newVersion = await transactWriteItems([
  // Update latest pointer
  {
    pk: formatKey(EntityPrefix.COMPOSITION, compositionId),
    sk: "VERSION#LATEST",
    latestVersion: newVersionKey
  },
  // Create new version
  {
    pk: formatKey(EntityPrefix.COMPOSITION, compositionId),
    sk: newVersionKey,
    ...compositionData,
    version: newVersion,
    editedBy: [...existingEditors, userId]
  }
]);
```

## Pagination

### Token-Based Pagination
```typescript
const result = await createQuery<Artist>()
  .withPartitionKey('pk', 'ARTIST#')
  .withLimit(20)
  .withStartKey(parseNextToken(nextToken))
  .execute();

// Result includes nextToken for continuation
const { items, nextToken: newNextToken, hasMore } = result;
```

## Search Implementation

### Basic Search (DynamoDB Scan)
```typescript
const results = await basicSearch<Artist>("ravi shankar", {
  fields: [
    { name: 'name', weight: 3 },
    { name: 'bio', weight: 1 },
    { name: 'instruments', weight: 2 }
  ],
  limit: 20
});
```

### Elasticsearch Sync Pattern
```typescript
// Track sync status
PK: "SYNC#artist"
SK: "ID#456" 
lastSyncedAt: "2023-01-01T10:00:00.000Z"
status: "synced" | "pending" | "failed"
```