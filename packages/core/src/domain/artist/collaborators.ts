import { canonicalRole } from '../../shared/roles';
import { getEventArtists, getEventsByArtist } from '../event-artist';
import type { EventArtist } from '../event-artist';
import { EventEntity } from '../event/entity';
import { COLLABORATOR_INLINE_CAP, collaboratorStrength } from './client';
import type { Collaborator } from './client';
import { ArtistEntity } from './entity';

async function fetchAllEventsForArtist(artistId: string): Promise<EventArtist[]> {
  const events: EventArtist[] = [];
  let nextToken: string | undefined;
  do {
    const page = await getEventsByArtist(artistId, { nextToken });
    events.push(...page.items);
    nextToken = page.nextToken;
  } while (nextToken);
  return events;
}

async function fetchAllArtistsForEvent(eventId: string): Promise<EventArtist[]> {
  const cast: EventArtist[] = [];
  let nextToken: string | undefined;
  do {
    const page = await getEventArtists(eventId, { nextToken });
    cast.push(...page.items);
    nextToken = page.nextToken;
  } while (nextToken);
  return cast;
}

/**
 * `softDeleteEvent` only marks the Event row; the EventArtist junction rows
 * it leaves behind still answer `getEventsByArtist`. Without this check a
 * rebuild triggered by that same soft-delete would recount the very event
 * that was just removed, making the fixup a silent no-op. Uses ElectroDB's
 * batch `get` (chunks of up to 100 automatically) rather than a get per
 * event or a hand-built key, which is either slower or, if the key string is
 * built by hand, silently wrong (ElectroDB lowercases stored keys).
 */
async function nonDeletedEventIds(eventIds: string[]): Promise<Set<string>> {
  const live = new Set<string>();
  if (eventIds.length === 0) return live;

  const result = await EventEntity.get(eventIds.map(id => ({ id }))).go();
  for (const event of result.data) {
    if (!event.deletedAt) live.add(event.id);
  }
  return live;
}

interface CoArtistAccumulator {
  name: string;
  sharedEventCount: number;
  lastSharedAt: string;
  roles: Set<string>;
}

/**
 * Recompute one artist's `collaborators` list from scratch — never
 * incrementally — and write it back with `collaboratorsComputedAt`. Starting
 * from scratch each time is what lets the same function serve both as the
 * repair path and as the un-approval/soft-delete fixup: there is no prior
 * state to reconcile, only the current truth in the EventArtist junction.
 */
export async function rebuildArtistCollaborators(artistId: string): Promise<void> {
  const artistEvents = await fetchAllEventsForArtist(artistId);
  const live = await nonDeletedEventIds(artistEvents.map(event => event.eventId));
  const events = artistEvents.filter(event => live.has(event.eventId));

  const byCoArtist = new Map<string, CoArtistAccumulator>();

  for (const event of events) {
    const cast = await fetchAllArtistsForEvent(event.eventId);
    for (const member of cast) {
      if (member.artistId === artistId) continue;

      // The co-artist's own role gives context on the pairing, not this
      // artist's — a mridangam player's collaborator list should say
      // "vocal", not "mridangam", against each vocalist they've backed.
      const role = member.role ? canonicalRole(member.role) : undefined;
      const existing = byCoArtist.get(member.artistId);
      if (existing) {
        existing.sharedEventCount += 1;
        if (event.eventStartDateTime > existing.lastSharedAt) {
          existing.lastSharedAt = event.eventStartDateTime;
        }
        if (role) existing.roles.add(role);
      } else {
        byCoArtist.set(member.artistId, {
          name: member.artistName,
          sharedEventCount: 1,
          lastSharedAt: event.eventStartDateTime,
          roles: role ? new Set([role]) : new Set(),
        });
      }
    }
  }

  const now = new Date();
  const collaborators: Collaborator[] = Array.from(byCoArtist.entries())
    .map(([coArtistId, acc]) => ({
      artistId: coArtistId,
      name: acc.name,
      sharedEventCount: acc.sharedEventCount,
      lastSharedAt: acc.lastSharedAt,
      topRoles: acc.roles.size > 0 ? Array.from(acc.roles) : undefined,
      strength: collaboratorStrength(acc.sharedEventCount, acc.lastSharedAt, now),
    }))
    .sort((a, b) => b.strength - a.strength);

  // Not capped here: storage is cheap and the display layer slices to
  // COLLABORATOR_INLINE_CAP. A very prolific artist (decades of concerts,
  // hundreds of distinct co-artists) can grow this list large; the eventual
  // bound is the DynamoDB 400KB item ceiling, not an application limit.
  await ArtistEntity.update({ id: artistId })
    .set({ collaborators, collaboratorsComputedAt: now.toISOString() })
    .go();
}

export { COLLABORATOR_INLINE_CAP, collaboratorStrength } from './client';
export type { Collaborator } from './client';
