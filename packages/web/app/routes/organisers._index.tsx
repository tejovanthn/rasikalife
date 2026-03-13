import { Plus } from 'lucide-react';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { Link, data, useLoaderData } from 'react-router';
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { getUser } from '~/lib/auth.server';
import { generateOrganiserUrl } from '~/lib/url-slug';

interface OrganiserItem {
  id: string;
  name: string;
}

export const meta: MetaFunction = () => {
  return [
    { title: 'Organisers - Rasika.life' },
    {
      name: 'description',
      content: 'Browse organisations and individuals who present Indian classical music events.',
    },
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/organisers' },
  ];
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const page = Number(url.searchParams.get('page') || '1');
  const user = await getUser(request);

  try {
    const result = await client.organiser.list.query({
      limit: 20,
      nextToken: nextToken || undefined,
    });

    return data({
      organisers: result.items,
      nextToken: result.nextToken,
      hasMore: result.hasMore,
      currentPage: page,
      isModerator: user?.role === 'moderator' || user?.role === 'admin',
    });
  } catch (error) {
    console.error('Failed to load organisers:', error);
    throw new Response('Failed to load organisers', { status: 500 });
  }
};

export default function OrganisersIndex() {
  const { organisers, nextToken, hasMore, currentPage, isModerator } = useLoaderData<{
    organisers: OrganiserItem[];
    nextToken: string | null;
    hasMore: boolean;
    currentPage: number;
    isModerator: boolean;
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Organisers</h1>
          <p className="text-xl text-muted-foreground">
            Organisations and individuals presenting Indian classical performances
          </p>
        </div>
        {isModerator && (
          <Link to="/organisers/new" className="shrink-0">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Organiser
            </Button>
          </Link>
        )}
      </header>

      {organisers.length === 0 ? (
        <EmptyState message="No organisers found." />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {organisers.map(organiser => (
              <Link
                key={organiser.id}
                to={generateOrganiserUrl(organiser.name, organiser.id)}
                className="block no-underline"
              >
                <Card className="h-full hover:border-primary/50 transition-colors">
                  <CardContent className="py-4">
                    <h2 className="font-semibold text-foreground">{organiser.name}</h2>
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
              baseUrl="/organisers"
            />
          </div>
        </>
      )}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Organisers', item: 'https://rasika.life/organisers' },
        ]}
      />
    </main>
  );
}
