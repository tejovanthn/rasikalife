import { Calendar } from 'lucide-react';
import { Link, data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { generateFestivalUrl } from '~/lib/url-slug';

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const page = Number(url.searchParams.get('page') || '1');

  try {
    const result = await client.festival.listUpcoming.query({
      limit: 20,
      nextToken: nextToken || undefined,
    });

    return data({
      festivals: result.items,
      nextToken: result.nextToken,
      hasMore: result.hasMore,
      currentPage: page,
    });
  } catch (error) {
    console.error('Failed to load festivals:', error);
    throw new Response('Failed to load festivals', { status: 500 });
  }
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Festivals - Indian Classical Arts - Rasika.life' },
    {
      name: 'description',
      content:
        'Discover Indian classical music and dance festivals. Browse upcoming festival schedules and performances.',
    },
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/festivals' },
  ];
};

interface FestivalItem {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  posterUrl?: string;
  organiserName?: string;
  tags?: string[];
}

export default function FestivalsIndex() {
  const { festivals, nextToken, hasMore, currentPage } = useLoaderData<{
    festivals: FestivalItem[];
    nextToken: string | null;
    hasMore: boolean;
    currentPage: number;
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="page-title">Upcoming Festivals</h1>
        <p className="text-xl text-muted-foreground">
          Upcoming Indian classical arts festivals and celebrations
        </p>
      </header>

      {festivals.length === 0 ? (
        <EmptyState message="No festivals at the moment." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {festivals.map(festival => (
              <Link
                key={festival.id}
                to={generateFestivalUrl(festival.name, festival.id)}
                className="block no-underline"
              >
                <Card className="h-full hover:border-primary/50 transition-colors">
                  {festival.posterUrl && (
                    <img
                      src={festival.posterUrl}
                      alt=""
                      className="w-full h-40 object-cover rounded-t-lg"
                    />
                  )}
                  <CardContent className="py-4">
                    <h2 className="font-semibold text-lg text-foreground truncate">
                      {festival.name}
                    </h2>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {new Date(festival.startDate).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                        })}
                        {festival.startDate !== festival.endDate && (
                          <>
                            {' - '}
                            {new Date(festival.endDate).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </>
                        )}
                      </span>
                    </div>
                    {festival.organiserName && (
                      <p className="text-sm text-muted-foreground mt-1">
                        by {festival.organiserName}
                      </p>
                    )}
                    {festival.tags && festival.tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {festival.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-8">
            <EntityPagination
              currentPage={currentPage}
              hasMore={hasMore}
              nextToken={nextToken}
              baseUrl="/festivals"
            />
          </div>
        </>
      )}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Festivals', item: 'https://rasika.life/festivals' },
        ]}
      />
    </main>
  );
}
