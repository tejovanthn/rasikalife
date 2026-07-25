// infra/repertoire.ts

import { database } from './database';

// Daily rebuild of the denormalized artist repertoire (topCompositions / topRagas).
// The profile reads those fields directly, so without a refresh they drift as new
// concerts are logged. Featured performances are maintained inline by
// setEventArtistFeatured, so only repertoire needs a schedule. Kept as its own cron
// rather than folded into the Instagram sync so the two jobs fail independently.
new sst.aws.Cron('RepertoireRebuildCron', {
  schedule: 'rate(24 hours)',
  job: {
    handler: 'packages/scripts/src/rebuildRepertoireCron.handler',
    link: [database],
    memory: '1024 MB',
    timeout: '300 seconds',
    environment: {
      DYNAMODB_TABLE: database.name,
    },
  },
});
