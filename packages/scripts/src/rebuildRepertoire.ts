/**
 * CLI wrapper around the repertoire rebuild.
 *
 * The bulk sweep lives in core (`Artist.rebuildAllRepertoires`) so the daily cron Lambda
 * and this command share one definition and cannot drift. The single-artist repair path
 * stays here — it is only ever run by hand.
 *
 * Usage: `pnpm cli rebuild-repertoire [--dry-run] [--artist <id>]`
 */
import { computeRepertoire } from '@rasika/core/domain/artist';
import type { Repertoire } from '@rasika/core/domain/artist';

function logSample(entries: Array<{ artistId: string; repertoire: Repertoire }>): void {
  for (const { artistId, repertoire } of entries) {
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
  console.log('Rebuilding repertoire across all artists…');
  const { Artist } = await import('@rasika/core');
  const result = await Artist.rebuildAllRepertoires({ dryRun });

  console.log(`\n${result.withRepertoire} artists have a repertoire.`);
  console.log(`${result.cleared} artists had a stale repertoire to clear.`);

  if (dryRun) {
    console.log('[dry-run] Sample (first few artists):');
    logSample(result.sample);
    console.log('[dry-run] No changes written.');
    return;
  }
  console.log('Done.');
}

async function rebuildOne(artistId: string, dryRun: boolean): Promise<void> {
  const { getEventsByArtist } = await import('../../core/src/domain/event-artist/index.js');
  const { getEventSetlist } = await import('../../core/src/domain/event-setlist/index.js');
  const { EventEntity } = await import('../../core/src/domain/event/entity.js');
  const { ArtistEntity } = await import('../../core/src/domain/artist/entity.js');

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

  logSample([{ artistId, repertoire }]);
  if (dryRun) {
    console.log('[dry-run] No changes written.');
    return;
  }
  await ArtistEntity.update({ id: artistId })
    .set({
      topCompositions: repertoire.topCompositions,
      topRagas: repertoire.topRagas,
      repertoireComputedAt: new Date().toISOString(),
    })
    .go();
  console.log('Done.');
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
