import { VenueSpace } from '@rasika/core';
import { requireVenueAccess } from '../partner-guard';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { mapQrErrors } from './qr';

/**
 * Spaces (halls) of a venue. Inputs are the core schemas (build notes: `space.*`).
 *
 * A moderator, or a member of the venue: any member may list, only an owner may create or update
 * (a viewer is read-only). There is no `space.delete` in v1. `space` is in `PRIVATE_ROUTERS`.
 */
export const spaceRouter = createTRPCRouter({
  list: protectedProcedure.input(VenueSpace.ListSpacesSchema).query(async ({ ctx, input }) => {
    await requireVenueAccess(ctx.user, input.venueId, 'viewer');
    return mapQrErrors(() => VenueSpace.listSpaces(input.venueId));
  }),

  create: protectedProcedure
    .input(VenueSpace.CreateSpaceSchema)
    .mutation(async ({ ctx, input }) => {
      await requireVenueAccess(ctx.user, input.venueId, 'owner');
      return mapQrErrors(() => VenueSpace.createSpace(input));
    }),

  update: protectedProcedure
    .input(VenueSpace.UpdateSpaceSchema)
    .mutation(async ({ ctx, input }) => {
      await requireVenueAccess(ctx.user, input.venueId, 'owner');
      return mapQrErrors(() => VenueSpace.updateSpace(input));
    }),
});
