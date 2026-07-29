/**
 * CLI wrapper for the collaborator rebuild.
 *
 * The sweep lives in core (`Artist.rebuildAllCollaborators`), shared with the daily cron, so
 * a scheduled run and a manual run can never differ — the same arrangement the repertoire and
 * featured sweeps already use. It used to live here instead, reaching across the package
 * boundary into core's entity modules by relative path and importing a helper the artist
 * barrel did not export, which meant the full sweep completed both table scans and then threw.
 *
 * Two modes, and they take different paths on purpose. With no arguments it runs the
 * single-pass sweep over the whole junction, which is the right shape for rebuilding
 * everything. With `--artist` it calls `rebuildArtistCollaborators` directly: for one record
 * the per-artist query is far cheaper than scanning the junction, and it is the repair path
 * after a bad merge.
 *
 * Usage: `pnpm cli rebuild-collaborators [--dry-run] [--artist <id>]`
 */
import { Artist } from '@rasika/core';

async function rebuildOne(artistId: string, dryRun: boolean): Promise<void> {
  if (dryRun) {
    // rebuildArtistCollaborators writes immediately — there is no dry-run mode at
    // single-artist granularity. Rather than silently mutate on a --dry-run request,
    // skip the call and say so.
    console.log(
      `[dry-run] Single-artist repair calls rebuildArtistCollaborators('${artistId}') directly, which writes immediately. Skipping rather than mutating under --dry-run.`
    );
    return;
  }

  console.log(`Rebuilding collaborators for artist ${artistId}…`);
  await Artist.rebuildArtistCollaborators(artistId);
  console.log('Done.');
}

export async function rebuildCollaborators(
  opts: { dryRun?: boolean; artistId?: string } = {}
): Promise<void> {
  const { dryRun = false, artistId } = opts;

  if (artistId) {
    await rebuildOne(artistId, dryRun);
    return;
  }

  console.log('Rebuilding collaborators across all artists…');
  const result = await Artist.rebuildAllCollaborators({ dryRun });

  console.log(`\nExcluded ${result.excludedDeleted} rows belonging to soft-deleted events.`);
  console.log(`${result.withCollaborators} artists have at least one collaborator edge.`);
  console.log(`${result.cleared} artists had a stale list to clear.`);

  if (dryRun) {
    console.log('[dry-run] Sample edges (first few artists):');
    for (const { artistId: id, collaborators } of result.sample) {
      console.log(`  ${id}:`);
      for (const c of collaborators.slice(0, 3)) {
        const roles = c.topRoles?.join(', ') ?? '—';
        console.log(
          `    -> ${c.name} (${c.artistId}) shared=${c.sharedEventCount} ` +
            `strength=${c.strength.toFixed(2)} roles=${roles}`
        );
      }
    }
    console.log('[dry-run] No changes written.');
    return;
  }
  console.log('Done.');
}
