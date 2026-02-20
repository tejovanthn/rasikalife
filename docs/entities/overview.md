# Entity Overview

This section documents all ElectroDB entities and their related functions in the Rasika.life codebase.

## Entities

| Entity | File | Description |
|--------|------|-------------|
| [Artist](artist.md) | artist | Musicians, composers, and gurus |
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

## Junction Tables

| Entity | File | Description |
|--------|------|-------------|
| EventArtist | event-artist | Links events to artists |

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

```typescript
import { createArtist, getArtist, listArtists, ... } from '@rasika/core';
```
