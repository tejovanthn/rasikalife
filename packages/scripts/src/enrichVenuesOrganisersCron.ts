import { Artist, Enrichment } from '@rasika/core';

/**
 * Weekly cron entry point for the venue, organiser and artist fills. Thin on purpose — the
 * sweeps live in core, shared with `pnpm cli enrich-venues-organisers` and
 * `pnpm cli enrich-artists`, so the scheduled runs and the manual ones can never differ.
 *
 * Weekly rather than daily because the drift it repairs is slow: `resolveOrganiser` in
 * `event.submitVerified` creates an organiser carrying nothing but a name each time an event
 * names an unknown one, and new venues arrive the same way. Contact details on *existing*
 * organisers are already handled the moment they are known — `cascadeEventContactToOrganiser`
 * runs on approval — so this is the net that catches what the cascade cannot: a name-derived
 * `venueType` or `organisationType`, and the tags of an organiser whose first events have only
 * now been approved.
 *
 * The artist fill rides the same schedule for the same reason and repairs the same drift:
 * `findOrCreateArtist` makes an artist holding nothing but a name each time an event names an
 * unknown one. `cascadeEventRolesToArtists` handles that on approval, so this is again the net —
 * chiefly an artist whose second concert finally credits an instrument their first did not.
 *
 * Nothing here overwrites, so a run that finds nothing writes nothing.
 */
export async function handler(): Promise<void> {
  console.log('Starting scheduled venue, organiser and artist fill');
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

    // Separate try/catch: the two sweeps share a schedule, not a fate. A failure in the artist
    // scan must not throw away the venue and organiser fills that already landed above.
    try {
      const artists = await Artist.fillArtistInstruments({ apply: true });
      console.log(
        `Scanned ${artists.scanned.artists} artists and ${artists.scanned.junctionRows} credits; ` +
          `filled ${artists.written} instruments (${artists.keptExisting} already set, ` +
          `${artists.noInstrumentInRoles} credited with no instrument, ` +
          `${artists.noAppearances} with no appearance).`
      );
      if (artists.failures.length) {
        console.error(`${artists.failures.length} artists failed to write:`);
        for (const failure of artists.failures) {
          console.error(`  ${failure.name}: ${failure.error}`);
        }
      }
    } catch (error) {
      console.error('Scheduled artist instrument fill failed', error);
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
