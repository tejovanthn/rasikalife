import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import type { SitemapFunction } from 'remix-sitemap';
import { client } from '~/api.server';
import { slugify } from '~/lib/carnaticUtils';

export const meta: MetaFunction = () => {
  return [
    { title: 'All Songs' },
    { name: 'description', content: 'All songs at Rasika.art' },
  ];
};

export type LoaderData = {
  data: Array<{
    letter: string;
    songs: { id: string; name: string }[];
  }>;
};

export const loader: LoaderFunction = async () => {
  const data = await Promise.all(
    'abcdefghijklmnopqrstuvwxyz'.split('').map(async (letter) => ({
      letter,
      songs: (await client.songs.byName.query({ name: letter })).data,
    })),
  );

  return { data };
};

export const sitemap: SitemapFunction = async () => {
  const data = await Promise.all(
    'abcdefghijklmnopqrstuvwxyz'.split('').map(async (letter) => ({
      letter,
      songs: (await client.songs.byName.query({ name: letter })).data,
    })),
  );

  const list: { loc: string; lastmod: string }[] = [];

  data.forEach(({ songs }) => {
    songs.forEach((song) => {
      list.push({
        loc: slugify({ id: song.id, name: song.name }),
        lastmod: new Date(song.updatedAt).toISOString(),
      });
    });
  });

  return list;
};

export default function SongList() {
  const { data } = useLoaderData<LoaderData>();

  return (
    <main className="container">
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
        All Songs
      </h1>
      {data.map(({ letter, songs }) =>
        songs.length > 0 ? (
          <section className="flex flex-row mt-5" key={letter}>
            <p className="mr-4">{letter}</p>
            <ul className="">
              {songs.map((song) => (
                <li key={song.id}>
                  <Link to={slugify({ id: song.id, name: song.name })}>
                    {song.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </main>
  );
}
