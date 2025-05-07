import type { LoaderFunction, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import Markdown from 'react-markdown';
import { client } from '~/api.server';
import { slugify } from '~/lib/carnaticUtils';

export const meta: MetaFunction = () => {
  return [
    { title: 'Rasika.art' },
    { name: 'description', content: 'Find all your lyrics and events here!' },
  ];
};

export type LoaderData = {
  popularSongs: { id: string; name: string }[];
  popularRagas: { id: string; name: string }[];
  homepageContent: string;
};

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
  const popularSongs = (await client.songs.popular.query()).data;
  const popularRagas = (await client.ragas.popular.query()).data;

  const url = new URL(request.url);
  const homepageContent = (await client.content.byPath.query({ path: url.pathname })).data;

  return {
    popularSongs,
    popularRagas,
    homepageContent: homepageContent?.content || '',
  };
};

export default function CarnaticIndex() {
  const { popularSongs, popularRagas, homepageContent } = useLoaderData<LoaderData>();

  return (
    <main className="container flex flex-col lg:grid lg:grid-cols-2 lg:gap-8">
      <div className="order-2 lg:order-1">
        <Markdown>{homepageContent}</Markdown>
      </div>
      <div className="order-1 lg:order-2">
        <section className="mt-5">
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
            Most Popular Songs
          </h2>
          <ul>
            {popularSongs.map(song => (
              <li key={song.id}>
                <Link to={slugify({ id: song.id, name: song.name })}>{song.name}</Link>
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
            {popularRagas.map(raga => (
              <li key={raga.id}>
                <Link to={slugify({ name: raga.name, type: 'ragas' })}>{raga.name}</Link>
              </li>
            ))}
            <li>
              <Link to={'/carnatic/ragas'}>View all Ragas</Link>
            </li>
          </ul>
        </section>

        <section className="mt-5">
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
            Resources
          </h2>
          <ul>
            <li>
              <Link to={'/carnatic/resources/glossary'}>Glossary</Link>
            </li>
            <li>
              <Link to={'/carnatic/resources/learning'}>Learning</Link>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
