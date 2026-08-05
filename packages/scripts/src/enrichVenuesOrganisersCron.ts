import { Enrichment } from '@rasika/core';

/**
 * Weekly cron entry point for the venue and organiser fill. Thin on purpose — the sweep lives
 * in core, shared with `pnpm cli enrich-venues-organisers`, so the scheduled run and a manual
 * run can never differ.
 *
 * Weekly rather than daily because the drift it repairs is slow: `resolveOrganiser` in
 * `event.submitVerified` creates an organiser carrying nothing but a name each time an event
 * names an unknown one, and new venues arrive the same way. Contact details on *existing*
 * organisers are already handled the moment they are known — `cascadeEventContactToOrganiser`
 * runs on approval — so this is the net that catches what the cascade cannot: a name-derived
 * `venueType` or `organisationType`, and the tags of an organiser whose first events have only
 * now been approved.
 *
 * Nothing here overwrites, so a run that finds nothing writes nothing.
 */
export async function handler(): Promise<void> {
  console.log('Starting scheduled venue and organiser fill');
  try {
    const result = await Enrichment.enrichVenuesAndOrganisers({ apply: true });
    console.log(
      `Scanned ${result.scanned.venues} venues, ${result.scanned.organisers} organisers, ` +
        `${result.scanned.events} events; filled ${result.venues.length} venues and ` +
        `${result.organisers.length} organisers (${result.written} records written).`
    );

    if (result.failures.length) {
      // Logged rather than thrown: a single bad record must not mark the whole run failed and
      // hide the ones that did land.
      console.error(`${result.failures.length} records failed to write:`);
      for (const failure of result.failures) {
        console.error(`  ${failure.name}: ${failure.error}`);
      }
    }

    // No reindex here. `SearchIndexCron` already rebuilds every 6 hours, so a fill is searchable
    // within one of those windows; rebuilding here as well would read the whole table a second
    // time for a field nobody searches on within the hour. The manual CLI path still prints the
    // reindex reminder, because a person running it by hand is usually watching for the result.
  } catch (error) {
    console.error('Scheduled venue and organiser fill failed', error);
    throw error;
  }
}
