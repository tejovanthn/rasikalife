import { initTRPC } from '@trpc/server';
import { ZodError } from 'zod';
import { ApplicationError } from '../../core/src/constants';

const t = initTRPC.create({
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

export const createTRPCRouter = router;
export const createCallerFactory = t.createCallerFactory;
