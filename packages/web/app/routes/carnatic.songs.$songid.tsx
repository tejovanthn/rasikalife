import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import DATA, { Song } from '~/data';

export const meta: MetaFunction = () => {
  return [
    { title: 'All Songs' },
    { name: 'description', content: 'All songs at Rasika.art' },
  ];
};

export type LoaderData = {
  data: Song;
};

export const loader: LoaderFunction = ({ params }) => {
  const song = DATA.find((song) => song.id === params.songid);

  return { data: { ...song, source: `https://www.karnatik.com/${song?.id}` } };
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
      <p>{detail}</p>
    </section>
  );
};

export default function Index() {
  const { data } = useLoaderData<LoaderData>();

  return (
    <main className="container">
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
        {data.title}
      </h1>
      <section className="mt-5">
        <ul>
          <li>Raga: {data.raga.join(',')}</li>
          <li>Tala: {data.tala}</li>
          <li>Composer: {data.composer}</li>
          <li>Language: {data.language}</li>
          <li>Source: {data.source}</li>
          <li>Last Updated: {data.updated}</li>
        </ul>
      </section>
      <Section heading="Lyrics" detail={data.lyrics} />
      <Section heading="Meaning" detail={data.meaning} />
      <Section heading="Notation" detail={data.notation} />
      <Section heading="Other Information" detail={data.otherInfo} />
    </main>
  );
}
