import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData, useSearchParams, Form } from '@remix-run/react';
import { Search } from 'lucide-react';
import { type RouterOutput, client } from '~/api.server';
import { slugify } from '~/lib/carnaticUtils';

type LoaderData = {
  talas: RouterOutput['tala']['search'];
  searchQuery?: string;
  aksharasFilter?: number;
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get('q') || undefined;
  const aksharasFilter = url.searchParams.get('aksharas')
    ? Number.parseInt(url.searchParams.get('aksharas')!)
    : undefined;
  const limit = 24;

  try {
    const talas = await client.tala.search.query({
      query: searchQuery,
      aksharas: aksharasFilter,
      limit,
      nextToken: url.searchParams.get('token') || undefined,
    });

    return json<LoaderData>({
      talas,
      searchQuery,
      aksharasFilter,
    });
  } catch (error) {
    console.error('Error loading talas:', error);
    throw new Response('Internal Server Error', { status: 500 });
  }
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Carnatic Talas - Rasika.life' },
    {
      name: 'description',
      content:
        'Explore the rhythmic cycles of Carnatic music. Learn about talas, their beat patterns, and musical applications.',
    },
    {
      name: 'keywords',
      content: 'Carnatic talas, rhythmic cycles, aksharas, Suladi Sapta Talas, Chapu talas',
    },
  ];
};

const TalaCard = ({ tala }: { tala: LoaderData['talas']['items'][0] }) => (
  <Link
    to={slugify({ name: tala.name, id: tala.id, type: 'talas' })}
    className="block p-4 border border-border rounded-lg hover:shadow-md transition-shadow bg-card"
  >
    <h3 className="font-semibold text-lg text-foreground mb-2">{tala.name}</h3>
    <div className="text-sm text-muted-foreground space-y-1">
      {tala.aksharas && (
        <div>
          <span className="font-medium text-foreground">Aksharas:</span> {tala.aksharas}
        </div>
      )}
      {tala.pattern && (
        <div>
          <span className="font-medium text-foreground">Pattern:</span> {tala.pattern}
        </div>
      )}
      {tala.type && (
        <div>
          <span className="font-medium text-foreground">Type:</span> {tala.type}
        </div>
      )}
    </div>
    {tala.description && (
      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
        {tala.description.length > 100
          ? tala.description.substring(0, 100) + '...'
          : tala.description}
      </p>
    )}
  </Link>
);

export default function TalasIndex() {
  const { talas, searchQuery, aksharasFilter } = useLoaderData<LoaderData>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4 text-foreground">
          Carnatic Talas
        </h1>
        <p className="text-xl text-muted-foreground">
          Discover the rhythmic cycles that provide the foundation for Carnatic compositions
        </p>
      </header>

      {/* Search and Filters */}
      <div className="bg-card border border-border rounded-lg p-6 mb-8">
        <Form method="get" className="space-y-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-foreground mb-2">
              Search Talas
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                id="search"
                name="q"
                defaultValue={searchQuery || ''}
                placeholder="Search by name or pattern..."
                className="w-full pl-10 pr-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
              />
            </div>
          </div>

          <div>
            <label htmlFor="aksharas" className="block text-sm font-medium text-foreground mb-2">
              Filter by Aksharas (Beat Count)
            </label>
            <input
              type="number"
              id="aksharas"
              name="aksharas"
              min="1"
              defaultValue={aksharasFilter || ''}
              placeholder="e.g., 8, 7, 16"
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
              to="/carnatic/talas"
              className="px-6 py-3 border border-input text-muted-foreground rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Clear
            </Link>
          </div>
        </Form>
      </div>

      {/* Results */}
      <section>
        {talas.items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No talas found.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {talas.items.map(tala => (
              <TalaCard key={tala.id} tala={tala} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
