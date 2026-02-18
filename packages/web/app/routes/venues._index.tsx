import { MapPin } from 'lucide-react';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { Link, data, useLoaderData } from 'react-router';
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';
import { Card, CardContent } from '~/components/ui/card';
import { generateVenueUrl } from '~/lib/url-slug';

interface VenueItem {
  id: string;
  name: string;
  city?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export const meta: MetaFunction = () => {
  return [
    { title: 'Venues - Rasika.life' },
    {
      name: 'description',
      content: 'Browse venues hosting Indian classical music concerts and performances.',
    },
  ];
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');

  try {
    const result = await client.venue.list.query({
      limit: 20,
      nextToken: nextToken || undefined,
    });

    return data({
      venues: result.items,
      nextToken: result.nextToken,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error('Failed to load venues:', error);
    throw new Response('Failed to load venues', { status: 500 });
  }
};

export default function VenuesIndex() {
  const { venues, nextToken, hasMore } = useLoaderData<{
    venues: VenueItem[];
    nextToken: string | null;
    hasMore: boolean;
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="page-title">Venues</h1>
        <p className="text-xl text-muted-foreground">
          Concert halls and spaces hosting Indian classical performances
        </p>
      </header>

      {venues.length === 0 ? (
        <EmptyState message="No venues found." />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {venues.map(venue => {
              const city = venue.city || venue.address?.city;
              return (
                <Link
                  key={venue.id}
                  to={generateVenueUrl(venue.name, venue.id)}
                  className="block no-underline"
                >
                  <Card className="h-full hover:border-primary/50 transition-colors">
                    <CardContent className="py-4">
                      <h2 className="font-semibold text-foreground">{venue.name}</h2>
                      {city && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {city}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          <div className="mt-8">
            <EntityPagination
              currentPage={1}
              hasMore={hasMore}
              nextToken={nextToken}
              baseUrl="/venues"
            />
          </div>
        </>
      )}
    </main>
  );
}
