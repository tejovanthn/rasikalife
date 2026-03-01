import { database } from './database';
import { getDomain } from './domain';
import { bucket } from './storage';

// Google OAuth secrets
const googleClientId = new sst.Secret('GoogleClientId');
const googleClientSecret = new sst.Secret('GoogleClientSecret');

export const auth = new sst.aws.Auth('RasikaAuth', {
  domain: getDomain('auth'),
  issuer: {
    handler: './packages/auth/src/issuer.handler',
    link: [database, googleClientId, googleClientSecret, bucket],
    dev: true,
    environment: {
      DYNAMODB_TABLE: database.name,
      AWS_REGION: undefined,
    },
  },
});
