/**
 * Extracts structured facts out of existing artist biographies and writes them to a CSV for
 * review. Reads the database; writes nothing to it.
 *
 * This is step one on purpose, and it has no product surface at all. Running it over the whole
 * corpus and handing the spreadsheet to a reviewer establishes the real precision rate before
 * anything is built on top — a bulk-approval screen is only worth building once that number
 * is known, and it might turn out that the CSV is enough on its own.
 *
 * Usage: `pnpm cli extract-artist-bios [--dry-run] [--artist <id>] [--limit <n>] [--out <path>]`
 */
import { writeFile } from 'node:fs/promises';
import { Artist } from '@rasika/core';
import { toCsv } from '@rasika/core/admin/csv';
import { extractFromBiography } from '@rasika/core/domain/artist/bio-extract';
import type { Proposal } from '@rasika/core/domain/artist/bio-proposals';
import { PROPOSAL_COLUMNS, toProposals } from '@rasika/core/domain/artist/bio-proposals';

/** A pause between model calls, so a few hundred artists do not trip the rate limit. */
const CALL_DELAY_MS = 250;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function proposalsToCsv(proposals: Proposal[]): string {
  // toCsv takes every row including the header, and handles the quoting.
  return toCsv([
    PROPOSAL_COLUMNS as string[],
    ...proposals.map(p => PROPOSAL_COLUMNS.map(column => p[column] ?? '')),
  ]);
}

export async function extractArtistBios(
  opts: { dryRun?: boolean; artistId?: string; limit?: number; out?: string } = {}
): Promise<void> {
  const { dryRun = false, artistId, limit, out } = opts;

  // One sweep, held for the whole run. listAllArtistsForMatching's own comment warns that
  // resolving names inside a loop turns this into a full scan per name — a hundred sweeps in
  // one invocation. The matcher is pure and takes its candidates, so it is loaded once here.
  console.log('Loading the artist corpus for name matching…');
  const candidates = await Artist.listAllArtistsForMatching();
  console.log(`${candidates.length} artists loaded.\n`);

  const targets = artistId
    ? candidates.filter(a => a.id === artistId)
    : candidates.filter(a => typeof a.biography === 'string' && a.biography.trim().length > 0);

  if (artistId && targets.length === 0) {
    console.error(`No artist with id ${artistId}.`);
    return;
  }

  const selected = limit ? targets.slice(0, limit) : targets;
  console.log(`${selected.length} artists with a biography to process.\n`);

  const proposals: Proposal[] = [];
  let failures = 0;

  for (const [index, artist] of selected.entries()) {
    const biography = (artist.biography as string | undefined) ?? '';
    if (!biography.trim()) continue;

    try {
      const extraction = await extractFromBiography(biography);
      const rows = toProposals({ id: artist.id, name: artist.name }, extraction, candidates);
      proposals.push(...rows);

      const unresolved = rows.filter(r => r.proposalType === 'unresolved').length;
      console.log(
        `[${index + 1}/${selected.length}] ${artist.name}: ${rows.length - unresolved} proposals, ${unresolved} left for review`
      );
    } catch (error) {
      // One artist's bad bio must not lose the whole batch — a run over several hundred
      // records is slow and paid for per call.
      failures++;
      console.error(`[${index + 1}/${selected.length}] ${artist.name}: FAILED —`, error);
    }

    if (index < selected.length - 1) await sleep(CALL_DELAY_MS);
  }

  console.log(`\n${proposals.length} proposal rows from ${selected.length} artists.`);
  if (failures > 0) console.log(`${failures} artists failed and were skipped.`);

  const byType = new Map<string, number>();
  for (const proposal of proposals) {
    byType.set(proposal.proposalType, (byType.get(proposal.proposalType) ?? 0) + 1);
  }
  for (const [type, count] of [...byType].sort()) {
    console.log(`  ${type}: ${count}`);
  }

  const csv = proposalsToCsv(proposals);

  if (dryRun) {
    console.log('\n[dry-run] First rows:\n');
    console.log(csv.split('\n').slice(0, 15).join('\n'));
    console.log('\n[dry-run] No file written.');
    return;
  }

  const path = out ?? `artist-bio-proposals-${new Date().toISOString().slice(0, 10)}.csv`;
  await writeFile(path, csv, 'utf8');
  console.log(`\nWritten to ${path}.`);
  console.log('Fill in the `decision` column (y/n) and `correctedValue` where needed, then run');
  console.log('`pnpm cli import-bio-extractions --file <path>`.');
}
