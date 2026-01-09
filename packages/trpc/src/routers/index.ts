import { createTRPCRouter } from '../trpc';
import { artistRouter } from './artist';
import { compositionRouter } from './composition';
import { ragaRouter } from './raga';
import { talaRouter } from './tala';

export const appRouter = createTRPCRouter({
  artist: artistRouter,
  composition: compositionRouter,
  raga: ragaRouter,
  tala: talaRouter,
});

export type AppRouter = typeof appRouter;
