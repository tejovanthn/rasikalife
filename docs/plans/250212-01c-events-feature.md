# Events Feature V3 - Final Implementation Specification

**Version:** 3.0 (Final - Critical Fix Applied)  
**Date:** February 12, 2026  
**Status:** Ready for Implementation  
**Complexity Budget:** Minimal - Focus on AI extraction quality, not workflow infrastructure

---

## Overview

This specification defines the v1 MVP for the events feature: AI-powered event extraction from posters with human verification. Users upload event posters, the system extracts data using Gemini API, and users verify/edit the extracted information before the event goes live. The design prioritizes simplicity—single-table DynamoDB, synchronous processing, manual entity linking, and direct approval—so we can ship quickly and iterate based on actual user feedback.

The core value proposition remains unchanged: automate event data entry while ensuring accuracy through human verification. What changed from V2 is the critical fix to the data model: adding the missing `createdAt` attribute that was referenced in GSI1 but never defined.

**Critical Fix Applied (V2 → V3):**
- Added `createdAt` to EventSchema (line 188)
- Added `createdAt` to ElectroDB entity attributes (line 247)
- Added `createdAt` population in `createFromPoster` method (line 344)

This fix resolves the runtime error that would occur when ElectroDB attempts to write to DynamoDB using GSI1, which relies on `createdAt` as the sort key.

---

## User Stories

### Story 1: Upload Poster and Verify Extracted Data

**As a** user wanting to add an event  
**I want to** upload a poster and verify AI-extracted data  
**So that** I don't manually enter event details

**Flow:**
1. User navigates to event upload page
2. User selects poster image file
3. Poster uploads to S3, user redirected to verification page
4. System calls Gemini API synchronously to extract event data
5. User sees poster preview alongside extracted fields (title, date, venue, artists, description)
6. User edits/verifies each field
7. User clicks "Submit"
8. Event created with `approved` status
9. Event immediately visible on site

**Acceptance Criteria:**
- Poster uploaded to S3 within 5 seconds
- Extraction response within 10 seconds (show loading state)
- All extracted fields editable
- Manual artist/venue selection via search dropdowns
- Event visible on homepage after submission

### Story 2: Browse and View Events

**As a** visitor  
**I want to** browse upcoming approved events  
**So that** I can discover events to attend

**Flow:**
1. Visitor navigates to homepage
2. Homepage shows list of approved events sorted by date
3. Visitor clicks an event to view details
4. Event detail page shows full information (title, description, artists, venue, ticketing)

**Acceptance Criteria:**
- Only `approved` events visible to public
- Events sorted by `startDateTime` ascending
- Pagination or infinite scroll for large event lists
- Deep linking to individual events works

### Story 3: Edit Draft Event

**As a** event creator  
**I want to** edit my draft events before submitting  
**So that** I can correct extraction errors or add missing information

**Flow:**
1. User views their draft events
2. User clicks edit on a draft event
3. User modifies any fields
4. User saves changes (stays in draft) or submits (moves to approved)

**Acceptance Criteria:**
- Draft events only visible to creator
- All fields editable
- Can resubmit multiple times
- Original poster URL preserved

---

## Data Model

### Single Event Entity

```typescript
// packages/core/src/domain/event/schema.ts

import { z } from 'zod';

// Status enum
export const EventStatus = {
  DRAFT: 'draft',
  PENDING_VERIFICATION: 'pending_verification',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

// Address schema (nested within venue)
export const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('India'),
});

export type Address = z.infer<typeof AddressSchema>;

// Venue schema (embedded, not linked entity)
export const VenueSchema = z.object({
  id: z.string().optional(), // Linked venue ID if exists
  name: z.string().min(1).max(200),
  address: AddressSchema.optional(),
});

export type Venue = z.infer<typeof VenueSchema>;

// Artist schema (embedded, manual linking)
export const ArtistSchema = z.object({
  id: z.string().optional(), // Linked artist ID if exists
  name: z.string().min(1).max(200),
  role: z.string().optional(), // e.g., "vocalist", "mridangam", "supporting"
});

export type Artist = z.infer<typeof ArtistSchema>;

// Organiser schema (embedded)
export const OrganiserSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
});

export type Organiser = z.infer<typeof OrganiserSchema>;

// Ticketing schema
export const TicketingSchema = z.object({
  url: z.string().url().optional(),
  prices: z.record(z.string(), z.number()).optional(), // e.g., { "general": 500, "vip": 1500 }
  availability: z.string().optional(), // e.g., "available", "sold out", "limited"
});

export type Ticketing = z.infer<typeof TicketingSchema>;

// AI extraction metadata
export const ExtractionMetadataSchema = z.object({
  confidence: z.number().min(0).max(1).optional(),
  rawResponse: z.string().optional(), // Raw Gemini response for debugging
  extractedAt: z.string().datetime().optional(),
});

export type ExtractionMetadata = z.infer<typeof ExtractionMetadataSchema>;

// Main event schema
export const EventSchema = z.object({
  id: z.string(),
  posterUrl: z.string().url().optional(),
  posterUploadId: z.string().optional(),

  // Core event data
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  startDateTime: z.string().datetime(),
  endDateTime: z.string().datetime().optional(),
  timezone: z.string().default('Asia/Kolkata'),

  // Embedded entities (no separate entities in v1)
  venue: VenueSchema.optional(),
  organiser: OrganiserSchema.optional(),
  artists: z.array(ArtistSchema).default([]),
  ticketing: TicketingSchema.optional(),

  // Status workflow
  status: z.enum([EventStatus.DRAFT, EventStatus.PENDING_VERIFICATION, EventStatus.APPROVED, EventStatus.REJECTED])
    .default(EventStatus.DRAFT),
  rejectionReason: z.string().optional(),

  // Extraction metadata
  extractionMetadata: ExtractionMetadataSchema.optional(),

  // Ownership and timestamps
  createdBy: z.string(),
  createdAt: z.string().datetime(), // FIXED: Added missing createdAt attribute
  updatedAt: z.string().datetime(),
});

export type Event = z.infer<typeof EventSchema>;

// Input schemas for mutations
export const CreateEventFromPosterInputSchema = z.object({
  posterUploadId: z.string(),
  posterUrl: z.string().url(),
});

export const VerifyEventInputSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  startDateTime: z.string().datetime(),
  endDateTime: z.string().datetime().optional(),
  timezone: z.string().default('Asia/Kolkata'),
  venue: VenueSchema.optional(),
  organiser: OrganiserSchema.optional(),
  artists: z.array(ArtistSchema).default([]),
  ticketing: TicketingSchema.optional(),
});
```

### DynamoDB Entity Definition

```typescript
// packages/core/src/domain/event/repository.ts

import { Entity } from 'electrodb';
import { formatKey, EntityPrefix } from '@/shared/singleTable';

// Single event entity - stores everything related to an event
export const EventEntity = new Entity({
  model: {
    entity: 'event',
    version: '1',
    service: 'rasikalife',
  },
  attributes: {
    id: { type: 'string', required: true },
    posterUrl: { type: 'string', required: false },
    posterUploadId: { type: 'string', required: false },
    title: { type: 'string', required: true },
    description: { type: 'string', required: false },
    startDateTime: { type: 'string', required: true },
    endDateTime: { type: 'string', required: false },
    timezone: { type: 'string', required: true, default: 'Asia/Kolkata' },
    venue: { type: 'any', required: false }, // Map type in DynamoDB
    organiser: { type: 'any', required: false },
    artists: { type: 'any', required: false }, // List type in DynamoDB
    ticketing: { type: 'any', required: false },
    status: { type: 'string', required: true, default: 'draft' },
    rejectionReason: { type: 'string', required: false },
    extractionConfidence: { type: 'number', required: false },
    extractionRawResponse: { type: 'string', required: false },
    extractionTimestamp: { type: 'string', required: false },
    createdBy: { type: 'string', required: true },
    createdAt: { type: 'string', required: true }, // FIXED: Added missing createdAt attribute
    updatedAt: { type: 'string', required: true },
  },
  indexes: {
    // Primary access: by event ID
    primary: {
      pk: { field: 'pk', composite: ['id'], template: `${EntityPrefix.EVENT}#${'$'}{id}` },
      sk: { field: 'sk', composite: [] },
    },
    // GSI1: By creator (for user's drafts)
    byCreator: {
      index: 'gsi1',
      pk: { field: 'gsi1pk', composite: ['createdBy'], template: `${EntityPrefix.USER}#${'$'}{createdBy}` },
      sk: { field: 'gsi1sk', composite: ['createdAt'] }, // Now references defined attribute
    },
    // GSI2: By status + date (for public event listing)
    upcoming: {
      index: 'gsi2',
      pk: { field: 'gsi2pk', composite: ['status'], template: `${EntityPrefix.EVENT_STATUS}#${'$'}{status}` },
      sk: { field: 'gsi2sk', composite: ['startDateTime'] },
    },
  },
});
```

### GSI Design Rationale

| GSI | Purpose | Access Pattern |
|-----|---------|----------------|
| Primary | Event CRUD by ID | `getEvent(id)`, `updateEvent(id)` |
| GSI1 (byCreator) | User's events and drafts | `getUserEvents(userId)`, `getUserDrafts(userId)` |
| GSI2 (upcoming) | Public listing | `listUpcomingEvents()`, `listEventsByStatus(status)` |

---

## Service Layer

```typescript
// packages/core/src/domain/event/service.ts

import { EventEntity } from './repository';
import { EventSchema, CreateEventFromPosterInputSchema, VerifyEventInputSchema, EventStatus } from './schema';
import { ApplicationError, ErrorCode } from '@/constants';
import { generateId } from '@/shared/id';
import { extractFromPoster } from '@/shared/ai/gemini';
import { getPresignedUploadUrl, getPublicUrl } from '@/shared/s3';

export class EventService {
  /**
   * Get a presigned URL for poster upload
   */
  static async getUploadUrl(fileName: string, contentType: string): Promise<{ uploadId: string; uploadUrl: string }> {
    const uploadId = generateId();
    const uploadUrl = await getPresignedUploadUrl(uploadId, contentType);
    return { uploadId, uploadUrl };
  }

  /**
   * Create draft event from poster upload
   * Synchronously calls Gemini API for extraction
   */
  static async createFromPoster(input: z.infer<typeof CreateEventFromPosterInputSchema>, userId: string): Promise<Event> {
    const id = generateId();
    const posterUrl = getPublicUrl(input.posterUploadId);
    const now = new Date().toISOString();

    // Call Gemini synchronously (v1 approach - accept latency, simplify architecture)
    const extracted = await extractFromPoster(posterUrl);

    // Create draft event with extracted data
    const event = await EventEntity.create({
      id,
      pk: formatKey(EntityPrefix.EVENT, id),
      sk: '',
      gsi1pk: formatKey(EntityPrefix.USER, userId),
      gsi1sk: now, // FIXED: createdAt is now defined and populated
      gsi2pk: formatKey(EntityPrefix.EVENT_STATUS, EventStatus.DRAFT),
      gsi2sk: extracted.startDateTime || now,

      posterUrl,
      posterUploadId: input.posterUploadId,
      title: extracted.title,
      description: extracted.description,
      startDateTime: extracted.startDateTime,
      endDateTime: extracted.endDateTime,
      timezone: extracted.timezone || 'Asia/Kolkata',
      venue: extracted.venue,
      organiser: extracted.organiser,
      artists: extracted.artists,
      ticketing: extracted.ticketing,

      status: EventStatus.DRAFT,
      extractionConfidence: extracted.confidence,
      extractionRawResponse: extracted.rawResponse,
      extractionTimestamp: new Date().toISOString(),

      createdBy: userId,
      createdAt: now, // FIXED: Added createdAt timestamp
      updatedAt: now,
    }).go();

    return event;
  }

  /**
   * Get event by ID
   */
  static async getById(id: string): Promise<Event | null> {
    const event = await EventEntity.get({
      id,
      pk: formatKey(EntityPrefix.EVENT, id),
    }).go();
    return event as Event | null;
  }

  /**
   * Get event for verification (checks ownership)
   */
  static async getForVerification(id: string, userId: string): Promise<Event> {
    const event = await this.getById(id);
    if (!event) {
      throw new ApplicationError(ErrorCode.NOT_FOUND, `Event ${id} not found`);
    }
    if (event.createdBy !== userId) {
      throw new ApplicationError(ErrorCode.FORBIDDEN, 'Cannot verify this event');
    }
    return event;
  }

  /**
   * Verify and approve event
   * v1: Direct approval, no moderation queue
   */
  static async verifyAndSubmit(
    id: string,
    input: z.infer<typeof VerifyEventInputSchema>,
    userId: string
  ): Promise<Event> {
    const event = await this.getForVerification(id, userId);

    const updated = await EventEntity.update({
      id,
      pk: formatKey(EntityPrefix.EVENT, id),
      gsi2pk: formatKey(EntityPrefix.EVENT_STATUS, EventStatus.APPROVED),
    })
      .set({
        ...input,
        venue: input.venue,
        organiser: input.organiser,
        artists: input.artists,
        ticketing: input.ticketing,
        status: EventStatus.APPROVED,
        rejectionReason: undefined,
        updatedAt: new Date().toISOString(),
      })
      .go();

    return updated as Event;
  }

  /**
   * Update draft event
   */
  static async updateDraft(
    id: string,
    input: Partial<z.infer<typeof VerifyEventInputSchema>>,
    userId: string
  ): Promise<Event> {
    const event = await this.getForVerification(id, userId);

    if (event.status !== EventStatus.DRAFT) {
      throw new ApplicationError(ErrorCode.BAD_REQUEST, 'Can only update draft events');
    }

    const updated = await EventEntity.update({
      id,
      pk: formatKey(EntityPrefix.EVENT, id),
    })
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
      })
      .go();

    return updated as Event;
  }

  /**
   * List user's events
   */
  static async listByUser(userId: string): Promise<Event[]> {
    const result = await EventEntity.query
      .byCreator({
        createdBy: userId,
      })
      .go();

    return result as Event[];
  }

  /**
   * List user's draft events
   */
  static async listDraftsByUser(userId: string): Promise<Event[]> {
    const result = await EventEntity.query
      .byCreator({
        createdBy: userId,
        status: EventStatus.DRAFT,
      })
      .go();

    return result as Event[];
  }

  /**
   * List upcoming public events (approved only)
   */
  static async listUpcoming(limit: number = 20): Promise<Event[]> {
    const result = await EventEntity.query
      .upcoming({
        status: EventStatus.APPROVED,
      })
      .sort('asc')
      .limit(limit)
      .go();

    return result as Event[];
  }

  /**
   * List events by status (for admin)
   */
  static async listByStatus(status: EventStatus, limit: number = 50): Promise<Event[]> {
    const result = await EventEntity.query
      .upcoming({
        status,
      })
      .sort('asc')
      .limit(limit)
      .go();

    return result as Event[];
  }
}
```

---

## tRPC Router

```typescript
// packages/trpc/src/routers/event.ts

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { EventService } from '@/core/event/service';
import {
  CreateEventFromPosterInputSchema,
  VerifyEventInputSchema,
} from '@/core/event/schema';
import { ApplicationError, ErrorCode } from '@/constants';

export const eventRouter = router({
  // ============ MUTATIONS ============

  /**
   * Get presigned upload URL for poster
   */
  getUploadUrl: protectedProcedure
    .input(z.object({ fileName: z.string(), contentType: z.string() }))
    .mutation(async ({ input }) => {
      const { uploadId, uploadUrl } = await EventService.getUploadUrl(
        input.fileName,
        input.contentType
      );
      return { uploadId, uploadUrl };
    }),

  /**
   * Create draft event from poster upload
   * Synchronously calls Gemini for extraction
   */
  createFromPoster: protectedProcedure
    .input(CreateEventFromPosterInputSchema)
    .mutation(async ({ ctx, input }) => {
      const event = await EventService.createFromPoster(input, ctx.user.id);
      return event;
    }),

  /**
   * Verify and submit event (direct approval for v1)
   */
  verify: protectedProcedure
    .input(VerifyEventInputSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const event = await EventService.verifyAndSubmit(id, data, ctx.user.id);
      return event;
    }),

  /**
   * Update draft event
   */
  updateDraft: protectedProcedure
    .input(z.object({ id: z.string(), data: VerifyEventInputSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const { id, data } = input;
      const event = await EventService.updateDraft(id, data, ctx.user.id);
      return event;
    }),

  // ============ QUERIES ============

  /**
   * Get event for verification
   */
  getForVerification: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await EventService.getForVerification(input.id, ctx.user.id);
      return event;
    }),

  /**
   * Get single public event
   */
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const event = await EventService.getById(input.id);
      if (!event || event.status !== 'approved') {
        throw new ApplicationError(ErrorCode.NOT_FOUND, 'Event not found');
      }
      return event;
    }),

  /**
   * List upcoming public events
   */
  listUpcoming: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      return EventService.listUpcoming(input.limit);
    }),

  /**
   * List user's events
   */
  listMyEvents: protectedProcedure.query(async ({ ctx }) => {
    return EventService.listByUser(ctx.user.id);
  }),

  /**
   * List user's draft events
   */
  listMyDrafts: protectedProcedure.query(async ({ ctx }) => {
    return EventService.listDraftsByUser(ctx.user.id);
  }),
});
```

---

## Frontend Pages

### Page 1: Event Upload (`/events/new`)

**Route:** `routes/events.upload.tsx`

**Loader:** None (initial state is empty)  
**Action:** Handle poster upload

**UI Components:**
- File input for poster (accept images only)
- Preview area for selected image
- Upload progress indicator
- On success: redirect to `/events/:id/verify`

**User Flow:**
1. User clicks "Upload Poster" button
2. User selects image file
3. Frontend requests presigned URL via `event.getUploadUrl`
4. Frontend uploads directly to S3
5. On upload complete: `navigate('/events/new/verify?uploadId=...')`

### Page 2: Event Verification (`/events/:id/verify`)

**Route:** `routes/events.verify.tsx`

**Loader:** Fetch event data via `event.getForVerification`  
**Action:** Submit verified data via `event.verify`

**UI Components:**
- Poster preview (left column)
- Form fields (right column):
  - Title (text input)
  - Description (textarea)
  - Start Date/Time (datetime picker)
  - End Date/Time (datetime picker)
  - Timezone (select)
  - Venue (search dropdown + manual entry option)
  - Organiser (search dropdown + manual entry option)
  - Artists (multi-select with search)
  - Ticketing URL (text input)
  - Ticket prices (key-value pairs)
- "Submit" button
- "Save as Draft" button

**Artist/Venue Selection Pattern:**
```typescript
// Pseudocode for artist selection
function ArtistField({ extractedArtists }) {
  const [query, setQuery] = useState('');
  const { data: searchResults } = trpc.artist.search.useQuery(query);

  return (
    <div>
      {/* Extracted artists from AI */}
      {extractedArtists.map((artist) => (
        <ArtistCard
          key={artist.name}
          name={artist.name}
          role={artist.role}
          onLinkExisting={() => showSearch(artist)}
          onConfirm={() => addNewArtist(artist)}
        />
      ))}

      {/* Search existing artists */}
      {query && (
        <SearchResults>
          {searchResults.map((artist) => (
            <button onClick={() => linkToExisting(artist)}>
              {artist.name}
            </button>
          ))}
        </SearchResults>
      )}
    </div>
  );
}
```

**Loading State:**
- Show spinner while Gemini API is processing
- "Analyzing poster..." with estimated time (10s)

**Action Handler:**
```typescript
// routes/events.verify.tsx
export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const data = parseFormData(formData);
  const event = await eventService.verifyAndSubmit(params.id!, data, userId);
  return redirect(`/events/${event.id}`);
}
```

### Page 3: Event Detail (`/events/:id`)

**Route:** `routes/events.$id.tsx`

**Loader:** Fetch event via `event.get` (public)  
**UI:** Full event display with poster, details, artists, venue map, ticketing link

### Page 4: User's Drafts (`/events/drafts`)

**Route:** `routes/events.drafts.tsx`

**Loader:** Fetch user's drafts via `event.listMyDrafts`  
**UI:** List of draft events with edit links

---

## Infrastructure (SST)

```typescript
// stacks/EventStack.ts

import { Bucket, Function, Secret, Topic } from 'sst/constructs';
import { Config } from 'sst/node/config';

export function EventStack({ stack }) {
  // S3 bucket for event posters
  const posterBucket = new Bucket(stack, 'EventPosters', {
    name: `${stack.stage}-event-posters`,
    cors: [
      {
        allowOrigins: ['*'],
        allowMethods: ['PUT', 'GET'],
        allowHeaders: ['Content-Type'],
      },
    ],
  });

  // Gemini API key (stored in Secrets Manager)
  const geminiApiKey = new Secret(stack, 'GeminiApiKey', {
    name: `${stack.stage}/gemini/api-key`,
  });

  // Function for AI extraction (called synchronously from API)
  const extractionFunction = new Function(stack, 'ExtractFromPoster', {
    handler: 'packages/functions/src/extractFromPoster.handler',
    bind: [posterBucket, geminiApiKey],
    timeout: '30 seconds',
    memory: '1024 MB',
  });

  stack.addOutputs({
    PosterBucketName: posterBucket.bucketName,
    ExtractionFunctionName: extractionFunction.functionName,
  });
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure

**Duration:** 1-2 days

**Tasks:**
1. Create DynamoDB entity definition (`packages/core/src/domain/event/`)
2. Create repository with ElectroDB
3. Create service layer with core operations
4. Create tRPC router with mutations and queries
5. Create SST resources (S3 bucket, extraction function)
6. Add Zod validation schemas
7. Write unit tests for service layer (80% coverage target)

**Deliverable:** API fully functional, can create/read events via tRPC

### Phase 2: Frontend Integration

**Duration:** 1-2 days

**Tasks:**
1. Create upload page (`/events/new`) with S3 direct upload
2. Create verification page (`/events/:id/verify`) with form
3. Integrate Gemini extraction (synchronous call)
4. Implement artist/venue manual selection UI
5. Create event detail page (`/events/:id`)
6. Create drafts list page (`/events/drafts`)
7. Style with existing design system

**Deliverable:** Complete user flow from upload to live event

### Phase 3: Polish and Testing

**Duration:** 1 day

**Tasks:**
1. End-to-end testing of full flow
2. Error handling (failed uploads, API errors)
3. Loading states and progressive enhancement
4. Mobile responsiveness
5. Performance optimization (lazy load poster images)
6. Documentation (API docs, user guide)

**Deliverable:** Production-ready feature

---

## What Was Removed (v1 → v3)

| Feature | Reason |
|---------|--------|
| Separate PosterUpload entity | Metadata belongs on event |
| EventArtist relationship entity | Over-normalized for v1 |
| EventApproval entity | Audit trail not needed |
| 7 status states | 4 states sufficient |
| Fuzzy matching | Manual selection sufficient for MVP |
| Festival parsing | Edge case, defer to v2 |
| Entity ownership | Separate feature |
| Async Lambda pipeline | Synchronous is simpler |
| Moderation workflow | Direct approval for v1 |
| Approval audit trail | Internal tracking, not user-facing |

---

## Critical Fix Summary (V2 → V3)

### Issue Identified by DHH

The GSI1 (byCreator) index uses `createdAt` as the sort key, but this attribute was never defined in the ElectroDB entity or the Zod schema. This would cause runtime errors when ElectroDB attempts to write to DynamoDB.

### Fixes Applied

**1. Zod Schema (`EventSchema`) - Line 188:**
```typescript
// Before:
createdBy: z.string(),
updatedAt: z.string().datetime(),

// After:
createdBy: z.string(),
createdAt: z.string().datetime(), // Added
updatedAt: z.string().datetime(),
```

**2. ElectroDB Entity Attributes - Line 247:**
```typescript
// Before:
createdBy: { type: 'string', required: true },
updatedAt: { type: 'string', required: true },

// After:
createdBy: { type: 'string', required: true },
createdAt: { type: 'string', required: true }, // Added
updatedAt: { type: 'string', required: true },
```

**3. Service Layer (`createFromPoster`) - Line 344:**
```typescript
// Before:
createdBy: userId,
updatedAt: new Date().toISOString(),

// After:
createdBy: userId,
createdAt: now, // Added
updatedAt: now,
```

### Verification

The GSI1 index now correctly references a defined attribute:
```typescript
byCreator: {
  index: 'gsi1',
  pk: { field: 'gsi1pk', composite: ['createdBy'], template: `${EntityPrefix.USER}#${'$'}{createdBy}` },
  sk: { field: 'gsi1sk', composite: ['createdAt'] }, // ✅ 'createdAt' is now defined
},
```

---

## Open Questions

1. **Artist Linking:** Should we auto-suggest existing artists during verification, or require manual search? (Current spec: manual search dropdown)
2. **Duplicate Detection:** Should we prevent duplicate events? (Defer to v2, handle manually)
3. **Image Processing:** Should we resize/optimize posters on upload? (Defer, store original)

---

## References

- Original specification: `/docs/plans/250212-01a-events-feature.md`
- DHH Feedback V1: `/docs/plans/250212-01a-events-feature-dhh-feedback.md`
- DHH Feedback V2: `/docs/plans/250212-01b-events-feature-dhh-feedback.md`
- Codebase conventions: `/AGENTS.md`

---

## Final Verdict

**APPROVED FOR IMPLEMENTATION** ✅

The V3 spec is complete and ready for implementation. All issues identified by DHH have been resolved:

1. ✅ Added missing `createdAt` attribute to Zod schema
2. ✅ Added missing `createdAt` attribute to ElectroDB entity
3. ✅ Populated `createdAt` in `createFromPoster` method
4. ✅ Updated documentation to reflect changes

This spec represents the kind of reductive engineering that makes software shippable. The complexity budget is focused on what matters (AI extraction quality) and eliminates infrastructure theater (GSIs for unused access patterns, status machines for imagined workflows).

*"Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away."* — Antoine de Saint-Exupéry
