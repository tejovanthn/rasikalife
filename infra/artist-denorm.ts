// infra/artist-denorm.ts

import { database } from './database';

// Daily rebuild of the denormalized artist derived-data: repertoire (topCompositions /
// topRagas), featured performances, and collaborators. The profile reads all three fields
// directly, so without a refresh they drift.
//
// Repertoire has no inline maintenance at all. Featured is maintained inline by
// setEventArtistFeatured and collaborators by approveEvent, but in both cases the sweep is
// the safety net rather than a nicety — the inline collaborator rebuild reads an eventually
// consistent GSI right after writing to it, over-cap casts and merges are skipped inline by
// design, and deletes / un-credits / merges are invisible to every inline path.
//
// Kept as its own cron rather than folded into the Instagram sync so the jobs fail
// independently.
//
// The limits carry three sequential full-table sweeps, not two: the collaborator pass scans
// the whole EventArtist junction and the whole Event table, then holds Σ(castSize²) rows
// while it pairs each cast. Both figures are headroom rather than measurements — the first
// production run is worth watching, and the duration/memory metrics say whether they can
// come back down.
new sst.aws.Cron('ArtistDenormRebuildCron', {
  schedule: 'rate(24 hours)',
  job: {
    handler: 'packages/scripts/src/rebuildArtistDenormCron.handler',
    link: [database],
    memory: '2048 MB',
    timeout: '900 seconds',
    environment: {
      DYNAMODB_TABLE: database.name,
    },
  },
});
