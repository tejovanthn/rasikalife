import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { client } from '~/api.server';
import { getSongSlug } from '~/lib/carnaticUtils';

export const meta: MetaFunction = () => {
  return [
    { title: 'Rasika.art' },
    { name: 'description', content: 'Find all your lyrics and events here!' },
  ];
};

export type LoaderData = {
  popularSongs: { id: string; name: string }[];
  popularRagas: { id: string; name: string }[];
};

export const loader: LoaderFunction = async () => {
  const popularSongs = (await client.songs.popular.query()).data;
  const popularRagas = (await client.ragas.popular.query()).data;

  return { popularSongs, popularRagas };
};

export default function Index() {
  const { popularSongs, popularRagas } = useLoaderData<LoaderData>();

  return (
    <main className="container">
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
        Welcome
      </h1>

      <section className="mt-5">
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
          Most Popular Songs
        </h2>
        <ul>
          {popularSongs.map((song) => (
            <li key={song.id}>
              <Link
                to={`/carnatic/songs/${getSongSlug({ id: song.id, name: song.name })}`}
              >
                {song.name}
              </Link>
            </li>
          ))}
          <li>
            <Link to={'/carnatic/songs'}>View all Songs</Link>
          </li>
        </ul>
      </section>

      <section className="mt-5">
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
          Most Popular Ragas
        </h2>
        <ul>
          {popularRagas.map((raga) => (
            <li key={raga.id}>
              <Link to={`/carnatic/ragas/${raga.name}`}>{raga.name}</Link>
            </li>
          ))}
          <li>
            <Link to={'/carnatic/ragas'}>View all Ragas</Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
