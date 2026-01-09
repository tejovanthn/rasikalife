import type { Artist } from '@rasika/core/domain/artist/entity';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { client } from '~/api.server';

export async function loader({ params }: { params: { artistid?: string } }) {
  const { artistid } = params;

  if (!artistid) {
    throw new Response('Artist ID is required', { status: 400 });
  }

  const slugId = artistid.split('-').pop();

  if (!slugId) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const artist = await client.artist.get.query({ id: slugId });

  if (!artist) {
    throw new Response('Artist not found', { status: 404 });
  }

  return json({
    entity: artist,
    breadcrumbs: [
      { name: 'Home', href: '/' },
      { name: 'Carnatic', href: '/carnatic' },
      { name: 'Artists', href: '/carnatic/artists' },
      { name: artist.name, href: `/carnatic/artists/${artistid}` },
    ],
  });
}

export default function ArtistDetails() {
  const { entity: artist } = useLoaderData<{
    entity: Artist;
    breadcrumbs: Array<{ name: string; href: string }>;
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <ArtistHeader artist={artist} />
      <ArtistProfile artist={artist} />
      {artist.bio && <ArtistBiography artist={artist} />}
      {artist.instruments && artist.instruments.length > 0 && (
        <ArtistInstruments instruments={artist.instruments} />
      )}
      {artist.traditions && artist.traditions.length > 0 && (
        <ArtistTraditions traditions={artist.traditions} />
      )}
    </main>
  );
}

function ArtistHeader({ artist }: { artist: Artist }) {
  return (
    <header className="mb-8">
      <h1 className="text-4xl font-bold mb-2">{artist.name}</h1>
      <p className="text-xl text-blue-600">{artist.artistType}</p>
      {artist.isVerified && (
        <span className="inline-block bg-green-100 text-green-800 text-sm px-2 py-1 rounded">
          Verified Artist
        </span>
      )}
    </header>
  );
}

function ArtistProfile({ artist }: { artist: Artist }) {
  return (
    <section className="mb-8 p-4 bg-gray-50 rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Quick Info</h2>
      <p>Profile Views: {artist.viewCount?.toLocaleString()}</p>
      {artist.profileImage && (
        <img
          src={artist.profileImage}
          alt={artist.name}
          className="mt-4 w-32 h-32 rounded-full object-cover"
        />
      )}
    </section>
  );
}

function ArtistBiography({ artist }: { artist: Artist }) {
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Biography</h2>
      <p className="whitespace-pre-line">{artist.bio}</p>
    </section>
  );
}

function ArtistInstruments({ instruments }: { instruments: string[] }) {
  return (
    <section className="mb-8 p-4 bg-gray-50 rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Instruments</h2>
      <ul className="space-y-1">
        {instruments.map(instrument => (
          <li key={instrument} className="text-gray-700">
            • {instrument}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ArtistTraditions({ traditions }: { traditions: string[] }) {
  return (
    <section className="mb-8 p-4 bg-gray-50 rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Traditions</h2>
      <ul className="space-y-1">
        {traditions.map(tradition => (
          <li key={tradition} className="text-gray-700">
            • {tradition}
          </li>
        ))}
      </ul>
    </section>
  );
}
