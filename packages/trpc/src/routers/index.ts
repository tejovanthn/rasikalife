import { createTRPCRouter } from '../trpc';
import { adminDataRouter } from './admin-data';
import { artistRouter } from './artist';
import { artistClaimRouter } from './artist-claim';
import { awardRouter } from './award';
import { classesRouter } from './classes';
import { compositionRouter } from './composition';
import { concertLogRouter } from './concert-log';
import { contentRouter } from './content';
import { crawlRouter } from './crawl';
import { editRouter } from './edit';
import { eventRouter } from './event';
import { eventSetlistRouter } from './event-setlist';
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
  adminData: adminDataRouter,
  artist: artistRouter,
  artistClaim: artistClaimRouter,
  award: awardRouter,
  classes: classesRouter,
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
