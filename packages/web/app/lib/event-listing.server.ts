import { DEFAULT_EVENT_TIMEZONE } from '@rasika/core/domain/event/client';
import { canonicalCitySlug } from '@rasika/core/shared/city';
import { startOfDayInstant, todayInTimeZone } from '@rasika/core/shared/timezone';
import { client, createServerClient } from '~/api.server';
import { getUser } from '~/lib/auth.server';
import { distanceKm } from '~/lib/distance';
import {
  DATE_PRESETS,
  type DatePreset,
  type DateRange,
  type ListingScope,
  type ListingState,
  calendarMonth,
  dayCounts,
  defaultCalendarMonth,
  filterEvents,
  groupConsecutiveByDate,
  lastEventMonth,
  listingHref,
  readListingState,
  resolveDateRange,
  sortByDistance,
} from '~/lib/event-filters';
import { eventDateKey, formatDayLabel, groupByEventDate } from '~/lib/event-time';
import { isGenericTitle } from '~/lib/generic-title';
import { cacheUntilMidnight } from '~/lib/page-cache';
import { generateEventUrl } from '~/lib/url-slug';
import { digestHeading, formatWhatsAppDigest } from '~/lib/whatsapp-digest';

/**
 * Everything `/events` and `/<city>/concerts[/<preset>]` render, from one load of every
 * upcoming event. Filtering happens here, in memory; see `listAllUpcomingEvents` for why that
 * is right at this size.
 */

export type ListingEvent = Awaited<
  ReturnType<typeof client.event.upcomingListings.query>
>[number] & {
  isGeneric: boolean;
  /** Straight-line km from the signed-in reader's home location, when both ends are known. */
  distanceKm?: number;
};

export interface EventListingData {
  scope: ListingScope;
  cityName?: string;
  state: ListingState;
  today: string;
  range: DateRange | null;
  groups: Array<{ date: string; events: ListingEvent[] }>;
  count: number;
  /** When the range is empty: the next concerts after it, so the page is never bare. */
  upcomingFallback: ListingEvent[];
  /**
   * `month` is what the calendar shows; `defaultMonth` what it shows unbrowsed, so a link back
   * to it can drop `cal`; `lastMonth` the last month with an event, where "next" stops.
   */
  calendar: {
    month: string;
    defaultMonth: string;
    lastMonth: string | null;
    counts: Record<string, number>;
  };
  /**
   * Concerts each date preset would show, and `all` for no date, within the city and "Free
   * only", so a preset that leads nowhere says so before it is pressed.
   */
  presetCounts: Record<DatePreset | 'all', number>;
  /** "Nearest first" is in force: asked for, and the reader has a home to measure from. */
  nearest: boolean;
  cities: Array<{ slug: string; name: string; count: number }>;
  topCities: string[];
  /** Present in the WhatsApp view only. */
  digest?: string;
  /** Distance needs an account: who is reading, and where they measure from. */
  viewer: { signedIn: boolean; home: { label: string } | null };
  /**
   * Why the reader's PIN was not saved, when the location form sent them back here
   * (`?pin_error=`). Signed-in only: those pages are private, so it never reaches a cached copy.
   */
  pinError?: string;
}

const ORIGIN = 'https://rasika.life';

export class ListingRedirect {
  constructor(public readonly location: string) {}
}

export async function loadEventListing(
  request: Request,
  opts: { city?: string; presetSegment?: string } = {}
): Promise<{ data: EventListingData; headers: HeadersInit } | ListingRedirect> {
  const url = new URL(request.url);
  const zone = DEFAULT_EVENT_TIMEZONE;
  const today = todayInTimeZone(zone);
  const state = readListingState(url, opts.presetSegment);

  const [listings, venueCities, viewer] = await Promise.all([
    client.event.upcomingListings.query({ from: startOfDayInstant(today, zone) }),
    client.venue.cities.query(),
    readViewer(request),
  ]);
  const cityNames = new Map(venueCities.map(c => [c.slug, c.name]));

  // `/events?city=Bengaluru` was the old city filter; the city page is now its home.
  const legacyCity = url.searchParams.get('city');
  if (!opts.city && legacyCity) {
    return new ListingRedirect(
      listingHref({ kind: 'city', slug: canonicalCitySlug(legacyCity) }, state)
    );
  }

  let scope: ListingScope = { kind: 'all' };
  let cityName: string | undefined;
  if (opts.city) {
    const slug = canonicalCitySlug(opts.city);
    if (slug !== opts.city) {
      return new ListingRedirect(listingHref({ kind: 'city', slug }, state));
    }
    const known = cityNames.has(slug) || listings.some(e => e.citySlug === slug);
    if (!known) throw new Response('Not Found', { status: 404 });
    scope = { kind: 'city', slug };
    cityName = cityNames.get(slug) ?? listings.find(e => e.citySlug === slug)?.city;
  }

  const range = resolveDateRange(state.when, today);
  const scoped = filterEvents(listings, {
    citySlug: scope.kind === 'city' ? scope.slug : undefined,
    free: state.free,
  });
  const shown = filterEvents(scoped, { range });
  const home = viewer.home;
  const withGeneric = (e: (typeof listings)[number]): ListingEvent => ({
    ...e,
    isGeneric: isGenericTitle(e.title, e.artists ?? undefined, e.artForm ?? undefined),
    distanceKm:
      home && typeof e.venueLat === 'number' && typeof e.venueLng === 'number'
        ? distanceKm(home, { lat: e.venueLat, lng: e.venueLng })
        : undefined,
  });

  const nearest = state.sort === 'near' && Boolean(home);
  const shownWithGeneric = shown.map(withGeneric);
  const counts = dayCounts(scoped);
  const lastMonth = lastEventMonth(counts);
  const presetCounts = { all: scoped.length } as EventListingData['presetCounts'];
  for (const p of DATE_PRESETS) {
    presetCounts[p.value] = filterEvents(scoped, {
      range: resolveDateRange(p.value, today),
    }).length;
  }
  const pinError = viewer.signedIn ? (url.searchParams.get('pin_error') ?? undefined) : undefined;

  const cityCounts = new Map<string, number>();
  for (const e of listings) {
    if (e.citySlug) cityCounts.set(e.citySlug, (cityCounts.get(e.citySlug) ?? 0) + 1);
  }
  const cities = [...cityCounts]
    .map(([slug, count]) => ({
      slug,
      count,
      name: cityNames.get(slug) ?? listings.find(e => e.citySlug === slug)?.city ?? slug,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const data: EventListingData = {
    scope,
    cityName,
    state,
    today,
    range,
    // Nearest first keeps strict distance order, with a date header wherever the day changes
    // (see `groupConsecutiveByDate`), so every card still shows its date.
    groups: nearest
      ? groupConsecutiveByDate(sortByDistance(shownWithGeneric))
      : groupByEventDate(shownWithGeneric),
    count: shown.length,
    upcomingFallback: range && shown.length === 0 ? scoped.slice(0, 6).map(withGeneric) : [],
    calendar: {
      month: calendarMonth(state.cal, range, today, lastMonth),
      defaultMonth: defaultCalendarMonth(range, today),
      lastMonth,
      counts,
    },
    presetCounts,
    nearest,
    cities,
    topCities: cities.slice(0, 3).map(c => c.name),
    viewer: {
      signedIn: viewer.signedIn,
      home: home ? { label: home.pin ? `PIN ${home.pin}` : 'your location' } : null,
    },
    pinError,
  };

  if (state.view === 'whatsapp') {
    data.digest = formatWhatsAppDigest(shown, {
      heading: digestHeading({ cityName, range, free: state.free }),
      listingUrl: `${ORIGIN}${listingHref(scope, { when: state.when, free: state.free })}`,
      eventUrl: e => `${ORIGIN}${generateEventUrl(e.title, e.id)}`,
      cast: state.cast,
      links: state.links,
      campaign: 'listing_share',
    });
  }

  return { data, headers: { 'Cache-Control': cacheUntilMidnight(request, zone) } };
}

/**
 * The signed-in reader and their saved location. Only a request carrying a session pays for
 * this; a signed-out one is the cached page, the same for everyone. A failure costs the
 * distances, never the page.
 */
async function readViewer(request: Request) {
  const user = await getUser(request).catch(() => null);
  if (!user) return { signedIn: false, home: null };
  try {
    const serverClient = await createServerClient(request);
    return { signedIn: true, home: await serverClient.user.getHomeLocation.query() };
  } catch (error) {
    console.error('Failed to read home location:', error);
    return { signedIn: true, home: null };
  }
}

/** The first concert a page shows, for its meta description. */
export function firstConcert(data: EventListingData) {
  const first = data.groups[0]?.events[0] ?? data.upcomingFallback[0];
  if (!first) return undefined;
  const lead = first.isGeneric && first.artists?.length ? first.artists[0].name : first.title;
  return {
    name: lead,
    day: formatDayLabel(eventDateKey(first)),
    venue: first.venueName ?? undefined,
  };
}
