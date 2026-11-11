import { database } from './database';
import { getDomain } from './domain';
import { siteCacheEnvironment, siteCachePermissions } from './site-cache';
import { bucket } from './storage';

// Google OAuth secrets
const googleClientId = new sst.Secret('GoogleClientId');
const googleClientSecret = new sst.Secret('GoogleClientSecret');

export const auth = new sst.aws.Auth('RasikaAuth', {
  domain: getDomain('auth'),
  issuer: {
    handler: './packages/auth/src/issuer.handler',
    link: [database, googleClientId, googleClientSecret, bucket],
    dev: false,
    // Accepting an owner's invite sets `verifiedAt`, which public pages show as a badge, so the
    // issuer clears the page cache (`invalidateSiteCache`) like a tRPC mutation does.
    permissions: siteCachePermissions,
    environment: {
      ...siteCacheEnvironment,
      DYNAMODB_TABLE: database.name,
      AWS_REGION: undefined,
    },
  },
});
