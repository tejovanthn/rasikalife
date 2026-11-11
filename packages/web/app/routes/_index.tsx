import { DEFAULT_EVENT_TIMEZONE } from '@rasika/core/domain/event/client';
import { startOfDayInstant, todayInTimeZone } from '@rasika/core/shared/timezone';
import type { ArtistType, CompositionWithRelations } from '@rasika/core/types/entities';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { data } from 'react-router';
import { Link, useLoaderData } from 'react-router';
import { client } from '~/api.server';
import { ArtistCard } from '~/components/ArtistCard';
import { CompositionCard } from '~/components/CompositionCard';
import { EventList } from '~/components/EventCard';
import { SectionHeader } from '~/components/shared';
import { OrganizationStructuredData, WebsiteStructuredData } from '~/components/structured-data';
import { type CityLink, homeCityLinks } from '~/lib/featured-cities';

interface UpcomingEvent {
  id: string;
  title: string;
  startDateTime: string;
  venueName?: string;
  city?: string;
  organiserName?: string;
  artists?: Array<{ title?: string; name: string; role?: string }>;
  tags?: string[];
  entryType?: string;
  posterUrl?: string;
}

type LoaderData = {
  popularCompositions: CompositionWithRelations[];
  featuredArtists: ArtistType[];
  upcomingEvents: UpcomingEvent[];
  cityLinks: CityLink[];
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Indian Classical Music and Dance Events | Rasika.life' },
    {
      name: 'description',
      content:
        'Find upcoming Indian classical music and dance events, from Carnatic and Hindustani concerts to Bharatanatyam. Look up ragas, lyrics and artists.',
    },
    {
      name: 'keywords',
      content:
        'Indian classical music, Carnatic concerts, Hindustani performances, ragas, artists, classical events',
    },
    { property: 'og:title', content: 'Rasika.life: Indian Classical Music and Dance Events' },
    {
      property: 'og:description',
      content: 'Upcoming Indian classical music and dance events, ragas, lyrics and artists.',
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://rasika.life' },
    { property: 'og:image', content: 'https://rasika.life/og-image.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Rasika.life: Indian Classical Music and Dance Events' },
    {
      name: 'twitter:description',
      content: 'Upcoming Indian classical music and dance events, ragas, lyrics and artists.',
    },
    { name: 'twitter:image', content: 'https://rasika.life/og-image.png' },
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life' },
  ];
};

export const loader: LoaderFunction = async () => {
  try {
    const zone = DEFAULT_EVENT_TIMEZONE;
    const [popularCompositions, featuredArtists, listings] = await Promise.all([
      client.composition.list.query({ limit: 6 }),
      client.artist.list.query({ limit: 4 }),
      // Already sorted by start time. Carries each event's city, from its venue.
      client.event.upcomingListings.query({
        from: startOfDayInstant(todayInTimeZone(zone), zone),
      }),
    ]);

    return data<LoaderData>({
      popularCompositions: popularCompositions.items,
      featuredArtists: featuredArtists.items,
      upcomingEvents: listings.slice(0, 6),
      cityLinks: homeCityLinks(listings),
    });
  } catch (error) {
    console.error('Error loading homepage data:', error);
    return data<LoaderData>({
      popularCompositions: [],
      featuredArtists: [],
      upcomingEvents: [],
      cityLinks: homeCityLinks([]),
    });
  }
};

export default function HomePage() {
  const { popularCompositions, featuredArtists, upcomingEvents, cityLinks } =
    useLoaderData<LoaderData>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Hero */}
      <section className="py-12 mb-12 md:flex md:items-end md:justify-between md:gap-12">
        <div className="md:max-w-xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">
            Carnatic &nbsp;·&nbsp; Hindustani
          </p>
          <h1 className="hero-title text-left mt-0">
            Indian Classical Music, <span className="text-primary">Live Near You</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-lg">
            Discover upcoming concerts and performances. Explore compositions, ragas, artists, and
            the living tradition of Indian classical music.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/events"
              className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Upcoming Events
            </Link>
            <Link
              to="/artists"
              className="inline-block px-6 py-3 border border-border text-foreground rounded-lg hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Artists
            </Link>
            <Link
              to="/carnatic/compositions"
              className="inline-block px-6 py-3 border border-border text-foreground rounded-lg hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Compositions
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Concerts in{' '}
            {cityLinks.map((city, i) => (
              <span key={city.slug}>
                {i > 0 && ' · '}
                <Link to={city.href} className="underline underline-offset-4 hover:text-foreground">
                  {city.name}
                </Link>
              </span>
            ))}
          </p>
        </div>
        <aside
          className="hidden md:flex flex-col items-end gap-3 text-right shrink-0"
          aria-label="Music tradition highlights"
        >
          {[
            { label: 'Ragas', sub: 'melodic frameworks' },
            { label: 'Talas', sub: 'rhythmic cycles' },
            { label: 'Kritis', sub: 'devotional compositions' },
          ].map(item => (
            <div key={item.label} className="border-r-2 border-primary pr-4">
              <div className="text-sm font-semibold text-foreground">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.sub}</div>
            </div>
          ))}
        </aside>
      </section>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <section className="mb-14">
          <SectionHeader title="Upcoming Events" viewAllPath="/events" />
          {/* A column of rows, held to a reading width: a row stretched across the whole page
              puts the time and the poster a screen apart. */}
          <EventList events={upcomingEvents} priorityFirst className="max-w-3xl" />
        </section>
      )}

      {/* Featured Artists */}
      {featuredArtists.length > 0 && (
        <section className="mb-14">
          <SectionHeader title="Artists" viewAllPath="/artists" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {featuredArtists.map(artist => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      )}

      {/* Compositions */}
      {popularCompositions.length > 0 && (
        <section className="mb-14">
          <SectionHeader title="Compositions" viewAllPath="/carnatic/compositions" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {popularCompositions.map(composition => (
              <CompositionCard key={composition.id} composition={composition} />
            ))}
          </div>
        </section>
      )}

      {/* Structured Data for SEO */}
      <OrganizationStructuredData />
      <WebsiteStructuredData />
    </main>
  );
}
