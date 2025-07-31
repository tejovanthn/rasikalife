import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { type RouterOutput, client } from '~/api.server';
import { EntityCard, SectionHeader } from '~/components/shared';
import type { EntityCardField } from '~/components/shared';

type LoaderData = {
  popularCompositions: RouterOutput['composition']['search']['items'];
  recentCompositions: RouterOutput['composition']['search']['items'];
  featuredArtists: RouterOutput['artist']['getPopular'];
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
  ];
};

export const loader: LoaderFunction = async () => {
  try {
    const [popularCompositions, recentCompositions, featuredArtists] = await Promise.all([
      client.composition.search.query({ limit: 6 }),
      client.composition.search.query({ limit: 4 }),
      client.artist.getPopular.query({ limit: 8 }),
    ]);

    return json<LoaderData>({
      popularCompositions: popularCompositions.items,
      recentCompositions: recentCompositions.items,
      featuredArtists,
    });
  } catch (error) {
    console.error('Error loading homepage data:', error);
    // Return empty arrays on error to prevent crashes
    return json<LoaderData>({
      popularCompositions: [],
      recentCompositions: [],
      featuredArtists: [],
    });
  }
};

const CompositionCard = ({
  composition,
}: { composition: LoaderData['popularCompositions'][0] }) => {
  const fields: EntityCardField[] = [
    {
      label: 'Raga',
      value:
        composition.ragaIds && composition.ragaIds.length > 0
          ? `${composition.ragaIds.length} raga${composition.ragaIds.length > 1 ? 's' : ''}`
          : 'Unknown',
    },
    {
      label: 'Tala',
      value:
        composition.talaIds && composition.talaIds.length > 0
          ? `${composition.talaIds.length} tala${composition.talaIds.length > 1 ? 's' : ''}`
          : 'Unknown',
    },
  ];

  return (
    <EntityCard
      id={composition.id}
      title={composition.title}
      type="compositions"
      fields={fields}
      description={composition.meaning}
    />
  );
};

const ArtistCard = ({ artist }: { artist: LoaderData['featuredArtists'][0] }) => {
  return (
    <EntityCard
      id={artist.id}
      title={artist.name}
      type="artists"
      subtitle={artist.artistType}
      metadata={{ viewCount: artist.viewCount }}
      compact
      className="text-center"
    />
  );
};

export default function HomePage() {
  const { popularCompositions, recentCompositions, featuredArtists } = useLoaderData<LoaderData>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Hero Section */}
      <section className="text-center py-12 mb-12">
        <h1 className="text-5xl font-bold text-foreground mb-4">Welcome to Rasika.life</h1>
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
            to="/carnatic/artists"
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
        <SectionHeader title="Featured Artists" viewAllPath="/carnatic/artists" />

        {featuredArtists.length > 0 ? (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
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

      {/* Quick Links */}
      <section className="bg-muted rounded-lg p-8">
        <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Explore by Category</h2>
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
            to="/carnatic/artists"
            className="p-4 bg-card rounded-lg text-center hover:shadow-md transition-shadow border border-border"
          >
            <h3 className="font-semibold text-lg text-card-foreground">Artists</h3>
            <p className="text-sm text-muted-foreground mt-1">Meet classical masters</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
