# Entity Overview

This section documents all ElectroDB entities and their related functions in the Rasika.life codebase.

## Entities

| Entity | File | Description |
|--------|------|-------------|
| [Artist](artist.md) | artist | Musicians, composers, and gurus |
| [Award](award.md) | award | Awards and honours |
| [Event](event.md) | event | Music events, concerts, and performances |
| [Venue](venue.md) | venue | Event locations |
| [Organiser](organiser.md) | organiser | Event organizers |
| [Festival](festival.md) | festival | Multi-day music festivals |
| [Composition](composition.md) | composition | Musical compositions with lyrics |
| [Raga](raga.md) | raga | Raga (melodic framework) |
| [Tala](tala.md) | tala | Talas (rhythmic cycles) |
| [User](user.md) | user | Application users |
| [Content](content.md) | content | CMS content/pages |
| [Edit](edit.md) | edit | Edit proposals and approvals |
| [ChangeHistory](change-history.md) | change-history | Field-level audit log for entity mutations |
| [SocialPost](social-post.md) | social-post | Scraped social media posts for event extraction |

## Junction Tables

| Entity | File | Description |
|--------|------|-------------|
| [ArtistAward](artist-award.md) | artist-award | Links artists to awards |
| [CompositionRaga](composition-raga.md) | composition-raga | Links compositions to ragas |
| [CompositionTala](composition-tala.md) | composition-tala | Links compositions to talas |
| [EventArtist](event-artist.md) | event-artist | Links events to artists (with denormalized display fields) |
| [Rsvp](rsvp.md) | rsvp | User attendance for an event — pk: `RSVP#${eventId}`, sk: `USER#${userId}` |
| [ConcertLog](concert-log.md) | concert-log | User's personal concert book — concerts they have attended, with private notes |

## Common Patterns

All entities follow these ElectroDB patterns:

### CRUD Operations
- `create<Entity>(input)` - Create new entity
- `get<Entity>(id)` - Get entity by ID
- `get<Entity>ByName(name)` - Get entity by name (where applicable)
- `update<Entity>(id, input)` - Update entity
- `delete<Entity>(id)` - Hard delete
- `softDelete<Entity>(id)` - Soft delete (marks as deleted)

### Listing
- `list<Entities>(params?)` - List all entities with pagination
- `list<Entities>By<Type>(value, params?)` - List by specific attribute

### Merging
- `merge<Entity>(loserId, canonicalId)` - Merge duplicate entities
- `get<Entity>MergeScore(id)` - Calculate merge priority score

## Import

tRPC routers and server-side Lambda code use namespace imports from the barrel:

```typescript
// Namespace import (preferred in server code — matches barrel re-exports)
import { Artist, Composition, Raga, Event } from '@rasika/core';
Artist.createArtist(input);
Event.getEvent(id);

// Subpath import — works everywhere, avoids loading the full barrel
import { createArtist, getArtist } from '@rasika/core/domain/artist';

// Browser-safe types and schemas only (web routes, client components)
import type { Artist } from '@rasika/core/domain/artist/client';
```

Never import from the bare `@rasika/core` entry in web route files — the main entry includes Node.js-only deps (AWS SDK, ElectroDB) that crash the browser bundle. Use subpath or `/client` imports there instead.

## Image Upload Domain

The `Image` namespace provides presigned S3 upload URLs for entity photos and logos. It is **not** an ElectroDB entity — it is a thin wrapper around S3 that reuses the `EVENT_POSTERS_BUCKET` / `EVENT_POSTERS_CDN_URL` environment variables.

```typescript
import { Image } from '@rasika/core';

const { uploadId, uploadUrl, imageUrl } = await Image.getImageUploadUrl(
  'venue',        // or 'organiser'
  'photo.jpg',
  'image/jpeg'
);
// PUT file directly to uploadUrl, then store imageUrl on the entity
```

Key pattern: `images/{entityType}/{uploadId}/{fileName}`

Exposed via tRPC as `venue.getImageUploadUrl` and `organiser.getImageUploadUrl` (both `editorProcedure`).
Web API route: `POST /api/upload/image` — accepts `entityType`, `fileName`, `contentType` form fields; requires authentication.
