import type { LoaderFunction, MetaFunction } from 'react-router';
import { data } from 'react-router';
import { Link, useLoaderData } from 'react-router';
import { type RouterOutput, client } from '~/api.server';
import { CompositionCard } from '~/components/CompositionCard';
import { RagaCard } from '~/components/RagaCard';
import { TalaCard } from '~/components/TalaCard';
import { EmptyState } from '~/components/shared/EmptyState';
import { SectionHeader } from '~/components/shared/SectionHeader';
import { BreadcrumbStructuredData } from '~/components/structured-data';

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

const CATEGORIES = [
  { href: '/carnatic/compositions', label: 'Compositions', subtitle: 'Krithis & Varnams' },
  { href: '/carnatic/ragas', label: 'Ragas', subtitle: 'Melodic Frameworks' },
  { href: '/carnatic/talas', label: 'Talas', subtitle: 'Rhythmic Cycles' },
  { href: '/carnatic/languages', label: 'Languages', subtitle: 'Classical Languages' },
  { href: '/artists', label: 'Artists', subtitle: 'Master Musicians' },
  { href: '/carnatic/events', label: 'Events', subtitle: 'Concerts & Festivals' },
];

export default function CarnaticIndex() {
  const { recentCompositions, recentRagas, recentTalas } = useLoaderData<LoaderData>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Hero Section */}
      <section className="centered-section">
        <h1 className="hero-title">Carnatic Music</h1>
        <p className="hero-description">
          Immerse yourself in the ancient tradition of South Indian classical music. Explore the
          intricate ragas, complex talas, and beautiful compositions that form the foundation of
          this rich musical heritage.
        </p>
        <div className="category-grid">
          {CATEGORIES.map(({ href, label, subtitle }) => (
            <Link key={href} to={href} className="category-card">
              <h3 className="category-card-title">{label}</h3>
              <p className="category-card-subtitle">{subtitle}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Compositions */}
      <section className="mb-12">
        <SectionHeader title="Recent Compositions" viewAllPath="/carnatic/compositions" />
        {recentCompositions.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {recentCompositions.map(composition => (
              <CompositionCard key={composition.id} composition={composition} />
            ))}
          </div>
        ) : (
          <EmptyState message="No compositions available." />
        )}
      </section>

      {/* Ragas and Talas */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <section>
          <SectionHeader title="Ragas" viewAllPath="/carnatic/ragas" />
          {recentRagas.length > 0 ? (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {recentRagas.map(raga => (
                <RagaCard key={raga.id} raga={raga} />
              ))}
            </div>
          ) : (
            <EmptyState message="No ragas available." />
          )}
        </section>

        <section>
          <SectionHeader title="Talas" viewAllPath="/carnatic/talas" />
          {recentTalas.length > 0 ? (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {recentTalas.map(tala => (
                <TalaCard key={tala.id} tala={tala} />
              ))}
            </div>
          ) : (
            <EmptyState message="No talas available." />
          )}
        </section>
      </div>

      {/* About Carnatic Music */}
      <section className="bg-muted rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-4 mt-0">About Carnatic Music</h2>
        <div className="space-y-3">
          <p className="text-muted-foreground">
            Carnatic music is one of two main subgenres of Indian classical music that evolved from
            ancient Hindu texts and traditions. It originated in South India and is known for its
            intricate melodic patterns (ragas) and complex rhythmic cycles (talas).
          </p>
          <p className="text-muted-foreground">
            This tradition emphasizes improvisation within a structured framework, featuring
            compositions by legendary composers like Tyagaraja, Muthuswami Dikshitar, and Syama
            Sastri — collectively known as the Trinity of Carnatic music.
          </p>
        </div>
      </section>

      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Carnatic', item: 'https://rasika.life/carnatic' },
        ]}
      />
    </main>
  );
}
