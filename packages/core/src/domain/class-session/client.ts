/**
 * Browser-safe exports. Never import the domain's `index.ts` from a route file — it pulls in
 * ElectroDB and the AWS SDK, which use Node-only APIs.
 */
export {
  AUTO_CONFIRM_DAYS,
  BULK_CONFIRM_LIMIT,
  ConfirmClassSessionSchema,
  MarkClassSessionSchema,
  SESSION_STATUSES,
  consumesCredit,
  expectedCredits,
  groupSessions,
} from './schema';
export type { ConfirmClassSessionInput, MarkClassSessionInput, SessionStatus } from './schema';
