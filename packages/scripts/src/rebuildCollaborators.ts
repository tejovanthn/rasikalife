/**
 * Backfills / repairs the `collaborators` list denormalized onto each Artist.
 *
 * Collaborators are computed when an event is approved (see
 * `createEventArtistJunctions` in `packages/core/src/domain/event/index.ts`). Every
 * event approved before that feature shipped contributes nothing, so this sweep
 * derives the full collaborator graph from the EventArtist junction once, from
 * scratch, and is also the repair tool afterwards (e.g. after a bad artist merge).
 *
 * Full sweep: one pass over the EventArtist junction, not a per-artist loop — a
 * naive `for each artist: rebuildArtistCollaborators(id)` would re-read every
 * shared event once per participant.
 *
 * Usage: `pnpm cli rebuild-collaborators [--dry-run] [--artist <id>]`
 */
import { collaboratorsFrom } from '@rasika/core/domain/artist';
import type { Collaborator } from '@rasika/core/domain/artist/client';

const SCAN_PAGE_SIZE = 1000;

interface JunctionRow {
  eventId: string;
  artistId: string;
  artistName: string;
  role?: string;
  eventStartDateTime: string;
}

async function fetchAllJunctionRows(): Promise<JunctionRow[]> {
  const { EventArtistEntity } = await import('../../core/src/domain/event-artist/entity.js');

  const rows: JunctionRow[] = [];
  let cursor: string | null = null;

  do {
    const result = await EventArtistEntity.scan.go({
      attributes: ['eventId', 'artistId', 'artistName', 'role', 'eventStartDateTime'] as never[],
      cursor,
      limit: SCAN_PAGE_SIZE,
    });
    rows.push(...(result.data as JunctionRow[]));
    cursor = result.cursor;
  } while (cursor);

  return rows;
}

/** Ids of events soft-deleted via `softDeleteEvent`, which sets `deletedAt` but
 * leaves the EventArtist junction rows in place. */
async function fetchDeletedEventIds(): Promise<Set<string>> {
  const { EventEntity } = await import('../../core/src/domain/event/entity.js');

  const ids = new Set<string>();
  let cursor: string | null = null;

  do {
    const result = await EventEntity.scan.go({
      attributes: ['id', 'deletedAt'] as never[],
      cursor,
      limit: SCAN_PAGE_SIZE,
    });
    for (const row of result.data as Array<{ id: string; deletedAt?: string }>) {
      if (row.deletedAt) {
        ids.add(row.id);
      }
    }
    cursor = result.cursor;
  } while (cursor);

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
 * Groups junction rows by event and emits every ordered pair (ai, aj) within each
 * cast into a per-artist edge map: ai's map gains/updates an edge to aj with an
 * incremented sharedEventCount, the max eventStartDateTime as lastSharedAt, and
 * aj's canonical roles tallied for topRoles.
 *
 * No event-status filter is needed here beyond the deletedAt exclusion the caller
 * already applied: `createEventArtistJunctions` only runs when an event is
 * approved, so every row reaching this function already belongs to an approved
 * event — there is no "unapproved junction row" to guard against.
 *
 * Trade: this copies each event's full cast into every member's row list, so the
 * peak memory is Σ(castSize²) across the table — a 40-artist festival contributes
 * ~1,600 rows, all resident at once. That is the price of the single-pass read-count
 * win above; fine for an occasional sweep, worth revisiting if the dataset grows huge.
 */
function buildCollaboratorLists(liveRows: JunctionRow[]): Map<string, Collaborator[]> {
  const byEvent = groupByEvent(liveRows);
  const rowsByArtist = new Map<string, JunctionRow[]>();

  // Each artist sees the full cast of every event they played; collaboratorsFrom
  // drops the artist themselves and does the pairing.
  for (const cast of byEvent.values()) {
    for (const member of cast) {
      const rows = rowsByArtist.get(member.artistId) ?? [];
      rows.push(...cast);
      rowsByArtist.set(member.artistId, rows);
    }
  }

  const now = new Date();
  const result = new Map<string, Collaborator[]>();
  for (const [artistId, rows] of rowsByArtist) {
    result.set(artistId, collaboratorsFrom(artistId, rows, now));
  }
  return result;
}

/** Artists currently holding a non-empty collaborator list. */
async function fetchArtistIdsWithCollaborators(): Promise<string[]> {
  const { ArtistEntity } = await import('../../core/src/domain/artist/entity.js');
  const ids: string[] = [];
  let cursor: string | null = null;

  do {
    const result = await ArtistEntity.query
      .list({})
      .go({ cursor, limit: SCAN_PAGE_SIZE, attributes: ['id', 'collaborators'] as never[] });
    for (const artist of result.data as Array<{ id: string; collaborators?: unknown[] }>) {
      if (artist.collaborators?.length) ids.push(artist.id);
    }
    cursor = result.cursor;
  } while (cursor);

  return ids;
}

async function writeCollaborators(
  entries: Array<{ artistId: string; collaborators: Collaborator[] }>
): Promise<void> {
  const { ArtistEntity } = await import('../../core/src/domain/artist/entity.js');

  const computedAt = new Date().toISOString();

  // Write through the entity, exactly as the live `rebuildArtistCollaborators` does,
  // rather than a raw UpdateCommand. Two paths for one operation is what let the old
  // raw write need its own key-lowercasing workaround; the entity path never has that
  // hazard, and the two can no longer drift on the shape they write.
  //
  // Thunks, not promises. `entries.map(() => go(...))` would fire every write the
  // moment map ran — the chunked await below would throttle nothing, and a rejection
  // in a not-yet-awaited chunk is an unhandled rejection.
  const updates = entries.map(
    ({ artistId, collaborators }) =>
      () =>
        ArtistEntity.update({ id: artistId })
          .set({ collaborators, collaboratorsComputedAt: computedAt })
          .go()
  );

  for (let i = 0; i < updates.length; i += 25) {
    await Promise.all(updates.slice(i, i + 25).map(run => run()));
    process.stdout.write(`\r${Math.min(i + 25, updates.length)}/${updates.length} updated…`);
  }
  console.log('\nDone.');
}

function logSample(entries: Array<{ artistId: string; collaborators: Collaborator[] }>): void {
  const SAMPLE_SIZE = 5;
  const EDGES_PER_SAMPLE = 3;

  console.log(`[dry-run] Sample edges (first ${SAMPLE_SIZE} artists):`);
  for (const { artistId, collaborators } of entries.slice(0, SAMPLE_SIZE)) {
    console.log(`  ${artistId}:`);
    for (const c of collaborators.slice(0, EDGES_PER_SAMPLE)) {
      const roles = c.topRoles?.join(', ') ?? '—';
      console.log(
        `    -> ${c.name} (${c.artistId}) shared=${c.sharedEventCount} ` +
          `strength=${c.strength.toFixed(2)} roles=${roles}`
      );
    }
  }
}

async function rebuildAll(dryRun: boolean): Promise<void> {
  console.log('Fetching all EventArtist junction rows…');
  const rows = await fetchAllJunctionRows();
  console.log(`Found ${rows.length} junction rows.`);

  console.log('Fetching soft-deleted event ids…');
  const deletedEventIds = await fetchDeletedEventIds();
  console.log(`Found ${deletedEventIds.size} soft-deleted events.`);

  const liveRows = rows.filter(row => !deletedEventIds.has(row.eventId));
  console.log(`Excluded ${rows.length - liveRows.length} rows belonging to soft-deleted events.`);

  const listsByArtist = buildCollaboratorLists(liveRows);
  const entries = [...listsByArtist.entries()].map(([artistId, collaborators]) => ({
    artistId,
    collaborators,
  }));

  // Artists who *had* a list but no longer have any edges — every shared event
  // soft-deleted, or their only co-performer merged away. They are absent from
  // the map above, so without this they keep a stale list forever. Clearing
  // them is what makes a re-run genuinely converge on the truth.
  const stale = (await fetchArtistIdsWithCollaborators()).filter(id => !listsByArtist.has(id));
  for (const artistId of stale) {
    entries.push({ artistId, collaborators: [] });
  }

  const withEdges = entries.filter(e => e.collaborators.length > 0).length;
  console.log(`\n${withEdges} artists have at least one collaborator edge.`);
  console.log(`${stale.length} artists have a stale list to clear.`);

  if (dryRun) {
    logSample(entries);
    console.log('\n[dry-run] No changes written.');
    return;
  }

  await writeCollaborators(entries);
}

async function rebuildOne(artistId: string, dryRun: boolean): Promise<void> {
  if (dryRun) {
    // rebuildArtistCollaborators writes immediately — there is no dry-run mode at
    // single-artist granularity. Rather than silently mutate on a --dry-run
    // request, skip the call and say so.
    const message = `[dry-run] Single-artist repair calls rebuildArtistCollaborators('${artistId}')`;
    console.log(
      `${message} directly, which writes immediately. Skipping rather than mutating under --dry-run.`
    );
    return;
  }

  const { rebuildArtistCollaborators } = await import('@rasika/core/domain/artist');
  console.log(`Rebuilding collaborators for artist ${artistId}…`);
  await rebuildArtistCollaborators(artistId);
  console.log('Done.');
}

export async function rebuildCollaborators(
  opts: { dryRun?: boolean; artistId?: string } = {}
): Promise<void> {
  const { dryRun = false, artistId } = opts;

  if (artistId) {
    await rebuildOne(artistId, dryRun);
    return;
  }

  await rebuildAll(dryRun);
}
