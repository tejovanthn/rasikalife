import type { z } from 'zod';
import { generateId } from '../../utils';
import { cascadeEventMerge, cascadeEventMetadataToArtists } from '../cascade';
import { deleteEventArtist } from '../event-artist';
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
    .where((attr, op) => op.notExists(attr.deletedAt))
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

  if (result.data.deletedAt && !result.data.mergedIntoId) {
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

export async function updateApprovedEvent(id: string, input: UpdateEventInput): Promise<Event> {
  const current = await getEvent(id);
  if (!current) {
    throw notFoundError('event', id);
  }

  await updateEvent(id, input);

  const newTitle = input.title ?? current.title;
  const newStartDateTime = input.startDateTime ?? current.startDateTime;

  if (
    (input.title && input.title !== current.title) ||
    (input.startDateTime && input.startDateTime !== current.startDateTime)
  ) {
    await cascadeEventMetadataToArtists(id, newTitle, newStartDateTime);
  }

  if (input.artists !== undefined) {
    const existingResult = await EventArtistEntity.query.primary({ eventId: id }).go();
    const existingArtists = (
      existingResult.data as Array<{ eventId: string; artistId: string }>
    ).filter(a => a.artistId);

    const newArtistIds = new Set((input.artists || []).filter(a => a.id).map(a => a.id as string));
    const existingArtistIds = new Set(existingArtists.map(a => a.artistId));

    const toRemove = existingArtists.filter(a => !newArtistIds.has(a.artistId));
    const toAdd = (input.artists || []).filter(a => a.id && !existingArtistIds.has(a.id as string));

    await Promise.all(toRemove.map(a => deleteEventArtist(id, a.artistId)));

    if (toAdd.length > 0) {
      await createEventArtistJunctions(id, newTitle, newStartDateTime, toAdd);
    }
  }

  return (await getEvent(id)) as Event;
}

export async function deleteEvent(id: string): Promise<void> {
  await EventEntity.delete({ id }).go();
}

export async function softDeleteEvent(id: string): Promise<void> {
  await EventEntity.update({ id }).set({ deletedAt: new Date().toISOString() }).go();
}

export async function listUpcomingEvents(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{ items: Event[]; nextToken?: string; hasMore: boolean }> {
  const limit = params?.limit || 20;
  const result = await EventEntity.query
    .byStatus({ status: 'approved' })
    .gt({ startDateTime: new Date().toISOString() })
    .where((attr, op) => op.notExists(attr.deletedAt))
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
    .where((attr, op) => op.notExists(attr.deletedAt))
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
    .where((attr, op) => op.notExists(attr.deletedAt))
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
    .where((attr, op) => op.notExists(attr.deletedAt))
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
    .where((attr, op) => op.notExists(attr.deletedAt))
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
    .where((attr, op) => op.notExists(attr.deletedAt))
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
      .where((attr, op) => op.notExists(attr.deletedAt))
      .go({ limit: 100, cursor });
    all.push(...((result.data || []) as Event[]));
    cursor = result.cursor || undefined;
  } while (cursor);
  return all;
}

export async function mergeEvent(loserId: string, canonicalId: string): Promise<void> {
  const canonical = await getEvent(canonicalId);
  if (!canonical) throw notFoundError('event', canonicalId);
  const loser = await EventEntity.get({ id: loserId }).go();
  if (!loser.data) throw notFoundError('event', loserId);

  await cascadeEventMerge(loserId, canonicalId);
  await EventEntity.update({ id: loserId })
    .set({ deletedAt: new Date().toISOString(), mergedIntoId: canonicalId })
    .go();
}

export async function getEventMergeScore(id: string): Promise<number> {
  const artistResult = await EventArtistEntity.query
    .primary({ eventId: id })
    .go({ attributes: ['artistId'] as never[] });

  const result = await EventEntity.get({ id }).go();
  let score = (artistResult.data || []).length;
  if (result.data) {
    if (result.data.description) score += 1;
    if (result.data.venueId) score += 1;
    if (result.data.organiserId) score += 1;
    if (result.data.endDateTime) score += 1;
  }
  return score;
}

export { extractFromPoster } from './gemini';
export { getPosterByHash } from './poster-hash';
export { getUploadUrl } from './s3';
export type { Event } from './entity';
export type { ExtractionResult } from './extraction';
export { CreateEventSchema, UpdateEventSchema } from './schema';
