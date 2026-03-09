// packages/trpc/src/routers/search.ts

import { Search } from '@rasika/core';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

const searchInputSchema = z.object({
  query: z.string().min(2),
  limit: z.number().min(1).max(50).optional().default(20),
  offset: z.number().optional().default(0),
});

export const searchRouter = createTRPCRouter({
  search: publicProcedure.input(Search.SearchInputSchema).query(({ input }) =>
    Search.search(input.query, {
      filters: input.filters,
      limit: input.limit,
      offset: input.offset,
    })
  ),

  searchWithFullData: publicProcedure.input(Search.SearchInputSchema).query(({ input }) =>
    Search.searchWithFullData(input.query, {
      filters: input.filters,
      limit: input.limit,
      offset: input.offset,
    })
  ),

  searchArtists: publicProcedure.input(searchInputSchema).query(({ input }) =>
    Search.search(input.query, {
      filters: ['name'],
      limit: input.limit,
      offset: input.offset,
    }).then(result => ({
      ...result,
      items: result.items
        .filter(item => item.type === 'artist')
        .map(item => ({ id: item.id, name: item.name })),
    }))
  ),

  searchRagas: publicProcedure.input(searchInputSchema).query(({ input }) =>
    Search.search(input.query, {
      filters: ['name'],
      limit: input.limit,
      offset: input.offset,
    }).then(result => ({
      ...result,
      items: result.items
        .filter(item => item.type === 'raga')
        .map(item => ({ id: item.id, name: item.name })),
    }))
  ),

  searchTalas: publicProcedure.input(searchInputSchema).query(({ input }) =>
    Search.search(input.query, {
      filters: ['name'],
      limit: input.limit,
      offset: input.offset,
    }).then(result => ({
      ...result,
      items: result.items
        .filter(item => item.type === 'tala')
        .map(item => ({ id: item.id, name: item.name })),
    }))
  ),

  searchVenues: publicProcedure.input(searchInputSchema).query(({ input }) =>
    Search.search(input.query, {
      filters: ['name'],
      limit: input.limit,
      offset: input.offset,
    }).then(result => ({
      ...result,
      items: result.items
        .filter(item => item.type === 'venue')
        .map(item => ({ id: item.id, name: item.name })),
    }))
  ),

  searchOrganisers: publicProcedure.input(searchInputSchema).query(({ input }) =>
    Search.search(input.query, {
      filters: ['name'],
      limit: input.limit,
      offset: input.offset,
    }).then(result => ({
      ...result,
      items: result.items
        .filter(item => item.type === 'organiser')
        .map(item => ({ id: item.id, name: item.name })),
    }))
  ),

  searchEvents: publicProcedure.input(searchInputSchema).query(({ input }) =>
    Search.search(input.query, {
      limit: input.limit,
      offset: input.offset,
    }).then(result => ({
      ...result,
      items: result.items
        .filter(item => item.type === 'event')
        .map(item => ({ id: item.id, name: item.name })),
    }))
  ),

  health: publicProcedure.query(() => Search.getHealth()),

  /** Get all indexed documents - useful for sitemap generation */
  documents: publicProcedure
    .input(
      z
        .object({
          type: z.enum([
            'artist',
            'raga',
            'tala',
            'composition',
            'venue',
            'organiser',
            'event',
            'festival',
          ]),
          startsWith: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Search.getDocuments(input?.type, input?.startsWith)),
});
