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

  // A throttled batch read returns keys under `unprocessed`. Those ids would
  // otherwise look exactly like deleted events, silently shrinking the artist's
  // collaborator list — and the caller would then write that wrong answer.
  // Failing loudly is better; the rebuild is always retryable.
  if (result.unprocessed?.length) {
    throw new Error(
      `Could not read ${result.unprocessed.length} of ${eventIds.length} events (DynamoDB returned unprocessed keys); refusing to compute a partial collaborator list`
    );
  }

  for (const event of result.data) {
    if (!event.deletedAt) live.add(event.id);
  }
  return live;
}

interface CoArtistAccumulator {
  name: string;
  sharedEventCount: number;
  lastSharedAt: string;
  roles: Map<string, number>;
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

  const casts = await Promise.all(events.map(event => fetchAllArtistsForEvent(event.eventId)));
  const now = new Date();
  const collaborators = collaboratorsFrom(artistId, casts.flat(), now);

  // Not capped here: storage is cheap and the display layer slices to
  // COLLABORATOR_INLINE_CAP. A very prolific artist (decades of concerts,
  // hundreds of distinct co-artists) can grow this list large; the eventual
  // bound is the DynamoDB 400KB item ceiling, not an application limit.
  await ArtistEntity.update({ id: artistId })
    .set({ collaborators, collaboratorsComputedAt: now.toISOString() })
    .go();
}

/**
 * Aggregate one artist's collaborators from the junction rows of the events they
 * played. Pure, so the per-artist rebuild and the bulk backfill share one
 * definition — they previously each had their own and disagreed on both the
 * ordering of `topRoles` and which duplicate `name` won, which meant the
 * "repair" tool wrote something different from the live path.
 *
 * `rows` must already exclude soft-deleted events; the callers own that filter
 * because they discover deletions differently.
 */
export function collaboratorsFrom(
  artistId: string,
  rows: Array<{ artistId: string; artistName: string; role?: string; eventStartDateTime: string }>,
  now: Date = new Date()
): Collaborator[] {
  const byCoArtist = new Map<string, CoArtistAccumulator>();

  for (const member of rows) {
    if (member.artistId === artistId) continue;

    // The co-artist's own role gives context on the pairing, not this
    // artist's — a mridangam player's collaborator list should say
    // "vocal", not "mridangam", against each vocalist they've backed.
    const role = member.role ? canonicalRole(member.role) : undefined;
    const existing = byCoArtist.get(member.artistId);
    if (existing) {
      existing.sharedEventCount += 1;
      // Keep the most recent name spelling rather than the first: a rename
      // cascade may not have reached every junction row.
      existing.name = member.artistName;
      if (member.eventStartDateTime > existing.lastSharedAt) {
        existing.lastSharedAt = member.eventStartDateTime;
      }
      if (role) existing.roles.set(role, (existing.roles.get(role) ?? 0) + 1);
    } else {
      byCoArtist.set(member.artistId, {
        name: member.artistName,
        sharedEventCount: 1,
        lastSharedAt: member.eventStartDateTime,
        roles: new Map(role ? [[role, 1]] : []),
      });
    }
  }

  return Array.from(byCoArtist.entries())
    .map(([coArtistId, acc]) => ({
      artistId: coArtistId,
      name: acc.name,
      sharedEventCount: acc.sharedEventCount,
      lastSharedAt: acc.lastSharedAt,
      // Most frequent first, capped — a co-artist seen mostly on vocal and once
      // on tambura should read as a vocalist.
      topRoles: acc.roles.size > 0 ? topRolesFrom(acc.roles) : undefined,
      strength: collaboratorStrength(acc.sharedEventCount, acc.lastSharedAt, now),
    }))
    .sort((a, b) => b.strength - a.strength);
}

const MAX_TOP_ROLES = 3;

function topRolesFrom(roles: Map<string, number>): string[] {
  return Array.from(roles.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOP_ROLES)
    .map(([role]) => role);
}

/**
 * How many other artists a merge will repair inline. Each is a full history
 * walk, so an uncapped fan-out on two busy performers can throttle the table
 * from inside a moderator request.
 */
export const COLLABORATOR_MERGE_FANOUT_CAP = 25;
