import type { inferRouterOutputs } from '@trpc/server';
import { createRouter } from '../server';
import { artistRouter } from './artist';
import { compositionRouter } from './composition';
import { contentRouter } from './content';
import { ragaRouter } from './raga';
import { talaRouter } from './tala';

// Create and export the app router
export const appRouter = createRouter({
  artist: artistRouter,
  raga: ragaRouter,
  tala: talaRouter,
  composition: compositionRouter,
  content: contentRouter,
});

// Export type for client usage
export type AppRouter = typeof appRouter;
export type RouterOutput = inferRouterOutputs<AppRouter>;
