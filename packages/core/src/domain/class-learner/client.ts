/**
 * Browser-safe exports. Never import the domain's `index.ts` from a route file — it pulls in
 * ElectroDB and the AWS SDK, which use Node-only APIs.
 */
export {
  CreateClassLearnerSchema,
  UpdateClassLearnerSchema,
  learnerDisplayName,
} from './schema';
export type { CreateClassLearnerInput, UpdateClassLearnerInput } from './schema';
