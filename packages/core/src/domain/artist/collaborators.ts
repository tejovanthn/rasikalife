import { canonicalRole } from '../../shared/roles';
import { getEventArtists, getEventsByArtist } from '../event-artist';
import type { EventArtist } from '../event-artist';
import { EventEntity } from '../event/entity';
import { ArtistEntity } from './entity';

/**
 * How many entries the artist-profile collaborator widget shows inline.
 * `approveEvent` reads this too (see the report), so the display cap and
 * this module agree on one number instead of two copies drifting apart.
 * The stored list itself is never truncated to this — see the comment at
 * the bottom of `rebuildArtistCollaborators`.
 */
export const COLLABORATOR_INLINE_CAP = 12;

// Average month length in ms (365.2425 days / 12), used only to turn a
// timestamp gap into a "months since" figure for the recency boost below.
const MS_PER_MONTH = (1000 * 60 * 60 * 24 * 365.2425) / 12;

export interface CollaboratorSummary {
  artistId: string;
  name: string;
  sharedEventCount: number;
  lastSharedAt: string;
  topRoles?: string[];
  strength: number;
}

/**
 * `strength = sharedEventCount * (1 + 1 / (1 + monthsSinceLastShared))`, so a
 * pair with many recent shared events outranks the same count from years
 * ago. `monthsSinceLastShared` is clamped to >= 0 — a `lastSharedAt` in the
 * future cannot boost past the same-month case — and, when `lastSharedAt`
 * can't be parsed, treated as unbounded, which collapses the boost to 1 (no
 * recency information beats none).
 */
export function collaboratorStrength(
  sharedEventCount: number,
  lastSharedAt: string,
  now: Date = new Date()
): number {
  const lastSharedMs = new Date(lastSharedAt).getTime();
  const monthsSinceLastShared = Number.isNaN(lastSharedMs)
    ? Number.POSITIVE_INFINITY
    : Math.max(0, (now.getTime() - lastSharedMs) / MS_PER_MONTH);
  const recencyBoost = 1 + 1 / (1 + monthsSinceLastShared);
  return sharedEventCount * recencyBoost;
}

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
  const collaborators: CollaboratorSummary[] = Array.from(byCoArtist.entries())
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
