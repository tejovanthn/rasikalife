/**
 * Backfills the denormalized `featuredPerformances` list on each Artist from the
 * `isFeatured` EventArtist rows.
 *
 * Going forward `setEventArtistFeatured` keeps the list in step; this one-time sweep
 * populates it for performances featured before the field existed, so the profile
 * teaser (which now reads the field) shows them without a re-feature.
 *
 * Usage: `pnpm cli rebuild-featured [--dry-run] [--artist <id>]`
 */
import { sortFeaturedPerformances } from '@rasika/core/domain/event-artist';

const SCAN_PAGE_SIZE = 1000;

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

async function fetchFeaturedByArtist(): Promise<Map<string, FeaturedPerformance[]>> {
  const { EventArtistEntity } = await import('../../core/src/domain/event-artist/entity.js');
  const byArtist = new Map<string, FeaturedPerformance[]>();
  let cursor: string | null = null;
  do {
    const result = await EventArtistEntity.scan.go({
      attributes: [
        'eventId',
        'artistId',
        'eventTitle',
        'eventStartDateTime',
        'role',
        'isFeatured',
        'featureRank',
      ] as never[],
      cursor,
      limit: SCAN_PAGE_SIZE,
    });
    for (const row of result.data as FeaturedRow[]) {
      if (!row.isFeatured) continue;
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
    cursor = result.cursor;
  } while (cursor);

  // Store each list in the same display order the setter writes.
  for (const [artistId, list] of byArtist) {
    byArtist.set(artistId, sortFeaturedPerformances(list));
  }
  return byArtist;
}

/** Artists currently holding a featured list, so a re-run can clear stale ones. */
async function fetchArtistIdsWithFeatured(): Promise<string[]> {
  const { ArtistEntity } = await import('../../core/src/domain/artist/entity.js');
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const result = await ArtistEntity.query.list({}).go({
      cursor,
      limit: SCAN_PAGE_SIZE,
      attributes: ['id', 'featuredPerformances'] as never[],
    });
    for (const artist of result.data as Array<{ id: string; featuredPerformances?: unknown[] }>) {
      if (artist.featuredPerformances?.length) ids.push(artist.id);
    }
    cursor = result.cursor;
  } while (cursor);
  return ids;
}

async function writeFeatured(
  entries: Array<{ artistId: string; featured: FeaturedPerformance[] }>
): Promise<void> {
  const { ArtistEntity } = await import('../../core/src/domain/artist/entity.js');
  const updates = entries.map(
    ({ artistId, featured }) =>
      () =>
        ArtistEntity.update({ id: artistId }).set({ featuredPerformances: featured }).go()
  );
  for (let i = 0; i < updates.length; i += 25) {
    await Promise.all(updates.slice(i, i + 25).map(run => run()));
    process.stdout.write(`\r${Math.min(i + 25, updates.length)}/${updates.length} updated…`);
  }
  console.log('\nDone.');
}

async function rebuildAll(dryRun: boolean): Promise<void> {
  console.log('Scanning EventArtist rows for featured performances…');
  const byArtist = await fetchFeaturedByArtist();
  const entries = [...byArtist.entries()].map(([artistId, featured]) => ({ artistId, featured }));

  // Artists whose featured rows were all removed keep a stale list otherwise.
  const stale = (await fetchArtistIdsWithFeatured()).filter(id => !byArtist.has(id));
  for (const artistId of stale) entries.push({ artistId, featured: [] });

  console.log(`${byArtist.size} artists have featured performances.`);
  console.log(`${stale.length} artists have a stale featured list to clear.`);

  if (dryRun) {
    for (const { artistId, featured } of entries.slice(0, 5)) {
      console.log(`  ${artistId}: ${featured.map(f => f.eventTitle).join(', ') || '(cleared)'}`);
    }
    console.log('\n[dry-run] No changes written.');
    return;
  }
  await writeFeatured(entries);
}

async function rebuildOne(artistId: string, dryRun: boolean): Promise<void> {
  const byArtist = await fetchFeaturedByArtist();
  const featured = byArtist.get(artistId) ?? [];
  if (dryRun) {
    console.log(`  ${artistId}: ${featured.map(f => f.eventTitle).join(', ') || '(none)'}`);
    console.log('\n[dry-run] No changes written.');
    return;
  }
  await writeFeatured([{ artistId, featured }]);
}

export async function rebuildFeatured(
  opts: { dryRun?: boolean; artistId?: string } = {}
): Promise<void> {
  const { dryRun = false, artistId } = opts;
  if (artistId) {
    await rebuildOne(artistId, dryRun);
    return;
  }
  await rebuildAll(dryRun);
}
