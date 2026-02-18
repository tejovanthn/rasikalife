# Events/Concerts Feature Specification

**Created:** February 12, 2026  
**Feature:** Events/Concerts with AI-Powered Poster Processing  
**Status:** Ready for Implementation

---

## Overview

This specification describes a comprehensive events/concerts feature that enables users to:
- Upload event poster images
- Have AI (Gemini) extract structured data automatically
- Verify and edit extracted data before submission
- Link events to existing artist, venue, and organiser entities
- Support multi-day festival schedules
- Implement an approval workflow before events go live

### Core Problem

Manually entering event information is tedious and error-prone. Users often have event posters (images) that contain all the relevant information, but extracting that data manually takes significant effort. This feature automates the extraction while maintaining human verification.

### Solution

A complete event management system with:
- **Upload Flow**: Authenticated users upload poster images to S3
- **AI Processing**: Lambda triggered by S3 upload uses Gemini to extract structured data
- **Verification UI**: Users review and edit AI-extracted data
- **Entity Linking**: Fuzzy matching to link artists, venues, and organisers to existing records
- **Approval Workflow**: Events require moderation approval before becoming public
- **Festival Support**: Multi-day multi-event schedules parsed from single posters

---

## User Stories

### 1. Event Creation
```
As an authenticated user
I want to upload an event poster image
So that I can quickly create an event without manual data entry

Acceptance Criteria:
- Upload page is accessible to authenticated users
- Poster image is saved to S3
- Structured data is extracted automatically
- User can verify and edit extracted data
- Event is submitted for approval after verification
```

### 2. Entity Linking
```
As a user creating an event
I want the system to match extracted entities to existing records
So that I don't create duplicate artists, venues, or organisers

Acceptance Criteria:
- 'M.S. Subbulakshmi' matches 'MS Subbulakshmi' (fuzzy matching)
- Users can override automatic matches
- New entities are created when no match is found
- Links are bidirectional (event → entity, entity → event)
```

### 3. Festival Support
```
As a user uploading a festival poster
I want each individual performance to be parsed as a separate event
So that each performance can be managed independently

Acceptance Criteria:
- Multi-day festivals create multiple event entries
- Each performance has its own date/time
- Artists are linked to their specific performances
- Users can edit individual event details
```

### 4. Approval Workflow
```
As a moderator
I want to review events before they go live
So that the quality and accuracy of events is maintained

Acceptance Criteria:
- Events start in 'pending_approval' status
- Moderators can approve or reject events
- Rejection includes a reason
- Approved events become visible publicly
- Original creator is notified of status changes
```

### 5. Entity Management
```
As an entity owner (artist, venue, organiser)
I want to edit events associated with my entity
So that I can maintain accurate event information

Acceptance Criteria:
- Venue owners can edit events at their venue
- Artists can edit their performance events
- Changes go through approval workflow
- Original creator is notified of edits
```

---

## Data Model

### DynamoDB Single-Table Design

#### Event Entity

```typescript
// packages/core/src/domain/event/entity.ts

import { Entity } from 'electrodb';

export const EventStatus = {
  PENDING_UPLOAD: 'pending_upload',      // Waiting for poster upload
  PENDING_EXTRACTION: 'pending_extraction',  // Poster uploaded, AI processing
  PENDING_VERIFICATION: 'pending_verification',  // AI done, user review needed
  PENDING_APPROVAL: 'pending_approval',   // Verified, awaiting moderation
  APPROVED: 'approved',                  // Live and public
  REJECTED: 'rejected',                  // Rejected by moderator
  ARCHIVED: 'archived',                   // No longer relevant
} as const;

export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const EventVisibility = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  UNLISTED: 'unlisted',
} as const;

export type EventVisibility = (typeof EventVisibility)[keyof typeof EventVisibility];

export const EventEntity = new Entity({
  model: {
    entity: 'event',
    version: '1',
    service: 'rasikalife',
  },
  attributes: {
    // Primary identifiers
    id: {
      type: 'string',
      required: true,
    },
    posterUploadId: {
      type: 'string',
      required: false,  // May be empty for manually created events
    },
    
    // Core event data (extracted from poster or manual entry)
    title: {
      type: 'string',
      required: true,
    },
    description: {
      type: 'string',
      required: false,
    },
    
    // Date/time information
    startDateTime: {
      type: 'string',
      required: true,
    },
    endDateTime: {
      type: 'string',
      required: false,
    },
    timezone: {
      type: 'string',
      required: true,
      default: 'Asia/Kolkata',
    },
    
    // Recurring/festival information
    isRecurring: {
      type: 'boolean',
      required: true,
      default: false,
    },
    recurringType: {
      type: 'string',
      required: false,  // 'daily', 'weekly', 'custom'
    },
    festivalId: {
      type: 'string',
      required: false,  // Link to parent festival event
    },
    festivalName: {
      type: 'string',
      required: false,  // Denormalized for display
    },
    sequenceNumber: {
      type: 'number',
      required: false,  // Order within festival (1 = day 1, 2 = day 2)
    },
    
    // Location information
    venueId: {
      type: 'string',
      required: false,  // Link to venue entity
    },
    venueName: {
      type: 'string',
      required: false,  // Denormalized for display
    },
    venueAddress: {
      type: 'string',
      required: false,
    },
    venueCity: {
      type: 'string',
      required: false,
    },
    
    // Organiser information
    organiserId: {
      type: 'string',
      required: false,  // Link to organiser entity
    },
    organiserName: {
      type: 'string',
      required: false,  // Denormalized for display
    },
    organiserContact: {
      type: 'string',
      required: false,
    },
    
    // Ticketing information
    ticketingUrl: {
      type: 'string',
      required: false,
    },
    ticketPrices: {
      type: 'any',  // { general: 500, vip: 1500, etc }
      required: false,
    },
    ticketAvailability: {
      type: 'string',
      required: false,  // 'available', 'sold_out', 'coming_soon'
    },
    
    // Media
    posterUrl: {
      type: 'string',
      required: false,
    },
    posterThumbnailUrl: {
      type: 'string',
      required: false,
    },
    
    // Status and workflow
    status: {
      type: EventStatus,
      required: true,
      default: EventStatus.PENDING_UPLOAD,
    },
    visibility: {
      type: EventVisibility,
      required: true,
      default: EventVisibility.PUBLIC,
    },
    
    // AI extraction metadata
    extractionConfidence: {
      type: 'number',
      required: false,  // 0-1 score from AI
    },
    extractionRawData: {
      type: 'any',
      required: false,  // Full AI response for debugging
    },
    
    // Attribution
    createdBy: {
      type: 'string',
      required: true,
    },
    lastModifiedBy: {
      type: 'string',
      required: false,
    },
    
    // Timestamps
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
    approvedAt: {
      type: 'string',
      required: false,
    },
    publishedAt: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    // Primary access by event ID
    primary: {
      pk: {
        field: 'pk',
        composite: ['id'],
        template: 'EVENT#${id}',
      },
      sk: {
        field: 'sk',
        composite: [],
        template: '#METADATA',
      },
    },
    
    // Query by date (upcoming/past events)
    byDate: {
      index: 'gsi1',
      pk: {
        field: 'gsi1pk',
        composite: ['status', 'startDateTime'],
        template: 'EVENT_STATUS#${status}#${startDateTime}',
      },
      sk: {
        field: 'gsi1sk',
        composite: ['id'],
        template: 'EVENT#${id}',
      },
    },
    
    // Query events by venue
    byVenue: {
      index: 'gsi2',
      pk: {
        field: 'gsi2pk',
        composite: ['venueId'],
        template: 'VENUE#${venueId}',
      },
      sk: {
        field: 'gsi2sk',
        composite: ['startDateTime', 'id'],
        template: '${startDateTime}#${id}',
      },
    },
    
    // Query events by organiser
    byOrganiser: {
      index: 'gsi3',
      pk: {
        field: 'gsi3pk',
        composite: ['organiserId'],
        template: 'ORGANISER#${organiserId}',
      },
      sk: {
        field: 'gsi3sk',
        composite: ['startDateTime', 'id'],
        template: '${startDateTime}#${id}',
      },
    },
    
    // Query events by creator (for user dashboard)
    byCreator: {
      index: 'gsi4',
      pk: {
        field: 'gsi4pk',
        composite: ['createdBy'],
        template: 'USER#${createdBy}',
      },
      sk: {
        field: 'gsi4sk',
        composite: ['createdAt', 'id'],
        template: '${createdAt}#${id}',
      },
    },
    
    // Query festival events by festival ID
    byFestival: {
      index: 'gsi5',
      pk: {
        field: 'gsi5pk',
        composite: ['festivalId'],
        template: 'FESTIVAL#${festivalId}',
      },
      sk: {
        field: 'gsi5sk',
        composite: ['sequenceNumber', 'startDateTime'],
        template: '${sequenceNumber}#${startDateTime}',
      },
    },
    
    // Pending approval queue (for moderators)
    pendingApproval: {
      index: 'gsi6',
      pk: {
        field: 'gsi6pk',
        composite: ['status'],
        template: 'EVENT_STATUS#${status}',
      },
      sk: {
        field: 'gsi6sk',
        composite: ['createdAt', 'id'],
        template: '${createdAt}#${id}',
      },
    },
  },
}, { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' });

export type Event = EntityItem<typeof EventEntity>;
```

#### Event Artist Relationship (Many-to-Many)

```typescript
// packages/core/src/domain/event/artist-relationship.ts

export const EventArtistEntity = new Entity({
  model: {
    entity: 'event_artist',
    version: '1',
    service: 'rasikalife',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    eventId: {
      type: 'string',
      required: true,
    },
    artistId: {
      type: 'string',
      required: true,
    },
    artistName: {
      type: 'string',
      required: false,  // Denormalized
    },
    role: {
      type: 'string',
      required: true,  // 'headliner', 'supporting', 'opening', 'special_appearance'
    },
    performanceOrder: {
      type: 'number',
      required: false,  // Order of performance
    },
    startTime: {
      type: 'string',
      required: false,  // Individual artist start time
    },
    endTime: {
      type: 'string',
      required: false,
    },
    isVerified: {
      type: 'boolean',
      required: true,
      default: false,  // Verified by artist/entity owner
    },
    createdAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'pk',
        composite: ['eventId'],
        template: 'EVENT#${eventId}',
      },
      sk: {
        field: 'sk',
        composite: ['performanceOrder', 'artistId'],
        template: 'ARTIST#${artistId}',
      },
    },
    byArtist: {
      index: 'gsi1',
      pk: {
        field: 'gsi1pk',
        composite: ['artistId'],
        template: 'ARTIST#${artistId}',
      },
      sk: {
        field: 'gsi1sk',
        composite: ['eventId'],
        template: 'EVENT#${eventId}',
      },
    },
  },
}, { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' });

export type EventArtist = EntityItem<typeof EventArtistEntity>;
```

#### Poster Upload Entity

```typescript
// packages/core/src/domain/event/poster-upload.ts

export const PosterUploadEntity = new Entity({
  model: {
    entity: 'poster_upload',
    version: '1',
    service: 'rasikalife',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    userId: {
      type: 'string',
      required: true,
    },
    eventId: {
      type: 'string',
      required: false,  // Set after event creation
    },
    
    // S3 information
    s3Key: {
      type: 'string',
      required: true,
    },
    s3Bucket: {
      type: 'string',
      required: true,
    },
    originalFileName: {
      type: 'string',
      required: false,
    },
    contentType: {
      type: 'string',
      required: true,
    },
    fileSize: {
      type: 'number',
      required: false,
    },
    
    // Processing status
    status: {
      type: 'string',
      required: true,
      default: 'pending',  // pending, processing, completed, failed
    },
    extractionResult: {
      type: 'any',
      required: false,  // AI extraction result
    },
    extractionError: {
      type: 'string',
      required: false,
    },
    retryCount: {
      type: 'number',
      required: true,
      default: 0,
    },
    
    // Timestamps
    createdAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
    },
    processedAt: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'pk',
        composite: ['id'],
        template: 'POSTER_UPLOAD#${id}',
      },
      sk: {
        field: 'sk',
        composite: [],
        template: '#METADATA',
      },
    },
    byUser: {
      index: 'gsi1',
      pk: {
        field: 'gsi1pk',
        composite: ['userId'],
        template: 'USER#${userId}',
      },
      sk: {
        field: 'gsi1sk',
        composite: ['createdAt', 'id'],
        template: '${createdAt}#${id}',
      },
    },
    byEvent: {
      index: 'gsi2',
      pk: {
        field: 'gsi2pk',
        composite: ['eventId'],
        template: 'EVENT#${eventId}',
      },
      sk: {
        field: 'gsi2sk',
        composite: [],
        template: '#METADATA',
      },
    },
    pendingProcessing: {
      index: 'gsi3',
      pk: {
        field: 'gsi3pk',
        composite: ['status'],
        template: 'UPLOAD_STATUS#${status}',
      },
      sk: {
        field: 'gsi3sk',
        composite: ['createdAt', 'id'],
        template: '${createdAt}#${id}',
      },
    },
  },
}, { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' });

export type PosterUpload = EntityItem<typeof PosterUploadEntity>;
```

#### Approval History Entity

```typescript
// packages/core/src/domain/event/approval-history.ts

export const ApprovalAction = {
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVISION_REQUESTED: 'revision_requested',
} as const;

export type ApprovalAction = (typeof ApprovalAction)[keyof typeof ApprovalAction];

export const EventApprovalEntity = new Entity({
  model: {
    entity: 'event_approval',
    version: '1',
    service: 'rasikalife',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    eventId: {
      type: 'string',
      required: true,
    },
    action: {
      type: ApprovalAction,
      required: true,
    },
    actorId: {
      type: 'string',
      required: true,  // User ID (creator, moderator, etc.)
    },
    actorRole: {
      type: 'string',
      required: true,  // 'creator', 'moderator', 'admin'
    },
    previousStatus: {
      type: 'string',
      required: false,
    },
    newStatus: {
      type: 'string',
      required: true,
    },
    notes: {
      type: 'string',
      required: false,
    },
    createdAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'pk',
        composite: ['eventId'],
        template: 'EVENT#${eventId}',
      },
      sk: {
        field: 'sk',
        composite: ['createdAt'],
        template: 'APPROVAL#${createdAt}',
      },
    },
  },
}, { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' });

export type EventApproval = EntityItem<typeof EventApprovalEntity>;
```

---

## Validation Schemas

```typescript
// packages/core/src/domain/event/schema.ts

import { z } from 'zod';

// Schema for AI extraction validation
export const ExtractedEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  startDateTime: z.string().datetime(),
  endDateTime: z.string().datetime().optional(),
  timezone: z.string().default('Asia/Kolkata'),
  
  venue: z.object({
    name: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
  }).optional(),
  
  organiser: z.object({
    name: z.string().optional(),
    contact: z.string().optional(),
    email: z.string().email().optional(),
  }).optional(),
  
  artists: z.array(z.object({
    name: z.string(),
    role: z.enum(['headliner', 'supporting', 'opening', 'special_appearance']).optional(),
    performanceOrder: z.number().optional(),
  })),
  
  ticketing: z.object({
    url: z.string().url().optional(),
    prices: z.record(z.number()).optional(),
    availability: z.enum(['available', 'sold_out', 'coming_soon']).optional(),
  }).optional(),
  
  festival: z.object({
    isFestival: z.boolean().optional(),
    festivalName: z.string().optional(),
    dayNumber: z.number().optional(),
  }).optional(),
  
  confidence: z.number().min(0).max(1),
});

export type ExtractedEventData = z.infer<typeof ExtractedEventSchema>;

// Schema for manual event creation/editing
export const CreateEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  startDateTime: z.string().datetime(),
  endDateTime: z.string().datetime().optional(),
  timezone: z.string().default('Asia/Kolkata'),
  
  isRecurring: z.boolean().optional(),
  recurringType: z.string().optional(),
  festivalId: z.string().optional(),
  festivalName: z.string().optional(),
  sequenceNumber: z.number().optional(),
  
  venueId: z.string().optional(),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  venueCity: z.string().optional(),
  
  organiserId: z.string().optional(),
  organiserName: z.string().optional(),
  organiserContact: z.string().optional(),
  
  ticketingUrl: z.string().url().optional(),
  ticketPrices: z.record(z.number()).optional(),
  ticketAvailability: z.enum(['available', 'sold_out', 'coming_soon']).optional(),
  
  visibility: z.enum(['public', 'private', 'unlisted']).optional(),
  
  artistIds: z.array(z.string()).optional(),
  artistRoles: z.record(z.string()).optional(),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = CreateEventSchema.partial();

export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

// Verification schema (what user can edit after AI extraction)
export const VerifyEventSchema = z.object({
  eventId: z.string(),
  verifiedData: CreateEventSchema,
  corrections: z.record(z.string()).optional(),  // Track what was changed from AI output
  notes: z.string().optional(),
});

export type VerifyEventInput = z.infer<typeof VerifyEventSchema>;
```

---

## Service Layer

```typescript
// packages/core/src/domain/event/service.ts

import { generateId } from '@/utils';
import { notFoundError } from '@/domain/helpers';
import { EventEntity, EventStatus, EventArtistEntity, PosterUploadEntity, EventApprovalEntity } from './entity';
import { CreateEventSchema, UpdateEventSchema, VerifyEventSchema, ExtractedEventSchema } from './schema';
import { ApplicationError, ErrorCode } from '@/constants';
import { matchEntity, createEntityIfNotExists } from './entity-matching';
import { DynamoDBDocumentClient, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

// === Poster Upload Service ===

export interface CreatePosterUploadInput {
  userId: string;
  s3Key: string;
  s3Bucket: string;
  originalFileName?: string;
  contentType: string;
  fileSize?: number;
}

export async function createPosterUpload(input: CreatePosterUploadInput): Promise<PosterUpload> {
  const id = generateId();
  
  const upload = await PosterUploadEntity.create({
    id,
    userId: input.userId,
    s3Key: input.s3Key,
    s3Bucket: input.s3Bucket,
    originalFileName: input.originalFileName,
    contentType: input.contentType,
    fileSize: input.fileSize,
    status: 'pending',
  }).go();
  
  return upload.data as PosterUpload;
}

export async function getPosterUpload(id: string): Promise<PosterUpload | null> {
  const result = await PosterUploadEntity.get({ id }).go();
  return result.data as PosterUpload | null;
}

export async function updatePosterStatus(
  id: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  extractionResult?: ExtractedEventData,
  error?: string
): Promise<PosterUpload> {
  const updateData: Record<string, unknown> = {
    status,
    processedAt: new Date().toISOString(),
  };
  
  if (extractionResult) {
    updateData.extractionResult = extractionResult;
  }
  
  if (error) {
    updateData.extractionError = error;
  }
  
  const result = await PosterUploadEntity.update({ id }).set(updateData).go();
  return result.data as PosterUpload;
}

// === Event Service ===

export async function createEvent(
  input: CreateEventInput,
  userId: string,
  posterUploadId?: string
): Promise<Event> {
  const id = generateId();
  
  const event = await EventEntity.create({
    id,
    posterUploadId,
    ...input,
    status: EventStatus.PENDING_VERIFICATION,
    createdBy: userId,
    lastModifiedBy: userId,
  }).go();
  
  return event.data as Event;
}

export async function getEvent(id: string): Promise<Event | null> {
  const result = await EventEntity.get({ id }).go();
  return result.data as Event | null;
}

export async function updateEvent(
  id: string,
  input: UpdateEventInput,
  userId: string
): Promise<Event> {
  const existing = await EventEntity.get({ id }).go();
  
  if (!existing.data) {
    throw notFoundError('event', id);
  }
  
  const updateData = {
    ...input,
    lastModifiedBy: userId,
  };
  
  const result = await EventEntity.update({ id }).set(updateData).go();
  return result.data as Event;
}

export async function submitForApproval(eventId: string, userId: string): Promise<Event> {
  const event = await EventEntity.get({ id: eventId }).go();
  
  if (!event.data) {
    throw notFoundError('event', eventId);
  }
  
  if (event.data.createdBy !== userId) {
    throw new ApplicationError(
      ErrorCode.FORBIDDEN,
      'Only the event creator can submit for approval'
    );
  }
  
  // Create approval history entry
  await EventApprovalEntity.create({
    id: generateId(),
    eventId,
    action: 'submitted',
    actorId: userId,
    actorRole: 'creator',
    previousStatus: event.data.status,
    newStatus: EventStatus.PENDING_APPROVAL,
  }).go();
  
  const result = await EventEntity.update({ id: eventId })
    .set({
      status: EventStatus.PENDING_APPROVAL,
      lastModifiedBy: userId,
    })
    .go();
  
  return result.data as Event;
}

// === Approval Service ===

export async function approveEvent(
  eventId: string,
  moderatorId: string,
  moderatorNote?: string
): Promise<Event> {
  const event = await EventEntity.get({ id: eventId }).go();
  
  if (!event.data) {
    throw notFoundError('event', eventId);
  }
  
  if (event.data.status !== EventStatus.PENDING_APPROVAL) {
    throw new ApplicationError(
      ErrorCode.INVALID_STATE,
      'Event is not pending approval'
    );
  }
  
  // Create approval history
  await EventApprovalEntity.create({
    id: generateId(),
    eventId,
    action: 'approved',
    actorId: moderatorId,
    actorRole: 'moderator',
    previousStatus: EventStatus.PENDING_APPROVAL,
    newStatus: EventStatus.APPROVED,
    notes: moderatorNote,
  }).go();
  
  const result = await EventEntity.update({ id: eventId })
    .set({
      status: EventStatus.APPROVED,
      approvedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      lastModifiedBy: moderatorId,
    })
    .go();
  
  return result.data as Event;
}

export async function rejectEvent(
  eventId: string,
  moderatorId: string,
  reason: string
): Promise<Event> {
  const event = await EventEntity.get({ id: eventId }).go();
  
  if (!event.data) {
    throw notFoundError('event', eventId);
  }
  
  // Create rejection history
  await EventApprovalEntity.create({
    id: generateId(),
    eventId,
    action: 'rejected',
    actorId: moderatorId,
    actorRole: 'moderator',
    previousStatus: event.data.status,
    newStatus: EventStatus.REJECTED,
    notes: reason,
  }).go();
  
  const result = await EventEntity.update({ id: eventId })
    .set({
      status: EventStatus.REJECTED,
      lastModifiedBy: moderatorId,
    })
    .go();
  
  return result.data as Event;
}

// === Event Artist Service ===

export async function linkArtistToEvent(
  eventId: string,
  artistId: string,
  role: string,
  performanceOrder?: number
): Promise<EventArtist> {
  const event = await EventEntity.get({ id: eventId }).go();
  if (!event.data) {
    throw notFoundError('event', eventId);
  }
  
  const artistLink = await EventArtistEntity.create({
    id: generateId(),
    eventId,
    artistId,
    artistName: '',  // Will be populated by query
    role,
    performanceOrder,
  }).go();
  
  return artistLink.data as EventArtist;
}

export async function getEventArtists(eventId: string): Promise<EventArtist[]> {
  const result = await EventArtistEntity.query
    .primary({ eventId })
    .go();
  
  return result.data as EventArtist[];
}

export async function getArtistEvents(artistId: string): Promise<EventArtist[]> {
  const result = await EventArtistEntity.query
    .byArtist({ artistId })
    .go();
  
  return result.data as EventArtist[];
}

// === Query Services ===

export async function listUpcomingEvents(
  limit = 20,
  nextToken?: string
): Promise<{ items: Event[]; nextToken?: string }> {
  const now = new Date().toISOString();
  
  const result = await EventEntity.query
    .byDate({ status: EventStatus.APPROVED })
    .gte({ startDateTime: now })
    .go({ limit, cursor: nextToken, order: 'asc' });
  
  return {
    items: result.data as Event[],
    nextToken: result.cursor,
  };
}

export async function listEventsByVenue(
  venueId: string,
  limit = 20,
  nextToken?: string
): Promise<{ items: Event[]; nextToken?: string }> {
  const result = await EventEntity.query
    .byVenue({ venueId })
    .go({ limit, cursor: nextToken, order: 'asc' });
  
  return {
    items: result.data as Event[],
    nextToken: result.cursor,
  };
}

export async function listEventsByOrganiser(
  organiserId: string,
  limit = 20,
  nextToken?: string
): Promise<{ items: Event[]; nextToken?: string }> {
  const result = await EventEntity.query
    .byOrganiser({ organiserId })
    .go({ limit, cursor: nextToken, order: 'asc' });
  
  return {
    items: result.data as Event[],
    nextToken: result.cursor,
  };
}

export async function listFestivalEvents(festivalId: string): Promise<Event[]> {
  const result = await EventEntity.query
    .byFestival({ festivalId })
    .go({ order: 'asc' });
  
  return result.data as Event[];
}

export async function listPendingApproval(
  limit = 20,
  nextToken?: string
): Promise<{ items: Event[]; nextToken?: string }> {
  const result = await EventEntity.query
    .pendingApproval({ status: EventStatus.PENDING_APPROVAL })
    .go({ limit, cursor: nextToken, order: 'asc' });
  
  return {
    items: result.data as Event[],
    nextToken: result.cursor,
  };
}

export async function listUserEvents(
  userId: string,
  limit = 20,
  nextToken?: string
): Promise<{ items: Event[]; nextToken?: string }> {
  const result = await EventEntity.query
    .byCreator({ createdBy: userId })
    .go({ limit, cursor: nextToken, order: 'desc' });
  
  return {
    items: result.data as Event[],
    nextToken: result.cursor,
  };
}

// === Entity Matching Service ===

export interface EntityMatchResult {
  matched: boolean;
  existingEntityId?: string;
  existingEntityName?: string;
  confidence: number;
}

export async function matchArtist(name: string): Promise<EntityMatchResult> {
  // TODO: Implement fuzzy matching using existing search service
  // This should use Fuse.js or similar for fuzzy matching
  return {
    matched: false,
    confidence: 0,
  };
}

export async function matchVenue(name: string, city?: string): Promise<EntityMatchResult> {
  // TODO: Implement fuzzy matching
  return {
    matched: false,
    confidence: 0,
  };
}

export async function matchOrganiser(name: string): Promise<EntityMatchResult> {
  // TODO: Implement fuzzy matching
  return {
    matched: false,
    confidence: 0,
  };
}
```

---

## AI Extraction Service

```typescript
// packages/core/src/domain/event/extraction-service.ts

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ExtractedEventSchema, ExtractedEventData } from './schema';
import { ApplicationError } from '@/constants';

export class GeminiExtractionService {
  private client: GoogleGenAI;
  private model: string;
  
  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = 'gemini-2.0-flash-exp';  // Use latest model for best results
  }
  
  async extractFromImage(
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<ExtractedEventData> {
    const base64Image = imageBuffer.toString('base64');
    const jsonSchema = zodToJsonSchema(ExtractedEventSchema);
    
    const prompt = `
      You are an expert at extracting structured information from Indian classical music event posters.
      
      Extract all event information from this poster image. Pay special attention to:
      
      1. **Event Title**: The name of the concert, festival, or event series
      2. **Date and Time**: When the event occurs (including day of week if visible)
      3. **Artists**: All performers listed, including their roles (headliner, supporting, etc.)
      4. **Venue**: Name, address, and city of the location
      5. **Organiser**: Who is organizing the event
      6. **Ticketing**: Prices, booking links, and availability
      7. **Festival Info**: If this is part of a multi-day festival, extract all days
      
      For festival posters with multiple days/performances, extract EACH individual performance
      as a separate entry with its own date, time, and artist list.
      
      Handle common challenges:
      - Date formats in various styles (DD/MM/YYYY, Month DD, etc.)
      - Time formats (24-hour, AM/PM notation)
      - Artist name variations and titles
      - Regional language text (transliterate to Latin script)
      - Abbreviations and shortened venue names
      
      Return ONLY valid JSON matching the provided schema.
    `;
    
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            type: 'text',
            text: prompt,
          },
          {
            type: 'image',
            data: base64Image,
            mime_type: mimeType,
          },
        ],
        config: {
          response_mime_type: 'application/json',
          response_schema: jsonSchema,
          temperature: 0.1,  // Low temperature for consistent extraction
        },
      });
      
      if (!response.text) {
        throw new ApplicationError(
          ErrorCode.AI_EXTRACTION_FAILED,
          'No response from Gemini API'
        );
      }
      
      const parsed = JSON.parse(response.text);
      
      // Validate against schema
      const result = ExtractedEventSchema.parse(parsed);
      
      return result;
      
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      throw new ApplicationError(
        ErrorCode.AI_EXTRACTION_FAILED,
        `Failed to extract event data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  async enhanceExtractedData(
    existingData: ExtractedEventData,
    userClarification?: string
  ): Promise<ExtractedEventData> {
    // Optional: Use AI to fill in gaps or clarify ambiguities
    // based on user input
    return existingData;
  }
}
```

---

## Entity Matching Service

```typescript
// packages/core/src/domain/event/entity-matching.ts

import Fuse from 'fuse.js';
import { getArtistByName } from '@/domain/artist';
import { getVenueByName } from '@/domain/venue';  // TODO: Implement
import { getOrganiserByName } from '@/domain/organiser';  // TODO: Implement
import type { EntityMatchResult } from './service';

// Fuzzy matching configuration
const FUSE_OPTIONS: Fuse.IFuseOptions<{ id: string; name: string }> = {
  includeScore: true,
  threshold: 0.4,  // 0.0 = exact match, 1.0 = match anything
  keys: ['name'],
  ignoreLocation: true,
  useExtendedSearch: true,
};

const MATCH_THRESHOLD = 0.3;  // Score below this is considered a match

export async function matchEntity(
  entityType: 'artist' | 'venue' | 'organiser',
  name: string,
  additionalData?: Record<string, string>
): Promise<EntityMatchResult> {
  switch (entityType) {
    case 'artist':
      return matchArtistByName(name);
    case 'venue':
      return matchVenueByName(name, additionalData?.city);
    case 'organiser':
      return matchOrganiserByName(name);
    default:
      return { matched: false, confidence: 0 };
  }
}

async function matchArtistByName(name: string): Promise<EntityMatchResult> {
  // Normalize name for comparison
  const normalizedName = normalizeName(name);
  
  // Try exact match first
  const exactMatch = await getArtistByName(name);
  if (exactMatch) {
    return {
      matched: true,
      existingEntityId: exactMatch.id,
      existingEntityName: exactMatch.name,
      confidence: 1.0,
    };
  }
  
  // Get all artists for fuzzy matching
  // TODO: Replace with proper search query
  const allArtists = await listAllArtists();
  
  const fuse = new Fuse(allArtists, {
    ...FUSE_OPTIONS,
    keys: ['name', 'aliases'],  // Include aliases if available
  });
  
  const results = fuse.search(normalizedName);
  
  if (results.length > 0 && (results[0].score ?? 1) < MATCH_THRESHOLD) {
    const bestMatch = results[0].item;
    return {
      matched: true,
      existingEntityId: bestMatch.id,
      existingEntityName: bestMatch.name,
      confidence: 1 - (results[0].score ?? 0),
    };
  }
  
  return {
    matched: false,
    confidence: 0,
  };
}

async function matchVenueByName(name: string, city?: string): Promise<EntityMatchResult> {
  // Similar implementation for venues
  return { matched: false, confidence: 0 };
}

async function matchOrganiserByName(name: string): Promise<EntityMatchResult> {
  // Similar implementation for organisers
  return { matched: false, confidence: 0 };
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/m\.?s\.?/gi, 'ms')  // M.S. -> MS
    .replace(/dr\.?/gi, 'doctor')
    .replace(/kalpana/gi, 'kalpana')
    .replace(/[,.]/g, '');
}

// TODO: Implement listAllArtists
async function listAllArtists(): Promise<Array<{ id: string; name: string }>> {
  return [];
}
```

---

## S3-Lambda Processing Pipeline

```typescript
// functions/event-poster-processor/src/handler.ts

import { S3Event, S3EventRecord, Context } from 'aws-lambda';
import { GoogleGenAI } from '@google/genai';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { GeminiExtractionService } from './gemini-client';
import { updatePosterStatus } from './poster-service';
import { createEventFromExtraction, createFestivalEventsFromExtraction } from './event-service';
import { ProcessingError, withRetry } from './errors';

const s3Client = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
const dynamoClient = DynamoDBDocumentClient.from(new S3Client({}), {
  marshallOptions: { removeUndefinedValues: true },
});

let extractionService: GeminiExtractionService | null = null;

function getExtractionService(): GeminiExtractionService {
  if (!extractionService) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    extractionService = new GeminiExtractionService(apiKey);
  }
  return extractionService;
}

export const handler = async (
  event: S3Event,
  context: Context
): Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }> => {
  console.log(`Lambda ARN: ${context.functionName}`);
  console.log(`Processing ${event.Records.length} record(s)`);
  
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];
  
  for (const record of event.Records) {
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const bucket = record.s3.bucket.name;
    
    console.log(`Processing: s3://${bucket}/${key}`);
    
    try {
      // Process the poster
      await processPoster(bucket, key);
      
      console.log(`Successfully processed: ${key}`);
      
    } catch (error) {
      const processingError = error as ProcessingError;
      
      console.error(`Failed to process ${key}:`, {
        message: processingError.message,
        retryable: processingError.retryable,
      });
      
      // Return for retry if error is retryable
      if (processingError.retryable && context.getRemainingTimeInMillis() > 10000) {
        batchItemFailures.push({
          itemIdentifier: record.s3.object.key,
        });
      }
    }
  }
  
  return { batchItemFailures };
};

async function processPoster(bucket: string, key: string): Promise<void> {
  // Extract upload ID from S3 key pattern: posters/{userId}/{uploadId}.{ext}
  const keyParts = key.split('/');
  const uploadId = keyParts[1];  // Second part is upload ID
  
  // Update status to processing
  await updatePosterStatus(uploadId, 'processing');
  
  try {
    // Get image from S3
    const imageBuffer = await getImageFromS3(bucket, key);
    const contentType = await getContentTypeFromS3(bucket, key);
    
    // Extract structured data
    const extractionService = getExtractionService();
    const extractedData = await withRetry(
      () => extractionService.extractFromImage(imageBuffer, contentType),
      3,  // Max retries
      1000  // Base delay
    );
    
    console.log(`Extracted ${extractedData.artists.length} artists from poster`);
    
    // Update poster with extraction result
    await updatePosterStatus(uploadId, 'completed', extractedData);
    
    // Create event(s) from extraction
    if (extractedData.festival?.isFestival) {
      // Create multiple events for festival
      await createFestivalEventsFromExtraction(uploadId, extractedData);
    } else {
      // Create single event
      await createEventFromExtraction(uploadId, extractedData);
    }
    
  } catch (error) {
    // Update status to failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updatePosterStatus(uploadId, 'failed', undefined, errorMessage);
    
    throw error;
  }
}

async function getImageFromS3(bucket: string, key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  
  const response = await s3Client.send(command);
  
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

async function getContentTypeFromS3(bucket: string, key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  
  const response = await s3Client.send(command);
  return response.ContentType ?? 'image/jpeg';
}
```

---

## tRPC Router

```typescript
// packages/trpc/src/routers/event.ts

import { z } from 'zod';
import { router, protectedProcedure, moderatorProcedure } from '../trpc';
import {
  createPosterUpload,
  createEvent,
  getEvent,
  updateEvent,
  submitForApproval,
  approveEvent,
  rejectEvent,
  listUpcomingEvents,
  listEventsByVenue,
  listEventsByOrganiser,
  listPendingApproval,
  listUserEvents,
  getPosterUpload,
} from '@core/domain/event/service';
import { ApplicationError, ErrorCode } from '@/constants';

// Upload URL generation schema
const GetUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export const eventRouter = router({
  // === Poster Upload ===
  
  getUploadUrl: protectedProcedure
    .input(GetUploadUrlSchema)
    .mutation(async ({ ctx, input }) => {
      // TODO: Generate pre-signed S3 URL for upload
      const uploadId = generateUploadId();
      return {
        uploadId,
        uploadUrl: `/api/upload/poster/${uploadId}`,
        requiredFields: {
          'x-upload-id': uploadId,
        },
      };
    }),
  
  // === Event CRUD ===
  
  create: protectedProcedure
    .input(z.object({
      posterUploadId: z.string().optional(),
      data: z.object({
        title: z.string().min(1).max(500),
        description: z.string().optional(),
        startDateTime: z.string().datetime(),
        endDateTime: z.string().datetime().optional(),
        timezone: z.string().default('Asia/Kolkata'),
        venueId: z.string().optional(),
        venueName: z.string().optional(),
        venueAddress: z.string().optional(),
        venueCity: z.string().optional(),
        organiserId: z.string().optional(),
        organiserName: z.string().optional(),
        organiserContact: z.string().optional(),
        ticketingUrl: z.string().url().optional(),
        ticketPrices: z.record(z.number()).optional(),
        ticketAvailability: z.enum(['available', 'sold_out', 'coming_soon']).optional(),
        visibility: z.enum(['public', 'private', 'unlisted']).optional(),
        artistIds: z.array(z.string()).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await createEvent(input.data, ctx.user.id, input.posterUploadId);
      } catch (error) {
        if (error instanceof ApplicationError) {
          throw error;
        }
        throw new ApplicationError(
          ErrorCode.EVENT_CREATE_FAILED,
          `Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }),
  
  get: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const event = await getEvent(input.id);
      if (!event) {
        throw new ApplicationError(ErrorCode.EVENT_NOT_FOUND, `Event ${input.id} not found`);
      }
      return event;
    }),
  
  update: protectedProcedure
    .input(z.object({
      id: z.string().min(1),
      data: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        startDateTime: z.string().optional(),
        endDateTime: z.string().optional(),
        venueId: z.string().optional(),
        venueName: z.string().optional(),
        venueAddress: z.string().optional(),
        venueCity: z.string().optional(),
        organiserId: z.string().optional(),
        organiserName: z.string().optional(),
        organiserContact: z.string().optional(),
        ticketingUrl: z.string().optional(),
        ticketPrices: z.record(z.number()).optional(),
        ticketAvailability: z.enum(['available', 'sold_out', 'coming_soon']).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      const event = await getEvent(input.id);
      if (!event) {
        throw new ApplicationError(ErrorCode.EVENT_NOT_FOUND, `Event ${input.id} not found`);
      }
      
      const canEdit = event.createdBy === ctx.user.id || 
                      ctx.user.role === 'admin' ||
                      ctx.user.role === 'moderator';
      
      if (!canEdit) {
        throw new ApplicationError(
          ErrorCode.FORBIDDEN,
          'You do not have permission to edit this event'
        );
      }
      
      return await updateEvent(input.id, input.data, ctx.user.id);
    }),
  
  // === Approval Workflow ===
  
  submitForApproval: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await submitForApproval(input.eventId, ctx.user.id);
    }),
  
  approve: moderatorProcedure
    .input(z.object({
      eventId: z.string(),
      moderatorNote: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await approveEvent(input.eventId, ctx.user.id, input.moderatorNote);
    }),
  
  reject: moderatorProcedure
    .input(z.object({
      eventId: z.string(),
      reason: z.string().min(1, 'Rejection reason is required'),
    }))
    .mutation(async ({ ctx, input }) => {
      return await rejectEvent(input.eventId, ctx.user.id, input.reason);
    }),
  
  // === Queries ===
  
  listUpcoming: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        nextToken: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return await listUpcomingEvents(input?.limit, input?.nextToken);
    }),
  
  listByVenue: protectedProcedure
    .input(z.object({
      venueId: z.string(),
      limit: z.number().min(1).max(100).optional().default(20),
      nextToken: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return await listEventsByVenue(input.venueId, input.limit, input.nextToken);
    }),
  
  listByOrganiser: protectedProcedure
    .input(z.object({
      organiserId: z.string(),
      limit: z.number().min(1).max(100).optional().default(20),
      nextToken: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return await listEventsByOrganiser(input.organiserId, input.limit, input.nextToken);
    }),
  
  listPendingApproval: moderatorProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        nextToken: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return await listPendingApproval(input?.limit, input?.nextToken);
    }),
  
  listMyEvents: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        nextToken: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return await listUserEvents(ctx.user.id, input?.limit, input?.nextToken);
    }),
  
  // === Poster Upload Status ===
  
  getPosterUpload: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const upload = await getPosterUpload(input.id);
      if (!upload) {
        throw new ApplicationError(ErrorCode.NOT_FOUND, `Upload ${input.id} not found`);
      }
      return upload;
    }),
});

function generateUploadId(): string {
  // TODO: Use KSUID or UUID
  return `poster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

---

## Frontend Pages

### Add Event Page (Poster Upload)

```typescript
// packages/web/app/routes/events.new.tsx

import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from 'react-router';
import { data, Form, useActionData, useLoaderData, useNavigation } from 'react-router';
import { client } from '~/api.server';
import { requireUser } from '~/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  return data({ user });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get('intent');
  
  if (intent === 'get-upload-url') {
    const fileName = formData.get('fileName') as string;
    const contentType = formData.get('contentType') as string;
    
    try {
      const result = await client.event.getUploadUrl.mutate({ fileName, contentType });
      return data({ uploadUrl: result.uploadUrl, uploadId: result.uploadId });
    } catch (error) {
      return data({ error: 'Failed to get upload URL' }, { status: 500 });
    }
  }
  
  return data({ error: 'Invalid intent' }, { status: 400 });
}

export const meta: MetaFunction = () => {
  return [
    { title: 'Add Event - Rasika.life' },
    { name: 'description', content: 'Upload an event poster to create an event' },
  ];
};

export default function AddEventPage() {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Add New Event</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-blue-800 mb-2">How it works</h2>
        <ol className="list-decimal list-inside space-y-1 text-blue-700">
          <li>Upload a photo of the event poster</li>
          <li>Our AI will extract event details automatically</li>
          <li>Review and edit the extracted information</li>
          <li>Submit for approval</li>
        </ol>
      </div>
      
      <Form method="post" className="space-y-6">
        <div>
          <label htmlFor="poster" className="block text-sm font-medium mb-2">
            Event Poster
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              id="poster"
              name="poster"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <label htmlFor="poster" className="cursor-pointer">
              <div className="text-gray-600">
                <span className="text-primary font-medium">Click to upload</span> or drag and drop
              </div>
              <div className="text-sm text-gray-500 mt-1">
                PNG, JPG, WebP up to 10MB
              </div>
            </label>
          </div>
          {selectedFile && (
            <div className="mt-4">
              <img
                src={URL.createObjectURL(selectedFile)}
                alt="Selected poster preview"
                className="max-h-64 rounded-lg"
              />
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-red-600 text-sm mt-2"
              >
                Remove
              </button>
            </div>
          )}
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            name="intent"
            value="upload"
            disabled={!selectedFile || isSubmitting}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Uploading...' : 'Continue to Verification'}
          </button>
        </div>
      </Form>
    </div>
  );
}
```

### Event Verification Page

```typescript
// packages/web/app/routes/events.$eventid.verify.tsx

import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from 'react-router';
import { data, Form, useActionData, useLoaderData, useNavigation } from 'react-router';
import { client } from '~/api.server';
import { requireUser } from '~/auth.server';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const { eventid } = params;
  
  if (!eventid) {
    throw new Response('Event ID required', { status: 400 });
  }
  
  const event = await client.event.get.query({ id: eventid });
  
  if (!event) {
    throw new Response('Event not found', { status: 404 });
  }
  
  // Only allow verification for pending events
  if (event.status !== 'pending_verification') {
    throw new Response('Event is not pending verification', { status: 400 });
  }
  
  return data({ event, user });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const { eventid } = params;
  const formData = await request.formData();
  const intent = formData.get('intent') as string;
  
  if (intent === 'save-draft') {
    const updates = extractFormData(formData);
    await client.event.update.mutate({
      id: eventid!,
      data: updates,
    });
    return data({ success: true, message: 'Draft saved' });
  }
  
  if (intent === 'submit') {
    const updates = extractFormData(formData);
    await client.event.update.mutate({
      id: eventid!,
      data: updates,
    });
    await client.event.submitForApproval.mutate({ eventId: eventid! });
    return data({ success: true, message: 'Submitted for approval' });
  }
  
  return data({ error: 'Invalid action' }, { status: 400 });
}

export const meta: MetaFunction = ({ data }) => {
  return [
    { title: `Verify Event: ${data?.event.title} - Rasika.life` },
  ];
};

export default function VerifyEventPage() {
  const { event } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Verify Event Details</h1>
      
      {actionData && 'success' in actionData && (
        <div className="p-4 mb-4 bg-green-50 text-green-600 rounded-lg">
          {actionData.message}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Poster Preview */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Original Poster</h2>
          <img
            src={event.posterUrl}
            alt="Event poster"
            className="rounded-lg shadow-lg max-h-[600px] w-full object-contain bg-gray-100"
          />
        </div>
        
        {/* Edit Form */}
        <Form method="post" className="space-y-6">
          <input type="hidden" name="eventId" value={event.id} />
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-sm">
              Please review and correct the AI-extracted information below before submitting.
            </p>
          </div>
          
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Event Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              defaultValue={event.title}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDateTime" className="block text-sm font-medium mb-1">
                Start Date/Time *
              </label>
              <input
                type="datetime-local"
                id="startDateTime"
                name="startDateTime"
                defaultValue={formatDateTimeForInput(event.startDateTime)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label htmlFor="endDateTime" className="block text-sm font-medium mb-1">
                End Date/Time
              </label>
              <input
                type="datetime-local"
                id="endDateTime"
                name="endDateTime"
                defaultValue={event.endDateTime ? formatDateTimeForInput(event.endDateTime) : ''}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
          
          {/* Venue */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Venue</h3>
            <VenueFields venue={event.venue} />
          </div>
          
          {/* Artists */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Artists</h3>
            <ArtistFields
              artists={event.artists}
              existingArtists={[]}
            />
          </div>
          
          {/* Ticketing */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Ticketing</h3>
            <TicketingFields event={event} />
          </div>
          
          {/* Actions */}
          <div className="flex justify-between pt-6 border-t">
            <button
              type="submit"
              name="intent"
              value="save-draft"
              disabled={isSubmitting}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Save Draft
            </button>
            <button
              type="submit"
              name="intent"
              value="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
```

### Moderation Dashboard

```typescript
// packages/web/app/routes/moderator.events.tsx

import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data, useLoaderData } from 'react-router';
import { client } from '~/api.server';
import { requireModerator } from '~/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireModerator(request);
  const pendingEvents = await client.event.listPendingApproval.query({});
  return data({ user, pendingEvents });
}

export const meta: MetaFunction = () => {
  return [
    { title: 'Event Moderation - Rasika.life' },
  ];
};

export default function ModeratorEventsPage() {
  const { pendingEvents } = useLoaderData<typeof loader>();
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Event Moderation</h1>
      
      <div className="mb-6">
        <div className="text-gray-600">
          {pendingEvents.items.length} events pending approval
        </div>
      </div>
      
      <div className="space-y-4">
        {pendingEvents.items.map((event) => (
          <EventReviewCard key={event.id} event={event} />
        ))}
        
        {pendingEvents.items.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No events pending approval
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Infrastructure (SST)

```typescript
// infra/event-poster.ts

import { S3Bucket, Function, Topic } from 'sst/aws';

export function setupEventPosterInfrastructure() {
  // Poster upload bucket
  const posterBucket = new S3Bucket('EventPosters', {
    notifications: {
      onUpload: {
        handler: 'functions/event-poster-processor.handler',
        filter: {
          suffix: ['.jpg', '.jpeg', '.png', '.webp'],
        },
      },
    },
  });
  
  // Lambda function for processing
  const processor = new Function('EventPosterProcessor', {
    handler: 'functions/event-poster-processor.handler',
    timeout: '15 minutes',
    memorySize: 2048,
    permissions: [
      {
        actions: ['s3:GetObject', 's3:PutObject'],
        resources: [posterBucket.arn + '/*'],
      },
    ],
    environment: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
      DYNAMODB_TABLE: process.env.DYNAMODB_TABLE ?? '',
    },
  });
  
  // Dead letter queue for failed processing
  const dlqTopic = new Topic('EventPosterDLQ');
  
  return {
    posterBucket,
    processor,
    dlqTopic,
  };
}
```

---

## Error Codes

```typescript
// packages/core/src/constants.ts

export enum ErrorCode {
  // Event errors
  EVENT_NOT_FOUND = 'EVENT_NOT_FOUND',
  EVENT_CREATE_FAILED = 'EVENT_CREATE_FAILED',
  EVENT_UPDATE_FAILED = 'EVENT_UPDATE_FAILED',
  EVENT_DELETE_FAILED = 'EVENT_DELETE_FAILED',
  
  // AI extraction errors
  AI_EXTRACTION_FAILED = 'AI_EXTRACTION_FAILED',
  AI_EXTRACTION_RETRY = 'AI_EXTRACTION_RETRY',
  
  // Approval errors
  EVENT_NOT_PENDING_APPROVAL = 'EVENT_NOT_PENDING_APPROVAL',
  
  // Permission errors
  CANNOT_EDIT_EVENT = 'CANNOT_EDIT_EVENT',
  CANNOT_APPROVE_OWN_EVENT = 'CANNOT_APPROVE_OWN_EVENT',
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create Event, EventArtist, PosterUpload, EventApproval entities
2. Implement Event service layer (CRUD operations)
3. Set up S3 bucket and Lambda trigger for poster processing
4. Create Gemini extraction service
5. Implement basic tRPC router for events

**Deliverable:** Users can create events manually, moderators can approve

### Phase 2: AI Processing
1. Complete Gemini extraction service with robust prompts
2. Implement Lambda handler for S3 trigger
3. Create extraction-to-event conversion logic
4. Handle festival/multi-day event parsing
5. Add retry logic for failed extractions

**Deliverable:** Poster upload → AI extraction → Event creation pipeline

### Phase 3: Verification UI
1. Build add event page with poster upload
2. Create verification page with editable fields
3. Implement artist/venue/organiser search and selection
4. Add fuzzy matching for entity linking
5. Build entity auto-creation from extraction

**Deliverable:** Complete user flow from upload to verification

### Phase 4: Moderation & Permissions
1. Build moderator dashboard for pending events
2. Implement approval/rejection workflow
3. Add entity owner permissions (venue owners, artists can edit)
4. Create notification system for status changes
5. Add audit trail for all moderation actions

**Deliverable:** Complete moderation workflow with permissions

### Phase 5: Entity Profile Integration
1. Add "events" section to artist profiles
2. Add "events" section to venue profiles
3. Add "events" section to organiser profiles
4. Implement chronological event listing
5. Add filtering (upcoming, past, all)

**Deliverable:** Events visible on entity profile pages

---

## Testing Strategy

### Unit Tests
- Event creation and validation
- AI extraction schema validation
- Entity matching algorithms
- Status transition logic

### Integration Tests
- Poster upload → Lambda → DynamoDB flow
- Verification page submission
- Moderation approval workflow
- Entity linking and updates

### E2E Tests
- Complete user flow: upload → verify → submit → approve
- Festival poster processing
- Entity owner edit flow

---

## Open Questions

1. **Entity Ownership**: How do users claim ownership of artist/venue/organiser profiles for editing permissions?

2. **Duplicate Detection**: Should the system prevent duplicate events (same venue, same time, similar title)?

3. **AI Confidence Thresholds**: What extraction confidence score requires manual review vs auto-approval?

4. **Festival Master Event**: Should there be a "festival" entity type, or just link events to a parent festival ID?

5. **Image Quality Requirements**: What minimum resolution/quality should posters meet for reliable extraction?

6. **Offline Processing**: How should failed extractions be handled - auto-retry, manual flag, or user notification?

---

## References

- [S3 → Lambda → Gemini Pipeline Pattern](/docs/stack/s3-lambda-gemini-pipeline.md)
- [Google Gemini API Integration](/docs/stack/google-gemini-api.md)
- [Generic Edit System Specification](/docs/plans/250201-01d-generic-edit-system.md)
- [Single Table DynamoDB Design](/docs/adrs/adr-001-single-table-dynamodb-design.md)
- [ElectroDB Type-Safe Operations](/docs/adrs/adr-005-electrodb-type-safe-database-operations.md)
