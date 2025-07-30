import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData, useSearchParams, Form } from '@remix-run/react';
import { Search } from 'lucide-react';
import { type RouterOutput, client } from '~/api.server';
import { slugify } from '~/lib/carnaticUtils';

type LoaderData = {
  ragas: RouterOutput['raga']['search'];
  searchQuery?: string;
  melakartaFilter?: number;
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get('q') || undefined;
  const melakartaFilter = url.searchParams.get('melakarta')
    ? Number.parseInt(url.searchParams.get('melakarta')!)
    : undefined;
  const limit = 24;

  try {
    const ragas = await client.raga.search.query({
      query: searchQuery,
      melakarta: melakartaFilter,
      limit,
      nextToken: url.searchParams.get('token') || undefined,
    });

    return json<LoaderData>({
      ragas,
      searchQuery,
      melakartaFilter,
    });
  } catch (error) {
    console.error('Error loading ragas:', error);
    throw new Response('Internal Server Error', { status: 500 });
  }
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Carnatic Ragas - Rasika.life' },
    {
      name: 'description',
      content:
        'Explore the melodic frameworks of Carnatic music. Learn about ragas, their characteristics, and musical applications.',
    },
    {
      name: 'keywords',
      content: 'Carnatic ragas, melakarta, janya ragas, Indian classical music scales',
    },
  ];
};

const RagaCard = ({ raga }: { raga: LoaderData['ragas']['items'][0] }) => (
  <Link
    to={slugify({ name: raga.name, id: raga.id, type: 'ragas' })}
    className="block p-4 border border-border rounded-lg hover:shadow-md transition-shadow bg-card"
  >
    <h3 className="font-semibold text-lg text-foreground mb-2">{raga.name}</h3>
    <div className="text-sm text-muted-foreground space-y-1">
      {raga.melakarta && (
        <div>
          <span className="font-medium text-foreground">Melakarta:</span> {raga.melakarta}
        </div>
      )}
      {raga.arohana && (
        <div>
          <span className="font-medium text-foreground">Arohanam:</span> {raga.arohana}
        </div>
      )}
      {raga.avarohana && (
        <div>
          <span className="font-medium text-foreground">Avarohanam:</span> {raga.avarohana}
        </div>
      )}
      {raga.mood && (
        <div>
          <span className="font-medium text-foreground">Mood:</span> {raga.mood}
        </div>
      )}
    </div>
  </Link>
);

export default function RagasIndex() {
  const { ragas, searchQuery, melakartaFilter } = useLoaderData<LoaderData>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4 text-foreground">
          Carnatic Ragas
        </h1>
        <p className="text-xl text-muted-foreground">
          Discover the melodic frameworks that form the foundation of Carnatic music
        </p>
      </header>

      {/* Search and Filters */}
      <div className="bg-card border border-border rounded-lg p-6 mb-8">
        <Form method="get" className="space-y-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-foreground mb-2">
              Search Ragas
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                id="search"
                name="q"
                defaultValue={searchQuery || ''}
                placeholder="Search by name or characteristics..."
                className="w-full pl-10 pr-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
              />
            </div>
          </div>

          <div>
            <label htmlFor="melakarta" className="block text-sm font-medium text-foreground mb-2">
              Filter by Melakarta
            </label>
            <input
              type="number"
              id="melakarta"
              name="melakarta"
              min="1"
              max="72"
              defaultValue={melakartaFilter || ''}
              placeholder="1-72"
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Search
            </button>
            <Link
              to="/carnatic/ragas"
              className="px-6 py-3 border border-input text-muted-foreground rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Clear
            </Link>
          </div>
        </Form>
      </div>

      {/* Results */}
      <section>
        {ragas.items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No ragas found.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ragas.items.map(raga => (
              <RagaCard key={raga.id} raga={raga} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
