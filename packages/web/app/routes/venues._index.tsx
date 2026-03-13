import { MapPin, Plus } from 'lucide-react';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { Link, data, useLoaderData } from 'react-router';
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { getUser } from '~/lib/auth.server';
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
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/venues' },
  ];
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const page = Number(url.searchParams.get('page') || '1');
  const user = await getUser(request);

  try {
    const result = await client.venue.list.query({
      limit: 20,
      nextToken: nextToken || undefined,
    });

    return data({
      venues: result.items,
      nextToken: result.nextToken,
      hasMore: result.hasMore,
      currentPage: page,
      isModerator: user?.role === 'moderator' || user?.role === 'admin',
    });
  } catch (error) {
    console.error('Failed to load venues:', error);
    throw new Response('Failed to load venues', { status: 500 });
  }
};

export default function VenuesIndex() {
  const { venues, nextToken, hasMore, currentPage, isModerator } = useLoaderData<{
    venues: VenueItem[];
    nextToken: string | null;
    hasMore: boolean;
    currentPage: number;
    isModerator: boolean;
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Venues</h1>
          <p className="text-xl text-muted-foreground">
            Concert halls and spaces hosting Indian classical performances
          </p>
        </div>
        {isModerator && (
          <Link to="/venues/new" className="shrink-0">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Venue
            </Button>
          </Link>
        )}
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
              currentPage={currentPage}
              hasMore={hasMore}
              nextToken={nextToken}
              baseUrl="/venues"
            />
          </div>
        </>
      )}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Venues', item: 'https://rasika.life/venues' },
        ]}
      />
    </main>
  );
}
