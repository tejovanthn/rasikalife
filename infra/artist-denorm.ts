// infra/artist-denorm.ts

import { database } from './database';

// Daily rebuild of the denormalized artist derived-data: repertoire (topCompositions /
// topRagas) and featured performances. The profile reads these fields directly, so without
// a refresh they drift. Repertoire has no inline maintenance; featured is maintained inline
// by setEventArtistFeatured but the sweep is its safety net for deletes / un-credits /
// merges. Kept as its own cron rather than folded into the Instagram sync so the jobs fail
// independently.
new sst.aws.Cron('ArtistDenormRebuildCron', {
  schedule: 'rate(24 hours)',
  job: {
    handler: 'packages/scripts/src/rebuildArtistDenormCron.handler',
    link: [database],
    memory: '1024 MB',
    timeout: '300 seconds',
    environment: {
      DYNAMODB_TABLE: database.name,
    },
  },
});
