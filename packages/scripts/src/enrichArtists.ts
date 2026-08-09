/**
 * CLI wrapper for the artist instrument fill.
 *
 * Thin on purpose — the sweep lives in core (`Artist.fillArtistInstruments`), shared with the
 * weekly cron, so a scheduled run and a manual run can never differ. Everything here is
 * presentation.
 *
 * What it fills, and on what evidence: `artist.instrument`, from the `role` credited to that
 * artist on the events they actually played. Nothing is looked up, so nothing here can be a
 * wrong claim about a person — the credit was read off a poster and checked by whoever verified
 * the event. An empty field is filled; a filled one is never touched, so a re-run is a no-op.
 *
 * Everything else on an artist — biography, city, birth year, gurus, website — is deliberately
 * out of scope, and most of it is not derivable at all. A venue only tells you where a concert
 * was, not where the artist lives, and the event corpus is too young to date a career.
 *
 * Usage: `pnpm prod-cli enrich-artists` (dry run), then `--apply`.
 */

import type { Artist } from '@rasika/core';

type InstrumentFill = Artist.InstrumentFill;

/** The commonest derived values, so a reviewer can see the shape before reading 681 lines. */
function reportDistribution(fills: InstrumentFill[]): void {
  const counts = new Map<string, number>();
  for (const fill of fills) {
    for (const instrument of fill.instrument.split(', ')) {
      counts.set(instrument, (counts.get(instrument) ?? 0) + 1);
    }
  }
  console.log('\nInstruments derived:');
  for (const [instrument, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${instrument.padEnd(16)} ${count}`);
  }
}

export async function enrichArtists(
  options: { apply?: boolean; limit?: number } = {}
): Promise<void> {
  const { Artist } = await import('@rasika/core');

  console.log('Reading artists, the event-artist junction and events…');
  const result = await Artist.fillArtistInstruments({ apply: options.apply });
  console.log(
    `  ${result.scanned.artists} artists, ${result.scanned.junctionRows} credits, ${result.scanned.events} events`
  );

  console.log(`\n${result.fills.length} artists would gain an instrument.`);
  console.log(`  ${result.keptExisting} already hold one and are left alone`);
  console.log(`  ${result.noInstrumentInRoles} have credits that name no instrument`);
  console.log(`  ${result.noAppearances} have no live appearance at all`);

  if (result.fills.length) {
    reportDistribution(result.fills);
    console.log('');
    for (const fill of result.fills.slice(0, options.limit ?? 40)) {
      console.log(
        `  ${fill.name.slice(0, 38).padEnd(40)}${fill.instrument.padEnd(30)}${fill.appearances} appearance(s)`
      );
    }
    if (result.fills.length > (options.limit ?? 40)) {
      console.log(`  … and ${result.fills.length - (options.limit ?? 40)} more`);
    }
  }

  if (!options.apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to write these.');
    return;
  }

  console.log(`\nUpdated ${result.written} artists.`);
  if (result.failures.length) {
    console.log(`\n${result.failures.length} failed:`);
    for (const failure of result.failures) console.log(`  ${failure.name}: ${failure.error}`);
  }
  console.log('\nReindex search so the new fields are searchable: pnpm prod-cli reindex');
}
