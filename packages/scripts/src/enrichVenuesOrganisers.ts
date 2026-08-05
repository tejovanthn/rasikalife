/**
 * CLI wrapper for the venue and organiser fill.
 *
 * Thin on purpose — the sweep lives in core (`Enrichment.enrichVenuesAndOrganisers`), shared
 * with the weekly cron, so a scheduled run and a manual run can never differ. Everything here
 * is presentation.
 *
 * What it fills, and on what evidence:
 *
 * | Field                          | Source                                          |
 * |--------------------------------|-------------------------------------------------|
 * | `organiser.website/phone/email`| `contactInfo` on that organiser's own events    |
 * | `organiser.tags`               | artForm, tags and entryType across their events |
 * | `organiser.organisationType`   | an explicit word in the name                    |
 * | `venue.venueType`              | an explicit word in the name                    |
 *
 * An empty field is filled; a filled one is never touched, so a re-run is a no-op. The
 * reasoning, including why event `contactInfo` may never be written to a venue, is in
 * `domain/organiser/enrich.ts`.
 *
 * Everything needing a person — city, capacity, founded year, street address, description —
 * is deliberately out of scope. Those already have a path: export the domain from
 * `/admin/data/<domain>/export`, edit the spreadsheet, and upload it back.
 *
 * Usage: `pnpm prod-cli enrich-venues-organisers` (dry run), then `--apply`.
 */

// Namespace type: `domain/enrichment` is a flat module like `cascade`, so it has no subpath
// export of its own. Erased at compile time, so it adds no runtime import of the Node-only entry.
import type { Enrichment } from '@rasika/core';

type EnrichmentChange = Enrichment.EnrichmentChange;

interface Options {
  apply?: boolean;
  venuesOnly?: boolean;
  organisersOnly?: boolean;
}

function report(label: string, changes: EnrichmentChange[], total: number): void {
  console.log(`\n${label}: ${changes.length} of ${total} records would gain fields.`);
  if (!changes.length) return;

  const perField = new Map<string, number>();
  for (const change of changes) {
    for (const field of Object.keys(change.fields)) {
      perField.set(field, (perField.get(field) ?? 0) + 1);
    }
  }
  for (const [field, count] of [...perField].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${field.padEnd(20)} ${count}`);
  }

  console.log('');
  for (const change of changes) {
    const summary = Object.entries(change.fields)
      .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join('|') : String(value)}`)
      .join('  ');
    console.log(`  ${change.name.slice(0, 44).padEnd(46)}${summary}`);
  }
}

export async function enrichVenuesOrganisers(options: Options = {}): Promise<void> {
  const { Enrichment } = await import('@rasika/core');

  console.log('Reading venues, organisers and events…');
  const result = await Enrichment.enrichVenuesAndOrganisers(options);
  console.log(
    `  ${result.scanned.venues} venues, ${result.scanned.organisers} organisers, ${result.scanned.events} events`
  );

  if (!options.organisersOnly) report('VENUES', result.venues, result.scanned.venues);
  if (!options.venuesOnly) report('ORGANISERS', result.organisers, result.scanned.organisers);

  if (!options.apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to write these.');
    return;
  }

  console.log(`\nUpdated ${result.written} records.`);
  if (result.failures.length) {
    console.log(`\n${result.failures.length} failed:`);
    for (const failure of result.failures) console.log(`  ${failure.name}: ${failure.error}`);
  }
  console.log('\nReindex search so the new fields are searchable: pnpm prod-cli reindex');
}
