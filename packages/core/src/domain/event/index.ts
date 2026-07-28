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

import { COLLABORATOR_INLINE_CAP } from '../artist/client';
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

/**
 * Refresh each performer's collaborator list after a cast change.
 *
 * Rebuilding beats incrementing here: the same call then serves approval,
 * un-approval and repair, and a re-approval cannot double-count.
 *
 * Skipped above `COLLABORATOR_INLINE_CAP` performers because the work is
 * quadratic in cast size — a 40-artist festival is 1,560 pairs, which has no
 * business running inside a moderator's approval request. Those events are
 * picked up by `pnpm cli rebuild-collaborators`, which reads the junction
 * regardless of cast size. Approval must not fail over this, so a rebuild
 * error is logged rather than thrown: a stale collaborator list is a smaller
 * problem than an event that cannot be approved.
 */
async function recomputeCollaboratorsForCast(
  artists: Array<{ id?: string | null }>
): Promise<void> {
  // Deduplicate the way createEventArtistJunctions does — the same artist can
  // appear twice with different roles, and counting them twice would both trip
  // the cap early and race two rebuilds on one row.
  const artistIds = [...new Set(artists.map(a => a.id).filter((id): id is string => !!id))];
  if (artistIds.length > COLLABORATOR_INLINE_CAP) {
    console.warn(
      `Skipping inline collaborator recompute for ${artistIds.length} artists ` +
        `(cap ${COLLABORATOR_INLINE_CAP}); run: pnpm cli rebuild-collaborators`
    );
    return;
  }

  const { rebuildArtistCollaborators } = await import('../artist/collaborators');
  const results = await Promise.allSettled(artistIds.map(rebuildArtistCollaborators));
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Failed to rebuild collaborators for artist ${artistIds[i]}:`, result.reason);
    }
  });
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
    await recomputeCollaboratorsForCast(approved.artists);
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

export async function listDraftEvents(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{ items: Event[]; nextToken?: string; hasMore: boolean }> {
  const limit = params?.limit || 20;
  const result = await EventEntity.query
    .byStatus({ status: 'draft' })
    .where((attr, op) => op.notExists(attr.deletedAt))
    .where((attr, op) => op.exists(attr.posterUrl))
    .go({ limit, cursor: params?.nextToken });

  return {
    items: (result.data || []) as Event[],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function forceSubmitEvent(id: string): Promise<Event> {
  const existing = await getEvent(id);
  if (!existing) throw notFoundError('event', id);
  if (existing.status !== 'draft') {
    throw createFailedError('event', `Event ${id} is not a draft`);
  }

  const result = await EventEntity.update({ id })
    .set({ status: 'submitted', submittedAt: new Date().toISOString() })
    .go({ response: 'all_new' });

  return result.data as Event;
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

    // Both sides need recomputing, and the removed artists especially: nothing
    // else will ever revisit them, so without this the rest of the cast names a
    // performer who is no longer on the bill, permanently.
    await recomputeCollaboratorsForCast([
      ...toRemove.map(a => ({ id: a.artistId })),
      ...(input.artists || []),
    ]);
  }

  return (await getEvent(id)) as Event;
}

export async function deleteEvent(id: string): Promise<void> {
  await EventEntity.delete({ id }).go();
}

export async function softDeleteEvent(id: string): Promise<void> {
  const existing = await getEvent(id);
  await EventEntity.update({ id }).set({ deletedAt: new Date().toISOString() }).go();
  // The cast loses a shared event. rebuildArtistCollaborators reads deletedAt, so
  // this has to run after the update or it recounts the event being deleted.
  if (existing?.artists?.length) {
    await recomputeCollaboratorsForCast(existing.artists);
  }
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

export async function listPastEvents(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{ items: Event[]; nextToken?: string; hasMore: boolean }> {
  const limit = params?.limit || 20;
  const result = await EventEntity.query
    .byStatus({ status: 'approved' })
    .lt({ startDateTime: new Date().toISOString() })
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({ order: 'desc', limit, cursor: params?.nextToken });

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

// NOTE: tag filtering is done in-memory after fetching up to `limit` approved future events.
// If there are more approved future events than `limit`, results will be silently incomplete.
// The correct fix is a tag-keyed GSI (e.g. PK=TAG#${tag}, SK=startDateTime), which requires
// an infrastructure change.
export async function listEventsByTag(
  tag: string,
  params?: { limit?: number }
): Promise<{ items: Event[] }> {
  const limit = params?.limit || 100;
  const result = await EventEntity.query
    .byStatus({ status: 'approved' })
    .gt({ startDateTime: new Date().toISOString() })
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({ limit });

  return {
    items: (result.data || []).filter(e => e.tags?.includes(tag)) as Event[],
  };
}

/**
 * The `byArtist` GSI sorts ascending by event date, so an unqualified query hands back an
 * artist's *earliest* concerts — for anyone with a history that means rows from years ago
 * and never the date they are about to play. `when` splits the partition at now:
 * `upcoming` reads forward (next concert first), `past` reads backward (most recent first).
 * Omitting it keeps the whole run ascending, which is what the wizard's performances
 * section wants: every row an artist has, in one order, featured or not.
 *
 * The boundary matches `listUpcomingEvents`/`listPastEvents` — strictly after and strictly
 * before `now` — so a date cannot sit in one bucket here and the other on /events.
 */
export async function listEventsByArtist(
  artistId: string,
  params?: { limit?: number; nextToken?: string; when?: 'upcoming' | 'past' }
): Promise<{
  items: Array<{
    eventId: string;
    artistId: string;
    eventTitle: string;
    eventStartDateTime: string;
    artistName: string;
    artistTitle?: string;
    role?: string;
    // The query returns full junction rows, so these carry through — the
    // moderator wizard's performances section toggles them.
    isFeatured?: boolean;
    featureRank?: number;
  }>;
  nextToken?: string;
  hasMore: boolean;
}> {
  const query = EventArtistEntity.query.byArtist({ artistId });
  const now = new Date().toISOString();
  const options = { limit: params?.limit || 20, cursor: params?.nextToken };

  const result = await (params?.when === 'upcoming'
    ? query.gt({ eventStartDateTime: now }).go(options)
    : params?.when === 'past'
      ? query.lt({ eventStartDateTime: now }).go({ ...options, order: 'desc' })
      : query.go(options));

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
  posterHash?: string,
  existingFestivalId?: string,
  sourceAttribution?: { platform: string; postId?: string; postUrl?: string },
  hint?: string,
  posterOgUrl?: string
): Promise<{ extraction: ExtractionResult; festivalId?: string; eventIds: string[] }> {
  const extraction = await extractFromPoster(posterUrl, hint);

  const eventIds: string[] = [];
  let festivalId: string | undefined = existingFestivalId;

  // Create festival if detected (skip if linking to an existing festival)
  if (!existingFestivalId && extraction.isFestival && extraction.festival) {
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

  // Create draft events in parallel — they are independent of each other
  const ids = extraction.events.map(() => generateId());
  await Promise.all(
    extraction.events.map((eventData, i) => {
      const artForm = deriveArtForm(eventData.tags);
      return EventEntity.create({
        id: ids[i],
        festivalId,
        festivalName: extraction.festival?.name,
        posterUrl,
        posterOgUrl,
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
        sourcePlatform: sourceAttribution?.platform,
        sourcePostId: sourceAttribution?.postId,
        sourcePostUrl: sourceAttribution?.postUrl,
      }).go();
    })
  );
  eventIds.push(...ids);

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
  const [artistResult, result] = await Promise.all([
    EventArtistEntity.query.primary({ eventId: id }).go({ attributes: ['artistId'] as never[] }),
    EventEntity.get({ id }).go(),
  ]);
  let score = (artistResult.data || []).length;
  if (result.data) {
    if (result.data.description) score += 1;
    if (result.data.venueId) score += 1;
    if (result.data.organiserId) score += 1;
    if (result.data.endDateTime) score += 1;
  }
  return score;
}

export { extractFromPoster, extractFromSocialPost } from './gemini';
export type { SocialPostInput } from './gemini';
export { getPosterByHash } from './poster-hash';
export { getUploadUrl, uploadPosterFromBuffer } from './s3';
export type { Event } from './entity';
export type { ExtractionResult } from './extraction';
export { CreateEventSchema, UpdateEventSchema } from './schema';
