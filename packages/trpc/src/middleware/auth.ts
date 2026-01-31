import { Auth, type User } from '@rasika/core';
import { TRPCError } from '@trpc/server';
import type { Context } from '../trpc';

export type AuthenticatedContext = Context & {
  user: NonNullable<Context['user']>;
};

function _isAuthed() {
  return async ({
    ctx,
    next,
  }: {
    ctx: Context;
    next: (input: { ctx: AuthenticatedContext }) => Promise<unknown>;
  }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource',
      });
    }

    return next({ ctx: ctx as AuthenticatedContext });
  };
}

export const isAuthed = _isAuthed as never;

export function requirePermission(permission: Auth.Permission) {
  return (async ({
    ctx,
    next,
  }: {
    ctx: Context;
    next: (input: { ctx: AuthenticatedContext }) => Promise<unknown>;
  }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource',
      });
    }

    const role = ctx.user.role as Auth.Role;

    if (!Auth.can(role, permission)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You do not have permission to ${permission}`,
      });
    }

    return next({ ctx: ctx as AuthenticatedContext });
  }) as never;
}

export function requireRole(role: Auth.Role) {
  return (async ({
    ctx,
    next,
  }: {
    ctx: Context;
    next: (input: { ctx: AuthenticatedContext }) => Promise<unknown>;
  }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource',
      });
    }

    const userRole = ctx.user.role as Auth.Role;

    if (userRole !== role && userRole !== Auth.ROLE.ADMIN) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `${role} role required`,
      });
    }

    return next({ ctx: ctx as AuthenticatedContext });
  }) as never;
}

export function requireModerator() {
  return requireRole(Auth.ROLE.MODERATOR);
}

export function requireAdmin() {
  return requireRole(Auth.ROLE.ADMIN);
}
