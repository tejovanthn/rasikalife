import { z } from 'zod';

export const GrantClassPackSchema = z
  .object({
    programId: z.string().min(1),
    learnerId: z.string().min(1),
    // A zero-credit row records nothing and would still show up in the history as an event
    // that happened. Bounded because a typo in a pack size is otherwise unrecoverable except
    // by a second correcting row.
    delta: z
      .number()
      .int()
      .min(-500)
      .max(500)
      .refine(value => value !== 0, {
        message: 'A pack must add or remove at least one class',
      }),
    reason: z.string().max(500).optional(),
    screenshotKey: z.string().max(500).optional(),
    grantedBy: z.string().min(1),
  })
  /**
   * Taking credits away is the one movement a learner will dispute, so it may not be
   * anonymous. A positive grant needs no justification — the screenshot is the justification.
   */
  .refine(input => input.delta > 0 || Boolean(input.reason?.trim()), {
    message: 'Removing credits needs a reason',
    path: ['reason'],
  });

export type GrantClassPackInput = z.infer<typeof GrantClassPackSchema>;

/**
 * What the credits *should* be, read straight off the rows.
 *
 * The enrollment's `creditsRemaining` is a cache of this minus the consuming sessions. Keeping
 * the sum computable from the ledger is the point of making the rows immutable, and it is what
 * a repair script would use to rebuild a balance that drifted.
 */
export function sumPackDeltas(packs: Array<{ delta: number }>): number {
  return packs.reduce((total, pack) => total + pack.delta, 0);
}

export function isCorrection(pack: { delta: number }): boolean {
  return pack.delta < 0;
}
