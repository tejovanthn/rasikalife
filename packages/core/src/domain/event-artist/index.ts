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
 * Order a featured-performance list the way the profile teaser shows it: explicit rank
 * first, then most-recent. Kept sorted at write time so the reader just slices.
 */
export function sortFeaturedPerformances<
  T extends { featureRank?: number; eventStartDateTime: string },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const rankA = a.featureRank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.featureRank ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return b.eventStartDateTime.localeCompare(a.eventStartDateTime);
  });
}

/**
 * Mark (or unmark) this artist's participation in this event as a career highlight,
 * which is what the profile's notable-past teaser selects on.
 *
 * Featuring is per-artist rather than per-event on purpose: a concert can be a milestone
 * for the vocalist and an ordinary night for the accompanist, so the flag belongs to the
 * junction row, not the Event.
 *
 * Clearing `isFeatured` also clears `featureRank`, so an unfeatured row cannot keep a
 * rank that would silently reorder things if it were featured again.
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

  const row = result.data as EventArtist;

  // Keep the artist's denormalized featured list in step, so the profile teaser reads
  // one field instead of a filtered full-partition scan of the artist's EventArtist rows.
  // Read-modify-write is fine: featuring is a rare moderator action, and a re-feature
  // fixes any race. Stored pre-sorted so the reader only slices.
  const { ArtistEntity } = await import('../artist/entity');
  const artist = await ArtistEntity.get({ id: artistId }).go();
  if (artist.data) {
    const withoutThis = (artist.data.featuredPerformances ?? []).filter(p => p.eventId !== eventId);
    const next = featured
      ? sortFeaturedPerformances([
          ...withoutThis,
          {
            eventId,
            eventTitle: row.eventTitle,
            eventStartDateTime: row.eventStartDateTime,
            role: row.role,
            featureRank,
          },
        ])
      : withoutThis;
    await ArtistEntity.update({ id: artistId }).set({ featuredPerformances: next }).go();
  }

  return row;
}

export async function deleteEventArtist(eventId: string, artistId: string): Promise<void> {
  await EventArtistEntity.delete({ eventId, artistId }).go();
}

export type { EventArtist } from './entity';
