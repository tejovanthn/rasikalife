/**
 * Browser-safe exports. Never import the domain's `index.ts` from a route file — it pulls in
 * ElectroDB and the AWS SDK, which use Node-only APIs.
 */
export {
  CLASS_MODES,
  CreateClassProgramSchema,
  PROGRAM_TYPES,
  SKIP_POLICIES,
  UpdateClassProgramSchema,
  isArchived,
  programDisplayTitle,
} from './schema';
export type {
  ClassMode,
  CreateClassProgramInput,
  ProgramType,
  SkipPolicy,
  UpdateClassProgramInput,
} from './schema';
