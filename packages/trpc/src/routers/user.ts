import { Auth, ConcertLog, User } from '@rasika/core';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure, createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

const preferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).optional(),
  contentLanguage: z
    .enum(['english', 'tamil', 'telugu', 'kannada', 'hindi', 'devanagari', 'sanskrit'])
    .optional(),
  contributeToPublicSetlists: z.boolean().optional(),
  attendanceVisible: z.boolean().optional(),
  showProfilePublicly: z.boolean().optional(),
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
});

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

  getMyPreferences: protectedProcedure.query(({ ctx }) => User.getEffectivePreferences(ctx.user)),

  updatePreferences: protectedProcedure
    .input(preferencesSchema)
    .mutation(({ input, ctx }) => User.updateUserPreferences(ctx.user.id, input)),

  // Where the reader's "≈ 6 km away" is measured from. A PIN or a device location; the core
  // stores neither more precisely than a PIN (`resolveHomeLocation`).
  getHomeLocation: protectedProcedure.query(({ ctx }) => User.getHomeLocation(ctx.user.id)),

  setHomeLocation: protectedProcedure
    .input(
      z.union([
        z.object({ pin: z.string().min(1).max(10) }),
        z.object({ lat: z.number(), lng: z.number() }),
      ])
    )
    .mutation(({ input, ctx }) => User.setHomeLocation(ctx.user.id, input)),

  clearHomeLocation: protectedProcedure.mutation(({ ctx }) => User.clearHomeLocation(ctx.user.id)),

  getPublicProfile: publicProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ input }) => {
      const user = await User.getUserByUsername(input.username);
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }
      const prefs = User.getEffectivePreferences(user);
      if (!prefs.showProfilePublicly) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }
      return {
        id: user.id,
        displayName: prefs.displayName || user.name,
        bio: prefs.bio,
        createdAt: user.createdAt,
      };
    }),

  getMyContributionStats: protectedProcedure.query(async ({ ctx }) => {
    const { items: logs } = await ConcertLog.listUserConcertLogs(ctx.user.id, { limit: 1000 });
    return {
      eventsLogged: logs.length,
      memberSince: ctx.user.createdAt,
    };
  }),
});
