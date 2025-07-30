import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { type RouterOutput, client } from '~/api.server';
import { slugify } from '~/lib/carnaticUtils';

type LoaderData = {
  popularCompositions: RouterOutput['composition']['search']['items'];
  recentCompositions: RouterOutput['composition']['search']['items'];
  // featuredArtists: RouterOutput['artist']['getPopular'];
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
    const [popularCompositions, recentCompositions] = await Promise.all([
      client.composition.search.query({ limit: 6 }),
      client.composition.search.query({ limit: 4 }),
      // client.artist.getPopular({ limit: 8 }),
    ]);

    return json<LoaderData>({
      popularCompositions: popularCompositions.items,
      recentCompositions: recentCompositions.items,
      // featuredArtists,
    });
  } catch (error) {
    console.error('Error loading homepage data:', error);
    // Return empty arrays on error to prevent crashes
    return json<LoaderData>({
      popularCompositions: [],
      recentCompositions: [],
      // featuredArtists: [],
    });
  }
};

const CompositionCard = ({
  composition,
}: { composition: LoaderData['popularCompositions'][0] }) => (
  <Link
    to={slugify({ name: composition.title, id: composition.id, type: 'compositions' })}
    className="block p-4 border border-border rounded-lg hover:shadow-md transition-shadow bg-card"
  >
    <h3 className="font-semibold text-lg text-card-foreground mb-2">{composition.title}</h3>
    <div className="text-sm text-muted-foreground space-y-1">
      {composition.ragaIds && (
        <div>
          <span className="font-medium">Raga:</span> {composition.ragaIds}
        </div>
      )}
      {composition.talaIds && (
        <div>
          <span className="font-medium">Tala:</span> {composition.talaIds}
        </div>
      )}
    </div>
    {composition.meaning && (
      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
        {composition.meaning.length > 100
          ? composition.meaning.substring(0, 100) + '...'
          : composition.meaning}
      </p>
    )}
  </Link>
);

// const ArtistCard = ({ artist }: { artist: LoaderData['featuredArtists'][0] }) => (
//   <Link
//     to={slugify({ name: artist.name, id: artist.id, type: 'artists' })}
//     className="block p-3 border border-border rounded-lg hover:shadow-md transition-shadow bg-card text-center"
//   >
//     <h3 className="font-medium text-card-foreground">{artist.name}</h3>
//     <p className="text-sm text-muted-foreground mt-1">{artist.artistType}</p>
//     {artist.viewCount && (
//       <p className="text-xs text-muted-foreground mt-1">{artist.viewCount} views</p>
//     )}
//   </Link>
// );

export default function HomePage() {
  const { popularCompositions, recentCompositions } = useLoaderData<LoaderData>();

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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-foreground">Popular Compositions</h2>
          <Link
            to="/carnatic/compositions"
            className="text-primary hover:text-primary/80 font-medium"
          >
            View All →
          </Link>
        </div>

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
      {/* <section className="mb-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-foreground">Featured Artists</h2>
          <Link to="/carnatic/artists" className="text-primary hover:text-primary/80 font-medium">
            View All →
          </Link>
        </div>

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
      </section> */}

      {/* Recent Additions */}
      <section className="mb-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-foreground">Recent Additions</h2>
        </div>

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
