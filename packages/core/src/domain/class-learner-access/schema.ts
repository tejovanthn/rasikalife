import { z } from 'zod';

/** Also used by `classInvite`, so a claimed invite and a direct grant cannot disagree. */
export const ACCESS_RELATIONS = ['self', 'guardian'] as const;

export type AccessRelation = (typeof ACCESS_RELATIONS)[number];

export const GrantLearnerAccessSchema = z.object({
  learnerId: z.string().min(1),
  userId: z.string().min(1),
  relation: z.enum(ACCESS_RELATIONS),
});

export type GrantLearnerAccessInput = z.infer<typeof GrantLearnerAccessSchema>;

/** Why a revoke was refused. The caller turns these into a message; the rule lives here. */
export const REVOKE_REFUSALS = {
  notFound: 'That account does not have access to this learner',
  lastAccess: 'A learner must keep at least one account with access',
  lastGuardianOfMinor: 'A learner under 18 must keep at least one guardian',
  selfCannotRemoveGuardian: 'A student cannot remove their own guardian',
} as const;

export type RevokeRefusal = keyof typeof REVOKE_REFUSALS;
