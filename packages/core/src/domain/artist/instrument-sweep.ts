/**
 * The corpus-wide fill of `artist.instrument` from stage credits.
 *
 * Lives in core rather than in `packages/scripts` for the reason `rebuildArtistDenormCron`
 * gives: a scheduled run and a manual run must not be able to differ. The script prints the
 * result; this decides it. The rules it applies are the pure functions in `enrich.ts`, shared
 * with `cascadeEventRolesToArtists` so the sweep and the approval hook cannot drift.
 *
 * **An empty field is filled; a filled one is never touched.** That is the same rule the venue
 * and organiser fill states, and for the same reason: what is stored was put there by a person,
 * and a derivation is weaker evidence. It also makes the sweep idempotent, so it is safe to
 * schedule and a second run writes nothing.
 *
 * The consequence worth knowing is the mirror of the one `tags` has over there — an artist
 * filled as `mridangam` will not gain `vocal` after they start singing, because the field is no
 * longer empty. Widening that would mean re-adding an instrument a moderator deliberately
 * removed, every week, with no way to tell that case from "never had it". The sweep exists
 * mainly for records that are *new*: `findOrCreateArtist` makes an artist holding nothing but a
 * name every time an event names an unknown one, which is what left 503 of 1,159 bare.
 *
 * Two full scans — the `EventArtist` junction and the `Event` table — plus one over the artist
 * list, all of which the daily denorm sweeps already do separately. It is kept apart from them
 * anyway, because those three rebuild a cache from scratch and this one writes into a field a
 * person may edit. Conflating a recompute with a one-way fill is how a fill starts overwriting.
 */

import { EventArtistEntity } from '../event-artist/entity';
import { EventEntity } from '../event/entity';
import { instrumentFromRoles } from './enrich';
import { ArtistEntity } from './entity';

const WRITE_CHUNK = 25;

interface JunctionRow {
  eventId: string;
  artistId: string;
  artistName: string;
  role?: string;
  eventStartDateTime: string;
}

export interface InstrumentFill {
  id: string;
  name: string;
  instrument: string;
  /** Appearances that contributed, so a dry run says what the value was read off. */
  appearances: number;
}

export interface InstrumentSweepResult {
  fills: InstrumentFill[];
  scanned: { artists: number; junctionRows: number; events: number };
  /** Artists already holding an instrument, left exactly as they are. */
  keptExisting: number;
  /** Artists with credits that name no instrument — `performer`, `chief-guest`, and the like. */
  noInstrumentInRoles: number;
  /** Artists with no live appearance at all. Only research can fill these. */
  noAppearances: number;
  written: number;
  failures: Array<{ name: string; error: string }>;
}

/**
 * Groups every live credit by artist, oldest first.
 *
 * Credits on events soft-deleted via `softDeleteEvent` are dropped: that call leaves the
 * junction rows in place, so a naive pass would read an instrument off a concert that no
 * longer exists. The same exclusion `collaborators-sweep` makes, for the same reason.
 *
 * Order matters because `instrumentFromRoles` breaks a tie on first appearance: without a sort
 * the result would depend on the order DynamoDB happened to return the scan in, and a re-run
 * could rewrite `"vocal, ghatam"` as `"ghatam, vocal"` for no reason.
 */
export function creditsByArtist(
  rows: JunctionRow[],
  deletedEventIds: Set<string>
): Map<string, string[]> {
  const byArtist = new Map<string, JunctionRow[]>();
  for (const row of rows) {
    if (deletedEventIds.has(row.eventId)) continue;
    const credits = byArtist.get(row.artistId) ?? [];
    credits.push(row);
    byArtist.set(row.artistId, credits);
  }

  const result = new Map<string, string[]>();
  for (const [artistId, credits] of byArtist) {
    result.set(
      artistId,
      credits
        .sort((a, b) => a.eventStartDateTime.localeCompare(b.eventStartDateTime))
        .map(credit => credit.role ?? '')
    );
  }
  return result;
}

interface ScannedArtist {
  id: string;
  name: string;
  instrument?: string;
  deletedAt?: string;
  mergedIntoId?: string;
}

async function fetchArtists(): Promise<ScannedArtist[]> {
  const result = await ArtistEntity.query
    .list({})
    .go({ pages: 'all', attributes: ['id', 'name', 'instrument', 'deletedAt', 'mergedIntoId'] });
  // A merged-away or deleted record is not worth filling — the record it points at is.
  return (result.data as ScannedArtist[]).filter(a => !a.deletedAt && !a.mergedIntoId);
}

async function writeFills(
  fills: InstrumentFill[]
): Promise<{ written: number; failures: Array<{ name: string; error: string }> }> {
  const failures: Array<{ name: string; error: string }> = [];
  let written = 0;

  // Thunks, not promises, for the reason `collaborators-sweep` gives: `.map(() => go(...))`
  // fires every write the moment map runs, so the chunking would throttle nothing.
  const updates = fills.map(fill => async () => {
    try {
      // `patch` rather than `update`: it carries an existence condition, so an artist deleted
      // between the read and the write fails loudly instead of being recreated as a phantom.
      await ArtistEntity.patch({ id: fill.id }).set({ instrument: fill.instrument }).go();
      written += 1;
    } catch (error) {
      failures.push({ name: fill.name, error: (error as Error).message });
    }
  });

  for (let i = 0; i < updates.length; i += WRITE_CHUNK) {
    await Promise.all(updates.slice(i, i + WRITE_CHUNK).map(run => run()));
  }
  return { written, failures };
}

/**
 * Fills `instrument` on every artist that has none and whose stage credits state one.
 *
 * Dry by default: it computes the fills and writes nothing unless `apply` is set, so the CLI
 * can print what a run would do. A failure on one record is collected rather than thrown, so a
 * single bad row cannot hide the hundreds that landed.
 */
export async function fillArtistInstruments(
  opts: { apply?: boolean } = {}
): Promise<InstrumentSweepResult> {
  const [junction, events, artists] = await Promise.all([
    EventArtistEntity.scan.go({ pages: 'all' }),
    EventEntity.scan.go({ pages: 'all' }),
    fetchArtists(),
  ]);

  const deletedEventIds = new Set<string>();
  for (const row of events.data as Array<{ id: string; deletedAt?: string }>) {
    if (row.deletedAt) deletedEventIds.add(row.id);
  }

  const credits = creditsByArtist(junction.data as JunctionRow[], deletedEventIds);

  const fills: InstrumentFill[] = [];
  let keptExisting = 0;
  let noInstrumentInRoles = 0;
  let noAppearances = 0;

  for (const artist of artists) {
    if (artist.instrument?.trim()) {
      keptExisting += 1;
      continue;
    }
    const roles = credits.get(artist.id);
    if (!roles) {
      noAppearances += 1;
      continue;
    }
    const instrument = instrumentFromRoles(roles);
    if (!instrument) {
      noInstrumentInRoles += 1;
      continue;
    }
    fills.push({ id: artist.id, name: artist.name, instrument, appearances: roles.length });
  }

  const { written, failures } = opts.apply
    ? await writeFills(fills)
    : { written: 0, failures: [] as Array<{ name: string; error: string }> };

  return {
    fills,
    scanned: {
      artists: artists.length,
      junctionRows: junction.data.length,
      events: events.data.length,
    },
    keptExisting,
    noInstrumentInRoles,
    noAppearances,
    written,
    failures,
  };
}
