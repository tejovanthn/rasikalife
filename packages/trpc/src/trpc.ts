import { Auth, type User } from '@rasika/core';
import { TRPCError, initTRPC } from '@trpc/server';
import type { CreateAWSLambdaContextOptions } from '@trpc/server/adapters/aws-lambda';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ZodError } from 'zod';
import { ROLE, type Role } from '../../core/src/auth/roles';
import { ApplicationError } from '../../core/src/constants';

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
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
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

export const createTRPCRouter = router;
export const createCallerFactory = t.createCallerFactory;
