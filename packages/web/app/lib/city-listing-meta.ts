import { DATE_PRESETS, type DatePreset, listingHref } from '~/lib/event-filters';
import type { EventListingData, firstConcert } from '~/lib/event-listing.server';
import { concertsMeta, decemberSeasonYear } from '~/lib/listing-description';

const SITE = 'https://rasika.life';

/** What the city listing loader returns (`cityListingLoader`). */
export type CityListingPageData = EventListingData & {
  kind: 'city';
  first?: ReturnType<typeof firstConcert>;
  hasAny: boolean;
  /** The preset of `/events/<city>/<preset>`; null on the city page itself. */
  datePage: DatePreset | null;
};

/**
 * Head tags of `/events/<city>` and `/events/<city>/<preset>`.
 *
 * The city page is the one that ranks ("carnatic concerts in bangalore", 260 a month, Oct 2026):
 * every filter on it is a view of it and its canonical is itself. A city date page is for
 * sharing: it has a title of its own and a self canonical, and is `noindex, follow` and out of
 * the sitemap, since no one searches for it. A city with nothing upcoming at all is `noindex`
 * too; it rejoins the index with its first listed concert.
 */
export function cityListingMeta(d: CityListingPageData | undefined) {
  if (!d?.cityName) return [{ title: 'Concerts | Rasika.life' }];
  const preset = DATE_PRESETS.find(p => p.value === d.datePage);
  const { title, description } = concertsMeta({
    city: d.cityName,
    range: preset?.label,
    count: d.count,
    next: d.first,
    seasonYear:
      d.range || preset
        ? undefined
        : decemberSeasonYear(
            d.cityName,
            d.groups.map(g => g.date)
          ),
  });
  const url = `${SITE}${listingHref(d.scope, { when: preset?.value })}`;
  const noindex = preset || !d.hasAny;
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: url },
    { property: 'og:image', content: `${SITE}/og-image.png` },
    { name: 'twitter:card', content: 'summary_large_image' },
    { tagName: 'link', rel: 'canonical', href: url },
    ...(noindex ? [{ name: 'robots', content: 'noindex, follow' }] : []),
  ];
}
