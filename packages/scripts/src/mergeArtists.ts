import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv } from '@rasika/core/admin/csv';

/**
 * Merge reviewed artist duplicates: `merge-artists --file <csv> [--dry-run]`.
 *
 * The file needs `keep_id` and `merge_id`; other columns are ignored, so a review sheet can be
 * passed as it is. Nothing here finds duplicates — a person decides every pair.
 *
 * Before each merge the kept record takes every field it lacks from the other copy
 * (`artistMergeFillPatch`, blanks only). `mergeArtist` alone would discard them: it re-points
 * events and compositions and soft-deletes the loser with what it held. A pair already merged
 * is skipped, so a rerun is a no-op. Every run writes a manifest beside the file, listing the
 * fields copied per pair: the record from which a merge could be reversed by hand.
 */
export async function mergeArtists(opts: { file: string; dryRun?: boolean }): Promise<void> {
  const Artist = await import('@rasika/core/domain/artist');
  const [header, ...rows] = parseCsv(readFileSync(opts.file, 'utf-8'));
  const keepAt = header.indexOf('keep_id');
  const mergeAt = header.indexOf('merge_id');
  if (keepAt < 0 || mergeAt < 0) throw new Error('The file needs keep_id and merge_id columns');

  const manifest: Array<Record<string, unknown>> = [];
  for (const cells of rows) {
    const keepId = cells[keepAt]?.trim();
    const mergeId = cells[mergeAt]?.trim();
    if (!keepId || !mergeId) continue;
    if (keepId === mergeId) throw new Error(`${keepId} is listed as its own duplicate`);

    const keep = await Artist.getArtist(keepId);
    const loser = await Artist.getArtist(mergeId);
    if (!keep || keep.deletedAt) {
      console.warn(`⚠️  kept artist ${keepId} is missing or deleted; skipped`);
      manifest.push({ keepId, mergeId, skipped: 'kept artist missing or deleted' });
      continue;
    }
    if (!loser || loser.mergedIntoId) {
      const why = loser?.mergedIntoId === keepId ? 'already merged' : 'missing or merged elsewhere';
      console.log(`   ${mergeId} ${why}; skipped`);
      manifest.push({ keepId, mergeId, skipped: why });
      continue;
    }

    const patch = Artist.artistMergeFillPatch(
      keep as Record<string, unknown>,
      loser as Record<string, unknown>
    );
    const fields = Object.keys(patch);
    console.log(
      `${opts.dryRun ? '[dry-run] ' : ''}${loser.name} → ${keep.name}` +
        (fields.length ? ` (copies ${fields.join(', ')})` : '')
    );
    if (!opts.dryRun) {
      if (fields.length) await Artist.updateArtist(keepId, patch);
      await Artist.mergeArtist(mergeId, keepId);
    }
    manifest.push({ keepId, keepName: keep.name, mergeId, mergeName: loser.name, copied: patch });
  }

  const out = `${opts.file}.${opts.dryRun ? 'dry-run' : `applied-${Date.now()}`}.json`;
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n${manifest.length} pairs; manifest → ${out}`);
  if (!opts.dryRun) console.log('Reindex search next.');
}
