import { Artist } from '@rasika/core';

/**
 * Daily cron entry point for the artist derived-data rebuilds. Thin on purpose — the sweeps
 * live in core, shared with the CLI commands, so the scheduled run and a manual run can
 * never differ.
 *
 * All three denormalized fields are refreshed here. Repertoire has no inline maintenance at
 * all. Featured is kept fresh inline by `setEventArtistFeatured`, and collaborators by
 * `approveEvent`, but for both the sweep is the safety net rather than a nicety:
 *
 * - the inline collaborator rebuild reads the `byArtist` GSI immediately after writing to
 *   it, and a GSI is eventually consistent, so a just-approved event can be computed away;
 * - casts over `COLLABORATOR_INLINE_CAP`, and merges over the fan-out cap, are skipped
 *   inline by design;
 * - deletes, un-credits and merges are invisible to every inline path.
 *
 * Until this ran collaborators, all of those waited for a human to remember the CLI.
 *
 * The three run sequentially, not in parallel: each does full table scans, and firing them
 * together triples the read burst against a table that also serves the site.
 */
export async function handler(): Promise<void> {
  console.log('Starting scheduled artist derived-data rebuild');
  try {
    const repertoire = await Artist.rebuildAllRepertoires();
    const featured = await Artist.rebuildAllFeatured();
    const collaborators = await Artist.rebuildAllCollaborators();
    console.log(
      `Rebuild complete: repertoire ${repertoire.withRepertoire} set / ${repertoire.cleared} cleared; ` +
        `featured ${featured.withFeatured} set / ${featured.cleared} cleared; ` +
        `collaborators ${collaborators.withCollaborators} set / ${collaborators.cleared} cleared`
    );
  } catch (error) {
    console.error('Scheduled artist derived-data rebuild failed', error);
    throw error;
  }
}
