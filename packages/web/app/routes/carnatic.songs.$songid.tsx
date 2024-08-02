import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { RouterOutput, client } from '~/api.server';

export const meta: MetaFunction = () => {
  return [
    { title: 'All Songs' },
    { name: 'description', content: 'All songs at Rasika.art' },
  ];
};

export type LoaderData = {
  data: RouterOutput['songs']['byId'];
};

export const loader: LoaderFunction = async ({ params }) => {
  const song = await client.songs.byId.query({ id: params.songid || '' });
  if (song.data.length === 0) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }

  return { data: song.data[0] };
};

const Section = ({ heading, detail }: { heading: string; detail?: string }) => {
  if (!detail) {
    return null;
  }
  return (
    <section className="mt-5">
      <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
        {heading}
      </h2>
      <p style={{ whiteSpace: 'pre-line' }}>{detail}</p>
    </section>
  );
};

export default function Index() {
  const { data } = useLoaderData<LoaderData>();

  return (
    <main className="container">
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
        {data.name}
      </h1>
      <section className="mt-5">
        <ul>
          <li>
            Raga: <Link to={`/carnatic/ragas/${data.raga}`}>{data.raga}</Link>
          </li>
          <li>
            Tala: <Link to={`/carnatic/talas/${data.tala}`}>{data.tala}</Link>
          </li>
          <li>
            Composer:{' '}
            <Link to={`/carnatic/composers/${data.composer}`}>
              {data.composer}
            </Link>
          </li>
          <li>
            Language:{' '}
            <Link to={`/carnatic/languages/${data.language}`}>
              {data.language}
            </Link>
          </li>
          <li>
            Source:{' '}
            <a href={data.source} target="_blank">
              {data.source}
            </a>
          </li>
          <li>Last Updated: {new Date(data.updatedAt).toDateString()}</li>
        </ul>
      </section>
      <Section heading="Lyrics" detail={data.lyrics} />
      <Section heading="Meaning" detail={data.meaning} />
      <Section heading="Notation" detail={data.notation} />
      <Section heading="Other Information" detail={data.otherInfo} />
    </main>
  );
}
