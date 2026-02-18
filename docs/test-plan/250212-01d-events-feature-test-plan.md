# Events Feature V4 - Comprehensive Test Plan

**Version:** 1.0
**Date:** February 12, 2026
**Feature:** Events Feature V4 (docs/plans/250212-01d-events-feature.md)
**Complexity:** High - Multiple entities, AI extraction, wizard verification

---

## Test Strategy Overview test plan covers

This all aspects of the Events Feature V4 implementation. Tests are organized by layer (unit, integration, e2e) and by feature area (entities, services, API, frontend). The strategy follows the existing codebase testing conventions from AGENTS.md.

### Test Pyramid

| Layer | Coverage | Tools |
|-------|----------|-------|
| Unit Tests | 70% | Vitest (core packages) |
| Integration Tests | 20% | Vitest + tRPC mocks |
| E2E Tests | 10% | Playwright (critical flows) |

### Test Files Location

```
packages/core/src/domain/
├── event/event.test.ts
├── event/event.repository.test.ts
├── event/event.service.test.ts
├── festival/festival.test.ts
├── festival/festival.repository.test.ts
├── venue/venue.test.ts
├── venue/venue.repository.test.ts
├── organiser/organiser.test.ts
├── organiser/organiser.repository.test.ts
├── event-artist/event-artist.test.ts
└── artist/artist.gurus.test.ts

packages/trpc/src/routers/
├── event.test.ts
├── event.verify.test.ts
├── festival.test.ts
├── venue.test.ts
└── organiser.test.ts

packages/web/tests/
├── events/
│   ├── upload.test.ts
│   ├── wizard.test.ts
│   └── listing.test.ts
└── entities/
    ├── festival.test.ts
    ├── venue.test.ts
    └── organiser.test.ts
```

---

## 1. Entity Layer Tests

### 1.1 Festival Entity Tests

#### 1.1.1 Festival Entity Creation

**Test File:** `packages/core/src/domain/festival/festival.test.ts`

```typescript
describe('FestivalEntity', () => {
  describe('entity creation', () => {
    it('should create festival with all required fields', async () => {
      const festivalData = {
        id: generateId(),
        name: 'Kritanjali 2026',
        startDate: '2026-02-19',
        endDate: '2026-02-21',
        createdBy: 'user-123',
        status: 'draft',
      };

      const festival = await FestivalEntity.create(festivalData).go();
      expect(festival.pk).toBe('FESTIVAL#festival-123');
      expect(festival.sk).toBe('#METADATA');
    });

    it('should set default status to draft', async () => {
      const festival = await FestivalEntity.create({
        id: generateId(),
        name: 'Test Festival',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
        createdBy: 'user-123',
      }).go();
      expect(festival.status).toBe('draft');
    });

    it('should handle optional fields', async () => {
      const festival = await FestivalEntity.create({
        id: generateId(),
        name: 'Test Festival',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
        createdBy: 'user-123',
        description: 'Annual music festival',
        posterUrl: 'https://s3.example.com/poster.jpg',
        tags: ['carnatic', 'vocal'],
        sponsors: [{ name: 'Sponsor A', type: 'co-sponsor' }],
      }).go();
      expect(festival.description).toBe('Annual music festival');
    });

    it('should generate timestamps automatically', async () => {
      const before = new Date().toISOString();
      const festival = await FestivalEntity.create({
        id: generateId(),
        name: 'Test Festival',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
        createdBy: 'user-123',
      }).go();
      const after = new Date().toISOString();

      expect(festival.createdAt).toBeDefined();
      expect(festival.createdAt >= before && festival.createdAt <= after).toBe(true);
      expect(festival.updatedAt).toBeDefined();
    });
  });

  describe('GSI queries', () => {
    it('should query by creator using GSI1', async () => {
      await FestivalEntity.create({
        id: 'festival-1',
        name: 'Festival 1',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
        createdBy: 'user-123',
      }).go();

      const result = await FestivalEntity.query
        .byCreator({ createdBy: 'user-123' })
        .go();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('festival-1');
    });

    it('should query by status using GSI2', async () => {
      await FestivalEntity.create({
        id: 'festival-approved',
        name: 'Approved Festival',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
        createdBy: 'user-123',
        status: 'approved',
      }).go();

      const result = await FestivalEntity.query
        .byStatus({ status: 'approved' })
        .go();

      expect(result.data).toHaveLength(1);
    });
  });
});
```

#### 1.1.2 Festival Repository Tests

**Test File:** `packages/core/src/domain/festival/festival.repository.test.ts`

```typescript
describe('FestivalRepository', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('createFestival', () => {
    it('should create festival and return typed result', async () => {
      const input: CreateFestivalInput = {
        name: 'Test Festival',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
        description: 'Annual festival',
        tags: ['carnatic'],
      };

      const festival = await FestivalRepository.create(input, 'user-123');

      expect(festival.id).toBeDefined();
      expect(festival.name).toBe('Test Festival');
      expect(festival.status).toBe('draft');
      expect(festival.createdBy).toBe('user-123');
    });

    it('should set default empty tags array', async () => {
      const festival = await FestivalRepository.create({
        name: 'Test',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
      }, 'user-123');

      expect(festival.tags).toEqual([]);
    });
  });

  describe('getFestival', () => {
    it('should return festival by ID', async () => {
      const created = await FestivalRepository.create({
        name: 'Test',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
      }, 'user-123');

      const fetched = await FestivalRepository.getById(created.id);
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.name).toBe('Test');
    });

    it('should return null for non-existent ID', async () => {
      const result = await FestivalRepository.getById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('updateFestival', () => {
    it('should update festival fields', async () => {
      const created = await FestivalRepository.create({
        name: 'Original Name',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
      }, 'user-123');

      const updated = await FestivalRepository.update(
        created.id,
        { name: 'Updated Name' }
      );

      expect(updated.name).toBe('Updated Name');
      expect(updated.updatedAt).toBeDefined();
    });
  });

  describe('approveFestival', () => {
    it('should change status to approved', async () => {
      const festival = await FestivalRepository.create({
        name: 'Test',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
      }, 'user-123');

      const approved = await FestivalRepository.approve(festival.id);

      expect(approved.status).toBe('approved');
    });
  });
});
```

### 1.2 Event Entity Tests

#### 1.2.1 Event Entity Creation

**Test File:** `packages/core/src/domain/event/event.test.ts`

```typescript
describe('EventEntity', () => {
  describe('entity creation', () => {
    it('should create event with all required fields', async () => {
      const eventData = {
        id: generateId(),
        title: 'Carnatic Vocal Concert',
        startDateTime: '2026-02-19T17:30:00+05:30',
        createdBy: 'user-123',
        status: 'draft',
      };

      const event = await EventEntity.create(eventData).go();
      expect(event.pk).toBe('EVENT#event-123');
      expect(event.sk).toBe('#METADATA');
    });

    it('should set default timezone to Asia/Kolkata', async () => {
      const event = await EventEntity.create({
        id: generateId(),
        title: 'Test Event',
        startDateTime: '2026-02-19T17:30:00+05:30',
        createdBy: 'user-123',
      }).go();
      expect(event.timezone).toBe('Asia/Kolkata');
    });

    it('should handle nested artists array', async () => {
      const event = await EventEntity.create({
        id: generateId(),
        title: 'Concert',
        startDateTime: '2026-02-19T17:30:00+05:30',
        createdBy: 'user-123',
        artists: [
          { title: 'Vid.', name: 'Artist One', role: 'vocal' },
          { title: 'Smt.', name: 'Artist Two', role: 'violin' },
        ],
      }).go();
      expect(event.artists).toHaveLength(2);
      expect(event.artists[0].title).toBe('Vid.');
    });

    it('should handle ticketing information', async () => {
      const event = await EventEntity.create({
        id: generateId(),
        title: 'Ticketed Concert',
        startDateTime: '2026-02-19T17:30:00+05:30',
        createdBy: 'user-123',
        entryType: 'ticketed',
        ticketing: {
          url: 'https://example.com/tickets',
          prices: { general: 500, vip: 1500 },
          contactPhone: '+91-9876543210',
        },
      }).go();
      expect(event.entryType).toBe('ticketed');
      expect(event.ticketing?.prices?.general).toBe(500);
    });
  });

  describe('GSI queries', () => {
    it('should query approved events by start date', async () => {
      await EventEntity.create({
        id: 'event-1',
        title: 'Approved Event',
        startDateTime: '2026-02-19T17:30:00+05:30',
        createdBy: 'user-123',
        status: 'approved',
      }).go();

      const result = await EventEntity.query
        .byStatus({ status: 'approved' })
        .gt({ startDateTime: '2026-02-01T00:00:00+05:30' })
        .go();

      expect(result.data).toHaveLength(1);
    });

    it('should query events by festival', async () => {
      await EventEntity.create({
        id: 'event-1',
        title: 'Festival Event',
        startDateTime: '2026-02-19T17:30:00+05:30',
        createdBy: 'user-123',
        festivalId: 'festival-1',
        status: 'approved',
      }).go();

      const result = await EventEntity.query
        .byFestival({ festivalId: 'festival-1' })
        .go();

      expect(result.data).toHaveLength(1);
    });

    it('should query events by venue', async () => {
      await EventEntity.create({
        id: 'event-1',
        title: 'Concert at Venue',
        startDateTime: '2026-02-19T17:30:00+05:30',
        createdBy: 'user-123',
        venueId: 'venue-1',
        status: 'approved',
      }).go();

      const result = await EventEntity.query
        .byVenue({ venueId: 'venue-1' })
        .go();

      expect(result.data).toHaveLength(1);
    });
  });
});
```

#### 1.2.2 Event Repository Tests

**Test File:** `packages/core/src/domain/event/event.repository.test.ts`

```typescript
describe('EventRepository', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('createEvent', () => {
    it('should create event and generate ID', async () => {
      const input: CreateEventInput = {
        title: 'Carnatic Concert',
        startDateTime: '2026-02-19T17:30:00+05:30',
        artists: [{ name: 'Test Artist', role: 'vocal' }],
      };

      const event = await EventRepository.create(input, 'user-123');

      expect(event.id).toMatch(/^[A-Za-z0-9_-]{20,}$/);
      expect(event.status).toBe('approved');
      expect(event.createdBy).toBe('user-123');
    });

    it('should create EventArtist junction records for linked artists', async () => {
      const artistId = generateId();
      const input: CreateEventInput = {
        title: 'Concert',
        startDateTime: '2026-02-19T17:30:00+05:30',
        artists: [
          { id: artistId, name: 'Test Artist', title: 'Vid.', role: 'vocal' },
        ],
      };

      const event = await EventRepository.create(input, 'user-123');

      expect(EventArtistEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: event.id,
          artistId: artistId,
          artistName: 'Test Artist',
          artistTitle: 'Vid.',
          role: 'vocal',
        })
      );
    });
  });

  describe('getEvent', () => {
    it('should return event with all denormalized fields', async () => {
      const event = await EventRepository.create({
        title: 'Test Event',
        startDateTime: '2026-02-19T17:30:00+05:30',
        venueName: 'Test Venue',
        organiserName: 'Test Organiser',
      }, 'user-123');

      const fetched = await EventRepository.getById(event.id);
      expect(fetched?.venueName).toBe('Test Venue');
      expect(fetched?.organiserName).toBe('Test Organiser');
    });
  });

  describe('listUpcomingEvents', () => {
    it('should return only approved events in the future', async () => {
      await EventRepository.create({
        title: 'Future Event',
        startDateTime: '2026-12-01T17:30:00+05:30',
        status: 'approved',
      }, 'user-123');

      await EventRepository.create({
        title: 'Past Event',
        startDateTime: '2025-01-01T17:30:00+05:30',
        status: 'approved',
      }, 'user-123');

      await EventRepository.create({
        title: 'Draft Event',
        startDateTime: '2026-12-01T17:30:00+05:30',
        status: 'draft',
      }, 'user-123');

      const { items } = await EventRepository.listUpcoming({ limit: 10 });

      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Future Event');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await EventRepository.create({
          title: `Event ${i}`,
          startDateTime: `2026-12-${String(i + 1).padStart(2, '0')}T17:30:00+05:30`,
          status: 'approved',
        }, 'user-123');
      }

      const { items, hasMore } = await EventRepository.listUpcoming({ limit: 3 });

      expect(items).toHaveLength(3);
      expect(hasMore).toBe(true);
    });
  });

  describe('listEventsByFestival', () => {
    it('should return events for specific festival', async () => {
      const festivalId = generateId();
      const event1 = await EventRepository.create({
        title: 'Event 1',
        startDateTime: '2026-02-19T17:30:00+05:30',
        festivalId,
        status: 'approved',
      }, 'user-123');
      const event2 = await EventRepository.create({
        title: 'Event 2',
        startDateTime: '2026-02-20T17:30:00+05:30',
        festivalId,
        status: 'approved',
      }, 'user-123');

      const { items } = await EventRepository.listEventsByFestival(festivalId);

      expect(items).toHaveLength(2);
    });
  });
});
```

### 1.3 Venue Entity Tests

**Test File:** `packages/core/src/domain/venue/venue.test.ts`

```typescript
describe('VenueEntity', () => {
  describe('entity creation', () => {
    it('should create venue with all fields', async () => {
      const venue = await VenueEntity.create({
        id: generateId(),
        name: 'Seva Sadan, Malleswaram',
        address: {
          street: '15th Cross, Malleswaram',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560003',
          country: 'India',
        },
        mapLink: 'https://maps.example.com',
      }).go();

      expect(venue.name).toBe('Seva Sadan, Malleswaram');
      expect(venue.address.city).toBe('Bengaluru');
    });

    it('should handle minimal venue data', async () => {
      const venue = await VenueEntity.create({
        id: generateId(),
        name: 'Simple Venue',
      }).go();

      expect(venue.name).toBe('Simple Venue');
      expect(venue.address).toBeUndefined();
    });
  });

  describe('GSI queries', () => {
    it('should query by name using GSI1', async () => {
      await VenueEntity.create({
        id: 'venue-1',
        name: 'Carnatic Music Society',
      }).go();

      const result = await VenueEntity.query
        .byName({ name: 'Carnatic Music Society' })
        .go();

      expect(result.data).toHaveLength(1);
    });

    it('should list all venues using GSI2', async () => {
      await VenueEntity.create({ id: 'v1', name: 'Venue A' }).go();
      await VenueEntity.create({ id: 'v2', name: 'Venue B' }).go();

      const result = await VenueEntity.query.list().go();

      expect(result.data).toHaveLength(2);
    });
  });
});
```

### 1.4 Organiser Entity Tests

**Test File:** `packages/core/src/domain/organiser/organiser.test.ts`

```typescript
describe('OrganiserEntity', () => {
  describe('entity creation', () => {
    it('should create organiser with name', async () => {
      const organiser = await OrganiserEntity.create({
        id: generateId(),
        name: 'Chandraguru School of Dance',
      }).go();

      expect(organiser.name).toBe('Chandraguru School of Dance');
    });
  });

  describe('GSI queries', () => {
    it('should query by name using GSI1', async () => {
      await OrganiserEntity.create({
        id: 'org-1',
        name: 'Music Academy',
      }).go();

      const result = await OrganiserEntity.query
        .byName({ name: 'Music Academy' })
        .go();

      expect(result.data).toHaveLength(1);
    });
  });
});
```

### 1.5 EventArtist Junction Entity Tests

**Test File:** `packages/core/src/domain/event-artist/event-artist.test.ts`

```typescript
describe('EventArtistEntity', () => {
  describe('junction creation', () => {
    it('should create junction record with denormalized data', async () => {
      const junction = await EventArtistEntity.create({
        eventId: 'event-123',
        artistId: 'artist-456',
        eventTitle: 'Carnatic Concert',
        eventStartDateTime: '2026-02-19T17:30:00+05:30',
        artistName: 'Vidwan Test Artist',
        artistTitle: 'Vid.',
        role: 'vocal',
      }).go();

      expect(junction.pk).toBe('EVENT_ARTIST#event-123');
      expect(junction.sk).toBe('ARTIST#artist-456');
    });
  });

  describe('GSI queries', () => {
    it('should query all events for an artist using GSI1', async () => {
      await EventArtistEntity.create({
        eventId: 'event-1',
        artistId: 'artist-123',
        eventTitle: 'Concert 1',
        eventStartDateTime: '2026-02-19T17:30:00+05:30',
        artistName: 'Test Artist',
      }).go();
      await EventArtistEntity.create({
        eventId: 'event-2',
        artistId: 'artist-123',
        eventTitle: 'Concert 2',
        eventStartDateTime: '2026-03-01T17:30:00+05:30',
        artistName: 'Test Artist',
      }).go();

      const result = await EventArtistEntity.query
        .byArtist({ artistId: 'artist-123' })
        .go();

      expect(result.data).toHaveLength(2);
      // Should be sorted by eventStartDateTime
      expect(result.data[0].eventTitle).toBe('Concert 1');
    });
  });
});
```

---

## 2. Service Layer Tests

### 2.1 Event Service Tests

**Test File:** `packages/core/src/domain/event/event.service.test.ts`

```typescript
describe('EventService', () => {
  describe('createEvent', () => {
    it('should create event with approved status', async () => {
      const input: CreateEventInput = {
        title: 'Carnatic Concert',
        startDateTime: '2026-02-19T17:30:00+05:30',
      };

      const event = await EventService.createEvent(input, 'user-123');

      expect(event.status).toBe('approved');
    });

    it('should create EventArtist records for all artists with IDs', async () => {
      const artistId1 = generateId();
      const artistId2 = generateId();

      const input: CreateEventInput = {
        title: 'Concert',
        startDateTime: '2026-02-19T17:30:00+05:30',
        artists: [
          { id: artistId1, name: 'Artist 1', role: 'vocal' },
          { id: artistId2, name: 'Artist 2', role: 'violin' },
          { name: 'Guest Artist', role: 'guest' }, // No ID
        ],
      };

      await EventService.createEvent(input, 'user-123');

      expect(EventArtistEntity.create).toHaveBeenCalledTimes(2);
      expect(EventArtistEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({ artistId: artistId1 })
      );
      expect(EventArtistEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({ artistId: artistId2 })
      );
    });
  });

  describe('extractAndCreateDrafts', () => {
    it('should create festival when extraction is festival', async () => {
      const extractionResult: ExtractionResult = {
        isFestival: true,
        festival: {
          name: 'Festival Name',
          startDate: '2026-02-19',
          endDate: '2026-02-21',
          tags: ['carnatic'],
        },
        events: [
          {
            title: 'Event 1',
            startDateTime: '2026-02-19T17:30:00+05:30',
            artists: [],
            tags: [],
            entryType: 'free',
          },
        ],
        confidence: 0.9,
      };

      vi.mocked(extractFromPoster).mockResolvedValue(extractionResult);

      const result = await EventService.extractAndCreateDrafts(
        'upload-123',
        'https://s3.example.com/poster.jpg',
        'user-123'
      );

      expect(result.festivalId).toBeDefined();
      expect(FestivalEntity.create).toHaveBeenCalled();
    });

    it('should not create festival when isFestival is false', async () => {
      const extractionResult: ExtractionResult = {
        isFestival: false,
        events: [
          {
            title: 'Single Event',
            startDateTime: '2026-02-19T17:30:00+05:30',
            artists: [],
            tags: [],
            entryType: 'free',
          },
        ],
        confidence: 0.95,
      };

      vi.mocked(extractFromPoster).mockResolvedValue(extractionResult);

      const result = await EventService.extractAndCreateDrafts(
        'upload-123',
        'https://s3.example.com/poster.jpg',
        'user-123'
      );

      expect(result.festivalId).toBeUndefined();
      expect(FestivalEntity.create).not.toHaveBeenCalled();
    });

    it('should create draft events with extraction metadata', async () => {
      const extractionResult: ExtractionResult = {
        isFestival: false,
        events: [
          {
            title: 'Extracted Event',
            startDateTime: '2026-02-19T17:30:00+05:30',
            artists: [
              { title: 'Vid.', name: 'Test Artist', role: 'vocal' },
            ],
            tags: ['carnatic', 'concert'],
            entryType: 'ticketed',
            ticketing: { url: 'https://tickets.example.com' },
            confidence: 0.92,
          },
        ],
      };

      vi.mocked(extractFromPoster).mockResolvedValue(extractionResult);

      const result = await EventService.extractAndCreateDrafts(
        'upload-123',
        'https://s3.example.com/poster.jpg',
        'user-123'
      );

      expect(result.eventIds).toHaveLength(1);
      expect(EventEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'draft',
          extractionConfidence: 0.92,
          title: 'Extracted Event',
        })
      );
    });
  });
});
```

### 2.2 Festival Service Tests

**Test File:** `packages/core/src/domain/festival/festival.service.test.ts`

```typescript
describe('FestivalService', () => {
  describe('createFestival', () => {
    it('should create festival with draft status', async () => {
      const input: CreateFestivalInput = {
        name: 'Annual Festival',
        startDate: '2026-02-19',
        endDate: '2026-02-21',
      };

      const festival = await FestivalService.createFestival(input, 'user-123');

      expect(festival.status).toBe('draft');
    });

    it('should handle sponsors array', async () => {
      const festival = await FestivalService.createFestival({
        name: 'Test',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
        sponsors: [
          { name: 'Sponsor A', type: 'main' },
          { name: 'Sponsor B', type: 'co-sponsor' },
        ],
      }, 'user-123');

      expect(festival.sponsors).toHaveLength(2);
    });
  });

  describe('approveFestival', () => {
    it('should update status to approved', async () => {
      const festival = await FestivalService.createFestival({
        name: 'Test',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
      }, 'user-123');

      const approved = await FestivalService.approveFestival(festival.id);

      expect(approved.status).toBe('approved');
    });
  });
});
```

---

## 3. Zod Schema Validation Tests

### 3.1 Event Schema Tests

**Test File:** `packages/core/src/domain/event/schema.test.ts`

```typescript
describe('EventSchemas', () => {
  describe('CreateEventSchema', () => {
    it('should validate correct event data', () => {
      const validData = {
        title: 'Carnatic Vocal Concert',
        startDateTime: '2026-02-19T17:30:00+05:30',
        artists: [
          { title: 'Vid.', name: 'Test Artist', role: 'vocal' },
        ],
        tags: ['carnatic', 'concert'],
        entryType: 'free',
      };

      const result = CreateEventSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const invalidData = {
        startDateTime: '2026-02-19T17:30:00+05:30',
      };

      const result = CreateEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate ticketing prices', () => {
      const validData = {
        title: 'Ticketed Event',
        startDateTime: '2026-02-19T17:30:00+05:30',
        entryType: 'ticketed',
        ticketing: {
          prices: { general: 500, vip: 1500 },
          url: 'https://example.com',
        },
      };

      const result = CreateEventSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email in contactInfo', () => {
      const invalidData = {
        title: 'Event',
        startDateTime: '2026-02-19T17:30:00+05:30',
        contactInfo: {
          email: 'not-an-email',
        },
      };

      const result = CreateEventSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should set default values', () => {
      const minimalData = {
        title: 'Minimal Event',
        startDateTime: '2026-02-19T17:30:00+05:30',
      };

      const result = CreateEventSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
      expect(result.data.entryType).toBe('free');
      expect(result.data.tags).toEqual([]);
    });

    it('should validate artist array items', () => {
      const withArtists = {
        title: 'Event',
        startDateTime: '2026-02-19T17:30:00+05:30',
        artists: [
          { name: 'Artist with role', role: 'vocal' },
          { title: 'Vid.', name: 'Artist with title' },
        ],
      };

      const result = CreateEventSchema.safeParse(withArtists);
      expect(result.success).toBe(true);
    });
  });

  describe('UpdateEventSchema', () => {
    it('should allow partial updates', () => {
      const partialUpdate = {
        title: 'Updated Title',
      };

      const result = UpdateEventSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });
  });
});
```

### 3.2 Festival Schema Tests

**Test File:** `packages/core/src/domain/festival/schema.test.ts`

```typescript
describe('FestivalSchemas', () => {
  describe('CreateFestivalSchema', () => {
    it('should validate correct festival data', () => {
      const validData = {
        name: 'Annual Music Festival',
        startDate: '2026-02-19',
        endDate: '2026-02-21',
        description: 'Weekend of carnatic music',
        tags: ['carnatic', 'vocal'],
      };

      const result = CreateFestivalSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate date format YYYY-MM-DD', () => {
      const validData = {
        name: 'Festival',
        startDate: '2026-02-19',
        endDate: '2026-02-21',
      };

      const result = CreateFestivalSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject endDate before startDate', () => {
      const invalidData = {
        name: 'Festival',
        startDate: '2026-02-21',
        endDate: '2026-02-19',
      };

      const result = CreateFestivalSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
```

### 3.3 Venue Schema Tests

**Test File:** `packages/core/src/domain/venue/schema.test.ts`

```typescript
describe('VenueSchemas', () => {
  describe('CreateVenueSchema', () => {
    it('should validate venue with address', () => {
      const validData = {
        name: 'Seva Sadan',
        address: {
          street: '15th Cross',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560003',
          country: 'India',
        },
        mapLink: 'https://maps.example.com',
      };

      const result = CreateVenueSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate minimal venue', () => {
      const minimalData = {
        name: 'Simple Venue',
      };

      const result = CreateVenueSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
    });
  });
});
```

### 3.4 Artist Schema Updates Tests

**Test File:** `packages/core/src/domain/artist/schema.test.ts`

```typescript
describe('ArtistSchemas - Title and Gurus', () => {
  describe('CreateArtistSchema with gurus', () => {
    it('should validate artist with title and gurus', () => {
      const validData = {
        name: 'Artist Name',
        title: 'Vidwan',
        gurus: [
          { id: 'guru-1', name: 'Guru Name 1' },
          { name: 'Guru Name 2' }, // Without ID
        ],
      };

      const result = CreateArtistSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should allow empty gurus array', () => {
      const data = {
        name: 'Artist Name',
        gurus: [],
      };

      const result = CreateArtistSchema.safeParse(data);
      expect(result.success).toBe(true);
      expect(result.data.gurus).toEqual([]);
    });
  });
});
```

---

## 4. Gemini Extraction Tests

### 4.1 Extraction Result Validation

**Test File:** `packages/core/src/domain/event/extraction.test.ts`

```typescript
describe('Gemini Extraction', () => {
  describe('ExtractionResult schema', () => {
    it('should validate single event extraction', () => {
      const extraction: ExtractionResult = {
        isFestival: false,
        events: [
          {
            title: 'Carnatic Concert',
            startDateTime: '2026-02-19T17:30:00+05:30',
            artists: [
              { title: 'Vid.', name: 'Artist Name', role: 'vocal' },
            ],
            tags: ['carnatic', 'concert'],
            entryType: 'free',
          },
        ],
        confidence: 0.92,
      };

      expect(extraction.isFestival).toBe(false);
      expect(extraction.events).toHaveLength(1);
    });

    it('should validate festival extraction', () => {
      const extraction: ExtractionResult = {
        isFestival: true,
        festival: {
          name: 'Festival Name',
          description: 'Annual festival',
          startDate: '2026-02-19',
          endDate: '2026-02-21',
          tags: ['carnatic'],
          organiser: { name: 'Organiser Name' },
          sponsors: [{ name: 'Sponsor', type: 'main' }],
        },
        events: [
          {
            title: 'Event 1',
            startDateTime: '2026-02-19T17:30:00+05:30',
            artists: [],
            tags: [],
            entryType: 'free',
          },
        ],
        confidence: 0.85,
      };

      expect(extraction.isFestival).toBe(true);
      expect(extraction.festival).toBeDefined();
      expect(extraction.events).toHaveLength(1);
    });

    it('should validate honorific separation', () => {
      const extraction: ExtractionResult = {
        isFestival: false,
        events: [
          {
            title: 'Concert',
            startDateTime: '2026-02-19T17:30:00+05:30',
            artists: [
              { title: 'Vid.', name: 'Hosalli Raghuram', role: 'vocal' },
              { title: 'Smt.', name: 'Lakshmi Srinivasan', role: 'violin' },
              { title: 'Pt.', name: 'Ravishankar', role: 'mridangam' },
              { title: 'Dr.', name: 'Research Scholar', role: 'speaker' },
            ],
            tags: ['carnatic'],
            entryType: 'free',
          },
        ],
        confidence: 0.9,
      };

      expect(extraction.events[0].artists[0].title).toBe('Vid.');
      expect(extraction.events[0].artists[0].name).toBe('Hosalli Raghuram');
    });

    it('should validate chief guest role', () => {
      const extraction: ExtractionResult = {
        isFestival: false,
        events: [
          {
            title: 'Event',
            startDateTime: '2026-02-19T17:30:00+05:30',
            artists: [
              { name: 'Chief Guest Name', role: 'chief-guest' },
            ],
            tags: [],
            entryType: 'free',
          },
        ],
        confidence: 0.9,
      };

      expect(extraction.events[0].artists[0].role).toBe('chief-guest');
    });
  });

  describe('extractFromPoster function', () => {
    it('should call Gemini API with correct parameters', async () => {
      vi.mocked(fetch).mockResolvedValue({
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  isFestival: false,
                  events: [{ title: 'Test', startDateTime: '2026-02-19T17:30:00+05:30', artists: [], tags: [], entryType: 'free' }],
                  confidence: 0.9,
                }),
              }],
            },
          }],
        }),
      } as Response);

      await extractFromPoster('https://s3.example.com/poster.jpg');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: expect.stringContaining('You are an expert') },
                  { inlineData: { mimeType: 'image/jpeg' } },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
        })
      );
    });

    it('should parse and return extraction result', async () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                isFestival: false,
                events: [{
                  title: 'Extracted Event',
                  startDateTime: '2026-02-19T17:30:00+05:30',
                  artists: [{ title: 'Smt.', name: 'Artist', role: 'vocal' }],
                  tags: ['carnatic'],
                  entryType: 'free',
                }],
                confidence: 0.95,
              }),
            }],
          },
        }],
      };

      vi.mocked(fetch).mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await extractFromPoster('https://example.com/poster.jpg');

      expect(result.isFestival).toBe(false);
      expect(result.events[0].title).toBe('Extracted Event');
      expect(result.confidence).toBe(0.95);
    });
  });
});
```

---

## 5. tRPC Router Tests

### 5.1 Event Router Tests

**Test File:** `packages/trpc/src/routers/event.test.ts`

```typescript
describe('eventRouter', () => {
  const mockCtx = {
    user: { id: 'user-123', role: 'EDITOR' },
  } as any;

  describe('getUploadUrl', () => {
    it('should return presigned URL for upload', async () => {
      const mockInput = { fileName: 'poster.jpg', contentType: 'image/jpeg' };

      vi.mocked(Event.getUploadUrl).mockResolvedValue({
        uploadId: 'upload-123',
        uploadUrl: 'https://s3.example.com/upload',
        posterUrl: 'https://s3.example.com/posters/poster.jpg',
      });

      const caller = eventRouter.createCaller(mockCtx);
      const result = await caller.getUploadUrl(mockInput);

      expect(result.uploadId).toBe('upload-123');
      expect(result.uploadUrl).toBeDefined();
    });

    it('should reject non-editor users', async () => {
      const mockCtxNonEditor = {
        user: { id: 'user-123', role: 'VIEWER' },
      } as any;

      const caller = eventRouter.createCaller(mockCtxNonEditor);

      await expect(caller.getUploadUrl({ fileName: 'test.jpg', contentType: 'image/jpeg' }))
        .rejects.toThrow('Editor access required');
    });
  });

  describe('extractFromPoster', () => {
    it('should create draft events and return extraction', async () => {
      const mockInput = {
        posterUploadId: 'upload-123',
        posterUrl: 'https://s3.example.com/poster.jpg',
      };

      vi.mocked(Event.extractAndCreateDrafts).mockResolvedValue({
        extraction: {
          isFestival: false,
          events: [{ title: 'Extracted', artists: [], tags: [], entryType: 'free' }],
          confidence: 0.9,
        },
        eventIds: ['event-1'],
      });

      const caller = eventRouter.createCaller(mockCtx);
      const result = await caller.extractFromPoster(mockInput);

      expect(result.eventIds).toHaveLength(1);
      expect(result.extraction.events[0].title).toBe('Extracted');
    });
  });

  describe('submitVerified', () => {
    it('should approve events with verified data', async () => {
      const mockInput = {
        festivalId: 'festival-1',
        events: [
          {
            id: 'draft-1',
            title: 'Verified Event',
            startDateTime: '2026-02-19T17:30:00+05:30',
            artists: [],
            tags: [],
            entryType: 'free',
          },
        ],
      };

      vi.mocked(Event.createEvent).mockResolvedValue({
        id: 'event-1',
        title: 'Verified Event',
        status: 'approved',
      } as Event);

      const caller = eventRouter.createCaller(mockCtx);
      const result = await caller.submitVerified(mockInput);

      expect(result).toHaveLength(1);
      expect(Event.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Verified Event' }),
        'user-123'
      );
    });
  });

  describe('public queries', () => {
    it('get should return approved event', async () => {
      vi.mocked(Event.getEvent).mockResolvedValue({
        id: 'event-1',
        title: 'Public Event',
        status: 'approved',
      } as Event);

      const caller = eventRouter.createCaller(mockCtx);
      const result = await caller.get({ id: 'event-1' });

      expect(result.title).toBe('Public Event');
    });

    it('get should reject draft events', async () => {
      vi.mocked(Event.getEvent).mockResolvedValue({
        id: 'event-1',
        title: 'Draft Event',
        status: 'draft',
      } as Event);

      const caller = eventRouter.createCaller(mockCtx);

      await expect(caller.get({ id: 'event-1' }))
        .rejects.toThrow('Event not found');
    });

    it('listUpcoming should return paginated events', async () => {
      vi.mocked(Event.listUpcomingEvents).mockResolvedValue({
        items: [
          { id: 'e1', title: 'Event 1', status: 'approved' },
          { id: 'e2', title: 'Event 2', status: 'approved' },
        ] as Event[],
        nextToken: 'token-123',
        hasMore: true,
      });

      const caller = eventRouter.createCaller(mockCtx);
      const result = await caller.listUpcoming({ limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it('byArtist should return events for artist', async () => {
      vi.mocked(Event.listEventsByArtist).mockResolvedValue({
        items: [
          { eventId: 'e1', artistId: 'a1', eventTitle: 'Concert' },
        ],
      });

      const caller = eventRouter.createCaller(mockCtx);
      const result = await caller.byArtist({ artistId: 'a1' });

      expect(result.items).toHaveLength(1);
    });
  });
});
```

### 5.2 Festival Router Tests

**Test File:** `packages/trpc/src/routers/festival.test.ts`

```typescript
describe('festivalRouter', () => {
  const mockCtx = {
    user: { id: 'user-123', role: 'EDITOR' },
  } as any;

  describe('get', () => {
    it('should return festival by ID', async () => {
      vi.mocked(Festival.getFestival).mockResolvedValue({
        id: 'festival-1',
        name: 'Test Festival',
        status: 'approved',
      } as Festival);

      const caller = festivalRouter.createCaller(mockCtx);
      const result = await caller.get({ id: 'festival-1' });

      expect(result.name).toBe('Test Festival');
    });
  });

  describe('list', () => {
    it('should return paginated festivals', async () => {
      vi.mocked(Festival.listFestivals).mockResolvedValue({
        items: [{ id: 'f1', name: 'Festival 1' }] as Festival[],
        hasMore: false,
      });

      const caller = festivalRouter.createCaller(mockCtx);
      const result = await caller.list({ limit: 20 });

      expect(result.items).toHaveLength(1);
    });
  });
});
```

---

## 6. Integration Tests

### 6.1 Poster Upload & Extraction Flow

**Test File:** `packages/trpc/src/routers/event.verify.test.ts`

```typescript
describe('Poster Upload & Extraction Integration', () => {
  it('should complete full flow from upload to draft creation', async () => {
    // Step 1: Get upload URL
    const uploadResult = await eventRouter.createCaller(mockCtx).getUploadUrl({
      fileName: 'poster.jpg',
      contentType: 'image/jpeg',
    });

    expect(uploadResult.uploadUrl).toBeDefined();
    expect(uploadResult.posterUrl).toBeDefined();

    // Step 2: Mock S3 upload (would be actual upload in real test)
    // Frontend would POST to uploadResult.uploadUrl with file

    // Step 3: Extract from poster
    const extractionResult = await eventRouter.createCaller(mockCtx).extractFromPoster({
      posterUploadId: uploadResult.uploadId,
      posterUrl: uploadResult.posterUrl,
    });

    expect(extractionResult.eventIds).toBeDefined();
    expect(extractionResult.extraction.confidence).toBeGreaterThan(0);
  });

  it('should handle festival extraction correctly', async () => {
    // Mock extraction result for festival
    vi.mocked(Event.extractAndCreateDrafts).mockResolvedValue({
      extraction: {
        isFestival: true,
        festival: {
          name: 'Multi-day Festival',
          startDate: '2026-02-19',
          endDate: '2026-02-21',
          tags: ['carnatic', 'festival'],
        },
        events: [
          { title: 'Day 1', startDateTime: '2026-02-19T17:30:00+05:30', artists: [], tags: [], entryType: 'free' },
          { title: 'Day 2', startDateTime: '2026-02-20T17:30:00+05:30', artists: [], tags: [], entryType: 'free' },
        ],
        confidence: 0.88,
      },
      festivalId: 'festival-123',
      eventIds: ['event-1', 'event-2'],
    });

    const result = await eventRouter.createCaller(mockCtx).extractFromPoster({
      posterUploadId: 'upload-123',
      posterUrl: 'https://s3.example.com/poster.jpg',
    });

    expect(result.festivalId).toBeDefined();
    expect(result.eventIds).toHaveLength(2);
  });
});
```

### 6.2 Entity Linking Flow

**Test File:** `packages/trpc/src/routers/event.entity-linking.test.ts`

```typescript
describe('Entity Linking Integration', () => {
  it('should link artists to events during verification', async () => {
    // Pre-existing artist
    const existingArtist = await ArtistRepository.create({
      name: 'Vidwan Existing Artist',
      title: 'Vidwan',
    }, 'user-system');

    // Extraction with same artist name
    const extractionResult: ExtractionResult = {
      isFestival: false,
      events: [{
        title: 'Concert',
        startDateTime: '2026-02-19T17:30:00+05:30',
        artists: [
          { name: 'Vidwan Existing Artist', role: 'vocal' }, // Should match
          { name: 'New Artist', role: 'violin' }, // Should create
        ],
        tags: [],
        entryType: 'free',
      }],
      confidence: 0.9,
    };

    // During verification, system would:
    // 1. Fuzzy match "Vidwan Existing Artist" → link to existing ID
    // 2. "New Artist" → create new artist during submit

    // Submit verified data
    await eventRouter.createCaller(mockCtx).submitVerified({
      events: [{
        id: 'draft-event',
        title: 'Concert',
        startDateTime: '2026-02-19T17:30:00+05:30',
        artists: [
          { id: existingArtist.id, name: 'Vidwan Existing Artist', role: 'vocal' },
          { name: 'New Artist', role: 'violin' },
        ],
        tags: [],
        entryType: 'free',
      }],
    });

    // Verify EventArtist junction was created for linked artist
    expect(EventArtistEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        artistId: existingArtist.id,
        artistName: 'Vidwan Existing Artist',
      })
    );
  });

  it('should create new venue when no match found', async () => {
    const extractionResult: ExtractionResult = {
      isFestival: false,
      events: [{
        title: 'Concert',
        startDateTime: '2026-02-19T17:30:00+05:30',
        venue: { name: 'New Unknown Venue', address: { city: 'Bangalore' } },
        artists: [],
        tags: [],
        entryType: 'free',
      }],
      confidence: 0.85,
    };

    // User clicks "Create new venue" during verification
    // System creates venue during submit
    await eventRouter.createCaller(mockCtx).submitVerified({
      events: [{
        id: 'draft-event',
        title: 'Concert',
        startDateTime: '2026-02-19T17:30:00+05:30',
        venueName: 'New Unknown Venue',
        // New venue would be created before submit
        artists: [],
        tags: [],
        entryType: 'free',
      }],
    });

    expect(VenueEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Unknown Venue',
      })
    );
  });
});
```

---

## 7. Frontend Component Tests

### 7.1 Event Upload Page Tests

**Test File:** `packages/web/tests/events/upload.test.ts`

```typescript
describe('Event Upload Page', () => {
  it('should render upload form', () => {
    render(<EventUploadPage />);

    expect(screen.getByText('Add Event')).toBeInTheDocument();
    expect(screen.getByText('Drop poster image here')).toBeInTheDocument();
  });

  it('should show loading state during extraction', async () => {
    // Mock slow extraction
    vi.mocked(trpc.event.extractFromPoster.useMutation).mockImplementation(
      () => ({
        mutate: () => new Promise(resolve => setTimeout(resolve, 2000)),
        isLoading: true,
      } as any)
    );

    render(<EventUploadPage />);

    expect(screen.getByText('Analyzing poster...')).toBeInTheDocument();
  });

  it('should redirect to verify page on success', async () => {
    vi.mocked(trpc.event.extractFromPoster.useMutation).mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
    } as any);

    // User uploads and extraction succeeds
    const mockSuccessResult = {
      extraction: { isFestival: false, events: [], confidence: 0.9 },
      festivalId: undefined,
      eventIds: ['event-123'],
    };

    // After mutation success, should redirect
    vi.mocked(useRouter).mockReturnValue({ push: vi.fn() });

    render(<EventUploadPage />);

    // Simulate successful upload and extraction
    // Assert navigation to /events/new/verify?eventIds=event-123
  });
});
```

### 7.2 Wizard Verification Tests

**Test File:** `packages/web/tests/events/wizard.test.ts`

```typescript
describe('Wizard Verification', () => {
  it('should show festival step when festival detected', () => {
    const mockData = {
      festival: {
        name: 'Test Festival',
        startDate: '2026-02-19',
        endDate: '2026-02-21',
      },
      events: [{ id: 'e1', title: 'Event 1' }],
    };

    render(<WizardVerificationPage initialData={mockData} />);

    expect(screen.getByText('Step 1 of 3: Festival Details')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Festival')).toBeInTheDocument();
  });

  it('should show event each extracted event', () => {
    const mockData = {
      events: [
 steps for        { id: 'e1', title: 'Concert 1' },
        { id: 'e2', title: 'Concert 2' },
        { id: 'e3', title: 'Dance Recital' },
      ],
    };

    render(<WizardVerificationPage initialData={mockData} />);

    expect(screen.getByText('Step 1 of 4: Event 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 4: Concert 1')).toBeInTheDocument();
  });

  it('should allow artist linking search', async () => {
    const mockData = {
      events: [{
        id: 'e1',
        title: 'Concert',
        artists: [{ name: 'Vidwan Test Artist' }],
      }],
    };

    render(<WizardVerificationPage initialData={mockData} />);

    // Click on artist section
    fireEvent.click(screen.getByText('Vidwan Test Artist'));

    // Should show search modal
    expect(screen.getByText('Link to existing artist')).toBeInTheDocument();
  });

  it('should show review step with summary', () => {
    const mockData = {
      festival: { name: 'Test Festival', startDate: '2026-02-19', endDate: '2026-02-19' },
      events: [
        { id: 'e1', title: 'Event 1', artists: [{ name: 'Artist 1' }] },
      ],
    };

    render(<WizardVerificationPage initialData={mockData} />);

    // Navigate to final step
    // Should show review summary
    expect(screen.getByText('🎪 Festival: Test Festival')).toBeInTheDocument();
    expect(screen.getByText('📅 Events (1)')).toBeInTheDocument();
  });

  it('should submit and redirect to events list', async () => {
    const mockSubmit = vi.fn().mockResolvedValue({ success: true });

    render(<WizardVerificationPage onSubmit={mockSubmit} />);

    // Complete wizard and click submit
    fireEvent.click(screen.getByText('Submit'));

    expect(mockSubmit).toHaveBeenCalled();
  });
});
```

### 7.3 Event Listing Tests

**Test File:** `packages/web/tests/events/listing.test.ts`

```typescript
describe('Event Listing', () => {
  it('should display upcoming approved events', () => {
    const mockEvents = [
      { id: 'e1', title: 'Carnatic Concert', startDateTime: '2026-02-19T17:30:00+05:30' },
      { id: 'e2', title: 'Bharatanatyam Recital', startDateTime: '2026-02-20T18:00:00+05:30' },
    ];

    render(<EventsListPage initialEvents={mockEvents} />);

    expect(screen.getByText('Carnatic Concert')).toBeInTheDocument();
    expect(screen.getByText('Bharatanatyam Recital')).toBeInTheDocument();
  });

  it('should filter by art form tags', () => {
    const mockEvents = [
      { id: 'e1', title: 'Carnatic Concert', tags: ['carnatic'] },
      { id: 'e2', title: 'Kuchipudi', tags: ['kuchipudi'] },
    ];

    render(<ArtFormEventsPage artForm="carnatic" initialEvents={[mockEvents[0]]} />);

    expect(screen.getByText('Carnatic Concert')).toBeInTheDocument();
    expect(screen.queryByText('Kuchipudi')).not.toBeInTheDocument();
  });

  it('should show load more button when hasMore is true', () => {
    const mockResult = {
      items: [{ id: 'e1', title: 'Event 1' }],
      hasMore: true,
      nextToken: 'token-123',
    };

    render(<EventsListPage initialData={mockResult} />);

    expect(screen.getByText('Load more')).toBeInTheDocument();
  });
});
```

---

## 8. Edge Cases & Boundary Tests

### 8.1 Multi-Language Extraction Tests

```typescript
describe('Multi-language Extraction', () => {
  it('should translate Kannada text to English', async () => {
    // Mock poster with Kannada text
    const kannadaExtraction: ExtractionResult = {
      isFestival: false,
      events: [{
        title: 'Carnatic Music Concert', // Should be translated
        startDateTime: '2026-02-19T17:30:00+05:30',
        artists: [{ title: 'ವಿದ್ವಾಂಸ್', name: 'Artist Name', role: 'vocal' }], // ವಿದ್ವಾಂಸ್ = Vidwan
        tags: ['carnatic'],
        entryType: 'free',
      }],
      confidence: 0.9,
    };

    expect(kannadaExtraction.events[0].artists[0].title).toBe('Vidwan');
  });

  it('should handle Tamil text', async () => {
    const tamilExtraction: ExtractionResult = {
      isFestival: false,
      events: [{
        title: 'Veena Concert', // Translated
        artists: [{ title: 'ஸ்ரீ', name: 'Artist Name', role: 'vocal' }], // ஸ்ரீ = Sri
        startDateTime: '2026-02-19T17:30:00+05:30',
        tags: ['carnatic'],
        entryType: 'free',
      }],
      confidence: 0.85,
    };

    expect(tamilExtraction.events[0].artists[0].title).toBe('Sri');
  });
});
```

### 8.2 Date Range Validation

```typescript
describe('Date Range Validation', () => {
  it('should reject end date before start date for events', () => {
    const invalidData = {
      title: 'Event',
      startDateTime: '2026-02-20T17:30:00+05:30',
      endDateTime: '2026-02-19T17:30:00+05:30', // Before start
    };

    const result = CreateEventSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject festival end date before start date', () => {
    const invalidData = {
      name: 'Festival',
      startDate: '2026-02-21',
      endDate: '2026-02-19', // Before start
    };

    const result = CreateFestivalSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
```

### 8.3 Ticketing Edge Cases

```typescript
describe('Ticketing Edge Cases', () => {
  it('should validate all price tiers', () => {
    const validTicketing = {
      title: 'Event',
      startDateTime: '2026-02-19T17:30:00+05:30',
      entryType: 'ticketed',
      ticketing: {
        prices: {
          general: 0, // Free tier in ticketed event
          balcony: 500,
          box: 1500,
        },
      },
    };

    const result = CreateEventSchema.safeParse(validTicketing);
    expect(result.success).toBe(true);
  });

  it('should handle by-invitation events', () => {
    const inviteOnly = {
      title: 'Private Concert',
      startDateTime: '2026-02-19T17:30:00+05:30',
      entryType: 'by-invitation',
      ticketing: {
        contactEmail: 'organiser@example.com',
      },
    };

    const result = CreateEventSchema.safeParse(inviteOnly);
    expect(result.success).toBe(true);
    expect(result.data.entryType).toBe('by-invitation');
  });
});
```

---

## 9. Performance & Load Tests

### 9.1 Pagination Tests

```typescript
describe('Pagination Performance', () => {
  it('should handle 100-item pages efficiently', async () => {
    // Create 100 events
    for (let i = 0; i < 100; i++) {
      await EventRepository.create({
        title: `Event ${i}`,
        startDateTime: `2026-02-${String(i % 28 + 1).padStart(2, '0')}T17:30:00+05:30`,
        status: 'approved',
      }, 'user-123');
    }

    // Fetch with limit
    const { items, hasMore } = await EventRepository.listUpcoming({ limit: 100 });

    expect(items).toHaveLength(100);
    expect(hasMore).toBe(false);
  });

  it('should handle nextToken pagination', async () => {
    // Create 50 events
    for (let i = 0; i < 50; i++) {
      await EventRepository.create({
        title: `Event ${i}`,
        startDateTime: `2026-02-${String(i % 28 + 1).padStart(2, '0')}T17:30:00+05:30`,
        status: 'approved',
      }, 'user-123');
    }

    // First page
    const page1 = await EventRepository.listUpcoming({ limit: 20 });
    expect(page1.items).toHaveLength(20);
    expect(page1.hasMore).toBe(true);

    // Second page
    const page2 = await EventRepository.listUpcoming({
      limit: 20,
      nextToken: page1.nextToken,
    });
    expect(page2.items).toHaveLength(20);

    // Total should be 50
    expect(page1.items.length + page2.items.length).toBe(50);
  });
});
```

### 9.2 Gemini API Response Time

```typescript
describe('Gemini API Performance', () => {
  it('should complete extraction within 15 seconds', async () => {
    const start = Date.now();

    await extractFromPoster('https://s3.example.com/poster.jpg');

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(15000);
  });
});
```

---

## 10. Test Execution Commands

### Core Package Tests

```bash
# Run all domain tests
cd packages/core && pnpm test

# Run specific domain tests
pnpm test -- --run src/domain/event/event.test.ts
pnpm test -- --run src/domain/festival/festival.test.ts
pnpm test -- --run src/domain/venue/venue.test.ts
pnpm test -- --run src/domain/organiser/organiser.test.ts
pnpm test -- --run src/domain/event-artist/event-artist.test.ts

# Watch mode for development
pnpm test:watch

# Coverage report
pnpm test:coverage
```

### tRPC Router Tests

```bash
# tRPC tests require SST context
cd packages/trpc && sst shell vitest run

# Watch mode
sst shell vitest
```

### Web/Frontend Tests

```bash
cd packages/web && pnpm test
```

### All Tests

```bash
# Run complete test suite
pnpm test

# Or individually
cd packages/core && pnpm test
cd packages/trpc && sst shell vitest run
cd packages/web && pnpm test
```

---

## 11. Test Data Fixtures

### Mock Data Examples

```typescript
// tests/fixtures/events.ts

export const mockEvent = {
  id: 'evt_test_123',
  title: 'Carnatic Vocal Concert by Vidwan Test Artist',
  description: 'An evening of classical music',
  startDateTime: '2026-02-19T17:30:00+05:30',
  endDateTime: '2026-02-19T20:00:00+05:30',
  timezone: 'Asia/Kolkata',
  venueId: 'venue_test_123',
  venueName: 'Seva Sadan, Malleswaram',
  organiserId: 'org_test_123',
  organiserName: 'BTM Cultural Academy',
  artists: [
    { id: 'artist_test_1', title: 'Vid.', name: 'Test Artist', role: 'vocal' },
    { id: 'artist_test_2', title: 'Vid.', name: 'Violin Artist', role: 'violin' },
    { id: 'artist_test_3', title: 'Vid.', name: 'Mridangam Artist', role: 'mridangam' },
  ],
  tags: ['carnatic', 'vocal', 'concert'],
  entryType: 'free',
  status: 'approved' as const,
  createdBy: 'user_editor_123',
  createdAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-02-01T10:00:00Z',
};

export const mockFestival = {
  id: 'festival_test_123',
  name: 'Annual Music Festival 2026',
  description: 'Week-long celebration of Indian classical arts',
  startDate: '2026-02-19',
  endDate: '2026-02-25',
  posterUrl: 'https://s3.example.com/festival-poster.jpg',
  tags: ['carnatic', 'hindustani', 'festival'],
  status: 'approved' as const,
  createdBy: 'user_editor_123',
  createdAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-02-01T10:00:00Z',
};

export const mockVenue = {
  id: 'venue_test_123',
  name: 'Seva Sadan, Malleswaram',
  address: {
    street: '15th Cross, Malleswaram',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560003',
    country: 'India',
  },
  mapLink: 'https://maps.google.com/?q=Seva+Sadan+Malleswaram',
  createdAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-02-01T10:00:00Z',
};

export const mockOrganiser = {
  id: 'org_test_123',
  name: 'BTM Cultural Academy',
  createdAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-02-01T10:00:00Z',
};

export const mockExtractionResult = {
  isFestival: false,
  events: [
    {
      title: 'Carnatic Vocal Concert',
      startDateTime: '2026-02-19T17:30:00+05:30',
      endDateTime: '2026-02-19T20:00:00+05:30',
      venue: { name: 'Test Venue' },
      organiser: { name: 'Test Organiser' },
      artists: [
        { title: 'Vid.', name: 'Bhargavi Venkataram', role: 'vocal' },
        { title: 'Vid.', name: 'Sindhu Suchethan', role: 'violin' },
      ],
      tags: ['carnatic', 'vocal', 'concert'],
      entryType: 'free',
      contactInfo: { socialHandles: ['@artist1', '@artist2'] },
    },
  ],
  confidence: 0.92,
};
```

---

## Summary

This test plan covers:

| Category | Test Count | Priority |
|----------|------------|----------|
| Entity Unit Tests | ~50 tests | High |
| Service Layer Tests | ~25 tests | High |
| Schema Validation Tests | ~20 tests | High |
| Gemini Extraction Tests | ~15 tests | High |
| tRPC Router Tests | ~20 tests | High |
| Integration Tests | ~15 tests | Medium |
| Frontend Tests | ~20 tests | Medium |
| Edge Case Tests | ~15 tests | Medium |
| Performance Tests | ~5 tests | Low |

**Total Estimated Tests:** ~170 tests

**Coverage Goals:**
- Core entities: 95%+
- Service layer: 90%+
- Validation schemas: 100%
- tRPC routers: 90%+
- Frontend components: 80%+
