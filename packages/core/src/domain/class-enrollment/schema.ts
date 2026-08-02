import { z } from 'zod';
import { PROGRAM_TYPES } from '../class-program/schema';

export const ENROLLMENT_STATUSES = ['active', 'ended'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const EnrollLearnerSchema = z.object({
  programId: z.string().min(1),
  learnerId: z.string().min(1),
  institutionId: z.string().min(1),
  learnerName: z.string().min(1).max(200),
  programTitle: z.string().min(1).max(200).optional(),
  programType: z.enum(PROGRAM_TYPES),
});

export type EnrollLearnerInput = z.infer<typeof EnrollLearnerSchema>;

/**
 * How a balance reads to a human.
 *
 * "3 classes over" rather than "-3", because a negative number in a place people look for
 * money reads as a debt owed, and it is not one — it is a workshop that ran long, which is
 * normal and which the guru sorts out in conversation. The soft flag on the roster is the
 * whole enforcement mechanism.
 */
export function creditBalanceLabel(creditsRemaining: number): string {
  if (creditsRemaining < 0) {
    const over = Math.abs(creditsRemaining);
    return `${over} ${over === 1 ? 'class' : 'classes'} over`;
  }
  if (creditsRemaining === 0) {
    return 'No classes left';
  }
  return `${creditsRemaining} ${creditsRemaining === 1 ? 'class' : 'classes'} left`;
}

/** When to nudge. Zero and below is always worth flagging; so is the last class of a pack. */
export function isLowBalance(creditsRemaining: number, threshold = 1): boolean {
  return creditsRemaining <= threshold;
}
