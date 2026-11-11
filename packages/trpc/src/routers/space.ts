import { VenueSpace } from '@rasika/core';
import { createTRPCRouter, moderatorProcedure } from '../trpc';
import { mapQrErrors } from './qr';

/**
 * Spaces (halls) of a venue. Inputs are the core schemas (build notes: `space.*`).
 *
 * Moderators only for now. TODO(phase 8): a verified partner owner of the venue may create and
 * update its spaces too, through `partnerProcedure`. There is no `space.delete` in v1.
 */
export const spaceRouter = createTRPCRouter({
  list: moderatorProcedure
    .input(VenueSpace.ListSpacesSchema)
    .query(({ input }) => mapQrErrors(() => VenueSpace.listSpaces(input.venueId))),

  create: moderatorProcedure
    .input(VenueSpace.CreateSpaceSchema)
    .mutation(({ input }) => mapQrErrors(() => VenueSpace.createSpace(input))),

  update: moderatorProcedure
    .input(VenueSpace.UpdateSpaceSchema)
    .mutation(({ input }) => mapQrErrors(() => VenueSpace.updateSpace(input))),
});
