import { createRouter } from '../server';
import { artistRouter } from './artist';
import { ragaRouter } from './raga';
import { talaRouter } from './tala';
import { compositionRouter } from './composition';

// Create and export the app router
export const appRouter = createRouter({
  artist: artistRouter,
  raga: ragaRouter,
  tala: talaRouter,
  composition: compositionRouter,
});

// Export type for client usage
export type AppRouter = typeof appRouter;
