import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { Link, Params, useLoaderData } from '@remix-run/react';
import { client } from '~/api.server';

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

export const handleItemTypes = ({ params }: { params: Params }) => {
  if (
    !params.item ||
    !['ragas', 'talas', 'languages', 'composers'].includes(params.item)
  ) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }
};

export const clientMap = {
  ragas: client.ragas,
  talas: client.talas,
  languages: client.languages,
  composers: client.composers,
  songs: {
    ragas: client.songs.byRaga,
    talas: client.songs.byTala,
    languages: client.songs.byLanguage,
    composers: client.songs.byComposer,
  },
};

export const loader: LoaderFunction = async () => {
  const popularSongs = (await client.songs.popular.query()).data;
  const popularRagas = (await client.ragas.popular.query()).data;

  console.log({ popularSongs, popularRagas });

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
              <Link to={`/carnatic/songs/${song.id}`}>{song.name}</Link>
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
          {popularRagas.map((song) => (
            <li key={song.id}>{song.name}</li>
          ))}
          <li>View all Ragas</li>
        </ul>
      </section>
    </main>
  );
}
