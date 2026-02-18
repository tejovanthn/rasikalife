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

export async function deleteEventArtist(eventId: string, artistId: string): Promise<void> {
  await EventArtistEntity.delete({ eventId, artistId }).go();
}

export type { EventArtist } from './entity';
