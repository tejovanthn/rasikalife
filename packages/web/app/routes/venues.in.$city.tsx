import { MapPin } from 'lucide-react';
import { Link, data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { client } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { EmptyState } from '~/components/shared/EmptyState';
import { Card, CardContent } from '~/components/ui/card';
import { generateVenueUrl } from '~/lib/url-slug';

interface VenueItem {
  id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export const loader: LoaderFunction = async ({ params }) => {
  const { city } = params;
  if (!city) {
    throw new Response('City is required', { status: 400 });
  }

  const decodedCity = decodeURIComponent(city);

  try {
    const result = await client.venue.byCity.query({ city: decodedCity, limit: 50 });
    return data({ venues: result.items, city: decodedCity });
  } catch (error) {
    console.error('Failed to load venues by city:', error);
    throw new Response('Failed to load venues', { status: 500 });
  }
};

export const meta: MetaFunction = ({ data: loaderData }) => {
  const city = (loaderData as { city: string } | undefined)?.city;
  if (!city) {
    return [{ title: 'Venues - Rasika.life' }];
  }

  return [
    { title: `Venues in ${city} - Rasika.life` },
    {
      name: 'description',
      content: `Discover Indian classical arts venues in ${city}. Find concert halls, auditoriums, and performance spaces.`,
    },
  ];
};

function formatAddress(address: VenueItem['address']): string | null {
  if (!address) return null;
  const parts = [address.street, address.city, address.state, address.postalCode, address.country];
  const filtered = parts.filter(Boolean);
  return filtered.length > 0 ? filtered.join(', ') : null;
}

export default function VenuesByCityPage() {
  const { venues, city } = useLoaderData<{
    venues: VenueItem[];
    city: string;
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <Breadcrumb
        items={[
          { label: 'Events', path: '/events' },
          { label: `Venues in ${city}`, path: '#' },
        ]}
      />

      <header className="mt-6 mb-8">
        <h1 className="page-title">Venues in {city}</h1>
        <p className="text-xl text-muted-foreground">
          Indian classical arts venues and performance spaces in {city}
        </p>
      </header>

      {venues.length === 0 ? (
        <EmptyState message={`No venues found in ${city}.`} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {venues.map(venue => (
            <Link
              key={venue.id}
              to={generateVenueUrl(venue.name, venue.id)}
              className="block no-underline"
            >
              <Card className="hover:border-primary/50 transition-colors h-full">
                <CardContent className="py-4">
                  <p className="font-medium text-foreground">{venue.name}</p>
                  {formatAddress(venue.address) && (
                    <div className="flex items-start gap-1.5 text-sm text-muted-foreground mt-2">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>{formatAddress(venue.address)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
