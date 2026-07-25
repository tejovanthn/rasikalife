import { EventArtistEntity } from '../event-artist/entity';
import { EventSetlistEntity } from '../event-setlist/entity';
import { EventEntity } from '../event/entity';
import { ArtistEntity } from './entity';
import { computeRepertoire } from './repertoire';
import type { Repertoire, RepertoireSetlistRow } from './repertoire';

const WRITE_CHUNK = 25;

interface EventArtistRow {
  eventId: string;
  artistId: string;
}

async function fetchAllEventArtistRows(): Promise<EventArtistRow[]> {
  const result = await EventArtistEntity.scan.go({ pages: 'all' });
  return result.data as EventArtistRow[];
}

/** eventId → its setlist rows (compositions/ragas), keyed for the in-memory join. */
async function fetchSetlistByEvent(): Promise<Map<string, RepertoireSetlistRow[]>> {
  const result = await EventSetlistEntity.scan.go({ pages: 'all' });
  const byEvent = new Map<string, RepertoireSetlistRow[]>();
  for (const row of result.data as Array<RepertoireSetlistRow & { eventId: string }>) {
    const rows = byEvent.get(row.eventId) ?? [];
    rows.push(row);
    byEvent.set(row.eventId, rows);
  }
  return byEvent;
}

/** Ids of events soft-deleted via `softDeleteEvent`, whose setlists must not count. */
async function fetchDeletedEventIds(): Promise<Set<string>> {
  const result = await EventEntity.scan.go({ pages: 'all' });
  const ids = new Set<string>();
  for (const row of result.data as Array<{ id: string; deletedAt?: string }>) {
    if (row.deletedAt) ids.add(row.id);
  }
  return ids;
}

export function buildRepertoireByArtist(
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
  const result = await ArtistEntity.query
    .list({})
    .go({ pages: 'all', attributes: ['id', 'topCompositions', 'topRagas'] as never[] });
  const ids: string[] = [];
  for (const artist of result.data as Array<{
    id: string;
    topCompositions?: unknown[];
    topRagas?: unknown[];
  }>) {
    if (artist.topCompositions?.length || artist.topRagas?.length) ids.push(artist.id);
  }
  return ids;
}

async function writeRepertoire(
  entries: Array<{ artistId: string; repertoire: Repertoire }>
): Promise<void> {
  const computedAt = new Date().toISOString();
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
  for (let i = 0; i < updates.length; i += WRITE_CHUNK) {
    await Promise.all(updates.slice(i, i + WRITE_CHUNK).map(run => run()));
  }
}

export interface RepertoireSweepResult {
  /** Artists whose repertoire has at least one composition or raga. */
  withRepertoire: number;
  /** Artists whose stale repertoire was cleared to empty. */
  cleared: number;
  /** The first few computed entries, for a dry-run preview. */
  sample: Array<{ artistId: string; repertoire: Repertoire }>;
}

/**
 * Recompute every artist's denormalized repertoire from scratch in one pass — one scan of
 * the EventArtist junction and one of the EventSetlist rows, joined in memory by eventId,
 * not a per-artist loop. Backfill and periodic refresh share this; a cron runs it daily.
 *
 * `dryRun` computes without writing, returning the counts and a sample so the CLI can
 * preview. Re-running is safe: it computes from scratch and overwrites, never increments.
 */
export async function rebuildAllRepertoires(
  opts: { dryRun?: boolean } = {}
): Promise<RepertoireSweepResult> {
  const [eventArtistRows, setlistByEvent, deletedEventIds] = await Promise.all([
    fetchAllEventArtistRows(),
    fetchSetlistByEvent(),
    fetchDeletedEventIds(),
  ]);

  const byArtist = buildRepertoireByArtist(eventArtistRows, setlistByEvent, deletedEventIds);
  const entries = [...byArtist.entries()].map(([artistId, repertoire]) => ({
    artistId,
    repertoire,
  }));

  // Artists who had a repertoire but no longer have any performed compositions/ragas —
  // every event soft-deleted, or setlists emptied. Absent from the map above, so clear
  // them explicitly or a re-run leaves a stale list forever.
  const stale = (await fetchArtistIdsWithRepertoire()).filter(id => !byArtist.has(id));
  for (const artistId of stale) {
    entries.push({ artistId, repertoire: { topCompositions: [], topRagas: [] } });
  }

  const withRepertoire = entries.filter(
    e => e.repertoire.topCompositions.length > 0 || e.repertoire.topRagas.length > 0
  ).length;

  if (!opts.dryRun) {
    await writeRepertoire(entries);
  }

  return { withRepertoire, cleared: stale.length, sample: entries.slice(0, 5) };
}
