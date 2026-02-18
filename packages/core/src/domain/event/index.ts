import type { z } from 'zod';
import { generateId } from '../../utils';
import { EventArtistEntity } from '../event-artist/entity';
import { createFestival } from '../festival';
import { createFailedError, notFoundError } from '../helpers';
import { EventEntity } from './entity';
import type { Event } from './entity';
import type { ExtractionResult } from './extraction';
import { extractFromPoster } from './gemini';
import { savePosterHash } from './poster-hash';
import type { CreateEventSchema, UpdateEventSchema } from './schema';

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

import { ART_FORMS } from './client';

export { ART_FORM_LABELS, ART_FORMS } from './client';

function deriveArtForm(tags?: string[]): string | undefined {
  return tags?.find(t => ART_FORMS.has(t.toLowerCase()))?.toLowerCase();
}

// Strip null values from an object — ElectroDB only accepts undefined, not null
function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null) {
      result[key] = value;
    }
  }
  return result;
}

export async function createEvent(
  input: CreateEventInput,
  userId: string,
  options?: { status?: string }
): Promise<Event> {
  const id = generateId();
  const artForm = input.artForm || deriveArtForm(input.tags);
  const status = options?.status ?? 'approved';
  const result = await EventEntity.create({
    id,
    ...input,
    ...(artForm ? { artForm } : {}),
    status: status as 'draft' | 'approved' | 'submitted',
    createdBy: userId,
  }).go();

  if (!result.data) {
    throw createFailedError('event', input.title);
  }

  // Create EventArtist junction records only for approved events
  if (status === 'approved' && input.artists?.length) {
    await createEventArtistJunctions(id, input.title, input.startDateTime, input.artists);
  }

  return result.data as Event;
}

async function createEventArtistJunctions(
  eventId: string,
  eventTitle: string,
  eventStartDateTime: string,
  artists: Array<{ id?: string | null; name: string; title?: string | null; role?: string | null }>
) {
  if (!artists?.length) return;

  // Deduplicate by artistId — same artist can appear with different roles
  const seen = new Set<string>();
  const unique = artists.filter(a => {
    if (!a.id || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  // Use upsert instead of create to be idempotent (no conditional check failure)
  await Promise.all(
    unique.map(artist =>
      EventArtistEntity.upsert({
        eventId,
        artistId: artist.id as string,
        eventTitle,
        eventStartDateTime,
        artistName: artist.name,
        artistTitle: artist.title ?? undefined,
        role: artist.role ?? undefined,
      }).go()
    )
  );
}

export async function submitEvent(
  id: string,
  inputData: UpdateEventInput,
  userId: string
): Promise<Event> {
  const existing = await getEvent(id);
  if (!existing) {
    throw notFoundError('event', id);
  }
  if (existing.status !== 'draft') {
    throw createFailedError('event', `Event ${id} is not a draft`);
  }
  if (existing.createdBy !== userId) {
    throw createFailedError('event', `Event ${id} does not belong to user`);
  }

  const artForm = inputData.artForm || deriveArtForm(inputData.tags);
  const result = await EventEntity.update({ id })
    .set({
      ...stripNulls(inputData as Record<string, unknown>),
      ...(artForm ? { artForm } : {}),
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    })
    .go({ response: 'all_new' });

  return result.data as Event;
}

export async function approveEvent(id: string, moderatorId: string): Promise<Event> {
  const existing = await getEvent(id);
  if (!existing) {
    throw notFoundError('event', id);
  }

  // Allow idempotent retry if already approved
  let approved: Event;
  if (existing.status === 'approved') {
    approved = existing;
  } else if (existing.status !== 'submitted') {
    throw createFailedError('event', `Event ${id} is not submitted (status: ${existing.status})`);
  } else {
    const result = await EventEntity.update({ id })
      .set({
        status: 'approved',
        moderatorId,
        processedAt: new Date().toISOString(),
      })
      .go({ response: 'all_new' });
    approved = result.data as Event;
  }

  // Create EventArtist junction records now that event is approved
  if (approved.artists?.length) {
    await createEventArtistJunctions(id, approved.title, approved.startDateTime, approved.artists);
  }

  // Auto-approve festival if linked
  if (approved.festivalId) {
    const { approveFestival } = await import('../festival');
    await approveFestival(approved.festivalId, moderatorId).catch(() => {});
  }

  return approved;
}

export async function rejectEvent(
  id: string,
  moderatorId: string,
  moderatorNote: string
): Promise<Event> {
  const existing = await getEvent(id);
  if (!existing) {
    throw notFoundError('event', id);
  }
  if (existing.status !== 'submitted') {
    throw createFailedError('event', `Event ${id} is not submitted`);
  }

  const result = await EventEntity.update({ id })
    .set({
      status: 'rejected',
      moderatorId,
      moderatorNote,
      processedAt: new Date().toISOString(),
    })
    .go({ response: 'all_new' });

  return result.data as Event;
}

export async function listSubmittedEvents(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{ items: Event[]; nextToken?: string; hasMore: boolean }> {
  const limit = params?.limit || 20;
  const result = await EventEntity.query
    .byStatus({ status: 'submitted' })
    .go({ limit, cursor: params?.nextToken });

  return {
    items: (result.data || []) as Event[],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function getEvent(id: string): Promise<Event | null> {
  const result = await EventEntity.get({ id }).go();

  if (!result.data) {
    return null;
  }

  return result.data as Event;
}

export async function updateEvent(id: string, input: UpdateEventInput): Promise<Event> {
  const result = await EventEntity.update({ id })
    .set(stripNulls(input as Record<string, unknown>))
    .go();

  if (!result.data) {
    throw notFoundError('event', id);
  }

  return result.data as Event;
}

export async function deleteEvent(id: string): Promise<void> {
  await EventEntity.delete({ id }).go();
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

export async function listEventsByArtForm(
  artForm: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{ items: Event[]; nextToken?: string; hasMore: boolean }> {
  const limit = params?.limit || 20;
  const result = await EventEntity.query
    .byArtForm({ artForm })
    .gt({ startDateTime: new Date().toISOString() })
    .go({ limit, cursor: params?.nextToken });

  return {
    items: (result.data || []) as Event[],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function listEventsByArtist(
  artistId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: Array<{
    eventId: string;
    artistId: string;
    eventTitle: string;
    eventStartDateTime: string;
    artistName: string;
    artistTitle?: string;
    role?: string;
  }>;
  nextToken?: string;
  hasMore: boolean;
}> {
  const result = await EventArtistEntity.query
    .byArtist({ artistId })
    .go({ limit: params?.limit || 20, cursor: params?.nextToken });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function extractAndCreateDrafts(
  posterUploadId: string,
  posterUrl: string,
  userId: string,
  posterHash?: string
): Promise<{ extraction: ExtractionResult; festivalId?: string; eventIds: string[] }> {
  const extraction = await extractFromPoster(posterUrl);

  const eventIds: string[] = [];
  let festivalId: string | undefined;

  // Create festival if detected
  if (extraction.isFestival && extraction.festival) {
    const festival = await createFestival(
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
  for (let i = 0; i < extraction.events.length; i++) {
    const eventData = extraction.events[i];
    const id = generateId();
    const artForm = deriveArtForm(eventData.tags);

    await EventEntity.create({
      id,
      festivalId,
      festivalName: extraction.festival?.name,
      posterUrl,
      posterUploadId,
      title: eventData.title,
      description: eventData.description ?? undefined,
      startDateTime: eventData.startDateTime,
      endDateTime: eventData.endDateTime ?? undefined,
      venueName: eventData.venue?.name,
      organiserName: eventData.organiser?.name || extraction.festival?.organiser?.name,
      artists: eventData.artists.map(a => ({
        name: a.name,
        title: a.title ?? undefined,
        role: a.role ?? undefined,
      })),
      artForm,
      tags: eventData.tags,
      entryType: eventData.entryType ?? undefined,
      ticketing: eventData.ticketing ?? undefined,
      contactInfo: eventData.contactInfo ?? undefined,
      sponsors: eventData.sponsors ?? undefined,
      status: 'draft',
      extractionConfidence: extraction.confidence,
      extractionRawResponse: JSON.stringify(extraction),
      extractionTimestamp: new Date().toISOString(),
      createdBy: userId,
    }).go();
    eventIds.push(id);
  }

  if (posterHash) {
    await savePosterHash({
      hash: posterHash,
      posterUploadId,
      posterUrl,
      festivalId,
      eventIds,
      createdBy: userId,
    });
  }

  return { extraction, festivalId, eventIds };
}

export async function listApprovedEvents(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{ items: Event[]; nextToken?: string; hasMore: boolean }> {
  const limit = params?.limit || 100;
  const result = await EventEntity.query
    .byStatus({ status: 'approved' })
    .go({ limit, cursor: params?.nextToken });

  return {
    items: (result.data || []) as Event[],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function listApprovedEventsByMonth(yearMonth: string): Promise<Event[]> {
  const all: Event[] = [];
  let cursor: string | undefined;
  do {
    const result = await EventEntity.query
      .byStatus({ status: 'approved' })
      .begins({ startDateTime: yearMonth })
      .go({ limit: 100, cursor });
    all.push(...((result.data || []) as Event[]));
    cursor = result.cursor || undefined;
  } while (cursor);
  return all;
}

export { extractFromPoster } from './gemini';
export { getPosterByHash } from './poster-hash';
export { getUploadUrl } from './s3';
export type { Event } from './entity';
export type { ExtractionResult } from './extraction';
export { CreateEventSchema, UpdateEventSchema } from './schema';
