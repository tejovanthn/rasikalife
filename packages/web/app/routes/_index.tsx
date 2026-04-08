import type { ArtistType, CompositionWithRelations } from '@rasika/core/types/entities';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { data } from 'react-router';
import { Link, useLoaderData } from 'react-router';
import { client } from '~/api.server';
import { ArtistCard } from '~/components/ArtistCard';
import { CompositionCard } from '~/components/CompositionCard';
import { EventCard } from '~/components/EventCard';
import { SectionHeader } from '~/components/shared';
import { OrganizationStructuredData, WebsiteStructuredData } from '~/components/structured-data';

interface UpcomingEvent {
  id: string;
  title: string;
  startDateTime: string;
  venueName?: string;
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
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Rasika.life - Indian Classical Music & Performances' },
    {
      name: 'description',
      content:
        'Discover upcoming Indian classical music concerts and performances. Explore compositions, ragas, artists, and their rich musical heritage.',
    },
    {
      name: 'keywords',
      content:
        'Indian classical music, Carnatic concerts, Hindustani performances, ragas, artists, classical events',
    },
    { property: 'og:title', content: 'Rasika.life - Indian Classical Music & Performances' },
    {
      property: 'og:description',
      content: 'Find upcoming Indian classical music concerts, artists, and compositions.',
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://rasika.life' },
    { property: 'og:image', content: 'https://rasika.life/og-image.jpg' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Rasika.life - Indian Classical Music & Performances' },
    {
      name: 'twitter:description',
      content: 'Find upcoming Indian classical music concerts, artists, and compositions.',
    },
    { name: 'twitter:image', content: 'https://rasika.life/og-image.jpg' },
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life' },
  ];
};

export const loader: LoaderFunction = async () => {
  try {
    const [popularCompositions, featuredArtists, upcomingEvents] = await Promise.all([
      client.composition.list.query({ limit: 6 }),
      client.artist.list.query({ limit: 4 }),
      client.event.listUpcoming.query({ limit: 6 }),
    ]);

    return data<LoaderData>({
      popularCompositions: popularCompositions.items,
      featuredArtists: featuredArtists.items,
      upcomingEvents: upcomingEvents.items,
    });
  } catch (error) {
    console.error('Error loading homepage data:', error);
    return data<LoaderData>({
      popularCompositions: [],
      featuredArtists: [],
      upcomingEvents: [],
    });
  }
};

export default function HomePage() {
  const { popularCompositions, featuredArtists, upcomingEvents } = useLoaderData<LoaderData>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Hero */}
      <section className="text-center py-12 mb-12">
        <h1 className="hero-title">Indian Classical Music, Live Near You</h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Discover upcoming concerts and performances. Explore the world of Carnatic and Hindustani
          music — artists, compositions, ragas, and more.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/events"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Events
          </Link>
          <Link
            to="/artists"
            className="inline-block px-6 py-3 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Artists
          </Link>
          <Link
            to="/carnatic/compositions"
            className="inline-block px-6 py-3 border border-border text-muted-foreground rounded-lg hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Compositions
          </Link>
        </div>
      </section>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <section className="mb-14">
          <SectionHeader title="Upcoming Events" viewAllPath="/events" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
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
