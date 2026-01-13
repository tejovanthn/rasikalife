import { createTRPCRouter } from '../trpc';
import { artistRouter } from './artist';
import { compositionRouter } from './composition';
import { contentRouter } from './content';
import { ragaRouter } from './raga';
import { talaRouter } from './tala';

export const appRouter = createTRPCRouter({
  artist: artistRouter,
  composition: compositionRouter,
  content: contentRouter,
  raga: ragaRouter,
  tala: talaRouter,
});

export type AppRouter = typeof appRouter;
