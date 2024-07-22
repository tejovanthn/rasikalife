import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import DATA from '~/data';

export const meta: MetaFunction = () => {
  return [
    { title: 'All Songs' },
    { name: 'description', content: 'All songs at Rasika.art' },
  ];
};

export type LoaderData = {
  data: Array<{
    letter: string;
    songs: { id: string; title: string }[];
  }>;
};

export const loader: LoaderFunction = () => {
  const allSongs = DATA.map((song) => ({ id: song.id, title: song.title }));

  const data = allSongs
    .reduce(
      (acc, song) => {
        const letter = (song.title ? song.title[0] : '=').toUpperCase();
        const index = acc.findIndex((item) => item.letter === letter);
        if (index === -1) {
          acc.push({ letter, songs: [song] });
        } else {
          acc[index].songs.push(song);
        }
        return acc;
      },
      [] as LoaderData['data'],
    )
    .sort((a, b) => (a.letter > b.letter ? 1 : -1));

  return { data };
};

export default function Index() {
  const { data } = useLoaderData<LoaderData>();

  return (
    <main className="container">
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
        All Songs
      </h1>
      {data.map(({ letter, songs }) => (
        <section className="flex flex-row mt-5">
          <p className="mr-4">{letter}</p>
          <ul className="">
            {songs.map((song) => (
              <li key={song.id}>
                <Link to={`/songs/${song.id}`}>{song.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
