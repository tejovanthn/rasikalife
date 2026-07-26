import { sortFeaturedPerformances } from '../event-artist';
import { EventArtistEntity } from '../event-artist/entity';
import { EventEntity } from '../event/entity';
import { ArtistEntity } from './entity';

const WRITE_CHUNK = 25;

interface FeaturedRow {
  eventId: string;
  artistId: string;
  eventTitle: string;
  eventStartDateTime: string;
  role?: string;
  isFeatured?: boolean;
  featureRank?: number;
}

interface FeaturedPerformance {
  eventId: string;
  eventTitle: string;
  eventStartDateTime: string;
  role?: string;
  featureRank?: number;
}

/** Ids of events soft-deleted via `softDeleteEvent`, whose featured rows must not count. */
async function fetchDeletedEventIds(): Promise<Set<string>> {
  const result = await EventEntity.scan.go({ pages: 'all' });
  const ids = new Set<string>();
  for (const row of result.data as Array<{ id: string; deletedAt?: string }>) {
    if (row.deletedAt) ids.add(row.id);
  }
  return ids;
}

/**
 * Rebuild every artist's featured list from the live `isFeatured` junction rows,
 * excluding soft-deleted events. Because it computes from the current junction, it also
 * heals the three lifecycle events the inline setter can't: an un-credited artist's row
 * is already gone, a merge has already rewritten the junction, and a deleted event is
 * filtered here — so a featured entry that should disappear does.
 */
export function buildFeaturedByArtist(
  rows: FeaturedRow[],
  deletedEventIds: Set<string>
): Map<string, FeaturedPerformance[]> {
  const byArtist = new Map<string, FeaturedPerformance[]>();
  for (const row of rows) {
    if (!row.isFeatured) continue;
    if (deletedEventIds.has(row.eventId)) continue;
    const list = byArtist.get(row.artistId) ?? [];
    list.push({
      eventId: row.eventId,
      eventTitle: row.eventTitle,
      eventStartDateTime: row.eventStartDateTime,
      role: row.role,
      featureRank: row.featureRank,
    });
    byArtist.set(row.artistId, list);
  }
  // Store each list in the display order the setter writes.
  for (const [artistId, list] of byArtist) {
    byArtist.set(artistId, sortFeaturedPerformances(list));
  }
  return byArtist;
}

/** Artists currently holding a featured list, so a re-run can clear stale ones. */
async function fetchArtistIdsWithFeatured(): Promise<string[]> {
  const result = await ArtistEntity.query
    .list({})
    .go({ pages: 'all', attributes: ['id', 'featuredPerformances'] as never[] });
  const ids: string[] = [];
  for (const artist of result.data as Array<{ id: string; featuredPerformances?: unknown[] }>) {
    if (artist.featuredPerformances?.length) ids.push(artist.id);
  }
  return ids;
}

async function writeFeatured(
  entries: Array<{ artistId: string; featured: FeaturedPerformance[] }>
): Promise<void> {
  const updates = entries.map(
    ({ artistId, featured }) =>
      () =>
        ArtistEntity.update({ id: artistId }).set({ featuredPerformances: featured }).go()
  );
  for (let i = 0; i < updates.length; i += WRITE_CHUNK) {
    await Promise.all(updates.slice(i, i + WRITE_CHUNK).map(run => run()));
  }
}

export interface FeaturedSweepResult {
  /** Artists with at least one featured performance. */
  withFeatured: number;
  /** Artists whose stale featured list was cleared to empty. */
  cleared: number;
  /** The first few computed entries, for a dry-run preview. */
  sample: Array<{ artistId: string; featured: FeaturedPerformance[] }>;
}

/**
 * Recompute every artist's denormalized featured list from scratch. The inline setter
 * (`setEventArtistFeatured`) keeps it fresh on the happy path; this daily sweep is the
 * safety net that reconciles deletes, un-credits, and merges, exactly as the repertoire
 * sweep does. `dryRun` computes without writing.
 */
export async function rebuildAllFeatured(
  opts: { dryRun?: boolean } = {}
): Promise<FeaturedSweepResult> {
  const [scan, deletedEventIds] = await Promise.all([
    EventArtistEntity.scan.go({ pages: 'all' }),
    fetchDeletedEventIds(),
  ]);

  const byArtist = buildFeaturedByArtist(scan.data as FeaturedRow[], deletedEventIds);
  const entries = [...byArtist.entries()].map(([artistId, featured]) => ({ artistId, featured }));

  // Artists whose featured rows were all removed (event deleted, un-credited, merged away)
  // keep a stale list otherwise — the whole point of the sweep.
  const stale = (await fetchArtistIdsWithFeatured()).filter(id => !byArtist.has(id));
  for (const artistId of stale) {
    entries.push({ artistId, featured: [] });
  }

  if (!opts.dryRun) {
    await writeFeatured(entries);
  }

  return { withFeatured: byArtist.size, cleared: stale.length, sample: entries.slice(0, 5) };
}
