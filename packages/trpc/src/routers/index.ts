import { createTRPCRouter } from '../trpc';
import { artistRouter } from './artist';
import { awardRouter } from './award';
import { compositionRouter } from './composition';
import { concertLogRouter } from './concert-log';
import { contentRouter } from './content';
import { crawlRouter } from './crawl';
import { editRouter } from './edit';
import { eventSetlistRouter } from './event-setlist';
import { eventRouter } from './event';
import { festivalRouter } from './festival';
import { organiserRouter } from './organiser';
import { ragaRouter } from './raga';
import { rsvpRouter } from './rsvp';
import { searchRouter } from './search';
import { setlistModerationRouter } from './setlist-moderation';
import { talaRouter } from './tala';
import { userRouter } from './user';
import { venueRouter } from './venue';

export const appRouter = createTRPCRouter({
  artist: artistRouter,
  award: awardRouter,
  composition: compositionRouter,
  concertLog: concertLogRouter,
  content: contentRouter,
  crawl: crawlRouter,
  edit: editRouter,
  eventSetlist: eventSetlistRouter,
  event: eventRouter,
  festival: festivalRouter,
  organiser: organiserRouter,
  raga: ragaRouter,
  rsvp: rsvpRouter,
  search: searchRouter,
  setlistModeration: setlistModerationRouter,
  tala: talaRouter,
  user: userRouter,
  venue: venueRouter,
});

export type AppRouter = typeof appRouter;
