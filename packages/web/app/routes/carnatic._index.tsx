import type { LoaderFunction, MetaFunction } from 'react-router';
import { data } from 'react-router';
import { Link, useLoaderData } from 'react-router';
import { type RouterOutput, client } from '~/api.server';
import {
  generateCompositionUrl,
  generateRagaUrl,
  generateTalaUrl,
} from '~/lib/url-slug';

type LoaderData = {
  recentCompositions: RouterOutput['composition']['list']['items'];
  recentRagas: RouterOutput['raga']['list']['items'];
  recentTalas: RouterOutput['tala']['list']['items'];
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Carnatic Music - Rasika.life' },
    {
      name: 'description',
      content:
        'Explore the rich tradition of Carnatic music. Discover compositions, ragas, talas, and the great artists who shaped this classical form.',
    },
    {
      name: 'keywords',
      content:
        'Carnatic music, South Indian classical music, ragas, talas, compositions, krithis, varnams',
    },
    { property: 'og:title', content: 'Carnatic Music - Indian Classical Music Database' },
    {
      property: 'og:description',
      content:
        'Explore the rich tradition of Carnatic music with detailed information about compositions, ragas, talas, and artists.',
    },
    { property: 'og:type', content: 'website' },
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/carnatic' },
  ];
};

export const loader: LoaderFunction = async () => {
  try {
    const [recentCompositions, recentRagas, recentTalas] = await Promise.all([
      client.composition.list.query({ limit: 8 }),
      client.raga.list.query({ limit: 6 }),
      client.tala.list.query({ limit: 6 }),
    ]);

    return data<LoaderData>({
      recentCompositions: recentCompositions.items,
      recentRagas: recentRagas.items,
      recentTalas: recentTalas.items,
    });
  } catch (error) {
    console.error('Error loading carnatic homepage:', error);
    return data<LoaderData>({
      recentCompositions: [],
      recentRagas: [],
      recentTalas: [],
    });
  }
};

const CompositionCard = ({ composition }: { composition: LoaderData['recentCompositions'][0] }) => (
  <Link
    to={generateCompositionUrl(composition.title, composition.id)}
    className="block p-3 border rounded-lg hover:shadow-md transition-shadow bg-white"
  >
    <h3 className="font-medium text-gray-900 mb-1">{composition.title}</h3>
    <div className="text-xs text-gray-600 space-y-1">
      {composition.ragas && composition.ragas.length > 0 && (
        <div>Raga: {composition.ragas.map(r => r.name).join(', ')}</div>
      )}
      {composition.talas && composition.talas.length > 0 && (
        <div>Tala: {composition.talas.map(t => t.name).join(', ')}</div>
      )}
    </div>
  </Link>
);


const RagaCard = ({ raga }: { raga: LoaderData['recentRagas'][0] }) => (
  <Link
    to={generateRagaUrl(raga.name, raga.id)}
    className="block p-3 border rounded-lg hover:shadow-md transition-shadow bg-white"
  >
    <h3 className="font-medium text-gray-900 mb-1">{raga.name}</h3>
  </Link>
);

const TalaCard = ({ tala }: { tala: LoaderData['recentTalas'][0] }) => (
  <Link
    to={generateTalaUrl(tala.name, tala.id)}
    className="block p-3 border rounded-lg hover:shadow-md transition-shadow bg-white"
  >
    <h3 className="font-medium text-gray-900 mb-1">{tala.name}</h3>
  </Link>
);

export default function CarnaticIndex() {
  const { recentCompositions, recentRagas, recentTalas } = useLoaderData<LoaderData>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Hero Section */}
      <section className="centered-section">
        <h1 className="hero-title">Carnatic Music</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Immerse yourself in the ancient tradition of South Indian classical music. Explore the
          intricate ragas, complex talas, and beautiful compositions that form the foundation of
          this rich musical heritage.
        </p>
        <div className="category-grid">
          <Link
            to="/carnatic/compositions"
            className="p-4 bg-blue-50 rounded-lg text-center hover:bg-blue-100 transition-colors"
          >
            <h3 className="font-semibold text-blue-900">Compositions</h3>
            <p className="text-xs text-blue-700 mt-1">Krithis & Varnams</p>
          </Link>
          <Link
            to="/carnatic/ragas"
            className="p-4 bg-green-50 rounded-lg text-center hover:bg-green-100 transition-colors"
          >
            <h3 className="font-semibold text-green-900">Ragas</h3>
            <p className="text-xs text-green-700 mt-1">Melodic Frameworks</p>
          </Link>
          <Link
            to="/carnatic/talas"
            className="p-4 bg-purple-50 rounded-lg text-center hover:bg-purple-100 transition-colors"
          >
            <h3 className="font-semibold text-purple-900">Talas</h3>
            <p className="text-xs text-purple-700 mt-1">Rhythmic Cycles</p>
          </Link>
          <Link
            to="/carnatic/languages"
            className="p-4 bg-red-50 rounded-lg text-center hover:bg-red-100 transition-colors"
          >
            <h3 className="font-semibold text-red-900">Languages</h3>
            <p className="text-xs text-red-700 mt-1">Classical Languages</p>
          </Link>
          <Link
            to="/artists"
            className="p-4 bg-orange-50 rounded-lg text-center hover:bg-orange-100 transition-colors"
          >
            <h3 className="font-semibold text-orange-900">Artists</h3>
            <p className="text-xs text-orange-700 mt-1">Master Musicians</p>
          </Link>
          <Link
            to="/carnatic/events"
            className="p-4 bg-amber-50 rounded-lg text-center hover:bg-amber-100 transition-colors"
          >
            <h3 className="font-semibold text-amber-900">Events</h3>
            <p className="text-xs text-amber-700 mt-1">Concerts & Festivals</p>
          </Link>
        </div>
      </section>

      {/* Recent Compositions */}
      <section className="mb-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Recent Compositions</h2>
          <Link
            to="/carnatic/compositions"
            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
          >
            View All →
          </Link>
        </div>

        {recentCompositions.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {recentCompositions.map(composition => (
              <CompositionCard key={composition.id} composition={composition} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No compositions available.</p>
          </div>
        )}
      </section>

      {/* Ragas and Talas */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Recent Ragas */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Ragas</h2>
            <Link
              to="/carnatic/ragas"
              className="text-blue-600 hover:text-blue-800 font-medium text-sm"
            >
              View All →
            </Link>
          </div>

          {recentRagas.length > 0 ? (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {recentRagas.map(raga => (
                <RagaCard key={raga.id} raga={raga} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No ragas available.</p>
            </div>
          )}
        </section>

        {/* Recent Talas */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Talas</h2>
            <Link
              to="/carnatic/talas"
              className="text-blue-600 hover:text-blue-800 font-medium text-sm"
            >
              View All →
            </Link>
          </div>

          {recentTalas.length > 0 ? (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {recentTalas.map(tala => (
                <TalaCard key={tala.id} tala={tala} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No talas available.</p>
            </div>
          )}
        </section>
      </div>

      {/* About Carnatic Music */}
      <section className="bg-gray-50 rounded-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">About Carnatic Music</h2>
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-700 mb-4">
            Carnatic music is one of two main subgenres of Indian classical music that evolved from
            ancient Hindu texts and traditions. It originated in South India and is known for its
            intricate melodic patterns (ragas) and complex rhythmic cycles (talas).
          </p>
          <p className="text-gray-700">
            This tradition emphasizes improvisation within a structured framework, featuring
            compositions by legendary composers like Tyagaraja, Muthuswami Dikshitar, and Syama
            Sastri - collectively known as the Trinity of Carnatic music.
          </p>
        </div>
      </section>
    </main>
  );
}
