import { createTRPCRouter } from '../trpc';
import { artistRouter } from './artist';
import { compositionRouter } from './composition';
import { contentRouter } from './content';
import { editRouter } from './edit';
import { ragaRouter } from './raga';
import { searchRouter } from './search';
import { talaRouter } from './tala';
import { userRouter } from './user';

export const appRouter = createTRPCRouter({
  artist: artistRouter,
  composition: compositionRouter,
  content: contentRouter,
  edit: editRouter,
  raga: ragaRouter,
  search: searchRouter,
  tala: talaRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
