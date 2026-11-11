import { Auth, PartnerMember, type User } from '@rasika/core';
import { TRPCError, initTRPC } from '@trpc/server';
import type { CreateAWSLambdaContextOptions } from '@trpc/server/adapters/aws-lambda';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ZodError } from 'zod';
import { ROLE, type Role } from '../../core/src/auth/roles';
import { ApplicationError } from '../../core/src/constants';
import { clearSiteCacheAfterMutation } from './middleware/site-cache';
import { type PartnerNeeds, PartnerTargetInputSchema, checkPartnerAccess } from './partner-access';

export interface Context {
  event: APIGatewayProxyEventV2;
  user: User.User | null;
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const isAppError = error.cause instanceof ApplicationError;

    return {
      ...shape,
      data: {
        ...shape.data,
        code: isAppError ? error.cause.code : undefined,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;

// Every procedure starts here, so no mutation can skip clearing the page cache.
const baseProcedure = t.procedure.use(clearSiteCacheAfterMutation);

export const publicProcedure = baseProcedure;

export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }

  if (ctx.user.role !== Auth.ROLE.ADMIN) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return next({ ctx });
});

export const editorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }

  const editorRoles: Role[] = [ROLE.EDITOR, ROLE.MODERATOR, ROLE.ADMIN];
  if (!editorRoles.includes(ctx.user.role as Role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Editor access required',
    });
  }

  return next({ ctx });
});

export const moderatorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }

  const moderatorRoles: Role[] = [ROLE.MODERATOR, ROLE.ADMIN];
  if (!moderatorRoles.includes(ctx.user.role as Role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Moderator access required',
    });
  }

  return next({ ctx });
});

/**
 * Sabha dashboard access. The call's input must carry `targetType` and `targetId` (the
 * `partner.*` inputs do), and the caller must hold a `PartnerMember` grant for that target with
 * the role the variant needs. Moderators and admins pass too, except where `allowModerator` is
 * false. `ctx.partner` says which way the caller got in. See `partner-access.ts` for the rules.
 */
function partnerGate(needs: PartnerNeeds, allowModerator: boolean) {
  return protectedProcedure.use(async ({ ctx, next, getRawInput }) => {
    const parsed = PartnerTargetInputSchema.safeParse(await getRawInput());
    if (!parsed.success) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'targetType and targetId are required',
      });
    }
    const { targetType, targetId } = parsed.data;
    const role = await checkPartnerAccess(
      { user: ctx.user, targetType, targetId, needs, allowModerator },
      (userId, type, id) => PartnerMember.getPartnerMember(userId, type, id)
    );
    return next({ ctx: { ...ctx, partner: { role, targetType, targetId } } });
  });
}

/** A member of the target (viewer or owner), or a moderator. */
export const partnerProcedure = partnerGate('viewer', true);

/** An owner of the target, or a moderator. For owner actions that staff may also do. */
export const partnerOwnerProcedure = partnerGate('owner', true);

/** An owner of the target and nobody else: not even a moderator. Used by the follower export. */
export const partnerStrictOwnerProcedure = partnerGate('owner', false);

export const createTRPCRouter = router;
export const createCallerFactory = t.createCallerFactory;
