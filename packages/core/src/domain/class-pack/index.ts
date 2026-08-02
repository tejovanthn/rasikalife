import { generateId } from '../../utils';
import { ClassLedgerService } from '../class-enrollment/ledger';
import { rejectedIndices } from '../class-enrollment/outcome';
import type { LedgerOutcome } from '../class-enrollment/outcome';
import { ClassPackEntity } from './entity';
import type { ClassPack } from './entity';
import type { GrantClassPackInput } from './schema';

/**
 * Adds credits, or takes them away, as one indivisible act.
 *
 * The row and the running total have to land together. Written as two calls, a crash between
 * them leaves a balance that disagrees with the ledger it is supposed to summarise — and since
 * nothing else ever writes `creditsRemaining`, nothing would ever put it right again.
 *
 * `patch` rather than `update` on the enrollment is doing real work: patch carries an
 * `attribute_exists` condition, so granting a pack to a learner who is not enrolled cancels the
 * transaction instead of conjuring an enrollment row with a balance and no roster entry.
 */
export async function grantClassPack(
  input: GrantClassPackInput
): Promise<LedgerOutcome<ClassPack>> {
  const pack: ClassPack = {
    id: generateId(),
    programId: input.programId,
    learnerId: input.learnerId,
    delta: input.delta,
    reason: input.reason,
    screenshotKey: input.screenshotKey,
    grantedBy: input.grantedBy,
    createdAt: new Date().toISOString(),
  };

  const outcome = await ClassLedgerService.transaction
    .write(({ classPack, classEnrollment }) => [
      classPack.create(pack).commit(),
      classEnrollment
        .patch({ programId: input.programId, learnerId: input.learnerId })
        // `add`, not `set`. An atomic ADD is what makes two gurus granting packs at the same
        // moment produce both packs rather than one, and it treats a missing attribute as
        // zero rather than failing.
        .add({ creditsRemaining: input.delta })
        .commit(),
    ])
    .go();

  if (outcome.canceled) {
    const rejected = rejectedIndices(outcome.data);
    return { applied: false, reason: rejected.includes(1) ? 'no-enrollment' : 'unknown' };
  }

  return { applied: true, result: pack };
}

/** Newest last, matching the sort key, so a history reads top to bottom as it happened. */
export async function listClassPacks(programId: string, learnerId: string): Promise<ClassPack[]> {
  const result = await ClassPackEntity.query.primary({ programId, learnerId }).go({ pages: 'all' });
  return (result.data as ClassPack[]) ?? [];
}

export { ClassPackEntity } from './entity';
export type { ClassPack } from './entity';
export { GrantClassPackSchema, isCorrection, sumPackDeltas } from './schema';
export type { GrantClassPackInput } from './schema';
