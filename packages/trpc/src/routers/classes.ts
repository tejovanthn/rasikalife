import {
  ClassEnrollment,
  ClassInstitution,
  ClassInvite,
  ClassLearner,
  ClassLearnerAccess,
  ClassPack,
  ClassProgram,
  ClassSession,
  ClassTeacher,
  Email,
  PrivateImage,
} from '@rasika/core';
import { addDaysToDate, todayInTimeZone } from '@rasika/core/shared/timezone';
import { studentAddedEmail } from '@rasika/email';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import {
  assertClassAccess,
  assertEnrollmentAccess,
  assertTeacher,
  institutionTimezone,
} from './classes-access';

const programId = z.string().min(1);
const learnerId = z.string().min(1);
const institutionId = z.string().min(1);

const sessionRefInput = z.object({
  programId,
  learnerId,
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  id: z.string().min(1),
});

/**
 * The guru's own institution, created on first use.
 *
 * Onboarding a guru is "add your first student", not "set up your organisation" — the word never
 * appears in the UI. So every teacher write goes through this rather than failing on a missing
 * record.
 */
/**
 * Fills in the `institutionId` a session transition needs to re-format its keys.
 *
 * Derived from the program rather than taken from the request. A client-supplied value would not
 * corrupt anything — ElectroDB guards it with a condition — but a wrong one cancels the
 * transaction as `ConditionalCheckFailed`, which is indistinguishable from "somebody already
 * confirmed this" and would be reported as such.
 *
 * Memoized per call because a bulk confirm of fifty rows is usually one or two programs, and
 * `assertClassAccess` also re-checks teaching at whichever institution the program really
 * belongs to — so a ref smuggled in from elsewhere is refused rather than merely mis-keyed.
 */
async function withInstitution<T extends { programId: string; learnerId: string }>(
  ctx: { user: { id: string } },
  refs: T[]
): Promise<Array<T & { institutionId: string }>> {
  const byProgram = new Map<string, Promise<string>>();

  return Promise.all(
    refs.map(async ref => {
      let resolved = byProgram.get(ref.programId);
      if (!resolved) {
        resolved = assertClassAccess(ctx, { programId: ref.programId }).then(
          actor => actor.institutionId
        );
        byProgram.set(ref.programId, resolved);
      }
      return { ...ref, institutionId: await resolved };
    })
  );
}

async function ensureOwnInstitution(user: { id: string; name: string }) {
  return ClassInstitution.ensureClassInstitution({
    ownerUserId: user.id,
    name: user.name || 'My classes',
  });
}

/**
 * Best-effort: the invite is already saved by the time this runs, so a send failure must not
 * fail the mutation. The student still shows up on the roster; they just don't hear about it
 * until they check the address themselves.
 */
async function sendStudentAddedEmail(input: {
  to: string;
  learnerName: string;
  guruName: string;
  institutionId: string;
  programTitle: string;
  relation: ClassLearnerAccess.AccessRelation;
}) {
  try {
    const institution = await ClassInstitution.getClassInstitution(input.institutionId);
    const content = await studentAddedEmail({
      learnerName: input.learnerName,
      guruName: input.guruName,
      institutionName: institution?.name ?? 'Rasika Classes',
      programTitle: input.programTitle,
      relation: input.relation,
      recipientEmail: input.to,
      signInUrl: `${process.env.CLASSES_URL}/`,
    });
    await Email.sendTransactional({ to: input.to, ...content });
  } catch (error) {
    console.error('[classes] Failed to send student-added email', error);
  }
}

export const classesRouter = createTRPCRouter({
  // ---------------------------------------------------------------- teacher: institution

  myInstitution: protectedProcedure.query(async ({ ctx }) => {
    const owned = await ClassInstitution.listInstitutionsByOwner(ctx.user.id);
    return owned[0] ?? null;
  }),

  ensureInstitution: protectedProcedure.mutation(({ ctx }) => ensureOwnInstitution(ctx.user)),

  /**
   * Every context this sign-in has. Powers both the resolver and the switcher.
   *
   * Teaching comes from the `classTeacher` junction rather than `byOwner`, which is the whole
   * point of that entity: a co-teacher owns nothing, and resolving on ownership alone would send
   * them to the "do you teach?" screen for ever.
   *
   * Two queries and a fan-out of gets for learner names. It runs on every page load, so it is
   * worth knowing the shape: the teaching side costs one query because the institution name is
   * denormalized onto the junction, and the learner side costs one query plus one get per
   * learner — bounded by how many children one parent has.
   */
  getMyContexts: protectedProcedure.query(async ({ ctx }) => {
    const [teaching, access] = await Promise.all([
      ClassTeacher.listUserTeaching(ctx.user.id),
      ClassLearnerAccess.listUserLearnerAccess(ctx.user.id),
    ]);

    const learners = await Promise.all(
      access.map(async row => {
        const learner = await ClassLearner.getClassLearner(row.learnerId);
        return learner
          ? {
              id: learner.id,
              name: ClassLearner.learnerDisplayName(learner),
              isMinor: learner.isMinor,
              relation: row.relation,
            }
          : null;
      })
    );

    return {
      teaching: teaching.map(row => ({
        institutionId: row.institutionId,
        name: row.institutionName,
        isOwner: row.role === 'owner',
      })),
      // A row whose learner has been deleted is dropped rather than rendered — the switcher
      // must never offer a context that navigates to a 404.
      learners: learners.filter((l): l is NonNullable<typeof l> => l !== null),
    };
  }),

  /**
   * Step 1 of guru onboarding. Refuses a second institution.
   *
   * Not `ensureInstitution`: that one is idempotent by design and is the safety net under any
   * teaching write. This is the deliberate, named act, and it says no rather than silently
   * handing back the existing one — a guru who taps twice should learn that they already have
   * one, not be left wondering which of two they are looking at. Multiple institutions per
   * teacher is deferred (§A8) and nothing should create the second one by accident.
   */
  createInstitution: protectedProcedure
    .input(
      z.object({ name: z.string().min(1).max(200), timezone: z.string().min(1).max(64).optional() })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ClassInstitution.listInstitutionsByOwner(ctx.user.id);
      if (existing.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You already have a set of classes',
        });
      }
      return ClassInstitution.createClassInstitution({
        ownerUserId: ctx.user.id,
        name: input.name,
        timezone: input.timezone ?? 'Asia/Kolkata',
      });
    }),

  /**
   * Which of the three onboarding steps remain.
   *
   * Read from the records themselves rather than from a stored progress flag, so a guru who
   * abandons after step 1 and returns a week later resumes at step 2 — and one who created a
   * program by some other route is never asked to create another.
   */
  onboardingState: protectedProcedure.query(async ({ ctx }) => {
    const owned = await ClassInstitution.listInstitutionsByOwner(ctx.user.id);
    const institution = owned[0] ?? null;
    if (!institution) {
      return { step: 1 as const, institution: null, programCount: 0, learnerCount: 0 };
    }

    const [programs, learners] = await Promise.all([
      ClassProgram.listInstitutionPrograms(institution.id, { includeArchived: true }),
      ClassLearner.listInstitutionLearners(institution.id),
    ]);

    const step =
      programs.length === 0 ? (2 as const) : learners.length === 0 ? (3 as const) : (0 as const);
    return {
      step,
      institution,
      programCount: programs.length,
      learnerCount: learners.length,
      firstProgramId: programs[0]?.id ?? null,
    };
  }),

  updateInstitution: protectedProcedure
    .input(
      z.object({
        institutionId,
        name: z.string().min(1).max(200).optional(),
        timezone: z.string().min(1).max(64).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertTeacher(ctx, { institutionId: input.institutionId });
      return ClassInstitution.updateClassInstitution(input.institutionId, {
        name: input.name,
        timezone: input.timezone,
      });
    }),

  // ---------------------------------------------------------------- teacher: programs

  programs: protectedProcedure
    .input(z.object({ institutionId, includeArchived: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      await assertTeacher(ctx, { institutionId: input.institutionId });
      return ClassProgram.listInstitutionPrograms(input.institutionId, {
        includeArchived: input.includeArchived,
      });
    }),

  /** One program by id. The roster page needs exactly this and used to list them all to get it. */
  program: protectedProcedure.input(z.object({ programId })).query(async ({ ctx, input }) => {
    await assertClassAccess(ctx, { programId: input.programId });
    return ClassProgram.getClassProgram(input.programId);
  }),

  createProgram: protectedProcedure
    .input(ClassProgram.CreateClassProgramSchema)
    .mutation(async ({ ctx, input }) => {
      await assertTeacher(ctx, { institutionId: input.institutionId });
      return ClassProgram.createClassProgram(input);
    }),

  updateProgram: protectedProcedure
    .input(
      z.object({
        programId,
        patch: ClassProgram.UpdateClassProgramSchema,
        // Named, because `undefined` cannot tell "not submitted" apart from "submitted blank".
        clear: z.array(z.enum(ClassProgram.CLEARABLE_PROGRAM_FIELDS)).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertTeacher(ctx, { programId: input.programId });
      const updated = await ClassProgram.updateClassProgram(
        input.programId,
        input.patch,
        input.clear
      );
      // The roster shows a denormalized title, so a rename that stopped here would leave every
      // student's card naming the old thing — and a *cleared* title has to reach the junction's
      // `.remove` branch, which it never did while the clear silently failed upstream.
      if (updated && ('title' in input.patch || input.clear.includes('title'))) {
        await ClassEnrollment.cascadeProgramTitleUpdate(input.programId, updated.title);
      }
      return updated;
    }),

  archiveProgram: protectedProcedure
    .input(z.object({ programId, archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertTeacher(ctx, { programId: input.programId });
      return input.archived
        ? ClassProgram.archiveClassProgram(input.programId)
        : ClassProgram.unarchiveClassProgram(input.programId);
    }),

  // ---------------------------------------------------------------- teacher: roster

  /**
   * The roster table: one row per learner, with the three columns the guru scans.
   *
   * `lastSessionDate` and `lastPaidAt` are read off the enrollment rather than derived, so this
   * is one query for the whole table — the alternative was two per learner, which on a
   * twelve-person workshop is twenty-four reads to draw one screen.
   */
  roster: protectedProcedure
    .input(z.object({ programId, activeOnly: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      await assertTeacher(ctx, { programId: input.programId });
      return ClassEnrollment.listProgramEnrollments(input.programId, {
        activeOnly: input.activeOnly,
      });
    }),

  /**
   * Adds a learner to a program and invites the account that will watch it.
   *
   * The learner and the enrollment are created **now**, not when the invite is claimed. The plan
   * described the other order, and it does not survive contact with the sequence: money changes
   * hands first, so the guru needs to grant a pack against a roster row before the student has
   * ever opened the app. Deferring creation would leave her with nothing to grant against.
   *
   * The invite therefore carries `learnerId`, which is the same shape the young-adult and
   * second-guardian flows use. The `learnerName` branch of the claim stays supported for an
   * invite created any other way.
   */
  addLearner: protectedProcedure
    .input(
      z.object({
        programId,
        firstName: z.string().min(1).max(80),
        lastInitial: z.string().max(4).optional(),
        isMinor: z.boolean().default(false),
        /**
         * Required, where it used to be optional.
         *
         * A learner created without one had **no access rows at all** — nobody could see it,
         * which quietly broke the rule that every learner keeps at least one account with access.
         * The guru got a roster row she could grant packs against and the family got nothing, with
         * no error anywhere to say so.
         */
        email: z.string().email().max(254),
        relation: z.enum(ClassLearnerAccess.ACCESS_RELATIONS).default('guardian'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = await assertTeacher(ctx, { programId: input.programId });
      const program = await ClassProgram.getClassProgram(input.programId);
      if (!program) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Program not found' });
      }

      const learner = await ClassLearner.createClassLearner({
        institutionId: actor.institutionId,
        firstName: input.firstName,
        lastInitial: input.lastInitial,
        isMinor: input.isMinor,
      });

      const enrollment = await ClassEnrollment.enrollLearner({
        programId: input.programId,
        learnerId: learner.id,
        institutionId: actor.institutionId,
        learnerName: ClassLearner.learnerDisplayName(learner),
        programTitle: program.title,
        programType: program.type,
      });

      const invite = await ClassInvite.createClassInvite({
        email: input.email,
        institutionId: actor.institutionId,
        programId: input.programId,
        learnerId: learner.id,
        relation: input.relation,
        invitedBy: ctx.user.id,
      });

      await sendStudentAddedEmail({
        to: invite.rawEmail,
        learnerName: ClassLearner.learnerDisplayName(learner),
        guruName: ctx.user.name,
        institutionId: actor.institutionId,
        programTitle: ClassProgram.programDisplayTitle(program),
        relation: input.relation,
      });

      return { learner, enrollment, invite };
    }),

  updateLearner: protectedProcedure
    .input(z.object({ learnerId, patch: ClassLearner.UpdateClassLearnerSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertTeacher(ctx, { learnerId: input.learnerId });
      const updated = await ClassLearner.updateClassLearner(input.learnerId, input.patch);
      if (updated) {
        await ClassEnrollment.cascadeLearnerNameUpdate(
          input.learnerId,
          ClassLearner.learnerDisplayName(updated)
        );
      }
      return updated;
    }),

  endEnrollment: protectedProcedure
    .input(z.object({ programId, learnerId, status: z.enum(ClassEnrollment.ENROLLMENT_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      await assertTeacher(ctx, { programId: input.programId });
      return ClassEnrollment.setEnrollmentStatus(input.programId, input.learnerId, input.status);
    }),

  invites: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      // A teacher may look up what is outstanding for an address they invited; anyone may look
      // up their own. Nothing else, because the reply names learners and institutions.
      const invites = await ClassInvite.listInvitesForEmail(input.email);
      const isOwnAddress =
        ClassInvite.normalizeInviteEmail(ctx.user.email) ===
        ClassInvite.normalizeInviteEmail(input.email);
      if (isOwnAddress) {
        return invites;
      }
      const owned = await ClassInstitution.listInstitutionsByOwner(ctx.user.id);
      const ownedIds = new Set(owned.map(i => i.id));
      return invites.filter(invite => ownedIds.has(invite.institutionId));
    }),

  /**
   * Which of this institution's invites are still waiting on somebody to sign in.
   *
   * Read off the new by-institution index rather than by address, because the guru does not know
   * the address she is looking for — that is the whole point of asking.
   */
  outstandingInvites: protectedProcedure
    .input(z.object({ institutionId }))
    .query(async ({ ctx, input }) => {
      await assertTeacher(ctx, { institutionId: input.institutionId });
      return ClassInvite.listOutstandingInvites(input.institutionId);
    }),

  /**
   * Corrects the address a learner was invited at.
   *
   * Withdraws the outstanding invite and sends a new one, which is what "change the email" means
   * while nobody has signed in: the old address never gains access and the new one does.
   *
   * It refuses once an invite has been **claimed**, rather than doing something clever. At that
   * point a real person holds access, and silently revoking it because a guru retyped an address
   * would take a family's session notes away without saying so. Adding a second account and
   * removing the first are two deliberate acts, and there are two procedures for them.
   */
  changeLearnerEmail: protectedProcedure
    .input(z.object({ learnerId, email: z.string().email().max(254) }))
    .mutation(async ({ ctx, input }) => {
      const actor = await assertTeacher(ctx, { learnerId: input.learnerId });

      const outstanding = await ClassInvite.listOutstandingInvites(actor.institutionId);
      const forLearner = outstanding.filter(invite => invite.learnerId === input.learnerId);

      if (forLearner.length === 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'That invitation has already been accepted. Invite the new address, then remove the old one.',
        });
      }

      const [first] = forLearner;
      await Promise.all(
        forLearner.map(invite => ClassInvite.deleteClassInvite(invite.normalizedEmail, invite.id))
      );

      return ClassInvite.createClassInvite({
        email: input.email,
        institutionId: actor.institutionId,
        programId: first?.programId,
        learnerId: input.learnerId,
        relation: first?.relation ?? 'guardian',
        invitedBy: ctx.user.id,
      });
    }),

  revokeInvite: protectedProcedure
    .input(z.object({ normalizedEmail: z.string().min(1), id: z.string().min(1), institutionId }))
    .mutation(async ({ ctx, input }) => {
      await assertTeacher(ctx, { institutionId: input.institutionId });

      // The row decides, not the request. `assertTeacher` only proves the caller teaches at the
      // institution they *named*; without this, any teacher could delete any other guru's
      // outstanding invite given its email and id, and neither party would see anything — the
      // student would simply never gain access.
      const invites = await ClassInvite.listInvitesForEmail(input.normalizedEmail);
      const invite = invites.find(row => row.id === input.id);
      if (!invite || invite.institutionId !== input.institutionId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invite not found' });
      }

      await ClassInvite.deleteClassInvite(input.normalizedEmail, input.id);
      return { ok: true };
    }),

  // ---------------------------------------------------------------- credits

  packs: protectedProcedure
    .input(z.object({ programId, learnerId }))
    .query(async ({ ctx, input }) => {
      await assertEnrollmentAccess(ctx, input);
      return ClassPack.listClassPacks(input.programId, input.learnerId);
    }),

  grantPack: protectedProcedure
    .input(ClassPack.GrantClassPackRequestSchema)
    .mutation(async ({ ctx, input }) => {
      // Teacher only. A learner viewer topping up their own balance is the one write that would
      // make the ledger worthless.
      const actor = await assertTeacher(ctx, { programId: input.programId });

      /**
       * A screenshot key is accepted from the client, so it has to be *proved* rather than
       * trusted. Without this, a teacher could attach another institution's key to their own
       * pack row and `screenshotUrl` would then sign a GET for it — the read path checks who may
       * see the row, and the row is exactly what this would have poisoned.
       */
      if (
        input.screenshotKey &&
        !PrivateImage.isKeyOwnedBy('classes', actor.institutionId, input.screenshotKey)
      ) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'That upload is not yours' });
      }

      const outcome = await ClassPack.grantClassPack({ ...input, grantedBy: ctx.user.id });
      if (!outcome.applied) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            outcome.reason === 'no-enrollment'
              ? 'That learner is not enrolled on this program'
              : 'Could not record the pack',
        });
      }
      return outcome.result;
    }),

  /**
   * A presigned PUT into the private bucket.
   *
   * Teacher only, because the guru is the one holding the screenshot the student sent her over
   * WhatsApp. Returns a key, never a URL — see `PrivateImage` for why the two uploaders are kept
   * apart.
   */
  screenshotUploadUrl: protectedProcedure
    .input(
      z.object({
        institutionId,
        fileName: z.string().min(1).max(200),
        contentType: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertTeacher(ctx, { institutionId: input.institutionId });
      if (!PrivateImage.isAllowedPrivateContentType(input.contentType)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'That file type is not supported' });
      }
      // Keys are prefixed with the institution, which is what makes the ownership check on
      // `grantPack` possible at all.
      return PrivateImage.getPrivateUploadUrl(
        'classes',
        input.institutionId,
        input.fileName,
        input.contentType
      );
    }),

  /**
   * A short-lived signed GET, handed out only after the access check.
   *
   * The key is re-read from the pack row rather than taken from the client. A caller who could
   * pass their own key would get a signature for any object in the bucket, which is the entire
   * access control undone by one parameter.
   */
  screenshotUrl: protectedProcedure
    .input(z.object({ programId, learnerId, packId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertEnrollmentAccess(ctx, input);
      const packs = await ClassPack.listClassPacks(input.programId, input.learnerId);
      const pack = packs.find(p => p.id === input.packId);
      if (!pack?.screenshotKey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No screenshot on that payment' });
      }
      return { url: await PrivateImage.getPrivateDownloadUrl('classes', pack.screenshotKey) };
    }),

  // ---------------------------------------------------------------- sessions

  /**
   * The student marks today's class attended.
   *
   * `sessionDate` is computed here from the *institution's* zone and is never taken from the
   * client. A student in California pressing this at 9pm Monday is marking the teacher's
   * Tuesday, and the ledger has to agree with the teacher. Taking it as input would also let a
   * client fabricate history.
   */
  markAttended: protectedProcedure
    .input(
      z.object({
        programId,
        learnerId,
        mode: z.enum(ClassProgram.CLASS_MODES).optional(),
        notes: z.string().max(2000).optional(),
        // Optional, and bounded below. Defaults to today on the teacher's wall.
        sessionDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { actor, enrollment } = await assertEnrollmentAccess(ctx, input);
      const program = await ClassProgram.getClassProgram(input.programId);
      if (!program) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Program not found' });
      }

      const timezone = await institutionTimezone(actor.institutionId);
      const today = todayInTimeZone(timezone);

      /**
       * A learner may name an earlier date, within a month, and never a later one.
       *
       * This used to be computed server-side full stop, on the reasoning that taking it from the
       * client lets someone fabricate history. The reasoning was half right: the *future* is
       * fabrication and stays refused, but "I forgot to mark Tuesday" is the ordinary case and
       * refusing it made the student's only honest option to mark the wrong day.
       *
       * What makes the past safe is the thing that was always there: the row lands `pending` and
       * the guru sees it in her review queue with the date on it. The bound stops a backdate
       * reaching a pack she settled months ago; a month is longer than the seven-day
       * auto-confirm window, so anything older is a conversation rather than a form.
       */
      const requested = input.sessionDate ?? today;
      const earliest = addDaysToDate(today, -31);
      if (requested > today) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A class cannot be marked before it has happened',
        });
      }
      if (requested < earliest) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'That is too long ago — ask your guru to add it',
        });
      }
      const sessionDate = requested;

      /**
       * One mark per learner per day, returned rather than refused.
       *
       * Nothing stopped a second one: `markClassSession` mints a fresh KSUID, so the sort key
       * `SESSION#${sessionDate}#${id}` never collides and a double submission produced two
       * `pending` rows — two queue rows for the guru, or two credits taken by the cron a week
       * later for one class. The whole transition path is guarded against double-decrement
       * precisely to prevent that, and creation was the unguarded end of it.
       *
       * Idempotent rather than an error, because the student's intent is "today happened" and
       * they should see that state, not a complaint. A settled row is left alone: if the guru
       * already marked them absent, re-marking must not quietly reopen it.
       *
       * A read-then-write, so two genuinely simultaneous taps can still both land. That is a far
       * smaller window than the one it closes, and the guru sees the duplicate in her queue.
       */
      const marked = await ClassSession.listLearnerSessions(input.programId, input.learnerId);
      const existing = marked.find(session => session.sessionDate === sessionDate);
      if (existing) {
        return existing;
      }

      return ClassSession.markClassSession({
        programId: input.programId,
        learnerId: input.learnerId,
        institutionId: actor.institutionId,
        sessionDate,
        startsAt: new Date().toISOString(),
        timezone,
        mode: input.mode ?? program.defaultMode,
        teacherId: program.defaultTeacherId,
        notes: input.notes,
        programTitle: enrollment.programTitle,
        programType: enrollment.programType,
        markedBy: ctx.user.id,
      });
    }),

  /**
   * The guru records a class for one learner, already settled.
   *
   * `markAttended` is the *student's* path: it lands `pending`, because the guru has the final
   * say and has not looked at it yet. When she is the one recording it there is nobody left to
   * ask, so leaving it pending would put her own entry in her own review queue — which is exactly
   * what the ledger's "Add class" did while its description promised the opposite.
   *
   * Two writes rather than one, deliberately: it creates through `markClassSession` and settles
   * through `confirmClassSession`, so the credit still moves inside the guarded transaction that
   * every other confirmation uses. A create that wrote `confirmed` directly would be a second way
   * to spend a credit, and the first way is the one with the conditional on it.
   *
   * If the confirm loses — the session already settled between the two writes — the row stays
   * pending and shows up in her queue, which is a visible outcome rather than a lost class.
   */
  markClassForLearner: protectedProcedure
    .input(
      z.object({
        programId,
        learnerId,
        sessionDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        mode: z.enum(ClassProgram.CLASS_MODES).optional(),
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = await assertTeacher(ctx, { programId: input.programId });
      const [program, enrollment] = await Promise.all([
        ClassProgram.getClassProgram(input.programId),
        ClassEnrollment.getEnrollment(input.programId, input.learnerId),
      ]);
      if (!program || !enrollment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'That learner is not on this class' });
      }

      const timezone = await institutionTimezone(actor.institutionId);
      const today = todayInTimeZone(timezone);
      const sessionDate = input.sessionDate ?? today;

      // She may reconstruct the past — she is doing this because somebody forgot — but not the
      // future, which is the one date that cannot describe a class that happened.
      if (sessionDate > today) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A class cannot be recorded before it has happened',
        });
      }

      // Same guard as the student's path: one class per learner per day, and an existing row is
      // returned rather than duplicated.
      const marked = await ClassSession.listLearnerSessions(input.programId, input.learnerId);
      const existing = marked.find(session => session.sessionDate === sessionDate);
      if (existing) {
        return existing;
      }

      const session = await ClassSession.markClassSession({
        programId: input.programId,
        learnerId: input.learnerId,
        institutionId: actor.institutionId,
        sessionDate,
        startsAt: input.sessionDate ? undefined : new Date().toISOString(),
        timezone,
        mode: input.mode ?? program.defaultMode,
        teacherId: program.defaultTeacherId,
        notes: input.notes,
        programTitle: enrollment.programTitle,
        programType: enrollment.programType,
        markedBy: ctx.user.id,
      });

      await ClassSession.confirmClassSession(ClassSession.sessionRef(session), {
        confirmedBy: ctx.user.id,
        notes: input.notes,
      });

      return session;
    }),

  /**
   * The guru marks a group class, which fans out to one row per active enrollment.
   *
   * A teacher may name the date, because she is reconstructing last Tuesday from memory. A
   * student may not — see `markAttended`.
   */
  markGroupSession: protectedProcedure
    .input(
      z.object({
        programId,
        sessionDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        mode: z.enum(ClassProgram.CLASS_MODES).optional(),
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = await assertTeacher(ctx, { programId: input.programId });
      const program = await ClassProgram.getClassProgram(input.programId);
      if (!program) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Program not found' });
      }

      const timezone = await institutionTimezone(actor.institutionId);
      return ClassSession.markGroupClassSession({
        programId: input.programId,
        institutionId: actor.institutionId,
        sessionDate: input.sessionDate ?? todayInTimeZone(timezone),
        timezone,
        mode: input.mode ?? program.defaultMode,
        teacherId: program.defaultTeacherId,
        notes: input.notes,
        programTitle: program.title,
        programType: program.type,
        markedBy: ctx.user.id,
      });
    }),

  sessions: protectedProcedure
    .input(z.object({ programId, learnerId }))
    .query(async ({ ctx, input }) => {
      await assertEnrollmentAccess(ctx, input);
      const sessions = await ClassSession.listLearnerSessions(input.programId, input.learnerId);
      return [...sessions].reverse();
    }),

  /**
   * The review queue, with learner names resolved.
   *
   * A session row carries `programTitle` but not a learner name, and a queue of KSUIDs is
   * useless. Rather than denormalizing another field onto every session — one more thing for a
   * rename to have to cascade to — the names come from one extra query over the institution's
   * learners, which is a small list by construction.
   */
  reviewQueue: protectedProcedure
    .input(z.object({ institutionId }))
    .query(async ({ ctx, input }) => {
      await assertTeacher(ctx, { institutionId: input.institutionId });
      const [sessions, learners] = await Promise.all([
        ClassSession.listPendingSessions(input.institutionId),
        ClassLearner.listInstitutionLearners(input.institutionId),
      ]);
      const names = new Map(
        learners.map(learner => [learner.id, ClassLearner.learnerDisplayName(learner)])
      );
      return sessions.map(session => ({
        ...session,
        learnerName: names.get(session.learnerId) ?? 'Student',
      }));
    }),

  confirmSessions: protectedProcedure
    .input(
      z.object({
        institutionId,
        refs: z.array(sessionRefInput).min(1).max(ClassSession.BULK_CONFIRM_LIMIT),
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertTeacher(ctx, { institutionId: input.institutionId });
      // Optional — see `ConfirmClassSessionSchema` for why a required note bought "ok" and
      // "done" rather than anything worth reading.
      const refs = await withInstitution(ctx, input.refs);
      const results = await ClassSession.confirmClassSessions(refs, {
        confirmedBy: ctx.user.id,
        notes: input.notes,
      });
      return results.map(result => ({
        id: result.ref.id,
        applied: result.applied,
        reason: result.applied ? null : result.reason,
      }));
    }),

  disputeSession: protectedProcedure
    .input(
      z.object({ institutionId, ref: sessionRefInput, notes: z.string().max(2000).optional() })
    )
    .mutation(async ({ ctx, input }) => {
      await assertTeacher(ctx, { institutionId: input.institutionId });
      const [ref] = await withInstitution(ctx, [input.ref]);
      if (!ref) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
      }
      return ClassSession.disputeClassSession(ref, {
        confirmedBy: ctx.user.id,
        notes: input.notes,
      });
    }),

  markAbsent: protectedProcedure
    .input(
      z.object({ institutionId, ref: sessionRefInput, notes: z.string().max(2000).optional() })
    )
    .mutation(async ({ ctx, input }) => {
      await assertTeacher(ctx, { institutionId: input.institutionId });
      const program = await ClassProgram.getClassProgram(input.ref.programId);
      if (!program) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Program not found' });
      }
      const [ref] = await withInstitution(ctx, [input.ref]);
      if (!ref) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
      }
      // The policy is read from the program, never sent by the client — it decides whether a
      // credit burns, so it is not the caller's to assert.
      return ClassSession.markClassSessionAbsent(ref, {
        confirmedBy: ctx.user.id,
        notes: input.notes,
        skipPolicy: program.skipPolicy,
      });
    }),

  groupSessions: protectedProcedure
    .input(z.object({ institutionId, groupSessionId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertTeacher(ctx, { institutionId: input.institutionId });
      const rows = await ClassSession.listGroupSessions(input.groupSessionId);
      // The group id came from the client, so the rows have to be checked rather than trusted.
      return rows.filter(row => row.institutionId === input.institutionId);
    }),

  // ---------------------------------------------------------------- learner side

  /** Every learner this sign-in can see. One means no profile switcher. */
  myLearners: protectedProcedure.query(async ({ ctx }) => {
    const access = await ClassLearnerAccess.listUserLearnerAccess(ctx.user.id);
    const learners = await Promise.all(
      access.map(row => ClassLearner.getClassLearner(row.learnerId))
    );
    return learners
      .map((learner, index) =>
        learner
          ? {
              id: learner.id,
              name: ClassLearner.learnerDisplayName(learner),
              isMinor: learner.isMinor,
              relation: access[index]?.relation ?? 'guardian',
            }
          : null
      )
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }),

  /**
   * A learner's programs, with as many recent classes as the caller asks for.
   *
   * No archive filter, deliberately. A program the guru archived still holds this learner's
   * session notes, and hiding it would delete the record from the only person it belongs to.
   *
   * `recent` is what used to be a second procedure sitting beside this one. The ledger page wants
   * the enrollments and nothing else (`recent: 0`, the default); the home screen wants the last
   * few classes inline. Two procedures answering nearly the same question is how one of them
   * drifts from the other.
   */
  learnerHome: protectedProcedure
    .input(z.object({ learnerId, recent: z.number().int().min(0).max(20).default(0) }))
    .query(async ({ ctx, input }) => {
      await assertClassAccess(ctx, { learnerId: input.learnerId });
      const enrollments = await ClassEnrollment.listLearnerEnrollments(input.learnerId);

      return Promise.all(
        enrollments.map(async enrollment => {
          const [program, sessions, timezone] = await Promise.all([
            ClassProgram.getClassProgram(enrollment.programId),
            // Skipped entirely when the caller wants none, so the ledger page pays nothing for a
            // feature only the home screen uses.
            input.recent > 0
              ? ClassSession.listLearnerSessions(enrollment.programId, enrollment.learnerId)
              : Promise.resolve([]),
            institutionTimezone(enrollment.institutionId),
          ]);

          // Per program, because a learner may study under two gurus in two zones — and "today"
          // is always the teacher's day, never the phone's.
          const today = todayInTimeZone(timezone);

          return {
            enrollment,
            program,
            total: sessions.length,
            // Newest first, trimmed — "View all" goes to the full ledger.
            recent: [...sessions].reverse().slice(0, input.recent),
            today,
            earliest: addDaysToDate(today, -31),
          };
        })
      );
    }),

  learnerAccess: protectedProcedure.input(z.object({ learnerId })).query(async ({ ctx, input }) => {
    await assertClassAccess(ctx, { learnerId: input.learnerId });
    return ClassLearnerAccess.listLearnerAccess(input.learnerId);
  }),

  revokeAccess: protectedProcedure
    .input(z.object({ learnerId, targetUserId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const actor = await assertClassAccess(ctx, { learnerId: input.learnerId });
      const result = await ClassLearnerAccess.revokeLearnerAccess({
        learnerId: input.learnerId,
        targetUserId: input.targetUserId,
        actorUserId: ctx.user.id,
        actorIsTeacher: actor.kind === 'teacher',
      });
      if (!result.allowed) {
        throw new TRPCError({ code: 'FORBIDDEN', message: result.message ?? 'Not allowed' });
      }
      return { ok: true };
    }),

  /** Invites another account to watch a learner: a second guardian, or the student themselves. */
  inviteToLearner: protectedProcedure
    .input(
      z.object({
        learnerId,
        email: z.string().email().max(254),
        relation: z.enum(ClassLearnerAccess.ACCESS_RELATIONS),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // A guardian may add a second guardian or hand the student their own access — that is the
      // young-adult path, and requiring a teacher for it would put the guru in the middle of a
      // family arrangement.
      const actor = await assertClassAccess(ctx, { learnerId: input.learnerId });
      if (actor.kind === 'learner' && actor.learnerId !== input.learnerId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your learner' });
      }
      return ClassInvite.createClassInvite({
        email: input.email,
        institutionId: actor.institutionId,
        learnerId: input.learnerId,
        relation: input.relation,
        invitedBy: ctx.user.id,
      });
    }),
});
