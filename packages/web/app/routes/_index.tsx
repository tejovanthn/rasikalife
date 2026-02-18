import type { ArtistType, CompositionWithRelations } from '@rasika/core/types/entities';
import { Calendar, MapPin } from 'lucide-react';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { data } from 'react-router';
import { Link, useLoaderData } from 'react-router';
import { client } from '~/api.server';
import { ArtistCard } from '~/components/ArtistCard';
import { CompositionCard } from '~/components/CompositionCard';
import { SectionHeader } from '~/components/shared';
import { OrganizationStructuredData, WebsiteStructuredData } from '~/components/structured-data';
import { Card, CardContent } from '~/components/ui/card';
import { generateEventUrl } from '~/lib/url-slug';

interface UpcomingEvent {
  id: string;
  title: string;
  startDateTime: string;
  venueName?: string;
  artists?: Array<{ title?: string; name: string }>;
}

type LoaderData = {
  popularCompositions: CompositionWithRelations[];
  recentCompositions: CompositionWithRelations[];
  featuredArtists: ArtistType[];
  upcomingEvents: UpcomingEvent[];
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Rasika.life - Indian Classical Music Database' },
    {
      name: 'description',
      content:
        'Explore the world of Indian classical music. Discover compositions, ragas, talas, artists, and their rich musical heritage.',
    },
    {
      name: 'keywords',
      content:
        'Indian classical music, Carnatic music, Hindustani music, ragas, talas, compositions, artists, classical songs',
    },
    { property: 'og:title', content: 'Rasika.life - Indian Classical Music Database' },
    {
      property: 'og:description',
      content:
        'Explore the world of Indian classical music with detailed information about compositions, ragas, talas, and artists.',
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://rasika.life' },
    { property: 'og:image', content: 'https://rasika.life/og-image.jpg' },
  ];
};

export const loader: LoaderFunction = async () => {
  try {
    const [popularCompositions, recentCompositions, featuredArtists, upcomingEvents] =
      await Promise.all([
        client.composition.list.query({ limit: 6 }),
        client.composition.list.query({ limit: 4 }),
        client.artist.list.query({ limit: 8 }),
        client.event.listUpcoming.query({ limit: 4 }),
      ]);

    return data<LoaderData>({
      popularCompositions: popularCompositions.items,
      recentCompositions: recentCompositions.items,
      featuredArtists: featuredArtists.items,
      upcomingEvents: upcomingEvents.items,
    });
  } catch (error) {
    console.error('Error loading homepage data:', error);
    // Return empty arrays on error to prevent crashes
    return data<LoaderData>({
      popularCompositions: [],
      recentCompositions: [],
      featuredArtists: [],
      upcomingEvents: [],
    });
  }
};

export default function HomePage() {
  const { popularCompositions, recentCompositions, featuredArtists, upcomingEvents } =
    useLoaderData<LoaderData>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Hero Section */}
      <section className="text-center py-12 mb-12">
        <h1 className="hero-title">Welcome to Rasika.life</h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Explore the rich world of Indian classical music. Discover compositions, learn about ragas
          and talas, and connect with the beauty of classical traditions.
        </p>
        <div className="space-x-4">
          <Link
            to="/carnatic/compositions"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Browse Compositions
          </Link>
          <Link
            to="/artists"
            className="inline-block px-6 py-3 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors"
          >
            Explore Artists
          </Link>
        </div>
      </section>

      {/* Popular Compositions */}
      <section className="mb-12">
        <SectionHeader title="Popular Compositions" viewAllPath="/carnatic/compositions" />

        {popularCompositions.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {popularCompositions.map(composition => (
              <CompositionCard key={composition.id} composition={composition} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No compositions available at the moment.</p>
          </div>
        )}
      </section>

      {/* Featured Artists */}
      <section className="mb-12">
        <SectionHeader title="Featured Artists" viewAllPath="/artists" />

        {featuredArtists.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {featuredArtists.map(artist => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No artists available at the moment.</p>
          </div>
        )}
      </section>

      {/* Recent Additions */}
      <section className="mb-12">
        <SectionHeader title="Recent Additions" />

        {recentCompositions.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {recentCompositions.map(composition => (
              <CompositionCard key={composition.id} composition={composition} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No recent compositions available.</p>
          </div>
        )}
      </section>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <section className="mb-12">
          <SectionHeader title="Upcoming Events" viewAllPath="/events" />
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingEvents.map(event => (
              <Link
                key={event.id}
                to={generateEventUrl(event.title, event.id)}
                className="block no-underline"
              >
                <Card className="h-full hover:border-primary/50 transition-colors">
                  <CardContent className="py-4">
                    <h3 className="font-semibold text-foreground truncate">{event.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(event.startDateTime).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {event.venueName && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.venueName}
                        </span>
                      )}
                    </div>
                    {event.artists && event.artists.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {event.artists
                          .map(a => `${a.title ? `${a.title} ` : ''}${a.name}`)
                          .join(', ')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick Links */}
      <section className="bg-muted rounded-lg p-8">
        <h2 className="section-heading text-center">Explore by Category</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/carnatic/compositions"
            className="p-4 bg-card rounded-lg text-center hover:shadow-md transition-shadow border border-border"
          >
            <h3 className="font-semibold text-lg text-card-foreground">Compositions</h3>
            <p className="text-sm text-muted-foreground mt-1">Explore classical pieces</p>
          </Link>
          <Link
            to="/carnatic/ragas"
            className="p-4 bg-card rounded-lg text-center hover:shadow-md transition-shadow border border-border"
          >
            <h3 className="font-semibold text-lg text-card-foreground">Ragas</h3>
            <p className="text-sm text-muted-foreground mt-1">Discover melodic frameworks</p>
          </Link>
          <Link
            to="/carnatic/talas"
            className="p-4 bg-card rounded-lg text-center hover:shadow-md transition-shadow border border-border"
          >
            <h3 className="font-semibold text-lg text-card-foreground">Talas</h3>
            <p className="text-sm text-muted-foreground mt-1">Learn about rhythmic cycles</p>
          </Link>
          <Link
            to="/artists"
            className="p-4 bg-card rounded-lg text-center hover:shadow-md transition-shadow border border-border"
          >
            <h3 className="font-semibold text-lg text-card-foreground">Artists</h3>
            <p className="text-sm text-muted-foreground mt-1">Meet classical masters</p>
          </Link>
          <Link
            to="/events"
            className="p-4 bg-card rounded-lg text-center hover:shadow-md transition-shadow border border-border"
          >
            <h3 className="font-semibold text-lg text-card-foreground">Events</h3>
            <p className="text-sm text-muted-foreground mt-1">Find upcoming performances</p>
          </Link>
          <Link
            to="/festivals"
            className="p-4 bg-card rounded-lg text-center hover:shadow-md transition-shadow border border-border"
          >
            <h3 className="font-semibold text-lg text-card-foreground">Festivals</h3>
            <p className="text-sm text-muted-foreground mt-1">Browse festival schedules</p>
          </Link>
        </div>
      </section>

      {/* Structured Data for SEO */}
      <OrganizationStructuredData />
      <WebsiteStructuredData />
    </main>
  );
}
