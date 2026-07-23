import { EventArtistEntity } from './entity';
import type { EventArtist } from './entity';

export interface CreateEventArtistInput {
  eventId: string;
  artistId: string;
  eventTitle: string;
  eventStartDateTime: string;
  artistName: string;
  artistTitle?: string;
  role?: string;
}

export async function createEventArtist(input: CreateEventArtistInput): Promise<EventArtist> {
  const result = await EventArtistEntity.create(input).go();

  if (!result.data) {
    throw new Error(`Failed to create event-artist relationship: ${JSON.stringify(input)}`);
  }

  return result.data as EventArtist;
}

export async function getEventArtists(
  eventId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: EventArtist[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 50;

  const result = await EventArtistEntity.query.primary({ eventId }).go({
    limit,
    cursor: params?.nextToken,
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function getEventsByArtist(
  artistId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: EventArtist[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await EventArtistEntity.query.byArtist({ artistId }).go({
    limit,
    cursor: params?.nextToken,
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

/**
 * Mark (or unmark) this artist's participation in this event as a career
 * highlight, which is what the profile's notable-past teaser selects on.
 *
 * Featuring is per-artist rather than per-event on purpose: a concert can be a
 * milestone for the vocalist and an ordinary night for the accompanist, so the
 * flag belongs to the junction row, not the Event.
 *
 * Clearing `isFeatured` also clears `featureRank`, so an unfeatured row cannot
 * keep a rank that would silently reorder things if it were featured again.
 */
export async function setEventArtistFeatured(
  eventId: string,
  artistId: string,
  featured: boolean,
  featureRank?: number
): Promise<EventArtist> {
  const result = await EventArtistEntity.patch({ eventId, artistId })
    .set({ isFeatured: featured, featureRank: featured ? featureRank : undefined })
    .go({ response: 'all_new' });

  return result.data as EventArtist;
}

/** This artist's featured performances, most prominent first. */
export async function getFeaturedEventsByArtist(
  artistId: string,
  params?: { limit?: number }
): Promise<EventArtist[]> {
  const result = await EventArtistEntity.query
    .byArtist({ artistId })
    .where((attr, op) => op.eq(attr.isFeatured, true))
    .go({ pages: 'all' });

  const items = (result.data || []).sort((a, b) => {
    // Explicit rank wins; unranked features fall back to most recent first.
    const rankA = a.featureRank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.featureRank ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return b.eventStartDateTime.localeCompare(a.eventStartDateTime);
  });

  return params?.limit ? items.slice(0, params.limit) : items;
}

export async function deleteEventArtist(eventId: string, artistId: string): Promise<void> {
  await EventArtistEntity.delete({ eventId, artistId }).go();
}

export type { EventArtist } from './entity';
