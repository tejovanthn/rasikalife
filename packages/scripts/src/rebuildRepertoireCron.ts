import { Artist } from '@rasika/core';

/**
 * Daily cron entry point for the artist repertoire rebuild. Thin on purpose — the sweep
 * itself lives in core (`Artist.rebuildAllRepertoires`), shared with the CLI command, so
 * the scheduled run and a manual run can never compute it differently.
 *
 * Only repertoire is scheduled: featured performances are kept fresh inline by
 * `setEventArtistFeatured`, so they need no periodic rebuild.
 */
export async function handler(): Promise<void> {
  console.log('Starting scheduled repertoire rebuild');
  try {
    const result = await Artist.rebuildAllRepertoires();
    console.log(
      `Repertoire rebuild complete: ${result.withRepertoire} artists with a repertoire, ${result.cleared} cleared`
    );
  } catch (error) {
    console.error('Scheduled repertoire rebuild failed', error);
    throw error;
  }
}
