import { DEFAULT_EVENT_TIMEZONE } from '@rasika/core/domain/event/client';
import { canonicalCitySlug } from '@rasika/core/shared/city';
import { startOfDayInstant, todayInTimeZone } from '@rasika/core/shared/timezone';
import { client } from '~/api.server';
import {
  type DateRange,
  type ListingScope,
  type ListingState,
  dayCounts,
  filterEvents,
  listingHref,
  monthCounts,
  readListingState,
  resolveDateRange,
} from '~/lib/event-filters';
import { eventDateKey, formatDayLabel, groupByEventDate } from '~/lib/event-time';
import { isGenericTitle } from '~/lib/generic-title';
import { cacheUntilMidnight } from '~/lib/page-cache';
import { generateEventUrl } from '~/lib/url-slug';
import { formatWhatsAppDigest } from '~/lib/whatsapp-digest';

/**
 * Everything `/events` and `/<city>/concerts[/<preset>]` render, from one load of every
 * upcoming event. Filtering happens here, in memory; see `listAllUpcomingEvents` for why that
 * is right at this size.
 */

export type ListingEvent = Awaited<
  ReturnType<typeof client.event.upcomingListings.query>
>[number] & { isGeneric: boolean };

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
  calendar: { month: string; counts: Record<string, number> };
  months: Array<[string, number]>;
  cities: Array<{ slug: string; name: string; count: number }>;
  topCities: string[];
  /** Present in the WhatsApp view only. */
  digest?: string;
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

  const [listings, venueCities] = await Promise.all([
    client.event.upcomingListings.query({ from: startOfDayInstant(today, zone) }),
    client.venue.cities.query(),
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
  const withGeneric = (e: (typeof listings)[number]): ListingEvent => ({
    ...e,
    isGeneric: isGenericTitle(e.title, e.artists ?? undefined, e.artForm ?? undefined),
  });

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

  const calendarMonth =
    state.when && range && /^\d{4}-\d{2}/.test(state.when)
      ? state.when.slice(0, 7)
      : today.slice(0, 7);

  const data: EventListingData = {
    scope,
    cityName,
    state,
    today,
    range,
    groups: groupByEventDate(shown.map(withGeneric)),
    count: shown.length,
    upcomingFallback: range && shown.length === 0 ? scoped.slice(0, 6).map(withGeneric) : [],
    calendar: { month: calendarMonth, counts: dayCounts(scoped) },
    months: monthCounts(scoped),
    cities,
    topCities: cities.slice(0, 3).map(c => c.name),
  };

  if (state.view === 'whatsapp') {
    const where = cityName ? ` in ${cityName}` : '';
    data.digest = formatWhatsAppDigest(shown, {
      heading: range ? `Concerts${where} · ${range.label}` : `Upcoming concerts${where}`,
      listingUrl: `${ORIGIN}${listingHref(scope, { when: state.when, free: state.free })}`,
      eventUrl: e => `${ORIGIN}${generateEventUrl(e.title, e.id)}`,
      cast: state.cast,
      links: state.links,
    });
  }

  return { data, headers: { 'Cache-Control': cacheUntilMidnight(request, zone) } };
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
