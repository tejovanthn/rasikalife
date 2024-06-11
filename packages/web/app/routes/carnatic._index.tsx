import type { LoaderFunction, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import DATA from "~/data";

export const meta: MetaFunction = () => {
  return [
    { title: "Rasika.art" },
    { name: "description", content: "Find all your lyrics and events here!" },
  ];
};

export type LoaderData = {
  popularSongs: { id: string; title: string }[];
  popularRagas: { id: string; raga: string }[];
}

export const loader: LoaderFunction = () => {
  const popularSongs = DATA.slice(0, 10).map((song) => ({ id: song.id, title: song.title }));
  const popularRagas = DATA.slice(0, 10).map((song) => ({ id: song.id, raga: song.raga }));

  return { popularSongs, popularRagas };
}

export default function Index() {
  const { popularSongs, popularRagas } = useLoaderData<LoaderData>();

  return (
    <main className="container">
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">Welcome</h1>

      <section className="mt-5">
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">Most Popular Songs</h2>
        <ul>
          {popularSongs.map((song) => (
            <li key={song.id}><Link to={`/carnatic/songs/${song.id}`}>{song.title}</Link></li>
          ))}
          <li><Link to={"/carnatic/songs"}>View all Songs</Link></li>
        </ul>
      </section>

      <section className="mt-5">
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">Most Popular Ragas</h2>
        <ul>
          {popularRagas.map((song) => (
            <li key={song.id}>{song.raga}</li>
          ))}
          <li>View all Ragas</li>
        </ul>
      </section>
    </main>
  );
}
