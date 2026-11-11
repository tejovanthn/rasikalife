import { ApplicationError, ErrorCode } from '../../constants';
import { generateId } from '../../utils';
import { resolveFollowTarget } from '../follow/target';
import { VenueSpaceEntity } from './entity';
import type { VenueSpace } from './entity';
import type { CreateSpaceInput, UpdateSpaceInput } from './schema';

export type { VenueSpace } from './entity';
export {
  CreateSpaceSchema,
  ListSpacesSchema,
  UpdateSpaceSchema,
} from './schema';
export type { CreateSpaceInput, UpdateSpaceInput } from './schema';

export async function getSpace(venueId: string, spaceId: string): Promise<VenueSpace | null> {
  const result = await VenueSpaceEntity.get({ venueId, spaceId }).go();
  return (result.data as VenueSpace | null) ?? null;
}

/** All spaces of a venue, by name. Not paginated: a venue has a handful of halls. */
export async function listSpaces(venueId: string): Promise<VenueSpace[]> {
  const result = await VenueSpaceEntity.query.primary({ venueId }).go({ pages: 'all' });
  const rows = (result.data as VenueSpace[]) ?? [];
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createSpace(input: CreateSpaceInput): Promise<VenueSpace> {
  const venue = await resolveFollowTarget('venue', input.venueId);
  if (!venue || venue.id !== input.venueId) {
    throw new ApplicationError(ErrorCode.VENUE_NOT_FOUND, `Venue ${input.venueId} not found`);
  }
  const result = await VenueSpaceEntity.create({
    venueId: input.venueId,
    spaceId: generateId(),
    name: input.name,
    capacity: input.capacity,
    notes: input.notes,
  }).go();
  return result.data as VenueSpace;
}

/**
 * Patches only the fields given. There is no way to clear `capacity` or `notes` here: the
 * input schema treats undefined as "leave alone", and v1 has no need to blank them.
 */
export async function updateSpace(input: UpdateSpaceInput): Promise<VenueSpace> {
  const existing = await getSpace(input.venueId, input.spaceId);
  if (!existing) {
    throw new ApplicationError(ErrorCode.SPACE_NOT_FOUND, `Space ${input.spaceId} not found`);
  }
  const changes: { name?: string; capacity?: number; notes?: string } = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.capacity !== undefined) changes.capacity = input.capacity;
  if (input.notes !== undefined) changes.notes = input.notes;

  if (Object.keys(changes).length === 0) return existing;

  const result = await VenueSpaceEntity.patch({
    venueId: input.venueId,
    spaceId: input.spaceId,
  })
    .set(changes)
    .go({ response: 'all_new' });
  return result.data as VenueSpace;
}

/**
 * Moves every space of `loserId` under `canonicalId`, keeping each `spaceId` so the `spaceId` on
 * events and codes stays valid. Used by the venue merge cascade. A space is created before the
 * old row is deleted, so a crash never loses one. Two halls with the same name stay two spaces.
 */
export async function moveSpaces(loserId: string, canonicalId: string): Promise<number> {
  const spaces = await listSpaces(loserId);
  for (const space of spaces) {
    try {
      await VenueSpaceEntity.create({
        venueId: canonicalId,
        spaceId: space.spaceId,
        name: space.name,
        capacity: space.capacity,
        notes: space.notes,
        createdAt: space.createdAt,
      }).go();
    } catch (error) {
      // A rerun after a crash finds the copy already there.
      const message = (error as { message?: string }).message ?? '';
      if (
        !message.includes('ConditionalCheckFailed') &&
        (error as { code?: number }).code !== 4001
      ) {
        throw error;
      }
    }
    await VenueSpaceEntity.delete({ venueId: loserId, spaceId: space.spaceId }).go();
  }
  return spaces.length;
}
