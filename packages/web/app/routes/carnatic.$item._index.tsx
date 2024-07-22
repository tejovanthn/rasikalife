import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { allTalas } from '~/data';

export const meta: MetaFunction = ({ params }) => {
  if (!['raga', 'tala', 'language', 'composer'].includes(params.item || '')) {
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
    items: { id: string; item: string }[];
  }>;
};

export const loader: LoaderFunction = ({ params }) => {
  if (!['raga', 'tala', 'language', 'composer'].includes(params.item || '')) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }

  const data = allTalas
    .reduce(
      (acc, tala) => {
        const letter = (tala.tala ? tala.tala[0] : '=').toUpperCase();
        const index = acc.findIndex((item) => item.letter === letter);
        if (index === -1) {
          acc.push({ letter, items: [{ id: tala.tala, item: tala.tala }] });
        } else {
          acc[index].items.push({ id: tala.tala, item: tala.tala });
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
      {data.map(({ letter, items }) => (
        <section className="flex flex-row mt-5">
          <p className="mr-4">{letter}</p>
          <ul className="">
            {items.map((item) => (
              <li key={item.id}>
                <Link to={`/songs/${item.id}`}>{item.item}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
