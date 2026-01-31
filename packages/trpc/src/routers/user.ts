import { Auth, User } from '@rasika/core';
import { z } from 'zod';
import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc';

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  list: adminProcedure.query(async () => {
    return User.listAllUsers();
  }),

  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.nativeEnum(Auth.ROLE),
      })
    )
    .mutation(async ({ input }) => {
      const user = await User.updateUserRole(input.userId, input.role);
      return user;
    }),
});
