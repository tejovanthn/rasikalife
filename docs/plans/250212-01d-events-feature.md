# Events Feature V4 - Complete Implementation Specification

**Version:** 4.0
**Date:** February 12, 2026
**Status:** Ready for Implementation
**Complexity Budget:** Moderate - Multiple new entities, AI extraction, wizard verification flow

---

## Overview

This specification defines the events feature for Rasika.life: AI-powered event extraction from posters with human verification. Users upload event posters, the system extracts structured data using Gemini API (including translation from Indic languages), and users verify/edit the extracted information through a wizard-style flow before events go live.

The feature supports single events, multi-event festivals, and multi-day schedules from a single poster upload. Events link to first-class Artist, Venue, and Organiser entities, with automatic creation when no match exists.

**Key differences from V3:**
- Festival entity for grouping related events
- Venue and Organiser as full domain entities (with their own pages)
- EventArtist junction entity for reverse lookups (artist's event history)
- Art form tags for filtering (`/carnatic/events`, `/kuchipudi/events`)
- Event type classification (concert, dance-recital, aradhana, debut, etc.)
- Expanded entry/ticketing model (free, ticketed with tiers, by-invitation)
- Chief guests treated as artists with `role: "chief-guest"`
- Honorific/title field on Artist entity (separate from name for fuzzy matching)
- Multi-event extraction (Gemini returns `Event[]` from one poster)
- Wizard-style verification UI
- Sponsor extraction and storage

---

## User Stories

### Story 1: Upload Poster and Verify Extracted Data

**As an** authenticated user (editor role)
**I want to** upload a poster and verify AI-extracted data through a wizard
**So that** I don't manually enter event details

**Flow:**
1. User navigates to `/events/new`
2. User selects poster image file
3. Poster uploads directly to S3 via presigned URL
4. System calls Gemini API synchronously to extract event data (show loading state)
5. User enters wizard-style verification:
   - Step 1 (if festival detected): Festival name, description, date range, organiser
   - Step 2...N: For each event — title, datetime, venue, artists, ticketing
   - Final step: Review summary
6. During verification, artists/venues/organisers are fuzzy-matched against existing entities
7. User can create new entities when no match found ("Create new artist from this")
8. User clicks "Submit"
9. Events created with `approved` status, immediately visible on site

**Acceptance Criteria:**
- Poster uploaded to S3 within 5 seconds
- Extraction response within 15 seconds (show catchy loading animation)
- All extracted fields editable at each wizard step
- Indic language text translated to English by Gemini
- Honorific titles (Vid., Vidwan, Vidushi, Smt., Sri, Pt., Dr.) separated from names
- Multi-event posters produce multiple events, optionally grouped under a festival

### Story 2: Browse and View Events

**As a** visitor
**I want to** browse upcoming approved events, filtered by art form
**So that** I can discover events to attend

**Flow:**
1. Homepage shows today's/tomorrow's events
2. `/events` shows all upcoming approved events
3. `/carnatic/events`, `/kuchipudi/events` etc. filter by art form tag
4. Clicking an event shows the detail page (`/events/:id`)
5. Clicking a festival shows its schedule (`/festivals/:id`)

**Acceptance Criteria:**
- Only `approved` events visible to public
- Events sorted by `startDateTime` ascending
- Festival page shows schedule grouped by date
- Artist/venue/organiser links navigate to their respective detail pages

### Story 3: View Events on Entity Pages

**As a** visitor
**I want to** see upcoming and past events on artist/venue/organiser pages
**So that** I can discover what an artist is performing or what's happening at a venue

**Flow:**
1. Visit an artist's page → see their upcoming/recent events
2. Visit a venue's page → see events at that venue
3. Visit an organiser's page → see events they've organized

**Acceptance Criteria:**
- Events displayed in chronological order on entity pages
- Links back to full event detail page

---

## Entities Overview

| Entity | Type | Purpose |
|--------|------|---------|
| **Festival** | New | Groups related events from multi-day/multi-event posters |
| **Event** | New | Individual event with datetime, venue, artists, ticketing |
| **EventArtist** | New (junction) | Links events to artists for reverse lookup |
| **Venue** | New | Physical location where events happen |
| **Organiser** | New | Organization or person that organizes events |
| **Artist** | Updated | Add `title` (honorific) and `guru` fields |

---

## Data Model

### 1. Festival Entity

```typescript
// packages/core/src/domain/festival/entity.ts

import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const FestivalEntity = new Entity(
  {
    model: {
      entity: 'festival',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      description: { type: 'string', required: false },
      startDate: { type: 'string', required: true }, // YYYY-MM-DD
      endDate: { type: 'string', required: true },   // YYYY-MM-DD
      posterUrl: { type: 'string', required: false },
      posterUploadId: { type: 'string', required: false },
      organiserId: { type: 'string', required: false },
      organiserName: { type: 'string', required: false }, // Denormalized
      tags: { type: 'list', items: { type: 'string' }, required: false, default: () => [] },
      sponsors: { type: 'any', required: false }, // Array<{ name: string; type?: string }>
      status: { type: 'string', required: true, default: 'draft' }, // draft | approved
      createdBy: { type: 'string', required: true },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
      updatedAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        set: () => new Date().toISOString(),
        watch: '*',
      },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['id'], template: 'FESTIVAL#${id}' },
        sk: { field: 'sk', composite: [], template: '#METADATA' },
      },
      byCreator: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['createdBy'], template: 'USER#${createdBy}' },
        sk: { field: 'gsi1sk', composite: ['createdAt'], template: 'FESTIVAL#${createdAt}' },
      },
      byStatus: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['status'], template: 'FESTIVAL_STATUS#${status}' },
        sk: { field: 'gsi2sk', composite: ['startDate'] },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Festival = EntityItem<typeof FestivalEntity>;
```

### 2. Event Entity

```typescript
// packages/core/src/domain/event/entity.ts

import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const EventEntity = new Entity(
  {
    model: {
      entity: 'event',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: { type: 'string', required: true },

      // Festival link (optional)
      festivalId: { type: 'string', required: false },
      festivalName: { type: 'string', required: false }, // Denormalized

      // Poster
      posterUrl: { type: 'string', required: false },
      posterUploadId: { type: 'string', required: false },

      // Core event data
      title: { type: 'string', required: true },
      description: { type: 'string', required: false },
      startDateTime: { type: 'string', required: true }, // ISO 8601
      endDateTime: { type: 'string', required: false },
      timezone: { type: 'string', required: true, default: 'Asia/Kolkata' },

      // Venue (denormalized + linked)
      venueId: { type: 'string', required: false },
      venueName: { type: 'string', required: false }, // Denormalized

      // Organiser (denormalized + linked)
      organiserId: { type: 'string', required: false },
      organiserName: { type: 'string', required: false }, // Denormalized

      // Artists (denormalized for display, canonical links in EventArtist entity)
      artists: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            id: { type: 'string', required: false },  // Linked artist ID (set during verification)
            title: { type: 'string', required: false }, // Honorific: Vidwan, Vidushi, etc.
            name: { type: 'string', required: true },
            role: { type: 'string', required: false },  // vocal, violin, chief-guest, etc.
          },
        },
        required: false,
        default: () => [],
      },

      // Classification
      tags: { type: 'list', items: { type: 'string' }, required: false, default: () => [] },
      // e.g., ['carnatic', 'vocal', 'concert'] or ['bharatanatyam', 'dance-recital']

      // Entry & Ticketing
      entryType: { type: 'string', required: false, default: 'free' },
      // 'free' | 'ticketed' | 'by-invitation'
      ticketing: { type: 'any', required: false },
      // { url?, prices?: Record<string, number>, contactPhone?, contactEmail?, partnerName? }

      // Contact & Social
      contactInfo: { type: 'any', required: false },
      // { phone?, email?, website?, socialHandles?: string[] }

      // Sponsors
      sponsors: { type: 'any', required: false },
      // Array<{ name: string; type?: string }>

      // Status
      status: { type: 'string', required: true, default: 'draft' }, // draft | approved

      // Extraction metadata
      extractionConfidence: { type: 'number', required: false },
      extractionRawResponse: { type: 'string', required: false },
      extractionTimestamp: { type: 'string', required: false },

      // Ownership & timestamps
      createdBy: { type: 'string', required: true },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
      updatedAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        set: () => new Date().toISOString(),
        watch: '*',
      },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['id'], template: 'EVENT#${id}' },
        sk: { field: 'sk', composite: [], template: '#METADATA' },
      },
      byCreator: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['createdBy'], template: 'USER#${createdBy}' },
        sk: { field: 'gsi1sk', composite: ['createdAt'], template: 'EVENT#${createdAt}' },
      },
      byStatus: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['status'], template: 'EVENT_STATUS#${status}' },
        sk: { field: 'gsi2sk', composite: ['startDateTime'] },
      },
      byFestival: {
        index: 'gsi3',
        pk: { field: 'gsi3pk', composite: ['festivalId'], template: 'FESTIVAL#${festivalId}' },
        sk: { field: 'gsi3sk', composite: ['startDateTime'] },
      },
      byVenue: {
        index: 'gsi4',
        pk: { field: 'gsi4pk', composite: ['venueId'], template: 'VENUE#${venueId}' },
        sk: { field: 'gsi4sk', composite: ['startDateTime'] },
      },
      byOrganiser: {
        index: 'gsi5',
        pk: { field: 'gsi5pk', composite: ['organiserId'], template: 'ORGANISER#${organiserId}' },
        sk: { field: 'gsi5sk', composite: ['startDateTime'] },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Event = EntityItem<typeof EventEntity>;
```

### 3. EventArtist Junction Entity

Purpose: Enables reverse lookup — "show all events for this artist" on artist detail pages.

```typescript
// packages/core/src/domain/event-artist/entity.ts

import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const EventArtistEntity = new Entity(
  {
    model: {
      entity: 'eventArtist',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      eventId: { type: 'string', required: true },
      artistId: { type: 'string', required: true },

      // Denormalized for display (avoid extra lookups)
      eventTitle: { type: 'string', required: true },
      eventStartDateTime: { type: 'string', required: true },
      artistName: { type: 'string', required: true },
      artistTitle: { type: 'string', required: false }, // Honorific
      role: { type: 'string', required: false },         // vocal, violin, chief-guest, etc.

      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['eventId'], template: 'EVENT_ARTIST#${eventId}' },
        sk: { field: 'sk', composite: ['artistId'], template: 'ARTIST#${artistId}' },
      },
      byArtist: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['artistId'], template: 'ARTIST_EVENTS#${artistId}' },
        sk: { field: 'gsi1sk', composite: ['eventStartDateTime'] },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type EventArtist = EntityItem<typeof EventArtistEntity>;
```

### 4. Venue Entity

```typescript
// packages/core/src/domain/venue/entity.ts

import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const VenueEntity = new Entity(
  {
    model: {
      entity: 'venue',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      address: {
        type: 'map',
        properties: {
          street: { type: 'string', required: false },
          city: { type: 'string', required: false },
          state: { type: 'string', required: false },
          postalCode: { type: 'string', required: false },
          country: { type: 'string', required: false },
        },
        required: false,
      },
      mapLink: { type: 'string', required: false },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
      updatedAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        set: () => new Date().toISOString(),
        watch: '*',
      },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['id'], template: 'VENUE#${id}' },
        sk: { field: 'sk', composite: [], template: '#METADATA' },
      },
      byName: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['name'], template: 'VENUE_NAME#${name}' },
        sk: { field: 'gsi1sk', composite: ['id'], template: 'VENUE#${id}' },
      },
      list: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: [], template: 'VENUE_LIST' },
        sk: { field: 'gsi2sk', composite: ['name', 'id'], template: '${name}#${id}' },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Venue = EntityItem<typeof VenueEntity>;
```

### 5. Organiser Entity

```typescript
// packages/core/src/domain/organiser/entity.ts

import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const OrganiserEntity = new Entity(
  {
    model: {
      entity: 'organiser',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
      updatedAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        set: () => new Date().toISOString(),
        watch: '*',
      },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['id'], template: 'ORGANISER#${id}' },
        sk: { field: 'sk', composite: [], template: '#METADATA' },
      },
      byName: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['name'], template: 'ORGANISER_NAME#${name}' },
        sk: { field: 'gsi1sk', composite: ['id'], template: 'ORGANISER#${id}' },
      },
      list: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: [], template: 'ORGANISER_LIST' },
        sk: { field: 'gsi2sk', composite: ['name', 'id'], template: '${name}#${id}' },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Organiser = EntityItem<typeof OrganiserEntity>;
```

### 6. Artist Entity Updates

Add `title` (honorific) and `gurus` (linked artist references) fields to the existing Artist entity:

```typescript
// packages/core/src/domain/artist/entity.ts — additions to attributes

title: { type: 'string', required: false },  // Honorific: Vidwan, Vidushi, Smt., Sri, Pt., Dr.
gurus: {                                      // Lineage: list of guru artist references
  type: 'list',
  items: {
    type: 'map',
    properties: {
      id: { type: 'string', required: false },    // Linked artist ID (if profile exists)
      name: { type: 'string', required: true },   // Guru name for display
    },
  },
  required: false,
  default: () => [],
},
```

**Guru auto-creation:** Gurus are artist profiles. During event verification:
- Guru names extracted by Gemini are fuzzy-matched against existing artists
- If matched → store `{ id, name }` (linked reference)
- If no match → store `{ name }` only (no `id`), and auto-create the artist profile during submission
- An artist can have multiple gurus (e.g., vocal guru + veena guru)

Update `CreateArtistSchema` and `UpdateArtistSchema` in `schema.ts`:

```typescript
export const CreateArtistSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(50).optional(),
  gurus: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(200),
  })).default([]),
});
```

---

## GSI Usage Summary

All entities share the same DynamoDB table and 6 GSIs. Different PK templates ensure no collisions.

| GSI | Used By | PK Template | Purpose |
|-----|---------|-------------|---------|
| gsi1 | Artist, Venue, Organiser, Festival, Event, EventArtist | `*_NAME#${name}`, `USER#${createdBy}`, `ARTIST_EVENTS#${artistId}` | byName, byCreator, byArtist |
| gsi2 | Artist, Venue, Organiser, Festival, Event | `*_LIST`, `*_STATUS#${status}` | list, byStatus |
| gsi3 | Event, Composition | `FESTIVAL#${festivalId}`, `LANGUAGE#${language}` | byFestival, byLanguage |
| gsi4 | Event, Composition | `VENUE#${venueId}`, `COMPOSITION_NAME#${title}` | byVenue, byName |
| gsi5 | Event, Composition | `ORGANISER#${organiserId}`, `COMPOSITION_LIST` | byOrganiser, list |
| gsi6 | (available) | — | Future use |

---

## Zod Validation Schemas

```typescript
// packages/core/src/domain/event/schema.ts

import { z } from 'zod';

export const CreateEventSchema = z.object({
  festivalId: z.string().optional(),
  posterUrl: z.string().url().optional(),
  posterUploadId: z.string().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  startDateTime: z.string().datetime(),
  endDateTime: z.string().datetime().optional(),
  timezone: z.string().default('Asia/Kolkata'),
  venueId: z.string().optional(),
  venueName: z.string().optional(),
  organiserId: z.string().optional(),
  organiserName: z.string().optional(),
  artists: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().optional(),
        name: z.string().min(1).max(200),
        role: z.string().optional(),
      })
    )
    .default([]),
  tags: z.array(z.string()).default([]),
  entryType: z.enum(['free', 'ticketed', 'by-invitation']).default('free'),
  ticketing: z
    .object({
      url: z.string().url().optional(),
      prices: z.record(z.string(), z.number()).optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().email().optional(),
      partnerName: z.string().optional(),
    })
    .optional(),
  contactInfo: z
    .object({
      phone: z.string().optional(),
      email: z.string().email().optional(),
      website: z.string().url().optional(),
      socialHandles: z.array(z.string()).optional(),
    })
    .optional(),
  sponsors: z.array(z.object({ name: z.string(), type: z.string().optional() })).optional(),
});

export const UpdateEventSchema = CreateEventSchema.partial();

// packages/core/src/domain/festival/schema.ts

export const CreateFestivalSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(),
  posterUrl: z.string().url().optional(),
  posterUploadId: z.string().optional(),
  organiserId: z.string().optional(),
  organiserName: z.string().optional(),
  tags: z.array(z.string()).default([]),
  sponsors: z.array(z.object({ name: z.string(), type: z.string().optional() })).optional(),
});

export const UpdateFestivalSchema = CreateFestivalSchema.partial();

// packages/core/src/domain/venue/schema.ts

export const CreateVenueSchema = z.object({
  name: z.string().min(1).max(200),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  mapLink: z.string().url().optional(),
});

export const UpdateVenueSchema = CreateVenueSchema.partial();

// packages/core/src/domain/organiser/schema.ts

export const CreateOrganiserSchema = z.object({
  name: z.string().min(1).max(200),
});

export const UpdateOrganiserSchema = CreateOrganiserSchema.partial();
```

---

## Gemini AI Extraction

### Extraction Response Schema

The Gemini API receives a poster image and returns structured data. The prompt must handle:
- Multi-language posters (Kannada, Tamil, Telugu, Hindi, Sanskrit → English translation)
- Single event and multi-event/festival posters
- Honorific separation (Vidwan/Vidushi/Smt./Sri/Pt./Dr. extracted as `title`)
- Art form inference from context (instruments, dance styles, event naming)
- Chief guests and guests of honour identified separately from performers

```typescript
// packages/core/src/domain/event/extraction.ts

export interface ExtractionResult {
  isFestival: boolean;

  festival?: {
    name: string;
    description?: string;
    startDate: string; // ISO 8601
    endDate: string; // ISO 8601
    organiser?: {
      name: string;
      contactPhone?: string;
      contactEmail?: string;
    };
    sponsors?: Array<{ name: string; type?: string }>;
    tags: string[]; // Inferred art forms and categories
  };

  events: Array<{
    title: string;
    description?: string;
    startDateTime: string; // ISO 8601
    endDateTime?: string; // ISO 8601
    venue?: {
      name: string;
      address?: {
        street?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      };
    };
    organiser?: {
      name: string;
      contactPhone?: string;
      contactEmail?: string;
    };
    artists: Array<{
      title?: string; // Separated honorific
      name: string;   // Name without honorific
      role?: string;  // vocal, violin, mridangam, chief-guest, guest-of-honour, emcee, etc.
    }>;
    tags: string[];
    entryType: 'free' | 'ticketed' | 'by-invitation';
    ticketing?: {
      url?: string;
      prices?: Record<string, number>;
      contactPhone?: string;
      contactEmail?: string;
      partnerName?: string;
    };
    contactInfo?: {
      phone?: string;
      email?: string;
      website?: string;
      socialHandles?: string[];
    };
    sponsors?: Array<{ name: string; type?: string }>;
  }>;

  confidence: number; // 0-1
}
```

### Gemini Prompt Design

```typescript
// packages/core/src/domain/event/gemini.ts

import { Config } from 'sst/node/config';

const EXTRACTION_PROMPT = `You are an expert at reading Indian classical arts event posters.
Analyze this poster image and extract structured event information.

IMPORTANT RULES:
1. If text is in any Indic language (Kannada, Tamil, Telugu, Hindi, Sanskrit, etc.),
   translate it to English while preserving proper nouns and names.
2. Separate honorific titles from artist names:
   - "Vid." / "Vidwan" / "Vidushi" / "Smt." / "Sri" / "Kum." / "Pt." / "Dr." / "Padmashri"
     go into the "title" field
   - The actual name goes into the "name" field
   - Example: "Vidwan Hosalli Raghuram" → { title: "Vidwan", name: "Hosalli Raghuram" }
3. Identify chief guests and guests of honour with role "chief-guest" or "guest-of-honour".
   They are NOT performing artists.
4. Identify the art form(s) from context and include as tags:
   - Music: carnatic, hindustani, light-music, bhajan, devotional, film-music
   - Dance: bharatanatyam, kuchipudi, mohiniyattam, odissi, kathak
   - Other: harikatha, jugalbandhi, orchestra
5. Classify event types as tags: concert, dance-recital, festival, aradhana,
   debut, award-ceremony, jugalbandhi, lecture-demonstration
6. If the poster contains MULTIPLE events (multi-day schedule, festival lineup),
   return each as a separate event in the events array and set isFestival: true.
7. For multi-day recurring non-music/non-arts items (like daily puja, abhisheka),
   do NOT create separate events — mention them in the festival description instead.
8. Determine entry type: "free" if "all are welcome" / "entry free",
   "ticketed" if prices are shown, "by-invitation" if invite-only.
9. Extract ticket prices as key-value pairs: { "general": 500, "vip": 1500 }
10. Extract sponsor names and classify as "sponsor" or "co-sponsor".
11. Extract all contact information (phone numbers, emails, social handles).

Return a JSON object matching this schema exactly:
{
  "isFestival": boolean,
  "festival": { ... } | null,
  "events": [ ... ],
  "confidence": number (0-1)
}`;

export async function extractFromPoster(posterUrl: string): Promise<ExtractionResult> {
  const apiKey = Config.GEMINI_API_KEY;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: await fetchImageAsBase64(posterUrl),
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    }
  );

  const result = await response.json();
  const text = result.candidates[0].content.parts[0].text;
  return JSON.parse(text) as ExtractionResult;
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}
```

### Example Extractions

**BTM Cultural Academy poster → Single event:**
```json
{
  "isFestival": false,
  "events": [{
    "title": "Concert for BTM Cultural Academy",
    "startDateTime": "2026-01-30T17:30:00+05:30",
    "endDateTime": "2026-01-30T20:00:00+05:30",
    "venue": { "name": "Shree Ramana Maharishi Academy for the Blind" },
    "organiser": { "name": "BTM Cultural Academy" },
    "artists": [
      { "title": "Vid.", "name": "Bhargavi Venkataram", "role": "vocal" },
      { "title": "Vid.", "name": "Sindhu Suchethan", "role": "violin" },
      { "title": "Vid.", "name": "Akshay Anand", "role": "mridangam" },
      { "title": "Vid.", "name": "Sharath Koushik", "role": "ghatam" }
    ],
    "tags": ["carnatic", "vocal", "concert"],
    "entryType": "free",
    "contactInfo": { "socialHandles": ["@mrid_boy", "@sindhusuchethan"] }
  }],
  "confidence": 0.92
}
```

**Shivasahasranama + Shivaratri poster → Festival with multiple events:**
```json
{
  "isFestival": true,
  "festival": {
    "name": "Shivasahasranama Laksharchana & Maha Shivaratri",
    "description": "Week-long celebration including daily Abhisheka, Shivasahasranama Archana, Bhajans, and Maha Shivaratri observance.",
    "startDate": "2026-02-08",
    "endDate": "2026-02-15",
    "tags": ["devotional", "bhajan", "festival"]
  },
  "events": [
    {
      "title": "Bhajans - Sri Anirudh Aithal (Hindustani Music)",
      "startDateTime": "2026-02-08T18:00:00+05:30",
      "endDateTime": "2026-02-08T19:00:00+05:30",
      "artists": [{ "title": "Sri", "name": "Anirudh Aithal", "role": "vocal" }],
      "tags": ["hindustani", "bhajan", "concert"],
      "entryType": "free"
    },
    {
      "title": "Bhajans - Sri Nischal Kumar & Group",
      "startDateTime": "2026-02-09T18:00:00+05:30",
      "endDateTime": "2026-02-09T19:00:00+05:30",
      "artists": [{ "title": "Sri", "name": "Nischal Kumar", "role": "vocal" }],
      "tags": ["bhajan", "concert"],
      "entryType": "free"
    }
    // ... more events for each day
  ],
  "confidence": 0.85
}
```

---

## Service Layer

Following the codebase pattern of plain exported functions:

```typescript
// packages/core/src/domain/event/index.ts

import { generateId } from '../../utils';
import { EventEntity } from './entity';
import type { Event } from './entity';
import { EventArtistEntity } from '../event-artist/entity';
import { extractFromPoster } from './gemini';
import type { ExtractionResult } from './extraction';

export async function createEvent(
  input: CreateEventInput,
  userId: string
): Promise<Event> {
  const id = generateId();
  const result = await EventEntity.create({
    id,
    ...input,
    status: 'approved',
    createdBy: userId,
  }).go();

  if (!result.data) {
    throw new Error('Failed to create event');
  }

  // Create EventArtist junction records for reverse lookup
  if (input.artists?.length) {
    await Promise.all(
      input.artists
        .filter((a) => a.id) // Only for linked artists
        .map((artist) =>
          EventArtistEntity.create({
            eventId: id,
            artistId: artist.id!,
            eventTitle: input.title,
            eventStartDateTime: input.startDateTime,
            artistName: artist.name,
            artistTitle: artist.title,
            role: artist.role,
          }).go()
        )
    );
  }

  return result.data as Event;
}

export async function getEvent(id: string): Promise<Event | null> {
  const result = await EventEntity.get({ id }).go();
  return (result.data as Event) || null;
}

export async function listUpcomingEvents(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{ items: Event[]; nextToken?: string; hasMore: boolean }> {
  const limit = params?.limit || 20;
  const result = await EventEntity.query
    .byStatus({ status: 'approved' })
    .gt({ startDateTime: new Date().toISOString() })
    .go({ limit, cursor: params?.nextToken });

  return {
    items: (result.data || []) as Event[],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function listEventsByFestival(
  festivalId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{ items: Event[]; nextToken?: string; hasMore: boolean }> {
  const result = await EventEntity.query
    .byFestival({ festivalId })
    .go({ limit: params?.limit || 50, cursor: params?.nextToken });

  return {
    items: (result.data || []) as Event[],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function listEventsByVenue(
  venueId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{ items: Event[]; nextToken?: string; hasMore: boolean }> {
  const result = await EventEntity.query
    .byVenue({ venueId })
    .go({ limit: params?.limit || 20, cursor: params?.nextToken });

  return {
    items: (result.data || []) as Event[],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function listEventsByOrganiser(
  organiserId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{ items: Event[]; nextToken?: string; hasMore: boolean }> {
  const result = await EventEntity.query
    .byOrganiser({ organiserId })
    .go({ limit: params?.limit || 20, cursor: params?.nextToken });

  return {
    items: (result.data || []) as Event[],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function listEventsByArtist(
  artistId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{ items: EventArtist[]; nextToken?: string; hasMore: boolean }> {
  const result = await EventArtistEntity.query
    .byArtist({ artistId })
    .go({ limit: params?.limit || 20, cursor: params?.nextToken });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function getUploadUrl(
  fileName: string,
  contentType: string
): Promise<{ uploadId: string; uploadUrl: string; posterUrl: string }> {
  // Implementation uses S3 presigned URL
  // See Infrastructure section
  const uploadId = generateId();
  const key = `posters/${uploadId}/${fileName}`;
  // ... S3 presigned URL generation
  return { uploadId, uploadUrl: '...', posterUrl: '...' };
}

export async function extractAndCreateDrafts(
  posterUploadId: string,
  posterUrl: string,
  userId: string
): Promise<{ extraction: ExtractionResult; festivalId?: string; eventIds: string[] }> {
  const extraction = await extractFromPoster(posterUrl);
  const eventIds: string[] = [];
  let festivalId: string | undefined;

  // Create festival if detected
  if (extraction.isFestival && extraction.festival) {
    const festival = await Festival.createFestival(
      {
        name: extraction.festival.name,
        description: extraction.festival.description,
        startDate: extraction.festival.startDate,
        endDate: extraction.festival.endDate,
        posterUrl,
        posterUploadId,
        tags: extraction.festival.tags,
        sponsors: extraction.festival.sponsors,
      },
      userId
    );
    festivalId = festival.id;
  }

  // Create draft events
  for (const eventData of extraction.events) {
    const id = generateId();
    await EventEntity.create({
      id,
      festivalId,
      festivalName: extraction.festival?.name,
      posterUrl,
      posterUploadId,
      title: eventData.title,
      description: eventData.description,
      startDateTime: eventData.startDateTime,
      endDateTime: eventData.endDateTime,
      venueName: eventData.venue?.name,
      organiserName: eventData.organiser?.name || extraction.festival?.organiser?.name,
      artists: eventData.artists,
      tags: eventData.tags,
      entryType: eventData.entryType,
      ticketing: eventData.ticketing,
      contactInfo: eventData.contactInfo,
      sponsors: eventData.sponsors,
      status: 'draft',
      extractionConfidence: extraction.confidence,
      extractionRawResponse: JSON.stringify(extraction),
      extractionTimestamp: new Date().toISOString(),
      createdBy: userId,
    }).go();
    eventIds.push(id);
  }

  return { extraction, festivalId, eventIds };
}

export { CreateEventSchema, UpdateEventSchema } from './schema';
export type { Event } from './entity';
```

---

## Pagination Conventions

All list/query functions follow the existing codebase pattern established in the Artist domain. This ensures consistent behavior across all new entities.

### Standard Return Shape

Every list function returns the same paginated structure:

```typescript
interface PaginatedResult<T> {
  items: T[];
  nextToken?: string; // Base64-encoded ElectroDB cursor, undefined when no more pages
  hasMore: boolean;   // Convenience flag: true when nextToken exists
}
```

### Standard Input Parameters

```typescript
interface PaginationParams {
  limit?: number;    // Page size, default 20, max 100
  nextToken?: string; // Cursor from previous response to fetch next page
}
```

### Defaults by Context

| Query | Default Limit | Rationale |
|-------|--------------|-----------|
| `listUpcomingEvents` | 20 | Main listing page, moderate page size |
| `listEventsByFestival` | 50 | Festivals may have many events, show all at once |
| `listEventsByVenue` | 20 | Standard entity detail page |
| `listEventsByOrganiser` | 20 | Standard entity detail page |
| `listEventsByArtist` | 20 | Standard entity detail page |
| `listFestivals` | 20 | Standard listing page |
| `listVenues` | 20 | Standard listing page |
| `listOrganisers` | 20 | Standard listing page |
| Homepage events (today/tomorrow) | 10 | Compact widget, link to full listing |

### tRPC Input Validation

All list endpoints validate pagination params consistently:

```typescript
// Standard pagination input used across all list endpoints
const paginationInput = z.object({
  limit: z.number().min(1).max(100).optional(),
  nextToken: z.string().optional(),
}).optional();
```

### Frontend Pagination Pattern

Follow the existing pattern from `carnatic.artists._index.tsx`:
- Initial page loaded via Remix loader (SSR)
- "Load more" button or infinite scroll triggers client-side tRPC query with `nextToken`
- `hasMore` controls visibility of the "Load more" button
- No page numbers — cursor-based pagination only (DynamoDB-native)

### Entity Detail Page Sub-lists

When events are shown on entity detail pages (artist, venue, organiser), follow the composition-on-artist pattern:
- Load first page in the Remix loader (e.g., `limit: 6`)
- Show "View more events" link if `hasMore` is true
- Link navigates to a dedicated sub-route or filters the `/events` page by entity

Example from artist detail page:
```typescript
// In loader for /artists/:id
const events = await client.event.byArtist.query({ artistId: artist.id, limit: 6 });
return data({ artist, events: events.items, hasMoreEvents: events.hasMore });
```

---

## tRPC Router

### New Procedure: editorProcedure

```typescript
// packages/trpc/src/trpc.ts — addition

export const editorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const editorRoles: Role[] = [ROLE.EDITOR, ROLE.MODERATOR, ROLE.ADMIN];
  if (!editorRoles.includes(ctx.user.role as Role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Editor access required',
    });
  }
  return next({ ctx });
});
```

### Event Router

```typescript
// packages/trpc/src/routers/event.ts

import { Event } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure, editorProcedure } from '../trpc';

export const eventRouter = createTRPCRouter({
  // === MUTATIONS ===

  getUploadUrl: editorProcedure
    .input(z.object({ fileName: z.string(), contentType: z.string() }))
    .mutation(({ input }) => Event.getUploadUrl(input.fileName, input.contentType)),

  extractFromPoster: editorProcedure
    .input(z.object({ posterUploadId: z.string(), posterUrl: z.string().url() }))
    .mutation(({ ctx, input }) =>
      Event.extractAndCreateDrafts(input.posterUploadId, input.posterUrl, ctx.user.id)
    ),

  submitVerified: editorProcedure
    .input(
      z.object({
        festivalId: z.string().optional(),
        festivalData: Event.CreateFestivalSchema.optional(),
        events: z.array(
          Event.CreateEventSchema.extend({ id: z.string() })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Update festival if provided
      if (input.festivalId && input.festivalData) {
        await Festival.updateFestival(input.festivalId, {
          ...input.festivalData,
          status: 'approved',
        });
      }

      // Update each event with verified data and approve
      const results = [];
      for (const eventInput of input.events) {
        const { id, ...data } = eventInput;
        const event = await Event.createEvent(
          { ...data, festivalId: input.festivalId },
          ctx.user.id
        );
        results.push(event);
      }
      return results;
    }),

  // === QUERIES ===

  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const event = await Event.getEvent(input.id);
      if (!event || event.status !== 'approved') {
        throw new Error('Event not found');
      }
      return event;
    }),

  listUpcoming: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      }).optional()
    )
    .query(({ input }) => Event.listUpcomingEvents(input)),

  byFestival: publicProcedure
    .input(z.object({ festivalId: z.string().min(1), limit: z.number().optional() }))
    .query(({ input }) => Event.listEventsByFestival(input.festivalId, { limit: input.limit })),

  byVenue: publicProcedure
    .input(z.object({ venueId: z.string().min(1), limit: z.number().optional(), nextToken: z.string().optional() }))
    .query(({ input }) => Event.listEventsByVenue(input.venueId, input)),

  byOrganiser: publicProcedure
    .input(z.object({ organiserId: z.string().min(1), limit: z.number().optional(), nextToken: z.string().optional() }))
    .query(({ input }) => Event.listEventsByOrganiser(input.organiserId, input)),

  byArtist: publicProcedure
    .input(z.object({ artistId: z.string().min(1), limit: z.number().optional(), nextToken: z.string().optional() }))
    .query(({ input }) => Event.listEventsByArtist(input.artistId, input)),
});
```

### Festival, Venue, Organiser Routers

Follow the same pattern as `artistRouter`:

```typescript
// packages/trpc/src/routers/festival.ts
export const festivalRouter = createTRPCRouter({
  get: publicProcedure.input(z.object({ id: z.string().min(1) })).query(...),
  list: publicProcedure.input(z.object({ limit, nextToken }).optional()).query(...),
});

// packages/trpc/src/routers/venue.ts
export const venueRouter = createTRPCRouter({
  get: publicProcedure.input(z.object({ id: z.string().min(1) })).query(...),
  list: publicProcedure.input(z.object({ limit, nextToken }).optional()).query(...),
  create: editorProcedure.input(Venue.CreateVenueSchema).mutation(...),
});

// packages/trpc/src/routers/organiser.ts
export const organiserRouter = createTRPCRouter({
  get: publicProcedure.input(z.object({ id: z.string().min(1) })).query(...),
  list: publicProcedure.input(z.object({ limit, nextToken }).optional()).query(...),
  create: editorProcedure.input(Organiser.CreateOrganiserSchema).mutation(...),
});
```

### Router Registration

```typescript
// packages/trpc/src/routers/index.ts — additions

import { eventRouter } from './event';
import { festivalRouter } from './festival';
import { venueRouter } from './venue';
import { organiserRouter } from './organiser';

export const appRouter = createTRPCRouter({
  // ... existing routers
  event: eventRouter,
  festival: festivalRouter,
  venue: venueRouter,
  organiser: organiserRouter,
});
```

---

## Frontend Pages

### Route Structure

| Route File | URL | Purpose |
|-----------|-----|---------|
| `events.new.tsx` | `/events/new` | Poster upload |
| `events.new.verify.tsx` | `/events/new/verify` | Wizard verification |
| `events._index.tsx` | `/events` | All upcoming events |
| `events.$eventid.tsx` | `/events/:id` | Event detail |
| `festivals.$festivalid.tsx` | `/festivals/:id` | Festival schedule |
| `festivals._index.tsx` | `/festivals` | All festivals |
| `venues.$venueid.tsx` | `/venues/:id` | Venue detail + events |
| `organisers.$organiserid.tsx` | `/organisers/:id` | Organiser detail + events |
| `$artform.events.tsx` | `/carnatic/events` etc. | Events filtered by art form |

### Page 1: Poster Upload (`/events/new`)

```
┌──────────────────────────────────────┐
│  Add Event                           │
│                                      │
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │    Drop poster image here      │  │
│  │    or click to browse          │  │
│  │                                │  │
│  │    Supports: JPG, PNG, WebP    │  │
│  │    Max size: 10MB              │  │
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  [Upload & Extract]                  │
│                                      │
└──────────────────────────────────────┘
```

**Flow:**
1. User selects image
2. Frontend calls `event.getUploadUrl` for presigned S3 URL
3. Frontend uploads directly to S3
4. Frontend calls `event.extractFromPoster` with `posterUploadId` and `posterUrl`
5. Shows loading animation: "Analyzing poster... Extracting event details..."
6. On success, redirects to `/events/new/verify?festivalId=...&eventIds=...`

### Page 2: Wizard Verification (`/events/new/verify`)

**Step 1 (if festival): Festival Details**
```
┌──────────────────────────────────────────────────────────┐
│  Step 1 of 4: Festival Details                           │
│                                                          │
│  ┌──────────┐  Festival Name: [Kritajnata 2026        ]  │
│  │          │  Description:   [National Festival of ... ]  │
│  │  Poster  │  Start Date:    [2026-02-19             ]  │
│  │  Preview │  End Date:      [2026-02-19             ]  │
│  │          │                                            │
│  │          │  Organiser: [Chandraguru School of Dance▼]  │
│  │          │    🔍 Search existing...                    │
│  │          │    ➕ Create "Chandraguru School of Dance"  │
│  │          │                                            │
│  └──────────┘  Tags: [bharatanatyam] [kuchipudi] [+]     │
│                                                          │
│                              [Back] [Next: Event 1 →]    │
└──────────────────────────────────────────────────────────┘
```

**Step 2...N: Individual Event Details**
```
┌──────────────────────────────────────────────────────────┐
│  Step 2 of 4: Event 1 — Deepak Mazumdar                  │
│                                                          │
│  Title:      [Bharatanatyam by Shri Deepak Mazumdar   ]  │
│  Start:      [2026-02-19T17:30] End: [2026-02-19T18:30]  │
│  Entry:      [Free ▼]                                    │
│                                                          │
│  Venue:      [Seva Sadan, Malleswaram ▼]                 │
│    🔍 Search existing...                                  │
│    ➕ Create "Seva Sadan, Malleswaram"                    │
│                                                          │
│  Artists:                                                │
│  ┌──────────────────────────────────────────────────┐    │
│  │ 🎭 Shri Deepak Mazumdar — bharatanatyam          │    │
│  │    🔍 Link to existing artist │ ➕ Create new     │    │
│  ├──────────────────────────────────────────────────┤    │
│  │ [+ Add another artist]                            │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  Tags: [bharatanatyam] [dance-recital] [+]               │
│                                                          │
│                         [← Back] [Next: Event 2 →]       │
└──────────────────────────────────────────────────────────┘
```

**Final Step: Review & Submit**
```
┌──────────────────────────────────────────────────────────┐
│  Step 4 of 4: Review & Submit                            │
│                                                          │
│  🎪 Festival: Kritajnata 2026                            │
│     Feb 19, 2026 • Chandraguru School of Dance           │
│     Seva Sadan, Malleswaram, Bengaluru                   │
│                                                          │
│  📅 Events (3):                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ 5:30 PM  Bharatanatyam — Shri Deepak Mazumdar    │    │
│  │ 6:30 PM  Kuchipudi — Shri Gururaju N             │    │
│  │ 7:30 PM  Odissi — Shri Bichitrananda Swain       │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  New entities to create:                                 │
│  • Venue: Seva Sadan, Malleswaram ✨                     │
│  • Organiser: Chandraguru School of Dance ✨              │
│  • Artist: Deepak Mazumdar ✨                             │
│  • Artist: Bichitrananda Swain ✨                         │
│                                                          │
│                   [← Back] [Submit & Publish]            │
└──────────────────────────────────────────────────────────┘
```

**Artist/Venue/Organiser Matching Flow:**

During verification, for each extracted artist/venue/organiser name:
1. Call existing search API to fuzzy match against known entities
2. Show top matches in dropdown
3. If user selects a match → link by ID (store `artistId`/`venueId`/`organiserId`)
4. If no match or user clicks "Create new" → create entity during submission
5. For artists, if Gemini extracted guru/lineage info, include it when creating

### Page 3: Event Detail (`/events/:id`)

Standard detail page showing poster, title, datetime, venue, artists, ticketing.
Links to artist/venue/organiser/festival pages.

### Page 4: Festival Detail (`/festivals/:id`)

Schedule view grouped by date. Shows festival poster, description, and lists all child events.

### Page 5: Events Listing (`/events`)

Paginated list of upcoming approved events. Filter by art form tag.

### Page 6: Homepage Integration

Show today's and tomorrow's events in a section on the homepage:
```
┌──────────────────────────────────────┐
│  🎵 Events Today & Tomorrow          │
│                                      │
│  Today, Feb 12:                      │
│  • 5:30 PM — Concert by Vid. X...   │
│  • 7:00 PM — Dance Recital at...    │
│                                      │
│  Tomorrow, Feb 13:                   │
│  • 6:00 PM — Bhajan evening at...   │
│                                      │
│  [View all events →]                 │
└──────────────────────────────────────┘
```

---

## Infrastructure

### S3 Bucket for Posters

```typescript
// infra/event-posters.ts (or add to existing storage.ts)

const eventPostersBucket = new sst.aws.Bucket('EventPosters', {
  cors: {
    allowOrigins: ['*'],
    allowMethods: ['PUT', 'GET'],
    allowHeaders: ['Content-Type'],
  },
  public: {
    accessControl: 'public-read',
  },
});
```

### Gemini API Key

```typescript
// infra/secrets.ts (or add to existing secrets)

const geminiApiKey = new sst.Secret('GeminiApiKey');
```

### Bind to API Function

```typescript
// Bind the bucket and secret to the API lambda
api.bind([eventPostersBucket, geminiApiKey]);
```

---

## EntityPrefix Updates

Add to `packages/core/src/shared/singleTable.ts`:

```typescript
export enum EntityPrefix {
  // ... existing
  FESTIVAL = 'FESTIVAL',
  ORGANISER = 'ORGANISER',
  EVENT_ARTIST = 'EVENT_ARTIST',
}
```

Note: `EVENT` and `VENUE` already exist in the enum.

---

## Files to Create

### Core Package
```
packages/core/src/domain/
├── event/
│   ├── entity.ts         # EventEntity ElectroDB definition
│   ├── schema.ts         # Zod schemas (CreateEventSchema, UpdateEventSchema)
│   ├── client.ts         # Browser-safe type exports
│   ├── extraction.ts     # ExtractionResult type
│   ├── gemini.ts         # Gemini API integration
│   ├── index.ts          # Service functions
│   └── index.test.ts     # Tests
├── event-artist/
│   ├── entity.ts         # EventArtistEntity junction
│   ├── index.ts          # Service functions
│   └── index.test.ts     # Tests
├── festival/
│   ├── entity.ts         # FestivalEntity
│   ├── schema.ts         # Zod schemas
│   ├── client.ts         # Browser-safe exports
│   ├── index.ts          # Service functions
│   └── index.test.ts     # Tests
├── venue/
│   ├── entity.ts         # VenueEntity
│   ├── schema.ts         # Zod schemas
│   ├── client.ts         # Browser-safe exports
│   ├── index.ts          # Service functions
│   └── index.test.ts     # Tests
└── organiser/
    ├── entity.ts         # OrganiserEntity
    ├── schema.ts         # Zod schemas
    ├── client.ts         # Browser-safe exports
    ├── index.ts          # Service functions
    └── index.test.ts     # Tests
```

### Files to Update
```
packages/core/src/domain/artist/entity.ts    # Add title, guru attributes
packages/core/src/domain/artist/schema.ts    # Add title, guru to schemas
packages/core/src/domain/artist/client.ts    # Update Artist interface
packages/core/src/domain/artist/index.ts     # Update type exports
packages/core/src/shared/singleTable.ts      # Add FESTIVAL, ORGANISER, EVENT_ARTIST prefixes
packages/trpc/src/trpc.ts                    # Add editorProcedure
packages/trpc/src/routers/index.ts           # Register new routers
```

### tRPC Package
```
packages/trpc/src/routers/
├── event.ts
├── festival.ts
├── venue.ts
└── organiser.ts
```

### Web Package
```
packages/web/app/routes/
├── events.new.tsx                # Poster upload
├── events.new.verify.tsx         # Wizard verification
├── events._index.tsx             # Events listing
├── events.$eventid.tsx           # Event detail
├── festivals._index.tsx          # Festivals listing
├── festivals.$festivalid.tsx     # Festival detail / schedule
├── venues.$venueid.tsx           # Venue detail + events
├── organisers.$organiserid.tsx   # Organiser detail + events
└── $artform.events.tsx           # Art form filtered events
```

### Infrastructure
```
infra/event-posters.ts            # S3 bucket (or add to existing infra)
```

---

## Implementation Plan

### Phase 1: Domain Entities (2-3 days)

1. Add `FESTIVAL`, `ORGANISER`, `EVENT_ARTIST` to EntityPrefix enum
2. Create Venue domain (entity, schema, client, index, tests)
3. Create Organiser domain (entity, schema, client, index, tests)
4. Create Festival domain (entity, schema, client, index, tests)
5. Create Event domain (entity, schema, client, index, tests) — without Gemini integration
6. Create EventArtist junction (entity, index, tests)
7. Update Artist entity (add `title`, `guru` fields)
8. Add `editorProcedure` to tRPC

**Deliverable:** All entities functional, can CRUD via direct function calls

### Phase 2: Gemini Integration & API (1-2 days)

1. Set up S3 bucket for posters (infra)
2. Set up Gemini API secret (infra)
3. Implement `gemini.ts` extraction function with prompt
4. Implement `extractAndCreateDrafts` service function
5. Implement presigned URL generation for S3 upload
6. Create tRPC routers (event, festival, venue, organiser)
7. Register routers in index
8. Test extraction with sample posters

**Deliverable:** Full API working, can upload poster and get extracted data

### Phase 3: Frontend — Upload & Wizard (2-3 days)

1. Create upload page (`/events/new`) with S3 direct upload
2. Create wizard verification page (`/events/new/verify`)
   - Step 1: Festival details (conditional)
   - Step 2...N: Individual event details
   - Entity fuzzy matching (artist, venue, organiser)
   - "Create new" entity flow
   - Final review step
3. Submit flow: create entities, link IDs, approve events
4. Loading states and error handling

**Deliverable:** Complete upload → verify → publish flow

### Phase 4: Frontend — Display Pages (1-2 days)

1. Events listing page (`/events`)
2. Event detail page (`/events/:id`)
3. Festival detail/schedule page (`/festivals/:id`)
4. Venue detail page + events (`/venues/:id`)
5. Organiser detail page + events (`/organisers/:id`)
6. Art form filtered events (`/carnatic/events`, etc.)
7. Homepage event widget (today/tomorrow)
8. Add events section to artist detail page

**Deliverable:** All display pages live

### Phase 5: Polish (1 day)

1. End-to-end testing of full flow with real posters
2. Error handling (failed uploads, Gemini API errors, edge cases)
3. Mobile responsiveness
4. Loading animation for extraction
5. SEO metadata and structured data

**Deliverable:** Production-ready feature

---

## Open Questions (Deferred to v2)

1. **Duplicate detection:** Should we prevent duplicate events? (Handle manually in v1)
2. **Image optimization:** Resize/optimize posters on upload? (Store original in v1)
3. **Composition linking:** Extract and link compositions mentioned on posters
4. **Event editing after approval:** Can events be edited after they're live?
5. **Event deletion/cancellation:** What happens when an event is cancelled?
6. **Notifications:** Notify followers when an artist has a new event?
7. **Calendar export:** iCal/Google Calendar integration?
8. **Map view:** Show events on a map using venue locations?

---

## References

- V3 Spec: `/docs/plans/250212-01c-events-feature.md`
- Codebase conventions: `/CLAUDE.md`
- Artist entity pattern: `packages/core/src/domain/artist/entity.ts`
- Composition entity (embedded relations): `packages/core/src/domain/composition/entity.ts`
- Gemini API docs: `docs/stack/google-gemini-api.md`
- S3 + Lambda pipeline: `docs/stack/s3-lambda-gemini-pipeline.md`
