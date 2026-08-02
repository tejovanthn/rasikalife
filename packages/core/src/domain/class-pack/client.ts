/**
 * Browser-safe exports. Never import the domain's `index.ts` from a route file — it pulls in
 * ElectroDB and the AWS SDK, which use Node-only APIs.
 */
export { GrantClassPackSchema, isCorrection, sumPackDeltas } from './schema';
export type { GrantClassPackInput } from './schema';
