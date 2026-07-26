import { Artist } from '@rasika/core';

/**
 * Daily cron entry point for the artist derived-data rebuilds. Thin on purpose — the
 * sweeps live in core (`Artist.rebuildAllRepertoires`, `Artist.rebuildAllFeatured`), shared
 * with the CLI commands, so the scheduled run and a manual run can never differ.
 *
 * Both are refreshed here. Repertoire has no inline maintenance at all; featured is kept
 * fresh inline by `setEventArtistFeatured`, but the sweep is its safety net — it reconciles
 * the deletes, un-credits, and merges the inline path can't reach.
 */
export async function handler(): Promise<void> {
  console.log('Starting scheduled artist derived-data rebuild');
  try {
    const [repertoire, featured] = await Promise.all([
      Artist.rebuildAllRepertoires(),
      Artist.rebuildAllFeatured(),
    ]);
    console.log(
      `Rebuild complete: repertoire ${repertoire.withRepertoire} set / ${repertoire.cleared} cleared; ` +
        `featured ${featured.withFeatured} set / ${featured.cleared} cleared`
    );
  } catch (error) {
    console.error('Scheduled artist derived-data rebuild failed', error);
    throw error;
  }
}
