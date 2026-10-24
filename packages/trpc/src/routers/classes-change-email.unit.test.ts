import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `changeLearnerEmail` withdrew the invite sent to a mistyped address and created one for the
 * corrected address, but emailed nobody, so the family never heard. This drives the procedure
 * itself, with core mocked, because the bug was a missing call: only the procedure shows it.
 */
const { sendTransactional, createClassInvite } = vi.hoisted(() => ({
  sendTransactional: vi.fn(),
  createClassInvite: vi.fn(),
}));

vi.mock('@rasika/core', async importOriginal => {
  // The router builds its input schemas from core at import, so only the calls are replaced.
  const core = await importOriginal<typeof import('@rasika/core')>();
  return {
    ...core,
    Email: { ...core.Email, sendTransactional },
    ClassInvite: {
      ...core.ClassInvite,
      listOutstandingInvites: vi.fn(async () => [
        {
          id: 'inv1',
          normalizedEmail: 'typo@example.com',
          learnerId: 'learn1',
          programId: 'prog1',
          relation: 'guardian',
        },
      ]),
      deleteClassInvite: vi.fn(),
      createClassInvite,
    },
    ClassLearner: {
      ...core.ClassLearner,
      getClassLearner: vi.fn(async () => ({ id: 'learn1', firstName: 'Meera' })),
    },
    ClassProgram: {
      ...core.ClassProgram,
      getClassProgram: vi.fn(async () => ({ id: 'prog1', title: 'Saturday class' })),
    },
    ClassInstitution: {
      ...core.ClassInstitution,
      getClassInstitution: vi.fn(async () => ({ name: 'Priya Raman Classes' })),
    },
  };
});

vi.mock('@rasika/core/site-cache', () => ({ invalidateSiteCache: vi.fn() }));

vi.mock('./classes-access', () => ({
  assertTeacher: vi.fn(async () => ({ institutionId: 'inst1' })),
  assertClassAccess: vi.fn(),
  assertEnrollmentAccess: vi.fn(),
}));

import { classesRouter } from './classes';

const caller = classesRouter.createCaller({
  event: {} as never,
  user: { id: 'guru', name: 'Priya Raman', email: 'priya@example.com' } as never,
});

beforeEach(() => {
  sendTransactional.mockReset().mockResolvedValue(undefined);
  createClassInvite.mockReset().mockImplementation(async (input: { email: string }) => ({
    id: 'inv2',
    rawEmail: input.email,
    relation: 'guardian',
  }));
});

describe('changeLearnerEmail', () => {
  it('emails the invite to the corrected address', async () => {
    await caller.changeLearnerEmail({ learnerId: 'learn1', email: 'meera.parent@example.com' });
    expect(sendTransactional).toHaveBeenCalledTimes(1);
    expect(sendTransactional).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'meera.parent@example.com', replyTo: 'priya@example.com' })
    );
  });

  it('still corrects the invite when the email fails', async () => {
    sendTransactional.mockRejectedValue(new Error('SES down'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const invite = await caller.changeLearnerEmail({
      learnerId: 'learn1',
      email: 'meera.parent@example.com',
    });
    expect(invite.rawEmail).toBe('meera.parent@example.com');
    log.mockRestore();
  });
});
