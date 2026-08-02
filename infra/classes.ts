import { auth } from './auth';
import { classUploadsBucket } from './class-uploads';
import { database } from './database';
import { getCookieDomain, getDomain } from './domain';
import { trpc } from './trpc';

/**
 * Rasika Classes — its own React Router app at `classes.rasika.life`.
 *
 * A separate site rather than a route inside `RasikaWeb`, because the two have opposite
 * defaults: the wiki is public, indexed and edge-cached; this is private, `noindex`, and every
 * document is somebody's ledger. Sharing a deployment would mean every caching and robots
 * decision on the main site needing an exception for one subtree.
 *
 * It is **not** linked to `database`. All reads and writes go through `RasikaTRPC`, which is
 * where `assertClassAccess` runs; giving the web tier its own table access would create a
 * second path to the same rows with a different authorisation story. `classUploadsBucket` is
 * linked only so the presigned URLs the tRPC function mints can be resolved by name.
 */
const classesSite = new sst.aws.React('RasikaClasses', {
  link: [trpc, auth, classUploadsBucket],
  path: 'packages/classes/',
  domain: getDomain('classes'),
  environment: {
    STAGE: $app.stage,
    VITE_STAGE: $app.stage,
    // The whole point of the subdomain sharing a sign-in. Both apps read this and set the same
    // cookie domain; without it the session is host-only and every visitor here looks signed out.
    SESSION_COOKIE_DOMAIN: getCookieDomain(),
  },
  server: {
    timeout: '30 seconds',
  },
});

/**
 * Auto-confirm.
 *
 * Daily, not hourly: the deadline is midnight on the seventh day after a class, so a day's
 * granularity is all the ledger asks for. Its own cron rather than folded into the artist
 * denorm sweep so the two fail independently — that one does three full table scans and this
 * one moves money's worth of credit.
 */
new sst.aws.Cron('ClassAutoConfirmCron', {
  schedule: 'rate(24 hours)',
  job: {
    handler: 'packages/scripts/src/autoConfirmClassSessionsCron.handler',
    link: [database],
    memory: '512 MB',
    timeout: '300 seconds',
    environment: {
      DYNAMODB_TABLE: database.name,
    },
  },
});

export { classesSite };
