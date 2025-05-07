import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { slugify } from '~/lib/carnaticUtils';
import { clientMap } from '~/lib/carnaticUtils.server';

export const meta: MetaFunction = () => {
  return [{ title: 'All Songs' }, { name: 'description', content: 'All songs at Rasika.art' }];
};

export type LoaderData = {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
};

export const loader: LoaderFunction = async ({ params }) => {
  if (
    !params.item ||
    !['ragas', 'talas', 'languages', 'composers'].includes(params.item) ||
    !params.itemid
  ) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }

  const item = await clientMap[params.item].byName.query({
    name: params.itemid.replace('-', ' ') || '',
  });
  const songs = await clientMap.songs[params.item].query({
    raga: params.itemid.replace('-', ' ') || '',
  });

  if (!item.data[0] || !songs.data) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }

  return { data: { item: item.data[0], songs: songs.data } };
};

export default function ItemDetails() {
  const { data } = useLoaderData<LoaderData>();

  return (
    <main className="container">
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
        {data.item.name}
      </h1>
      <section className="mt-5">
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
          Songs
        </h2>
        <ul>
          {data.songs.map(song => (
            <li key={song.id}>
              <Link to={slugify({ id: song.id, name: song.name })}>{song.name}</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
