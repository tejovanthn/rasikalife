// infra/venue-organiser-enrich.ts

import { database } from './database';

// Weekly fill of the derivable venue and organiser fields: `venueType` and `organisationType`
// from the name, and an organiser's contact details and tags from the events they ran.
//
// Weekly rather than daily because the drift is slow. `resolveOrganiser` in
// `event.submitVerified` creates an organiser holding nothing but a name every time an event
// names an unknown one, and venues arrive the same way — that is what left 108 of 109
// organisers bare. Contact details on organisers that already exist are handled the moment
// they are known, by `cascadeEventContactToOrganiser` on approval, so this sweep is the net
// for what the cascade cannot see rather than the main path.
//
// Its own cron rather than folded into ArtistDenormRebuildCron so the jobs fail independently,
// and because this one is cheap by comparison: three plain table scans and, after the initial
// backfill, a handful of writes. Nothing here overwrites, so a run that finds nothing writes
// nothing.
//
// No reindex — SearchIndexCron already rebuilds every 6 hours.
new sst.aws.Cron('VenueOrganiserEnrichCron', {
  schedule: 'rate(7 days)',
  job: {
    handler: 'packages/scripts/src/enrichVenuesOrganisersCron.handler',
    link: [database],
    memory: '1024 MB',
    timeout: '600 seconds',
    environment: {
      DYNAMODB_TABLE: database.name,
    },
  },
});
