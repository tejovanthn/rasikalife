import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { type RouterOutput, client } from '~/api.server';
import { slugify } from '~/lib/carnaticUtils';

type LoaderData = {
  artist: NonNullable<RouterOutput['artist']['getById']>;
  relatedArtists: RouterOutput['artist']['search']['items'];
};

export const loader: LoaderFunction = async ({ params, request }) => {
  if (!params.artistid) {
    throw new Response('Not Found', { status: 404 });
  }

  // Extract ID from slug (format: "artist-name-ARTIST_ID")
  const artistId = params.artistid.split('-').pop();
  if (!artistId) {
    throw new Response('Invalid artist ID', { status: 400 });
  }

  try {
    // Get artist details
    const artist = await client.artist.getById({
      id: artistId,
      trackView: true,
    });

    if (!artist) {
      throw new Response('Artist not found', { status: 404 });
    }

    // Get related artists (same tradition)
    const relatedArtists = await client.artist.search.query({
      tradition: artist.traditions?.[0] as any,
      limit: 6,
    });

    return json<LoaderData>({
      artist,
      relatedArtists: relatedArtists.items.filter(a => a.id !== artist.id),
    });
  } catch (error) {
    console.error('Error loading artist:', error);
    throw new Response('Internal Server Error', { status: 500 });
  }
};

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
  if (!data?.artist) {
    return [
      { title: 'Artist Not Found' },
      { name: 'description', content: 'The requested artist could not be found.' },
    ];
  }

  const { artist } = data;
  const title = `${artist.name} - Indian Classical Music Artist`;
  const description = `Learn about ${artist.name}, ${artist.artistType} specializing in ${artist.traditions?.join(', ') || 'Indian classical music'}. ${artist.bio ? artist.bio.substring(0, 150) + '...' : 'Discover their musical journey and contributions.'}`;

  return [
    { title },
    { name: 'description', content: description },
    {
      name: 'keywords',
      content: `${artist.name}, ${artist.artistType}, ${artist.instruments?.join(', ')}, ${artist.traditions?.join(', ')}, Indian classical music`,
    },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'profile' },
    ...(artist.profileImage ? [{ property: 'og:image', content: artist.profileImage }] : []),
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: artist.name,
        description:
          artist.bio || `${artist.artistType} specializing in ${artist.traditions?.join(', ')}`,
        ...(artist.profileImage && { image: artist.profileImage }),
        jobTitle: artist.artistType,
        knowsAbout: artist.traditions?.join(', '),
        url: `https://rasika.life/carnatic/artists/${params.artistid}`,
      },
    },
  ];
};

export default function ArtistDetails() {
  const { artist, relatedArtists } = useLoaderData<LoaderData>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-start md:space-x-8">
          {artist.profileImage && (
            <div className="flex-shrink-0 mb-6 md:mb-0">
              <img
                src={artist.profileImage}
                alt={artist.name}
                className="w-32 h-32 md:w-48 md:h-48 rounded-full object-cover mx-auto md:mx-0"
              />
            </div>
          )}

          <div className="flex-1 text-center md:text-left">
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
              {artist.name}
            </h1>

            <p className="text-xl text-blue-600 font-medium mb-4">{artist.artistType}</p>

            {/* Quick Info */}
            <div className="space-y-2 text-sm text-gray-600">
              {artist.instruments && artist.instruments.length > 0 && (
                <div>
                  <span className="font-semibold">Instruments:</span>{' '}
                  {artist.instruments.join(', ')}
                </div>
              )}
              {artist.traditions && artist.traditions.length > 0 && (
                <div>
                  <span className="font-semibold">Traditions:</span> {artist.traditions.join(', ')}
                </div>
              )}
              {artist.viewCount && (
                <div>
                  <span className="font-semibold">Profile Views:</span>{' '}
                  {artist.viewCount.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Biography */}
      {artist.bio && (
        <section className="mb-12">
          <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mb-4">
            Biography
          </h2>
          <div className="prose prose-sm max-w-none" style={{ whiteSpace: 'pre-line' }}>
            {artist.bio}
          </div>
        </section>
      )}

      {/* Musical Details */}
      <section className="mb-12">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mb-4">
          Musical Profile
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {artist.instruments && artist.instruments.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">Instruments</h3>
              <ul className="space-y-1">
                {artist.instruments.map((instrument, index) => (
                  <li key={index} className="text-gray-700">
                    • {instrument}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {artist.traditions && artist.traditions.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">Traditions</h3>
              <ul className="space-y-1">
                {artist.traditions.map((tradition, index) => (
                  <li key={index} className="text-gray-700">
                    • {tradition}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Related Artists */}
      {relatedArtists.length > 0 && (
        <section className="mb-12">
          <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mb-6">
            Related Artists
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {relatedArtists.map(relatedArtist => (
              <Link
                key={relatedArtist.id}
                to={slugify({ name: relatedArtist.name, id: relatedArtist.id, type: 'artists' })}
                className="block p-4 border rounded-lg hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-center space-x-3">
                  {relatedArtist.profileImage && (
                    <img
                      src={relatedArtist.profileImage}
                      alt={relatedArtist.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <div className="font-medium">{relatedArtist.name}</div>
                    <div className="text-sm text-gray-600">{relatedArtist.artistType}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Footer metadata */}
      <footer className="mt-12 pt-8 border-t text-sm text-gray-500">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <div>Profile created: {new Date(artist.createdAt).toLocaleDateString()}</div>
          <div>Last updated: {new Date(artist.updatedAt).toLocaleDateString()}</div>
        </div>
      </footer>
    </main>
  );
}
