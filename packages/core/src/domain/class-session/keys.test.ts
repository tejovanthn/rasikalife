import { describe, expect, it } from 'vitest';
import { ClassEnrollmentEntity } from '../class-enrollment/entity';
import { ClassInstitutionEntity } from '../class-institution/entity';
import { ClassInviteEntity } from '../class-invite/entity';
import { ClassLearnerAccessEntity } from '../class-learner-access/entity';
import { ClassLearnerEntity } from '../class-learner/entity';
import { ClassPackEntity } from '../class-pack/entity';
import { ClassProgramEntity } from '../class-program/entity';
import { ClassSessionEntity } from './entity';

/**
 * The keys these entities actually write, read off `.params()` rather than off the templates.
 *
 * Every other test in this feature mocks the entity, which means every other test agrees with
 * whatever the code *says* it writes. That has already cost this codebase real bugs three
 * times (CLAUDE.md rules 7 and 8), so this file asks DynamoDB's own parameters instead.
 *
 * Note that ElectroDB lowercases key values. Ids are KSUIDs and case-sensitive in principle,
 * but everything goes through ElectroDB, so the lowering is consistent and total.
 */

const SESSION = {
  id: 'sess1',
  programId: 'prog1',
  learnerId: 'learn1',
  institutionId: 'inst1',
  sessionDate: '2026-08-04',
  timezone: 'Asia/Kolkata',
  status: 'pending' as const,
  mode: 'online' as const,
  groupSessionId: 'grp1',
  programType: 'workshop' as const,
  autoConfirmAt: '2026-08-10T18:30:00.000Z',
};

function keysOf(params: unknown): Record<string, string> {
  const item = (params as { Item?: Record<string, string> }).Item ?? {};
  return Object.fromEntries(
    Object.entries(item).filter(([field]) => /^(pk|sk|gsi\d(pk|sk))$/.test(field))
  );
}

describe('class entity keys', () => {
  it('puts a learner ledger in one partition, packs and sessions together', () => {
    const session = keysOf(ClassSessionEntity.create(SESSION).params());
    const pack = keysOf(
      ClassPackEntity.create({
        id: 'pack1',
        programId: 'prog1',
        learnerId: 'learn1',
        delta: 8,
        grantedBy: 'user1',
      }).params()
    );

    // One query on this pk reads a learner's whole ledger: what put credits in and what
    // took them out.
    expect(session.pk).toBe('class_enrollment#prog1#learn1');
    expect(pack.pk).toBe(session.pk);

    // The sort key prefixes are what keep the two apart.
    expect(session.sk).toBe('session#2026-08-04#sess1');
    expect(pack.sk).toMatch(/^pack#.+#pack1$/);
  });

  it('shares one partition between an institution its programs and its learners', () => {
    const program = keysOf(
      ClassProgramEntity.create({
        id: 'prog1',
        institutionId: 'inst1',
        type: 'regular',
        isGroup: false,
        defaultMode: 'in-person',
        skipPolicy: 'burn',
      }).params()
    );
    const learner = keysOf(
      ClassLearnerEntity.create({
        id: 'learn1',
        institutionId: 'inst1',
        firstName: 'Priya',
        isMinor: false,
      }).params()
    );

    expect(program.pk).toBe('class_institution#inst1');
    expect(learner.pk).toBe(program.pk);
    expect(program.sk).toMatch(/^program#/);
    expect(learner.sk).toBe('learner#learn1');

    // Sharing a partition is only safe because each query is scoped by its own sort-key
    // template, so neither entity's list can pick up the other's rows.
    expect(program.sk.startsWith('learner#')).toBe(false);
  });

  /**
   * The review queue has to read *only* pending rows. An index keyed on the institution alone
   * would be dense over every session ever taught, so after a year the queue would read
   * thousands of confirmed rows to find three pending ones.
   */
  it('keys the review queue on institution and status together', () => {
    const pending = keysOf(ClassSessionEntity.create(SESSION).params());
    const confirmed = keysOf(
      ClassSessionEntity.create({ ...SESSION, status: 'confirmed' }).params()
    );

    expect(pending.gsi1pk).toBe('class_session#inst1#pending');
    expect(confirmed.gsi1pk).toBe('class_session#inst1#confirmed');
    expect(pending.gsi1sk).toBe('2026-08-04#sess1');
  });

  /**
   * CLAUDE.md rule 9. An index over an optional attribute is not sparse — a missing composite
   * writes the template with an empty suffix, so every solo session on the platform would land
   * in one partition that a blank lookup then matches in full. `groupSessionId` is required
   * and `markClassSession` defaults it to the row's own id, making a solo class a group of one.
   */
  it('never writes a blank group partition', () => {
    const solo = keysOf(
      ClassSessionEntity.create({ ...SESSION, groupSessionId: 'sess1' }).params()
    );

    expect(solo.gsi2pk).toBe('class_group_session#sess1');
    expect(solo.gsi2pk).not.toBe('class_group_session#');
  });

  it('keys the auto-confirm sweep on status and deadline, across institutions', () => {
    const pending = keysOf(ClassSessionEntity.create(SESSION).params());

    // No institution in the key: the cron needs every overdue session on the platform, and
    // there is no list of institutions it could walk instead.
    expect(pending.gsi3pk).toBe('class_session_due#pending');
    // Lowercased, which matters: the cron compares this against an ISO string, and `T` and `Z`
    // sort before lower-case digits-and-letters. Both sides go through ElectroDB, so both are
    // lowered and the comparison holds.
    expect(pending.gsi3sk).toBe('2026-08-10t18:30:00.000z#sess1');
  });

  it('gives every other entity the reverse lookup it exists for', () => {
    const enrollment = keysOf(
      ClassEnrollmentEntity.put({
        programId: 'prog1',
        learnerId: 'learn1',
        institutionId: 'inst1',
        learnerName: 'Priya R',
        programType: 'regular',
      }).params()
    );
    const access = keysOf(
      ClassLearnerAccessEntity.put({
        learnerId: 'learn1',
        userId: 'user1',
        relation: 'guardian',
      }).params()
    );
    const institution = keysOf(
      ClassInstitutionEntity.create({
        id: 'inst1',
        name: 'Smt Radha',
        ownerUserId: 'user9',
      }).params()
    );

    // Roster by program, and every program a learner is on.
    expect(enrollment.pk).toBe('class_program#prog1');
    expect(enrollment.gsi1pk).toBe('class_learner_enrollments#learn1');

    // Everyone who can see a learner, and every learner one sign-in can see.
    expect(access.pk).toBe('class_learner#learn1');
    expect(access.gsi1pk).toBe('class_user_learners#user1');

    expect(institution.gsi1pk).toBe('class_institution_owner#user9');
  });

  it('keys an invite on the normalized address, since that is what both sides agree on', () => {
    const invite = keysOf(
      ClassInviteEntity.create({
        id: 'inv1',
        normalizedEmail: 'priyaraman@gmail.com',
        rawEmail: 'Priya.Raman+classes@gmail.com',
        institutionId: 'inst1',
        relation: 'guardian',
        invitedBy: 'user9',
      }).params()
    );

    expect(invite.pk).toBe('class_invite#priyaraman@gmail.com');
  });
});
