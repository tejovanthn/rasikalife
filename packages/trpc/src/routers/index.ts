import { createTRPCRouter } from '../trpc';
import { artistRouter } from './artist';
import { compositionRouter } from './composition';

export const appRouter = createTRPCRouter({
  artist: artistRouter,
  composition: compositionRouter,
});

export type AppRouter = typeof appRouter;
