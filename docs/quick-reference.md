# Quick Reference - Types, Constants & Utilities

## Core Package Import Patterns

The core package exports domain namespaces for grouped imports, or individual named imports:

```typescript
// Namespace imports (preferred for multiple functions from one domain)
import * as Artist from '@rasika/core/domain/artist';
import * as Composition from '@rasika/core/domain/composition';

// Or via main index (namespace re-exports)
import { Artist, Composition, Raga, Venue, Organiser, Image } from '@rasika/core';

// Individual function imports
import { createArtist, getArtist, listArtists } from '@rasika/core/domain/artist';

// Utilities
import { generateId, getCurrentISOString } from '@rasika/core/utils';

// Constants
import { ApplicationError, ErrorCode } from '@rasika/core';
```

## Pagination Types

```typescript
interface PaginationParams {
  limit?: number;
  nextToken?: string;
}

// All list functions return this shape
interface PaginatedResult<T> {
  items: T[];
  nextToken?: string;
  hasMore: boolean;
}
```

## Error Handling

```typescript
import { ApplicationError, ErrorCode } from '@rasika/core';

// Throw typed errors
throw new ApplicationError(ErrorCode.ARTIST_NOT_FOUND, `artist with ID ${id} not found`);

// Catch and check type
if (error instanceof ApplicationError) {
  console.error(error.code, error.message);
}
```

### ErrorCode Enum (key values)

```typescript
enum ErrorCode {
  // Not found
  ARTIST_NOT_FOUND, COMPOSITION_NOT_FOUND, RAGA_NOT_FOUND, TALA_NOT_FOUND,
  USER_NOT_FOUND, VENUE_NOT_FOUND, ORGANISER_NOT_FOUND, AWARD_NOT_FOUND,
  FESTIVAL_NOT_FOUND, EVENT_NOT_FOUND,

  // Operation failures
  ARTIST_CREATE_FAILED, ARTIST_UPDATE_FAILED, ARTIST_FETCH_FAILED,
  RAGA_CREATE_FAILED, TALA_CREATE_FAILED, USER_CREATE_FAILED,
  VENUE_CREATE_FAILED, ORGANISER_CREATE_FAILED, AWARD_CREATE_FAILED,
  FESTIVAL_CREATE_FAILED, EVENT_CREATE_FAILED,
  // (and corresponding _UPDATE_FAILED variants)

  // Generic
  VALIDATION_ERROR, DATABASE_ERROR,

  // Search
  SEARCH_INDEX_ERROR, SEARCH_INDEX_BUILD_FAILED, SEARCH_QUERY_FAILED,
}
```

## Utility Functions

### ID Generation
```typescript
import { generateId } from '@rasika/core/utils';

// Returns a KSUID string (time-sortable, globally unique)
const id = generateId(); // e.g. "2mzinCV9zyB8EBGaJuLi9KMTn15"
```

### Date Utilities
```typescript
import {
  getCurrentISOString,   // () => string — current UTC ISO timestamp
  formatDateYYYYMMDD,    // (date: Date) => string — e.g. "2025-03-02"
  toISOString,           // (date: Date | string | number) => string
  addDays,               // (date: Date, days: number) => Date
  isPast,                // (date: Date | string) => boolean
  isFuture,              // (date: Date | string) => boolean
  daysBetween,           // (dateA, dateB) => number
} from '@rasika/core/utils';
```

### Transliteration
```typescript
import { transliterate } from '@rasika/core/utils';
import type { TransliterationScheme } from '@rasika/core/utils';

// Schemes: 'itrans' | 'iast' | 'devanagari' | 'tamil' | 'telugu' | 'kannada'
const devanagari = transliterate('rAga', 'itrans', 'devanagari');
```

## Image Upload Helpers

```typescript
import { Image } from '@rasika/core';

// Generate presigned S3 PUT URL (5-min expiry)
// entityType: 'venue' | 'organiser'
const { uploadId, uploadUrl, imageUrl } = await Image.getImageUploadUrl(
  entityType,
  fileName,   // original filename
  contentType // MIME type, e.g. 'image/jpeg'
);

// Then PUT the file directly:
await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } });

// Store imageUrl on entity (e.g. venue.photoUrl, organiser.logoUrl)
```

Web API route for client-side uploads:
```typescript
// POST /api/upload/image
// FormData: { entityType: 'venue' | 'organiser', fileName: string, contentType: string }
// Returns: { uploadId, uploadUrl, imageUrl }
// Requires: authenticated session
```

## Domain Error Helpers

```typescript
import { notFoundError, createFailedError } from '@rasika/core/domain/helpers';

// Returns ApplicationError with the correct ErrorCode
throw notFoundError('artist', id);        // ARTIST_NOT_FOUND
throw createFailedError('artist', name);  // ARTIST_CREATE_FAILED
```

## Entity Type Pattern

Entity types are derived from ElectroDB — never hand-written:

```typescript
import type { EntityItem } from 'electrodb';
import { ArtistEntity } from './entity';

export type Artist = EntityItem<typeof ArtistEntity>;
```

## Change History Constants

```typescript
const CHANGE_ENTITY_TYPE = {
  COMPOSITION: 'composition',
  RAGA: 'raga',
  TALA: 'tala',
  ARTIST: 'artist',
} as const;

type ChangeAction = 'create' | 'update' | 'delete' | 'rollback';
```
