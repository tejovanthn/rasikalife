import { createTRPCRouter } from '../trpc';
import { artistRouter } from './artist';
import { awardRouter } from './award';
import { compositionRouter } from './composition';
import { contentRouter } from './content';
import { crawlRouter } from './crawl';
import { editRouter } from './edit';
import { eventRouter } from './event';
import { festivalRouter } from './festival';
import { organiserRouter } from './organiser';
import { ragaRouter } from './raga';
import { searchRouter } from './search';
import { talaRouter } from './tala';
import { userRouter } from './user';
import { venueRouter } from './venue';

export const appRouter = createTRPCRouter({
  artist: artistRouter,
  award: awardRouter,
  composition: compositionRouter,
  content: contentRouter,
  crawl: crawlRouter,
  edit: editRouter,
  event: eventRouter,
  festival: festivalRouter,
  organiser: organiserRouter,
  raga: ragaRouter,
  search: searchRouter,
  tala: talaRouter,
  user: userRouter,
  venue: venueRouter,
});

export type AppRouter = typeof appRouter;
