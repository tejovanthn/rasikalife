import { createTRPCRouter } from '../trpc';
import { artistRouter } from './artist';
import { compositionRouter } from './composition';
import { contentRouter } from './content';
import { ragaRouter } from './raga';
import { searchRouter } from './search';
import { talaRouter } from './tala';

export const appRouter = createTRPCRouter({
  artist: artistRouter,
  composition: compositionRouter,
  content: contentRouter,
  raga: ragaRouter,
  search: searchRouter,
  tala: talaRouter,
});

export type AppRouter = typeof appRouter;
