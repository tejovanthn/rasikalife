import { describe, expect, it, vi } from 'vitest';

const lookup = vi.hoisted(() => vi.fn());

vi.mock('@rasika/core', async importOriginal => {
  const core = await importOriginal<typeof import('@rasika/core')>();
  return { ...core, PartnerMember: { ...core.PartnerMember, getPartnerMember: lookup } };
});
vi.mock('@rasika/core/site-cache', () => ({ invalidateSiteCache: vi.fn() }));

import { z } from 'zod';
import { checkPartnerAccess } from './partner-access';
import {
  createTRPCRouter,
  partnerOwnerProcedure,
  partnerProcedure,
  partnerStrictOwnerProcedure,
} from './trpc';

const target = { targetType: 'organiser' as const, targetId: 'o1' };
const input = z.object({ targetType: z.enum(['organiser', 'venue']), targetId: z.string() });

const router = createTRPCRouter({
  viewer: partnerProcedure.input(input).query(({ ctx }) => ctx.partner.role),
  owner: partnerOwnerProcedure.input(input).query(({ ctx }) => ctx.partner.role),
  strict: partnerStrictOwnerProcedure.input(input).query(({ ctx }) => ctx.partner.role),
});

const as = (user: { id: string; role: string } | null) =>
  router.createCaller({ event: {} as never, user: user as never });

const members: Record<string, 'owner' | 'viewer'> = { owner1: 'owner', viewer1: 'viewer' };
lookup.mockImplementation(async (userId: string, type: string, id: string) =>
  type === 'organiser' && id === 'o1' && members[userId] ? { role: members[userId] } : null
);

/** [who, partnerProcedure, partnerOwnerProcedure, partnerStrictOwnerProcedure] */
const MATRIX = [
  ['owner', { id: 'owner1', role: 'editor' }, 'owner', 'owner', 'owner'],
  ['viewer', { id: 'viewer1', role: 'editor' }, 'viewer', 'FORBIDDEN', 'FORBIDDEN'],
  ['non-member', { id: 'someone', role: 'editor' }, 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN'],
  ['moderator', { id: 'mod1', role: 'moderator' }, 'moderator', 'moderator', 'FORBIDDEN'],
  ['admin', { id: 'adm1', role: 'admin' }, 'moderator', 'moderator', 'FORBIDDEN'],
  ['signed out', null, 'UNAUTHORIZED', 'UNAUTHORIZED', 'UNAUTHORIZED'],
] as const;

describe('partnerProcedure access matrix', () => {
  for (const [who, user, viewer, owner, strict] of MATRIX) {
    it(`${who}: viewer=${viewer} owner=${owner} strict=${strict}`, async () => {
      const caller = as(user);
      const run = async (fn: () => Promise<string>, expected: string) => {
        if (['FORBIDDEN', 'UNAUTHORIZED'].includes(expected)) {
          await expect(fn()).rejects.toMatchObject({ code: expected });
        } else {
          await expect(fn()).resolves.toBe(expected);
        }
      };
      await run(() => caller.viewer(target), viewer);
      await run(() => caller.owner(target), owner);
      await run(() => caller.strict(target), strict);
    });
  }

  it('says PARTNER_FORBIDDEN in the error data', async () => {
    const error = await as({ id: 'someone', role: 'editor' })
      .viewer(target)
      .catch(e => e);
    expect(error.cause?.code).toBe('PARTNER_FORBIDDEN');
  });

  it('checks the requested target, not the user having some other grant', async () => {
    await expect(
      as({ id: 'owner1', role: 'editor' }).viewer({ targetType: 'organiser', targetId: 'o2' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // The same id as a venue is a different target.
    await expect(
      as({ id: 'owner1', role: 'editor' }).viewer({ targetType: 'venue', targetId: 'o1' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses a call that names no target', async () => {
    const loose = createTRPCRouter({ x: partnerProcedure.query(() => 'ok') });
    await expect(
      loose
        .createCaller({ event: {} as never, user: { id: 'owner1', role: 'editor' } as never })
        .x()
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('checkPartnerAccess', () => {
  it('lets a viewer do viewer actions only', async () => {
    const fake = async () => ({ role: 'viewer' as const });
    await expect(
      checkPartnerAccess({ user: { id: 'u' }, ...target, needs: 'viewer' }, fake)
    ).resolves.toBe('viewer');
    await expect(
      checkPartnerAccess({ user: { id: 'u' }, ...target, needs: 'owner' }, fake)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does not look up a grant for a moderator who is let in', async () => {
    const spy = vi.fn();
    await checkPartnerAccess({ user: { id: 'u', role: 'moderator' }, ...target }, spy);
    expect(spy).not.toHaveBeenCalled();
  });
});
