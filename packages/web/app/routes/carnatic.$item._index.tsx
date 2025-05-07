import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import type { SitemapFunction } from 'remix-sitemap';
import { serverOnly$ } from 'vite-env-only/macros';
import { slugify } from '~/lib/carnaticUtils';
import { clientMap } from '~/lib/carnaticUtils.server';

export const meta: MetaFunction = ({ params }) => {
  if (!params.item || !['ragas', 'talas', 'languages', 'composers'].includes(params.item)) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }

  return [
    { title: `All ${params.item}s` },
    { name: 'description', content: `All ${params.item}s at Rasika.life` },
  ];
};

export type LoaderData = {
  data: Array<{
    letter: string;
    items: { id: string; name: string }[];
  }>;
  params: { item: string };
};

export const loader: LoaderFunction = async ({ params }) => {
  if (!params.item || !['ragas', 'talas', 'languages', 'composers'].includes(params.item)) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }

  const data = await Promise.all(
    'abcdefghijklmnopqrstuvwxyz'.split('').map(async letter => ({
      letter,
      items: (await clientMap[params.item].byName.query({ name: letter })).data,
    }))
  );

  return { data, params };
};

export const sitemap: SitemapFunction = serverOnly$(async () => {
  const list: { loc: string; lastmod: string }[] = [];

  await Promise.all(
    ['ragas', 'talas', 'languages', 'composers'].map(async type => {
      const data = await Promise.all(
        'abcdefghijklmnopqrstuvwxyz'.split('').map(async letter => ({
          letter,
          items: (await clientMap[type].byName.query({ name: letter })).data,
        }))
      );

      data.forEach(({ items }) => {
        items.forEach(item => {
          list.push({
            loc: slugify({ type, name: item.name }),
            lastmod: new Date(item.updatedAt).toISOString(),
          });
        });
      });
    })
  );

  return list;
});

export default function ItemList() {
  const { data, params } = useLoaderData<LoaderData>();

  return (
    <main className="container">
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">All Songs</h1>
      {data.map(({ letter, items }) =>
        items.length > 0 ? (
          <section className="flex flex-row mt-5" key={letter}>
            <p className="mr-4">{letter}</p>
            <ul className="">
              {items.map(item => (
                <li key={item.id}>
                  <Link to={slugify({ type: params.item, name: item.name })}>{item.name}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null
      )}
    </main>
  );
}
