import { enrollLearner } from '../class-enrollment';
import { createClassLearner, getClassLearner, learnerDisplayName } from '../class-learner';
import { grantLearnerAccess } from '../class-learner-access';
import { getClassProgram } from '../class-program';
import type { ClassInvite } from './entity';
import { listUnclaimedInvites, markInviteClaimed } from './index';

/**
 * Turns every unclaimed invite for an address into real access, at sign-in.
 *
 * Run on **every** sign-in, not just the first. Existing students get invited to new programs
 * later, and a first-sign-in-only check drops those silently — the student opens the app they
 * already had, sees nothing new, and nobody has an error to look at.
 *
 * ## Why the invite is claimed *before* the work is done
 *
 * The obvious order is the other one: do the work, then mark it claimed, so a crash leaves the
 * invite to be retried. That is wrong here, because the retry is not idempotent in the case that
 * matters. `grantLearnerAccess` and `enrollLearner` are both puts on a known key and can run
 * twice harmlessly — but `createClassLearner` mints a KSUID, so a second pass produces a second
 * child with the same name, a second enrollment and a second balance. Splitting a family's
 * history across two records is far worse than an invite that did nothing, and much harder to
 * notice.
 *
 * So: claim first, conditionally (`markInviteClaimed` refuses a second claim, which is also what
 * stops two tabs signing in at once from both running this), then do the work. A failure after
 * the claim leaves an invite that achieved nothing — the student says the app is empty, and the
 * guru re-invites.
 */
export type ClaimedInvite = {
  inviteId: string;
  learnerId: string;
  programId?: string;
  createdLearner: boolean;
};

export async function claimClassInvites(input: {
  userId: string;
  email: string;
}): Promise<ClaimedInvite[]> {
  const invites = await listUnclaimedInvites(input.email);
  const claimed: ClaimedInvite[] = [];

  for (const invite of invites) {
    const held = await markInviteClaimed(invite.normalizedEmail, invite.id, input.userId);
    if (!held) {
      // Another tab got there first. Its pass does the work.
      continue;
    }

    const result = await applyInvite(invite, input.userId);
    if (result) {
      claimed.push(result);
    }
  }

  return claimed;
}

async function applyInvite(invite: ClassInvite, userId: string): Promise<ClaimedInvite | null> {
  const existingLearnerId = invite.learnerId;

  if (existingLearnerId) {
    // Adding an account to a learner that already exists: a second guardian, or the young adult
    // getting their own row beside the guardian's. The enrollment is already there.
    const learner = await getClassLearner(existingLearnerId);
    if (!learner) {
      return null;
    }
    await grantLearnerAccess({
      learnerId: existingLearnerId,
      userId,
      relation: invite.relation,
    });
    return {
      inviteId: invite.id,
      learnerId: existingLearnerId,
      programId: invite.programId,
      createdLearner: false,
    };
  }

  if (!invite.learnerName) {
    // Neither handle. The schema forbids it, so this is a row written before the schema or by
    // hand — nothing sensible to do with it.
    return null;
  }

  const learner = await createClassLearner({
    institutionId: invite.institutionId,
    firstName: invite.learnerName,
    // Unknown, and not worth guessing. A guru who is inviting a child sets the flag on the
    // roster; defaulting to true here would block her removing her own access by mistake.
    isMinor: false,
  });

  await grantLearnerAccess({ learnerId: learner.id, userId, relation: invite.relation });

  if (invite.programId) {
    const program = await getClassProgram(invite.programId);
    if (program) {
      await enrollLearner({
        programId: invite.programId,
        learnerId: learner.id,
        institutionId: invite.institutionId,
        learnerName: learnerDisplayName(learner),
        programTitle: program.title,
        programType: program.type,
      });
    }
  }

  return {
    inviteId: invite.id,
    learnerId: learner.id,
    programId: invite.programId,
    createdLearner: true,
  };
}
