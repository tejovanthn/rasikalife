import { Venue } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, editorProcedure, publicProcedure } from '../trpc';

export const venueRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => Venue.getVenue(input.id)),

  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Venue.listVenues(input)),

  getByName: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(({ input }) => Venue.getVenueByName(input.name)),

  byCity: publicProcedure
    .input(
      z.object({
        city: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) => Venue.listVenuesByCity(input.city, input)),

  create: editorProcedure
    .input(Venue.CreateVenueSchema)
    .mutation(({ input }) => Venue.createVenue(input)),

  update: editorProcedure
    .input(z.object({ id: z.string().min(1), data: Venue.UpdateVenueSchema }))
    .mutation(({ input }) => Venue.updateVenue(input.id, input.data)),
});
