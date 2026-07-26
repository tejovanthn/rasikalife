/**
 * CLI wrapper for the featured-performance rebuild.
 *
 * The sweep lives in core (`Artist.rebuildAllFeatured`), shared with the daily cron. It
 * rebuilds each artist's featured list from the live `isFeatured` junction rows, excluding
 * soft-deleted events — so besides the initial backfill it also heals un-credits and
 * merges. `setEventArtistFeatured` keeps the list fresh inline between runs.
 *
 * Usage: `pnpm cli rebuild-featured [--dry-run]`
 */
export async function rebuildFeatured(opts: { dryRun?: boolean } = {}): Promise<void> {
  const { dryRun = false } = opts;
  console.log('Rebuilding featured performances across all artists…');
  const { Artist } = await import('@rasika/core');
  const result = await Artist.rebuildAllFeatured({ dryRun });

  console.log(`\n${result.withFeatured} artists have featured performances.`);
  console.log(`${result.cleared} artists had a stale featured list to clear.`);

  if (dryRun) {
    console.log('[dry-run] Sample (first few artists):');
    for (const { artistId, featured } of result.sample) {
      console.log(`  ${artistId}: ${featured.map(f => f.eventTitle).join(', ') || '(cleared)'}`);
    }
    console.log('[dry-run] No changes written.');
    return;
  }
  console.log('Done.');
}
