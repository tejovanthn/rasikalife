# DHH Code Review: Events Feature Specification

**Review Date:** February 12, 2026  
**Reviewer:** DHH Code Reviewer  
**Spec File:** `/docs/plans/250212-01a-events-feature.md`  
**Verdict:** **NOT READY FOR IMPLEMENTATION**

---

## Overall Assessment

This specification is a textbook example of over-engineering dressed up as "comprehensive." You've taken a relatively straightforward problem—users uploading event posters and the system extracting data—and converted it into an enterprise-grade workflow that would make any Y2K consultant proud.

**The core problem is sound:** automate event data extraction from posters using AI while maintaining human verification. This is a legitimate feature that solves real user pain.

**The implementation is bloated:** 7 (!) DynamoDB entities, 6 GSIs per entity, approval workflows with audit trails, fuzzy matching services, festival parsing, entity ownership permissions, notification systems—this is Rails 1.0 wanting to be SAP.

The spec reads like you asked "what's the most complex way to solve this?" and then implemented it. DHH would ship the MVP and iterate based on actual user feedback, not engineer a system for edge cases that may never materialize.

---

## Critical Issues

### 1. Over-Engineered Data Model (7 Entities is Too Many)

**Current Design:**
```
- Event Entity (6 GSIs)
- EventArtist Relationship (2 GSIs)
- PosterUpload Entity (4 GSIs)
- EventApproval Entity (1 GSI)
```

That's 13 GSIs across 4 entities, with more planned. For what? A poster upload flow.

**DHH's Rule:** "Fat models, thin controllers" means your domain logic should be rich, not your database schema.

**Reality Check:**
- You don't need a separate `PosterUploadEntity`. This is metadata about the event creation process. Store it on the event.
- You don't need an `EventApprovalEntity` for an audit trail. DynamoDB has TTL and you can store approval history as an array on the event.
- You don't need `EventArtistEntity` as a separate entity. Artists performing at events is a many-to-many, but in single-table DynamoDB, this should be stored as a list on the event or as simple SK appends.

**Refactored Model (Single Entity):**

```typescript
const EventEntity = new Entity({
  model: { entity: 'event', version: '1', service: 'rasikalife' },
  attributes: {
    id: { type: 'string', required: true },
    posterUploadId: { type: 'string', required: false },
    posterUrl: { type: 'string', required: false },
    
    // Core event data
    title: { type: 'string', required: true },
    description: { type: 'string', required: false },
    startDateTime: { type: 'string', required: true },
    endDateTime: { type: 'string', required: false },
    timezone: { type: 'string', required: true, default: 'Asia/Kolkata' },
    
    // Denormalized entity references (no separate entities needed yet)
    venueId: { type: 'string', required: false },
    venueName: { type: 'string', required: false },
    organiserId: { type: 'string', required: false },
    organiserName: { type: 'string', required: false },
    
    // Artists as a simple array (can refactor to separate entity if needed)
    artists: { type: 'list', required: false }, // [{ artistId, name, role }]
    
    // Ticketing
    ticketingUrl: { type: 'string', required: false },
    ticketPrices: { type: 'map', required: false },
    ticketAvailability: { type: 'string', required: false },
    
    // Status machine (simple state, not 7-step workflow)
    status: { type: 'string', required: true, default: 'draft' }, // draft → pending_verification → approved
    
    // Extraction metadata
    extractionConfidence: { type: 'number', required: false },
    
    // Ownership and timestamps
    createdBy: { type: 'string', required: true },
    updatedAt: { type: 'string', required: true, default: () => new Date().toISOString() },
    
    // Approval (inline, not separate entity)
    approvedBy: { type: 'string', required: false },
    approvedAt: { type: 'string', required: false },
  },
  indexes: {
    primary: { pk: { field: 'pk', composite: ['id'], template: 'EVENT#${id}' }, sk: { field: 'sk', composite: [] } },
    byCreator: { index: 'gsi1', pk: { field: 'gsi1pk', composite: ['createdBy'], template: 'USER#${createdBy}' }, sk: { field: 'gsi1sk', composite: ['createdAt'] } },
    byVenue: { index: 'gsi2', pk: { field: 'gsi2pk', composite: ['venueId'], template: 'VENUE#${venueId}' }, sk: { field: 'gsi2sk', composite: ['startDateTime'] } },
    byDate: { index: 'gsi3', pk: { field: 'gsi3pk', composite: ['status'], template: 'EVENT#${status}' }, sk: { field: 'gsi3sk', composite: ['startDateTime'] } },
  },
});
```

**3 GSIs. One entity. Same functionality.**

---

### 2. Status State Machine is Over-Designed

**Current:**
```
pending_upload → pending_extraction → pending_verification → pending_approval → approved
                                    ↘ rejected                    ↘ archived
```

**Reality:** You're building an event system, not a nuclear power plant control system.

**Simplified:**
```
draft → pending_verification → approved
        ↘ rejected
```

**Why:**
- `pending_upload` is meaningless. If there's no upload, it's a draft.
- `pending_extraction` is Lambda's internal concern, not user-facing state.
- `archived` can be a filter, not a status.
- The 7-status machine is 5 more statuses than you need for v1.

**User-facing states should be:**
1. **Draft** - Being edited, not visible
2. **Pending Verification** - User submitted, waiting for review
3. **Approved** - Live and public
4. **Rejected** - Not approved, with reason

That's it. Ship it.

---

### 3. Fuzzy Matching and Entity Linking is Premature Optimization

**Current Plan:**
```typescript
export async function matchArtist(name: string): Promise<EntityMatchResult> {
  // TODO: Implement fuzzy matching using existing search service
  // This should use Fuse.js or similar for fuzzy matching
  return { matched: false, confidence: 0 };
}
```

**Problem:** You're building a fuzzy matching system with TODO comments as the core implementation.

**Questions you're not asking:**
1. How many artists exist in the system? (Probably < 1000 initially)
2. What's the actual problem fuzzy matching solves? (Preventing duplicates)
3. Is exact match + manual selection sufficient for v1?

**DHH's Philosophy:** "Make the common case fast and the edge cases possible."

**Simpler Approach for v1:**
1. Show extracted artist names as text
2. Provide autocomplete search for existing artists
3. User selects "link to existing" or "create new"
4. No fuzzy matching algorithm needed upfront
5. Iterate based on actual duplicate rates

You're optimizing for a problem you haven't proven exists. Ship the simple version first.

---

### 4. Festival Support is Feature Creep

**Current Spec:**
```
- Multi-day festivals create multiple event entries
- Each performance has its own date/time
- Artists are linked to their specific performances
- Users can edit individual event details
```

**Reality:** You're building for a use case that may represent 1% of events.

**Questions:**
1. How many festivals does your target audience upload?
2. Can users just upload multiple posters (one per day) instead?
3. Is parsing a festival poster (complex layout, multiple days) actually reliable with AI?

**DHH would ask:** "What's the minimum viable version of this feature?"

**MVP Approach:**
1. Support single-event posters
2. For festivals, users upload separate posters per event
3. Link events with a common `festivalId` field if users want
4. Parse festival data as a "nice to have" for v2

---

### 5. Approval Workflow Has No Moderators

**Spec says:**
```
- Moderators can approve or reject events
- Moderator dashboard required
- Moderator procedure in tRPC
```

**But doesn't define:**
1. Who are moderators?
2. How do you become a moderator?
3. What's the criteria for approval?
4. How many moderators exist?

**This is infrastructure for a problem you don't have yet.**

**Simpler v1:**
1. Single admin (you/team)
2. Direct database approval for launch
3. Build the moderation UI when you have actual moderators

---

### 6. Entity Ownership is a Red Herring

**User Story 5:**
```
As an entity owner (artist, venue, organiser)
I want to edit events associated with my entity
So that I can maintain accurate event information

Acceptance Criteria:
- Venue owners can edit events at their venue
- Artists can edit their performance events
```

**Problems:**
1. How does someone "own" an artist profile? (Artists are people, not companies)
2. What's the ownership verification process?
3. Who arbitrates ownership disputes?

**This is a completely separate feature (user accounts + entity claiming) that should not be bundled with the events feature.**

---

### 7. Lambda + S3 + Gemini Pipeline is Overkill for v1

**Current Infrastructure:**
```
User Upload → S3 → Lambda Trigger → Gemini API → DynamoDB
```

**Problems:**
1. Lambda cold starts will delay processing
2. Lambda timeout (15 minutes!) suggests unreliable extraction
3. No fallback if AI fails
4. Complex retry logic with DLQ

**Simpler v1:**
1. User uploads poster to S3
2. User sees "processing..." on frontend
3. Cron job every 5 minutes queries S3 for new uploads
4. Processes in batch (more efficient, simpler error handling)
5. Updates event status when done

Or even simpler: process synchronously in the verification page load (accept the delay, simplify the architecture).

---

## Improvements Needed

### 1. Remove These Features from v1 Scope

| Feature | Reason |
|---------|--------|
| Fuzzy matching | Premature optimization |
| Festival parsing | Edge case (1% of events) |
| Entity ownership | Separate feature |
| Moderation workflow | Build when moderators exist |
| Approval audit trail | Internal tracking, not user-facing |
| Separate PosterUpload entity | Metadata belongs on event |
| EventArtist relationship entity | Over-normalized |

### 2. Simplify Status to 4 States

```typescript
const EventStatus = {
  DRAFT: 'draft',
  PENDING_VERIFICATION: 'pending_verification',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
```

### 3. Single Entity Instead of 4

Store everything on the event. If you need to scale artist relationships later, refactor then.

### 4. Synchronous AI Extraction (Accept the Latency)

Process the poster when the user clicks "verify" instead of async Lambda. Simpler architecture, fewer failure modes.

### 5. Manual Artist/Venue Selection

No fuzzy matching. Show extracted data, provide search dropdowns, user links manually.

---

## What Works Well

### 1. Core Concept (AI + Verification)

The idea of AI extraction with human verification is sound and appropriate for:
- Indian classical music has specific naming conventions
- AI can extract structured data from posters
- Humans verify accuracy (critical for event details)

### 2. DynamoDB Single-Table Design (Mostly)

The single-table pattern is good. Just over-normalized.

### 3. ElectroDB Usage

Type-safe DynamoDB operations are the right choice for this codebase.

### 4. Zod Schemas for Validation

Validation at boundaries is correct.

### 5. Frontend Integration Points

React Router forms and progressive enhancement patterns are appropriate.

---

## Refactored Specification (v1 MVP)

### Core Flow

```
1. User uploads poster image
2. Poster saved to S3
3. User redirected to verification page
4. System (synchronously) calls Gemini API to extract data
5. User sees extracted data + poster preview
6. User edits/verifies data
7. User clicks "Submit"
8. Event created with status: approved (for v1)
9. Event visible on site immediately
```

### Simplified Data Model

```typescript
// Single entity - everything related to an event
const EventEntity = new Entity({
  model: { entity: 'event', version: '1', service: 'rasikalife' },
  attributes: {
    id: { type: 'string', required: true },
    posterUrl: { type: 'string', required: false },
    posterUploadId: { type: 'string', required: false },
    
    // Core event data
    title: { type: 'string', required: true },
    description: { type: 'string', required: false },
    startDateTime: { type: 'string', required: true },
    endDateTime: { type: 'string', required: false },
    timezone: { type: 'string', required: true, default: 'Asia/Kolkata' },
    
    // Venue (stored as object, not linked entity yet)
    venue: { type: 'map', required: false }, // { id, name, address, city }
    
    // Organiser
    organiser: { type: 'map', required: false }, // { id, name, contact }
    
    // Artists array
    artists: { type: 'list', required: false }, // [{ id, name, role }]
    
    // Ticketing
    ticketing: { type: 'map', required: false }, // { url, prices, availability }
    
    // Status
    status: { type: 'string', required: true, default: 'draft' },
    
    // AI extraction confidence
    extractionConfidence: { type: 'number', required: false },
    
    // Ownership
    createdBy: { type: 'string', required: true },
    updatedAt: { type: 'string', required: true, set: () => new Date().toISOString() },
    
    // For filtering
    isPublic: { type: 'boolean', required: true, default: true },
  },
  indexes: {
    primary: { pk: { field: 'pk', composite: ['id'], template: 'EVENT#${id}' }, sk: { field: 'sk', composite: [] } },
    byCreator: { index: 'gsi1', pk: { field: 'gsi1pk', composite: ['createdBy'], template: 'USER#${createdBy}' }, sk: { field: 'gsi1sk', composite: ['createdAt'] } },
    upcoming: { index: 'gsi2', pk: { field: 'gsi2pk', composite: ['status'], template: 'EVENT#${status}' }, sk: { field: 'gsi2sk', composite: ['startDateTime'] } },
  },
});
```

### Simplified Service Layer

```typescript
// packages/core/src/domain/event/service.ts

export async function createEventFromPoster(
  input: CreateEventInput,
  posterData: ExtractedEventData,
  userId: string
): Promise<Event> {
  const id = generateId();
  
  return EventEntity.create({
    id,
    ...input,
    posterUrl: input.posterUrl,
    extractedData: posterData, // Store raw AI response for debugging
    extractionConfidence: posterData.confidence,
    status: EventStatus.DRAFT,
    createdBy: userId,
  }).go();
}

export async function verifyAndSubmit(
  eventId: string,
  verifiedData: VerifiedEventData,
  userId: string
): Promise<Event> {
  const event = await EventEntity.get({ id: eventId }).go();
  
  if (!event) throw notFoundError('event', eventId);
  if (event.createdBy !== userId) throw forbiddenError();
  
  return EventEntity.update({ id: eventId })
    .set({
      ...verifiedData,
      status: EventStatus.APPROVED, // Direct approval for v1
      updatedAt: new Date().toISOString(),
    })
    .go();
}
```

### tRPC Router (Simplified)

```typescript
export const eventRouter = router({
  // Get upload URL for poster
  getUploadUrl: protectedProcedure
    .input(z.object({ fileName: z.string(), contentType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const uploadId = generateUploadId();
      const uploadUrl = await generatePresignedUploadUrl(uploadId, input.contentType);
      return { uploadId, uploadUrl };
    }),
  
  // Create event from poster (triggers AI extraction)
  createFromPoster: protectedProcedure
    .input(z.object({
      posterUploadId: z.string(),
      posterUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const poster = await getPosterUpload(input.posterUploadId);
      if (!poster) throw notFoundError('poster', input.posterUploadId);
      
      // Call Gemini synchronously (simplest v1 approach)
      const extractedData = await extractFromPoster(input.posterUrl);
      
      return createEventFromPoster({
        title: extractedData.title,
        startDateTime: extractedData.startDateTime,
        endDateTime: extractedData.endDateTime,
        venue: extractedData.venue,
        organiser: extractedData.organiser,
        artists: extractedData.artists,
        ticketing: extractedData.ticketing,
      }, extractedData, ctx.user.id);
    }),
  
  // Get event for verification
  getForVerification: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await getEvent(input.id);
      if (!event) throw notFoundError('event', input.id);
      if (event.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
        throw forbiddenError('Cannot verify this event');
      }
      return event;
    }),
  
  // Verify and submit
  verify: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: VerifiedEventSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return verifyAndSubmit(input.id, input.data, ctx.user.id);
    }),
  
  // Public queries
  listUpcoming: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      return listEventsByStatus('approved', input.limit);
    }),
  
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const event = await getEvent(input.id);
      if (!event || !event.isPublic) throw notFoundError('event', input.id);
      return event;
    }),
});
```

---

## Specific Changes Summary

| Current | Proposed |
|---------|----------|
| 4 entities (Event, EventArtist, PosterUpload, Approval) | 1 entity (Event) |
| 7 status states | 4 status states |
| 13 GSIs | 3 GSIs |
| Async Lambda processing | Synchronous processing for v1 |
| Fuzzy matching | Manual selection |
| Moderation workflow | Direct approval |
| Entity ownership | Not in v1 |
| Festival parsing | Not in v1 |
| Approval audit trail | Not in v1 |

---

## Final Verdict

**This spec is NOT ready for implementation.** It tries to solve problems that don't exist yet, builds infrastructure for edge cases, and over-normalizes a simple domain.

**DHH would say:** "Ship the simplest thing that could possibly work, then iterate."

**Recommended Action:**
1. Delete this spec
2. Write a new spec with just:
   - Poster upload → S3
   - Verification page with AI extraction (synchronous)
   - Edit form with manual artist/venue selection
   - Direct approval (no moderation workflow)
   - Single event entity

**Complexity Budget:** Spend your complexity budget on the AI extraction quality, not on workflow infrastructure that adds no user value.

---

*"Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away."* — Antoine de Saint-Exupéry

Your spec needs to lose 60% of its weight before it's shippable.
