import { type LoaderFunction, type MetaFunction, json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { client } from '~/api.server';
import { ArtistCard } from '~/components/ArtistCard';

export const loader: LoaderFunction = async () => {
  // Simple mock data - in real app this would come from database
  const artists = [
    {
      id: '1',
      name: 'M.S. Subbulakshmi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Ravi Shankar',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Bismillah Khan',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  return json({ artists });
};

interface LoaderData {
  artists: any[];
  query?: string;
}

export const meta: MetaFunction = () => {
  return [
    { title: 'Artists - Indian Classical Music - Rasika.life' },
    {
      name: 'description',
      content:
        'Explore renowned artists of Indian classical music. Discover their musical styles and contributions to classical traditions.',
    },
    {
      name: 'keywords',
      content:
        'Indian classical music artists, Carnatic musicians, Hindustani artists, classical musicians, maestros',
    },
  ];
};

export default function ArtistsIndex() {
  const { artists } = useLoaderData() as any;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Artists</h1>
        <p className="text-gray-600">Explore renowned artists of Indian classical music.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {artists.map((artist: any) => (
          <ArtistCard key={artist.id} artist={artist} />
        ))}
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
      <p className="text-gray-600">
        We're having trouble loading the artists. Please try again later.
      </p>
    </div>
  );
}
