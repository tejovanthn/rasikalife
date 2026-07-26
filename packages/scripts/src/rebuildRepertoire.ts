/**
 * CLI wrapper around the repertoire rebuild.
 *
 * Both the bulk sweep and the single-artist repair live in core
 * (`Artist.rebuildAllRepertoires`, `Artist.rebuildArtistRepertoire`), shared with the daily
 * cron, so a manual run and the scheduled run can never compute it differently.
 *
 * Usage: `pnpm cli rebuild-repertoire [--dry-run] [--artist <id>]`
 */
import { Artist } from '@rasika/core';
import type { Repertoire } from '@rasika/core/domain/artist';

function logRepertoire(artistId: string, repertoire: Repertoire): void {
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

export async function rebuildRepertoire(
  opts: { dryRun?: boolean; artistId?: string } = {}
): Promise<void> {
  const { dryRun = false, artistId } = opts;

  if (artistId) {
    const repertoire = await Artist.rebuildArtistRepertoire(artistId, { dryRun });
    logRepertoire(artistId, repertoire);
    console.log(dryRun ? '[dry-run] No changes written.' : 'Done.');
    return;
  }

  console.log('Rebuilding repertoire across all artists…');
  const result = await Artist.rebuildAllRepertoires({ dryRun });
  console.log(`\n${result.withRepertoire} artists have a repertoire.`);
  console.log(`${result.cleared} artists had a stale repertoire to clear.`);

  if (dryRun) {
    console.log('[dry-run] Sample (first few artists):');
    for (const { artistId: id, repertoire } of result.sample) {
      logRepertoire(id, repertoire);
    }
    console.log('[dry-run] No changes written.');
    return;
  }
  console.log('Done.');
}
