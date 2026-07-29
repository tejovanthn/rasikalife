import { EventArtistEntity } from '../event-artist/entity';
import { EventEntity } from '../event/entity';
import type { Collaborator } from './client';
import { collaboratorsFrom } from './collaborators';
import { ArtistEntity } from './entity';

const WRITE_CHUNK = 25;

interface JunctionRow {
  eventId: string;
  artistId: string;
  artistName: string;
  role?: string;
  eventStartDateTime: string;
}

async function fetchAllJunctionRows(): Promise<JunctionRow[]> {
  const result = await EventArtistEntity.scan.go({ pages: 'all' });
  return result.data as JunctionRow[];
}

/**
 * Ids of events soft-deleted via `softDeleteEvent`, which sets `deletedAt` on the Event and
 * leaves the EventArtist junction rows in place — so a naive pass over the junction would
 * count concerts that no longer exist.
 */
async function fetchDeletedEventIds(): Promise<Set<string>> {
  const result = await EventEntity.scan.go({ pages: 'all' });
  const ids = new Set<string>();
  for (const row of result.data as Array<{ id: string; deletedAt?: string }>) {
    if (row.deletedAt) ids.add(row.id);
  }
  return ids;
}

function groupByEvent(rows: JunctionRow[]): Map<string, JunctionRow[]> {
  const byEvent = new Map<string, JunctionRow[]>();
  for (const row of rows) {
    const cast = byEvent.get(row.eventId) ?? [];
    cast.push(row);
    byEvent.set(row.eventId, cast);
  }
  return byEvent;
}

/**
 * Groups junction rows by event and hands each artist the full cast of every event they
 * played; `collaboratorsFrom` drops the artist themselves and does the pairing.
 *
 * One pass over the junction, not a per-artist loop — `for each artist:
 * rebuildArtistCollaborators(id)` would re-read every shared event once per participant.
 *
 * No event-status filter is needed beyond the `deletedAt` exclusion the caller applies:
 * `createEventArtistJunctions` only runs on approval, so every row here already belongs to
 * an approved event.
 *
 * Trade: each event's cast is copied into every member's row list, so peak memory is
 * Σ(castSize²) across the table — a 40-artist festival contributes ~1,600 rows, all
 * resident at once. That is the price of the single-pass read-count win; fine for a daily
 * sweep, worth revisiting if the dataset grows very large.
 */
export function buildCollaboratorLists(
  liveRows: JunctionRow[],
  now: Date = new Date()
): Map<string, Collaborator[]> {
  const byEvent = groupByEvent(liveRows);
  const rowsByArtist = new Map<string, JunctionRow[]>();

  for (const cast of byEvent.values()) {
    for (const member of cast) {
      const rows = rowsByArtist.get(member.artistId) ?? [];
      rows.push(...cast);
      rowsByArtist.set(member.artistId, rows);
    }
  }

  const result = new Map<string, Collaborator[]>();
  for (const [artistId, rows] of rowsByArtist) {
    result.set(artistId, collaboratorsFrom(artistId, rows, now));
  }
  return result;
}

/** Artists currently holding a non-empty collaborator list, so a re-run can clear stale ones. */
async function fetchArtistIdsWithCollaborators(): Promise<string[]> {
  const result = await ArtistEntity.query
    .list({})
    .go({ pages: 'all', attributes: ['id', 'collaborators'] as never[] });
  const ids: string[] = [];
  for (const artist of result.data as Array<{ id: string; collaborators?: unknown[] }>) {
    if (artist.collaborators?.length) ids.push(artist.id);
  }
  return ids;
}

async function writeCollaborators(
  entries: Array<{ artistId: string; collaborators: Collaborator[] }>
): Promise<void> {
  const computedAt = new Date().toISOString();

  // Thunks, not promises. `entries.map(() => go(...))` would fire every write the moment map
  // ran — the chunked await below would throttle nothing, and a rejection in a not-yet-awaited
  // chunk is an unhandled rejection.
  const updates = entries.map(
    ({ artistId, collaborators }) =>
      () =>
        ArtistEntity.update({ id: artistId })
          .set({ collaborators, collaboratorsComputedAt: computedAt })
          .go()
  );

  for (let i = 0; i < updates.length; i += WRITE_CHUNK) {
    await Promise.all(updates.slice(i, i + WRITE_CHUNK).map(run => run()));
  }
}

export interface CollaboratorSweepResult {
  /** Artists with at least one collaborator edge. */
  withCollaborators: number;
  /** Artists whose stale list was cleared to empty. */
  cleared: number;
  /** Junction rows dropped because their event is soft-deleted. */
  excludedDeleted: number;
  /** The first few computed entries, for a dry-run preview. */
  sample: Array<{ artistId: string; collaborators: Collaborator[] }>;
}

/**
 * Rebuild every artist's denormalized collaborator list from the junction, from scratch.
 *
 * This is both the backfill (§4.5.1 — events approved before the feature shipped contribute
 * nothing, so without one run the whole section launches empty) and the standing repair for
 * everything the inline recompute in `approveEvent` cannot reach:
 *
 * - the inline rebuild reads the `byArtist` GSI immediately after writing to it, and a GSI
 *   is eventually consistent, so a just-approved event can be missed;
 * - casts over `COLLABORATOR_INLINE_CAP` are skipped inline by design;
 * - merges over the fan-out cap are skipped the same way;
 * - a hard-deleted event leaves junction rows nothing recomputes.
 *
 * Every one of those used to wait for someone to run the CLI by hand. It is on the daily
 * cron now, beside the repertoire and featured sweeps.
 *
 * Re-running is safe: it computes from scratch and overwrites, so it never double-counts.
 */
export async function rebuildAllCollaborators(
  opts: { dryRun?: boolean } = {}
): Promise<CollaboratorSweepResult> {
  const [rows, deletedEventIds] = await Promise.all([
    fetchAllJunctionRows(),
    fetchDeletedEventIds(),
  ]);

  const liveRows = rows.filter(row => !deletedEventIds.has(row.eventId));
  const listsByArtist = buildCollaboratorLists(liveRows);
  const entries = [...listsByArtist.entries()].map(([artistId, collaborators]) => ({
    artistId,
    collaborators,
  }));

  // Artists who *had* a list but no longer have any edges — every shared event soft-deleted,
  // or their only co-performer merged away. They are absent from the map above, so without
  // this they keep a stale list forever. Clearing them is what makes a re-run converge.
  const stale = (await fetchArtistIdsWithCollaborators()).filter(id => !listsByArtist.has(id));
  for (const artistId of stale) {
    entries.push({ artistId, collaborators: [] });
  }

  if (!opts.dryRun) {
    await writeCollaborators(entries);
  }

  return {
    withCollaborators: entries.filter(e => e.collaborators.length > 0).length,
    cleared: stale.length,
    excludedDeleted: rows.length - liveRows.length,
    sample: entries.slice(0, 5),
  };
}
