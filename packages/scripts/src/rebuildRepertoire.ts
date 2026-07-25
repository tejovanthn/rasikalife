/**
 * Backfills / refreshes the denormalized "most performed" repertoire on each Artist.
 *
 * The profile reads `artist.topCompositions` / `artist.topRagas` directly; without this
 * sweep those fields are empty and the page would fall back to a per-view fan-out over
 * every event's setlist. The repertoire is an aggregate that tolerates staleness, so it
 * is refreshed here (a scheduled sweep) rather than inline on every concert-log submit,
 * which would amplify that frequent write across all the event's artists.
 *
 * Full sweep: one scan of the EventArtist junction and one of the EventSetlist rows,
 * joined in memory by eventId — not a per-artist loop, which would re-read every shared
 * event's setlist once per participant.
 *
 * Usage: `pnpm cli rebuild-repertoire [--dry-run] [--artist <id>]`
 */
import { computeRepertoire } from '@rasika/core/domain/artist';
import type { Repertoire, RepertoireSetlistRow } from '@rasika/core/domain/artist';

const SCAN_PAGE_SIZE = 1000;

interface EventArtistRow {
  eventId: string;
  artistId: string;
}

async function fetchAllEventArtistRows(): Promise<EventArtistRow[]> {
  const { EventArtistEntity } = await import('../../core/src/domain/event-artist/entity.js');
  const rows: EventArtistRow[] = [];
  let cursor: string | null = null;
  do {
    const result = await EventArtistEntity.scan.go({
      attributes: ['eventId', 'artistId'] as never[],
      cursor,
      limit: SCAN_PAGE_SIZE,
    });
    rows.push(...(result.data as EventArtistRow[]));
    cursor = result.cursor;
  } while (cursor);
  return rows;
}

/** eventId → its setlist rows (compositions/ragas), keyed for the in-memory join. */
async function fetchSetlistByEvent(): Promise<Map<string, RepertoireSetlistRow[]>> {
  const { EventSetlistEntity } = await import('../../core/src/domain/event-setlist/entity.js');
  const byEvent = new Map<string, RepertoireSetlistRow[]>();
  let cursor: string | null = null;
  do {
    const result = await EventSetlistEntity.scan.go({
      attributes: ['eventId', 'compositionId', 'compositionTitle', 'ragaId', 'ragaName'] as never[],
      cursor,
      limit: SCAN_PAGE_SIZE,
    });
    for (const row of result.data as Array<RepertoireSetlistRow & { eventId: string }>) {
      const rows = byEvent.get(row.eventId) ?? [];
      rows.push(row);
      byEvent.set(row.eventId, rows);
    }
    cursor = result.cursor;
  } while (cursor);
  return byEvent;
}

/** Ids of events soft-deleted via `softDeleteEvent`, whose setlists must not count. */
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
      if (row.deletedAt) ids.add(row.id);
    }
    cursor = result.cursor;
  } while (cursor);
  return ids;
}

function buildRepertoireByArtist(
  eventArtistRows: EventArtistRow[],
  setlistByEvent: Map<string, RepertoireSetlistRow[]>,
  deletedEventIds: Set<string>
): Map<string, Repertoire> {
  // Gather each artist's setlist rows across their non-deleted events, then aggregate.
  const rowsByArtist = new Map<string, RepertoireSetlistRow[]>();
  for (const { eventId, artistId } of eventArtistRows) {
    if (deletedEventIds.has(eventId)) continue;
    const setlist = setlistByEvent.get(eventId);
    if (!setlist || setlist.length === 0) continue;
    const rows = rowsByArtist.get(artistId) ?? [];
    rows.push(...setlist);
    rowsByArtist.set(artistId, rows);
  }

  const result = new Map<string, Repertoire>();
  for (const [artistId, rows] of rowsByArtist) {
    result.set(artistId, computeRepertoire(rows));
  }
  return result;
}

/** Artists currently holding a non-empty repertoire, so a re-run can clear stale ones. */
async function fetchArtistIdsWithRepertoire(): Promise<string[]> {
  const { ArtistEntity } = await import('../../core/src/domain/artist/entity.js');
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const result = await ArtistEntity.query.list({}).go({
      cursor,
      limit: SCAN_PAGE_SIZE,
      attributes: ['id', 'topCompositions', 'topRagas'] as never[],
    });
    for (const artist of result.data as Array<{
      id: string;
      topCompositions?: unknown[];
      topRagas?: unknown[];
    }>) {
      if (artist.topCompositions?.length || artist.topRagas?.length) ids.push(artist.id);
    }
    cursor = result.cursor;
  } while (cursor);
  return ids;
}

async function writeRepertoire(
  entries: Array<{ artistId: string; repertoire: Repertoire }>
): Promise<void> {
  const { ArtistEntity } = await import('../../core/src/domain/artist/entity.js');
  const computedAt = new Date().toISOString();

  // Thunks, not promises, so the chunked await below actually throttles the writes
  // rather than firing them all at once.
  const updates = entries.map(
    ({ artistId, repertoire }) =>
      () =>
        ArtistEntity.update({ id: artistId })
          .set({
            topCompositions: repertoire.topCompositions,
            topRagas: repertoire.topRagas,
            repertoireComputedAt: computedAt,
          })
          .go()
  );

  for (let i = 0; i < updates.length; i += 25) {
    await Promise.all(updates.slice(i, i + 25).map(run => run()));
    process.stdout.write(`\r${Math.min(i + 25, updates.length)}/${updates.length} updated…`);
  }
  console.log('\nDone.');
}

function logSample(entries: Array<{ artistId: string; repertoire: Repertoire }>): void {
  const SAMPLE_SIZE = 5;
  console.log(`[dry-run] Sample repertoire (first ${SAMPLE_SIZE} artists):`);
  for (const { artistId, repertoire } of entries.slice(0, SAMPLE_SIZE)) {
    const comps = repertoire.topCompositions
      .slice(0, 3)
      .map(c => `${c.title} (${c.count})`)
      .join(', ');
    const ragas = repertoire.topRagas
      .slice(0, 3)
      .map(r => `${r.name} (${r.count})`)
      .join(', ');
    console.log(`  ${artistId}: compositions=[${comps}] ragas=[${ragas}]`);
  }
}

async function rebuildAll(dryRun: boolean): Promise<void> {
  console.log('Fetching EventArtist junction rows…');
  const eventArtistRows = await fetchAllEventArtistRows();
  console.log(`Found ${eventArtistRows.length} junction rows.`);

  console.log('Fetching setlist rows…');
  const setlistByEvent = await fetchSetlistByEvent();
  console.log(`Found setlists for ${setlistByEvent.size} events.`);

  console.log('Fetching soft-deleted event ids…');
  const deletedEventIds = await fetchDeletedEventIds();
  console.log(`Found ${deletedEventIds.size} soft-deleted events.`);

  const byArtist = buildRepertoireByArtist(eventArtistRows, setlistByEvent, deletedEventIds);
  const entries = [...byArtist.entries()].map(([artistId, repertoire]) => ({
    artistId,
    repertoire,
  }));

  // Artists who had a repertoire but no longer have any performed compositions/ragas —
  // every event soft-deleted, or their setlists emptied. Absent from the map above, so
  // clear them explicitly or a re-run leaves a stale list forever.
  const stale = (await fetchArtistIdsWithRepertoire()).filter(id => !byArtist.has(id));
  for (const artistId of stale) {
    entries.push({ artistId, repertoire: { topCompositions: [], topRagas: [] } });
  }

  const withData = entries.filter(
    e => e.repertoire.topCompositions.length > 0 || e.repertoire.topRagas.length > 0
  ).length;
  console.log(`\n${withData} artists have a repertoire.`);
  console.log(`${stale.length} artists have a stale repertoire to clear.`);

  if (dryRun) {
    logSample(entries);
    console.log('\n[dry-run] No changes written.');
    return;
  }

  await writeRepertoire(entries);
}

async function rebuildOne(artistId: string, dryRun: boolean): Promise<void> {
  const { getEventsByArtist } = await import('../../core/src/domain/event-artist/index.js');
  const { getEventSetlist } = await import('../../core/src/domain/event-setlist/index.js');
  const { EventEntity } = await import('../../core/src/domain/event/entity.js');

  const eventIds: string[] = [];
  let nextToken: string | undefined;
  do {
    const page = await getEventsByArtist(artistId, { nextToken });
    eventIds.push(...page.items.map(ea => ea.eventId));
    nextToken = page.nextToken;
  } while (nextToken);

  // Exclude soft-deleted events, whose setlist rows still exist.
  const live = await Promise.all(
    eventIds.map(async id => ({
      id,
      deleted: !!(await EventEntity.get({ id }).go()).data?.deletedAt,
    }))
  );
  const liveIds = live.filter(e => !e.deleted).map(e => e.id);

  const setlists = await Promise.all(liveIds.map(id => getEventSetlist(id)));
  const repertoire = computeRepertoire(setlists.flat());

  if (dryRun) {
    logSample([{ artistId, repertoire }]);
    console.log('\n[dry-run] No changes written.');
    return;
  }

  await writeRepertoire([{ artistId, repertoire }]);
}

export async function rebuildRepertoire(
  opts: { dryRun?: boolean; artistId?: string } = {}
): Promise<void> {
  const { dryRun = false, artistId } = opts;
  if (artistId) {
    await rebuildOne(artistId, dryRun);
    return;
  }
  await rebuildAll(dryRun);
}
