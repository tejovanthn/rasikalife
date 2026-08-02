/**
 * Browser-safe exports. Never import the domain's `index.ts` from a route file — it pulls in
 * ElectroDB and the AWS SDK, which use Node-only APIs.
 */
export { checkRevokeLearnerAccess } from './rules';
export type { AccessRow, RevokeCheck } from './rules';
export { ACCESS_RELATIONS, GrantLearnerAccessSchema, REVOKE_REFUSALS } from './schema';
export type { AccessRelation, GrantLearnerAccessInput, RevokeRefusal } from './schema';
