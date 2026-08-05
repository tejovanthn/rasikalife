/**
 * The JSON-LD payload for every indexed entity page.
 *
 * These are plain functions rather than JSX because vitest here runs `app/**\/*.test.ts` in a
 * node environment: a payload assembled inside a component cannot be asserted on, and what
 * these emit is a public claim about a real person, hall or organisation. The components in
 * `~/components/structured-data` do nothing but serialise what these return.
 *
 * Two rules run through the whole file.
 *
 * **Claim nothing the record does not hold.** This is the same rule the meta descriptions
 * follow, and it has already cost the site once: every artist's JSON-LD carried the sentence
 * "Renowned classical musician in Indian classical music", which is the inflation
 * `GURU_RELATIONSHIPS` exists to prevent, asserted of all 1,111 of them. An absent field is
 * left out; it is never filled with a plausible default.
 *
 * **An absent field is `undefined`, and a list with nothing in it is absent too.**
 * `JSON.stringify` drops `undefined` keys, so `undefined` is how a key is omitted — but an
 * `undefined` *inside an array* serialises as `null`, so every list goes through `list()`
 * first. An empty array is not the same claim as no array: `award: []` reads as "we checked
 * and there are none".
 */

export const SITE_URL = 'https://rasika.life';

export type JsonLdObject = Record<string, unknown>;

/** Keep the entries that exist, or drop the key. See the second rule above. */
function list<T>(items: Array<T | null | undefined> | null | undefined): T[] | undefined {
  const kept = (items ?? []).filter((item): item is T => item !== null && item !== undefined);
  return kept.length > 0 ? kept : undefined;
}

/** A blank string is an absent field, not a value. Trailing spaces come in from CSV import. */
function trimmed(value?: string | null): string | undefined {
  return value?.trim() || undefined;
}

export interface StructuredAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Google's Event rich result requires `location.address`, and until now the event page shipped
 * a `Place` carrying only a name — so every concert on the site was ineligible. The venue and
 * organiser records store the parts separately, which is what schema.org wants anyway.
 */
export function postalAddress(address?: StructuredAddress | null): JsonLdObject | undefined {
  const fields = {
    streetAddress: trimmed(address?.street),
    addressLocality: trimmed(address?.city),
    addressRegion: trimmed(address?.state),
    postalCode: trimmed(address?.postalCode),
    addressCountry: trimmed(address?.country),
  };
  if (!Object.values(fields).some(Boolean)) return undefined;
  return { '@type': 'PostalAddress', ...fields };
}

/**
 * `PerformingArtsTheater` is a `LocalBusiness`: it says the address and phone on this page
 * belong to something trading as a theatre. That is true of an auditorium and of a sabha hall,
 * and it is not true of a temple hall, a terrace, a pandal, a university's own building or a
 * heritage house — none of which trade, and several of which belong to a body that is not the
 * organiser either.
 *
 * So the map lists the two that hold and everything else stays a plain `Place`, including
 * `other` and an unset type. Same rule the venue-type enrichment follows: read an explicit
 * word or say nothing. Falling back to a business type would assert a legal character the
 * record never recorded.
 */
const VENUE_SCHEMA_TYPES: Record<string, string> = {
  auditorium: 'PerformingArtsTheater',
  'sabha-hall': 'PerformingArtsTheater',
};

export function venueSchemaType(venueType?: string | null): string {
  return (venueType && VENUE_SCHEMA_TYPES[venueType]) || 'Place';
}

/**
 * `email` is a property of `Organization`, not of `Place`. A `PerformingArtsTheater` is both,
 * so it may carry one; a plain `Place` may not, and a validator flags it. This is the only
 * consequence of the conservative type map above, and it is a cheap one — barely any venue
 * record stores an email.
 */
function venueTakesEmail(venueType?: string | null): boolean {
  return venueSchemaType(venueType) !== 'Place';
}

/**
 * `sabha`, `trust` and `temple` all stay `Organization`.
 *
 * schema.org's `HinduTemple` is a `PlaceOfWorship` — a building, not the body that programmes
 * the concerts, and this record is the organiser. There is no type for a private trust that
 * does not also assert a legal form (`NGO` is a different registration), and inventing one
 * would be the same mistake as promoting a school to a `university` in the enrichment sweep.
 */
const ORGANISATION_SCHEMA_TYPES: Record<string, string> = {
  ngo: 'NGO',
  university: 'CollegeOrUniversity',
};

export function organisationSchemaType(organisationType?: string | null): string {
  return (organisationType && ORGANISATION_SCHEMA_TYPES[organisationType]) || 'Organization';
}

const withContext = (payload: JsonLdObject): JsonLdObject => ({
  '@context': 'https://schema.org',
  ...payload,
});

// ---------------------------------------------------------------------------
// Site-wide
// ---------------------------------------------------------------------------

export function organizationJsonLd(): JsonLdObject {
  return withContext({
    '@type': 'Organization',
    '@id': `${SITE_URL}#organization`,
    name: 'Rasika.life',
    url: SITE_URL,
    description: 'Indian Classical Music Database',
  });
}

export function websiteJsonLd(): JsonLdObject {
  return withContext({
    '@type': 'WebSite',
    '@id': `${SITE_URL}#website`,
    name: 'Rasika.life',
    url: SITE_URL,
    description: 'Explore the world of Indian classical music',
    publisher: { '@id': `${SITE_URL}#organization` },
  });
}

export function breadcrumbJsonLd(items: Array<{ name: string; item: string }>): JsonLdObject {
  return withContext({
    '@type': 'BreadcrumbList',
    itemListElement: items.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: entry.item,
    })),
  });
}

export function faqJsonLd(
  faqs: Array<{ question: string; answer: string }>
): JsonLdObject | undefined {
  if (faqs.length === 0) return undefined;
  return withContext({
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  });
}

/**
 * A listing page's items, in the order they are shown.
 *
 * `ItemList` is the shape Google documents for an *event list page* — a page that is a set of
 * concerts rather than one concert — which is exactly what `/events`, `/past-events`,
 * `/events/tags/:tag` and the art-form listings are. Each entry carries the whole nested item
 * because a bare URL list is only read as navigation.
 */
export function itemListJsonLd(items: JsonLdObject[]): JsonLdObject | undefined {
  if (items.length === 0) return undefined;
  return withContext({
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item,
    })),
  });
}

// ---------------------------------------------------------------------------
// Artists
// ---------------------------------------------------------------------------

export interface ArtistJsonLdInput {
  name: string;
  url: string;
  description?: string;
  image?: string;
  city?: string | null;
  /** Already split and cased by `parseInstruments` — this file does no display formatting. */
  instruments?: string[];
  specialisations?: string[] | null;
  sameAs?: string[];
  awards?: string[];
  /** Groups this artist performs in. The inverse of `MusicGroup.member`. */
  memberOf?: Array<{ name: string; url: string }>;
  affiliations?: Array<{ name: string; url?: string }>;
  alumniOf?: string[];
  /** Set only for a group (`isGroup`) — the artists who make it up. */
  members?: Array<{ name: string; url: string }>;
}

/**
 * A single artist, or a performing group.
 *
 * `knowsAbout` carries the instruments and specialisations the record actually stores. It used
 * to be the constant `['Carnatic Music', 'Indian Classical Music']` on every profile, which is
 * a claim about the tradition made of Bharatanatyam dancers and Hindustani vocalists alike;
 * the same constant sat in `genre` on every group. Neither field is derivable from what an
 * artist record holds, so both now say only what it holds and nothing when it holds nothing.
 *
 * `affiliation` and `alumniOf` are kept apart, matching the split the profile makes: an
 * affiliation is a role held at an institution, an `alumniOf` is where a qualification came
 * from. Collapsing them would tell a crawler that every artist with a diploma works for the
 * awarding university.
 */
export function artistJsonLd(artist: ArtistJsonLdInput, isGroup: boolean): JsonLdObject {
  const knowsAbout = list([...(artist.instruments ?? []), ...(artist.specialisations ?? [])]);
  const city = trimmed(artist.city);

  const shared: JsonLdObject = {
    '@type': isGroup ? 'MusicGroup' : 'Person',
    '@id': `${artist.url}#artist`,
    name: artist.name,
    description: trimmed(artist.description),
    url: artist.url,
    image: trimmed(artist.image),
    sameAs: list(artist.sameAs),
    award: list(artist.awards),
    knowsAbout,
    address: city ? { '@type': 'PostalAddress', addressLocality: city } : undefined,
  };

  if (isGroup) {
    return withContext({
      ...shared,
      member: list(
        artist.members?.map(member => ({ '@type': 'Person', name: member.name, url: member.url }))
      ),
    });
  }

  return withContext({
    ...shared,
    memberOf: list(
      artist.memberOf?.map(group => ({ '@type': 'MusicGroup', name: group.name, url: group.url }))
    ),
    affiliation: list(
      artist.affiliations?.map(org => ({
        '@type': 'Organization',
        name: org.name,
        url: org.url,
      }))
    ),
    alumniOf: list(artist.alumniOf?.map(name => ({ '@type': 'EducationalOrganization', name }))),
  });
}

// ---------------------------------------------------------------------------
// Compositions, ragas, talas
// ---------------------------------------------------------------------------

/**
 * A raga and a tala are named terms in a controlled vocabulary, which is what `DefinedTerm`
 * is for. Neither is a `CreativeWork`: nobody authored Kalyani, and typing it as one would
 * invite a crawler to ask for a composer and a publication date.
 *
 * `termCode` carries the melakarta number, and only for a melakarta. A janya raga stores its
 * *parent's* mela number, so emitting it here unqualified would number Abheri among the 72 —
 * the same wrong claim the meta description used to make.
 */
export function definedTermJsonLd(term: {
  name: string;
  url: string;
  description?: string | null;
  /** The listing this term belongs to, e.g. `/carnatic/ragas`. */
  setName: string;
  setUrl: string;
  termCode?: string | number | null;
}): JsonLdObject {
  return withContext({
    '@type': 'DefinedTerm',
    '@id': `${term.url}#term`,
    name: term.name,
    description: trimmed(term.description),
    url: term.url,
    termCode: term.termCode == null ? undefined : String(term.termCode),
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: term.setName,
      url: term.setUrl,
    },
  });
}

/**
 * `about` points at the raga and tala pages, which is the whole reason those got a
 * `DefinedTerm` of their own: it turns "this kriti is in Kalyani" from a keyword into an edge
 * between two pages the crawler has already seen.
 *
 * Two things that used to be here are gone. `inAlbum: "<raga> Raga Collection"` named a
 * `MusicAlbum` that does not exist, on the site or anywhere else. And `datePublished` was set
 * to `createdAt` — the day the row was written here, which dated a nineteenth-century kriti to
 * this year.
 */
export function musicCompositionJsonLd(composition: {
  title: string;
  url: string;
  composer: { name: string; url?: string };
  ragas?: Array<{ name: string; url: string }>;
  talas?: Array<{ name: string; url: string }>;
  language?: string | null;
  /** Emitted only when the record stores lyrics; the meta description follows the same test. */
  hasLyrics?: boolean;
}): JsonLdObject {
  const ragas = composition.ragas ?? [];
  const talas = composition.talas ?? [];

  return withContext({
    '@type': 'MusicComposition',
    '@id': `${composition.url}#composition`,
    name: composition.title,
    url: composition.url,
    composer: {
      '@type': 'Person',
      name: composition.composer.name,
      url: trimmed(composition.composer.url),
    },
    inLanguage: trimmed(composition.language),
    genre: 'Carnatic music',
    about: list([
      ...ragas.map(raga => ({ '@type': 'DefinedTerm', name: raga.name, url: raga.url })),
      ...talas.map(tala => ({ '@type': 'DefinedTerm', name: tala.name, url: tala.url })),
    ]),
    // `lyrics` on a MusicComposition is a CreativeWork, not the text itself. Naming it without
    // a body is still the honest signal for "<name> lyrics", which is how this page is
    // searched for — and it is claimed only when there is something to claim.
    lyrics: composition.hasLyrics
      ? { '@type': 'CreativeWork', name: `${composition.title} lyrics`, url: composition.url }
      : undefined,
    keywords: list([
      ...ragas.map(raga => raga.name),
      ...talas.map(tala => tala.name),
      trimmed(composition.language),
      composition.composer.name,
      'Carnatic music',
    ]),
  });
}

// ---------------------------------------------------------------------------
// Events and festivals
// ---------------------------------------------------------------------------

export interface EventLocationInput {
  name?: string | null;
  url?: string;
  address?: StructuredAddress | null;
  /** A pre-built address string, used where the route has only the joined form. */
  addressText?: string | null;
}

function eventLocation(location?: EventLocationInput | null): JsonLdObject | undefined {
  const name = trimmed(location?.name);
  const address = postalAddress(location?.address) ?? trimmed(location?.addressText);
  if (!name && !address) return undefined;
  return {
    '@type': 'Place',
    name: name ?? 'India',
    url: trimmed(location?.url),
    address,
  };
}

function eventOffers(event: {
  entryType?: string | null;
  ticketing?: { url?: string | null; prices?: Record<string, number> | null } | null;
}): JsonLdObject[] | undefined {
  const ticketUrl = trimmed(event.ticketing?.url);

  if (event.entryType === 'free') {
    return [
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
        url: ticketUrl,
        availability: 'https://schema.org/InStock',
      },
    ];
  }

  const prices = Object.values(event.ticketing?.prices ?? {});
  if (prices.length > 0) {
    return prices.map(price => ({
      '@type': 'Offer',
      price: String(price),
      priceCurrency: 'INR',
      url: ticketUrl,
      availability: 'https://schema.org/InStock',
    }));
  }

  if (ticketUrl) {
    return [{ '@type': 'Offer', url: ticketUrl, availability: 'https://schema.org/InStock' }];
  }

  // by-invitation, or a ticketed event whose prices nobody has filled in. Emitting a zero
  // offer for either would put "Free" beside it in a search result.
  return undefined;
}

export interface EventJsonLdInput {
  title: string;
  url: string;
  description?: string | null;
  startDateTime: string;
  endDateTime?: string | null;
  location?: EventLocationInput | null;
  organiserName?: string | null;
  organiserUrl?: string;
  posterUrl?: string | null;
  entryType?: string | null;
  artists?: Array<{ name: string; url?: string }>;
  ticketing?: { url?: string | null; prices?: Record<string, number> | null } | null;
  /** The festival this concert belongs to, when it belongs to one. */
  partOf?: { name: string; url: string } | null;
}

export function eventJsonLd(event: EventJsonLdInput): JsonLdObject {
  return withContext({
    '@type': 'MusicEvent',
    '@id': `${event.url}#event`,
    name: event.title,
    description: trimmed(event.description),
    startDate: event.startDateTime,
    endDate: trimmed(event.endDateTime),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    image: trimmed(event.posterUrl),
    url: event.url,
    location: eventLocation(event.location),
    organizer: trimmed(event.organiserName)
      ? {
          '@type': 'Organization',
          name: event.organiserName,
          url: trimmed(event.organiserUrl),
        }
      : undefined,
    performer: list(
      event.artists?.map(artist =>
        trimmed(artist.name)
          ? { '@type': 'Person', name: artist.name, url: trimmed(artist.url) }
          : undefined
      )
    ),
    superEvent: event.partOf
      ? { '@type': 'Festival', name: event.partOf.name, url: event.partOf.url }
      : undefined,
    offers: eventOffers(event),
    isAccessibleForFree: event.entryType === 'free' ? true : undefined,
  });
}

export interface NestedEventInput {
  title: string;
  url: string;
  startDateTime: string;
  endDateTime?: string | null;
  venueName?: string | null;
  posterUrl?: string | null;
}

/**
 * One concert as it appears inside a *list* — on a venue's page, inside a festival, or in a
 * listing page's `ItemList`.
 *
 * `location` is passed in rather than read off the row because the caller usually knows it
 * better: on a venue page every entry happens at the page's own `Place`, which is already
 * spelled out with its address, so each event points back at it by `@id` instead of repeating
 * a name with no address — the shape Google rejects.
 */
export function nestedEventJsonLd(
  event: NestedEventInput,
  location?: JsonLdObject | { '@id': string }
): JsonLdObject {
  return {
    '@type': 'MusicEvent',
    name: event.title,
    startDate: event.startDateTime,
    endDate: trimmed(event.endDateTime),
    url: event.url,
    image: trimmed(event.posterUrl),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: location ?? eventLocation({ name: event.venueName }),
  };
}

/**
 * A listing page's concerts, ready for `itemListJsonLd`.
 *
 * The three event listings (`/events`, `/events/tags/:tag`, `/:artform/events`) all load the
 * same row shape, so the mapping lives here rather than three times over. Each entry keeps its
 * own venue by name — a listing has no address to hand, and the concert's own page carries the
 * full location for anything that follows the URL.
 *
 * Capped, because a busy December returns a great many rows and an `ItemList` is meant to
 * describe the page rather than replace it.
 */
export function eventListItems(
  events: Array<{
    id: string;
    title: string;
    startDateTime: string;
    endDateTime?: string | null;
    venueName?: string | null;
    posterUrl?: string | null;
  }>,
  eventUrl: (title: string, id: string) => string,
  limit = 50
): JsonLdObject[] {
  return events.slice(0, limit).map(event =>
    nestedEventJsonLd({
      title: event.title,
      url: `${SITE_URL}${eventUrl(event.title, event.id)}`,
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      venueName: event.venueName,
      posterUrl: event.posterUrl,
    })
  );
}

/**
 * Where a festival happens.
 *
 * A festival runs at whatever halls its concerts run at, and the record does not store a venue
 * of its own. Naming one when the programme is spread over several would put the wrong hall in
 * a search result, so the venue is claimed only when every event agrees on it — which is the
 * ordinary case for a sabha's own season, and never for a city-wide festival.
 */
export function festivalLocationName(
  events: Array<{ venueName?: string | null }>
): string | undefined {
  const venues = new Set(events.map(event => trimmed(event.venueName)).filter(Boolean));
  return venues.size === 1 ? [...venues][0] : undefined;
}

export function festivalJsonLd(festival: {
  name: string;
  url: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  posterUrl?: string | null;
  organiserName?: string | null;
  organiserUrl?: string;
  events?: NestedEventInput[];
}): JsonLdObject {
  const events = festival.events ?? [];
  const venueName = festivalLocationName(events);

  return withContext({
    '@type': 'Festival',
    '@id': `${festival.url}#festival`,
    name: festival.name,
    description: trimmed(festival.description),
    startDate: festival.startDate,
    endDate: trimmed(festival.endDate),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    image: trimmed(festival.posterUrl),
    url: festival.url,
    location: eventLocation({ name: venueName }),
    organizer: trimmed(festival.organiserName)
      ? {
          '@type': 'Organization',
          name: festival.organiserName,
          url: trimmed(festival.organiserUrl),
        }
      : undefined,
    subEvent: list(events.map(event => nestedEventJsonLd(event))),
  });
}

// ---------------------------------------------------------------------------
// Venues and organisers
// ---------------------------------------------------------------------------

/**
 * A hall.
 *
 * This page's whole search problem is "&lt;hall&gt; events" — impressions at position ten and
 * no clicks — and until now it published no entity data at all, only a breadcrumb. The events
 * are marked up too, by `Place.event`, each pointing back at this Place by `@id` so the
 * address is stated once and every concert inherits a complete location.
 */
export function venueJsonLd(venue: {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  venueType?: string | null;
  address?: StructuredAddress | null;
  mapLink?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  photoUrl?: string | null;
  capacity?: number | null;
  amenities?: string[] | null;
  nearestTransit?: string | null;
  socialLinks?: Array<{ url: string }> | null;
  events?: NestedEventInput[];
}): JsonLdObject {
  const placeId = `${venue.url}#venue`;

  return withContext({
    '@type': venueSchemaType(venue.venueType),
    '@id': placeId,
    name: venue.name,
    description: trimmed(venue.description),
    url: venue.url,
    image: trimmed(venue.photoUrl),
    address: postalAddress(venue.address),
    hasMap: trimmed(venue.mapLink),
    telephone: trimmed(venue.phone),
    email: venueTakesEmail(venue.venueType) ? trimmed(venue.email) : undefined,
    sameAs: list([
      trimmed(venue.website),
      ...(venue.socialLinks ?? []).map(link => trimmed(link.url)),
    ]),
    maximumAttendeeCapacity: venue.capacity ?? undefined,
    // schema.org has no property for "nearest metro", and `Place` is a building rather than a
    // business so it has no opening hours or transit fields to borrow. `additionalProperty` is
    // the sanctioned way to carry a fact the vocabulary does not name, which beats dropping a
    // line the page shows or inventing a property that would fail validation.
    additionalProperty: trimmed(venue.nearestTransit)
      ? {
          '@type': 'PropertyValue',
          name: 'Nearest transit',
          value: trimmed(venue.nearestTransit),
        }
      : undefined,
    // `amenityFeature` is what carries "wheelchair-accessible" and "hearing-loop" as
    // machine-readable accessibility rather than as two words in a badge. The slugs are the
    // stored values from `VENUE_AMENITIES`, so the names here are the record's own.
    amenityFeature: list(
      (venue.amenities ?? []).map(amenity => ({
        '@type': 'LocationFeatureSpecification',
        name: amenity.replace(/-/g, ' '),
        value: true,
      }))
    ),
    event: list((venue.events ?? []).map(event => nestedEventJsonLd(event, { '@id': placeId }))),
  });
}

/**
 * A sabha, trust, temple or other body that puts on concerts.
 *
 * The affiliated artists the page lists are deliberately *not* emitted as `member`. Membership
 * of a sabha is a specific thing — a subscriber who pays for a season ticket — and an artistic
 * director is not one. The artist's own page states the relationship the right way round, with
 * `affiliation`, which is where the junction row's role actually belongs.
 */
export function organiserJsonLd(organiser: {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  organisationType?: string | null;
  city?: string | null;
  address?: StructuredAddress | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  foundedYear?: number | null;
  socialLinks?: Array<{ url: string }> | null;
  venue?: { name: string; url?: string } | null;
  events?: NestedEventInput[];
}): JsonLdObject {
  const address =
    postalAddress(organiser.address) ??
    (trimmed(organiser.city)
      ? { '@type': 'PostalAddress', addressLocality: trimmed(organiser.city) }
      : undefined);

  return withContext({
    '@type': organisationSchemaType(organiser.organisationType),
    '@id': `${organiser.url}#organiser`,
    name: organiser.name,
    description: trimmed(organiser.description),
    url: organiser.url,
    logo: trimmed(organiser.logoUrl),
    image: trimmed(organiser.logoUrl),
    address,
    telephone: trimmed(organiser.phone),
    email: trimmed(organiser.email),
    sameAs: list([
      trimmed(organiser.website),
      ...(organiser.socialLinks ?? []).map(link => trimmed(link.url)),
    ]),
    // A year is a valid ISO 8601 date, and a year is all the record stores. Padding it to
    // January the first would invent a founding day.
    foundingDate: organiser.foundedYear ? String(organiser.foundedYear) : undefined,
    location: organiser.venue
      ? { '@type': 'Place', name: organiser.venue.name, url: trimmed(organiser.venue.url) }
      : undefined,
    event: list((organiser.events ?? []).map(event => nestedEventJsonLd(event))),
  });
}
