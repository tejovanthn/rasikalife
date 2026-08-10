/**
 * The disambiguating facts a research packet carries about an artist.
 *
 * This is the piece that has no counterpart in the raga pipeline, and it is what makes an
 * artist run safe enough to delegate at all. A raga's **name is its subject**: a worker handed
 * `kalyANi` and a parent list can only be researching Kalyani. A person's name is not — this
 * corpus holds a `Hariharan` credited as an instructor across eight events, and a worker given
 * that string alone comes back with the playback singer's biography, correctly sourced and
 * about the wrong man. The same trap sits under `Shashank`, `Team`, `Group` and every common
 * South Indian surname in the list.
 *
 * So the packet states what the database already knows about *this* record — what they played,
 * where, for whom, alongside whom, and when. A worker can then confirm or refuse the identity
 * before spending a lookup, and say so in `notes` when the person they found does not match.
 *
 * Everything here is already denormalized onto the rows (`venueName`, `organiserName`,
 * `artForm` on the Event; `role` and `artistName` on the junction), so this is two scans and no
 * fan-out.
 */

import { EventArtistEntity } from '../event-artist/entity';
import { EventEntity } from '../event/entity';

/** Kept small deliberately: a packet holds 25 of these and a worker reads them all. */
const MAX_VENUES = 5;
const MAX_ORGANISERS = 4;
const MAX_COLLABORATORS = 8;

export interface ArtistResearchContext {
  /** Live appearances on record. The ordering signal, and the first thing a worker checks. */
  appearances: number;
  /** Every distinct credited role, verbatim — including the ones `enrich.ts` refuses. */
  roles: string[];
  venues: string[];
  organisers: string[];
  artForms: string[];
  /** `YYYY-MM-DD`, so a worker can tell a fifty-year career from a debut last spring. */
  firstSeen?: string;
  lastSeen?: string;
  /** Who they share a stage with — usually the strongest identity signal of the lot. */
  performsWith: string[];
}

interface JunctionRow {
  eventId: string;
  artistId: string;
  artistName: string;
  role?: string;
  eventStartDateTime: string;
}

interface EventRow {
  id: string;
  deletedAt?: string;
  venueName?: string;
  organiserName?: string;
  artForm?: string;
}

/** Distinct, insertion-ordered, capped, blanks dropped. */
function top(values: Array<string | undefined>, cap: number): string[] {
  const seen: string[] = [];
  for (const raw of values) {
    const value = raw?.trim();
    if (!value || seen.includes(value)) continue;
    seen.push(value);
    if (seen.length === cap) break;
  }
  return seen;
}

/**
 * Builds the context map from rows already in memory. Pure, so it is unit-tested without an
 * environment — the same split `buildCollaboratorLists` uses.
 */
export function buildArtistContext(
  junction: JunctionRow[],
  events: EventRow[]
): Map<string, ArtistResearchContext> {
  const byEvent = new Map(events.filter(event => !event.deletedAt).map(event => [event.id, event]));

  // Cast per event, so co-performers cost no extra pass.
  const castByEvent = new Map<string, JunctionRow[]>();
  const rowsByArtist = new Map<string, JunctionRow[]>();
  for (const row of junction) {
    if (!byEvent.has(row.eventId)) continue;
    const cast = castByEvent.get(row.eventId) ?? [];
    cast.push(row);
    castByEvent.set(row.eventId, cast);

    const mine = rowsByArtist.get(row.artistId) ?? [];
    mine.push(row);
    rowsByArtist.set(row.artistId, mine);
  }

  const result = new Map<string, ArtistResearchContext>();
  for (const [artistId, rows] of rowsByArtist) {
    const ordered = [...rows].sort((a, b) =>
      a.eventStartDateTime.localeCompare(b.eventStartDateTime)
    );
    const eventsOf = ordered.map(row => byEvent.get(row.eventId) as EventRow);

    const others: string[] = [];
    for (const row of ordered) {
      for (const mate of castByEvent.get(row.eventId) ?? []) {
        if (mate.artistId !== artistId) others.push(mate.artistName);
      }
    }

    result.set(artistId, {
      appearances: ordered.length,
      roles: top(
        ordered.map(row => row.role),
        12
      ),
      venues: top(
        eventsOf.map(event => event.venueName),
        MAX_VENUES
      ),
      organisers: top(
        eventsOf.map(event => event.organiserName),
        MAX_ORGANISERS
      ),
      artForms: top(
        eventsOf.map(event => event.artForm),
        4
      ),
      firstSeen: ordered[0]?.eventStartDateTime.slice(0, 10),
      lastSeen: ordered[ordered.length - 1]?.eventStartDateTime.slice(0, 10),
      performsWith: top(others, MAX_COLLABORATORS),
    });
  }
  return result;
}

/** Reads the junction and the events, and builds the map. Two scans, no per-artist query. */
export async function artistResearchContext(): Promise<Map<string, ArtistResearchContext>> {
  const [junction, events] = await Promise.all([
    EventArtistEntity.scan.go({ pages: 'all' }),
    EventEntity.scan.go({ pages: 'all' }),
  ]);
  return buildArtistContext(junction.data as JunctionRow[], events.data as EventRow[]);
}
