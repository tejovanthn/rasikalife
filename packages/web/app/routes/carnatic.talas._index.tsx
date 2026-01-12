import { json, type LoaderFunction, type MetaFunction } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { client } from '~/api.server';
import { TalaCard } from '~/components/TalaCard';
import { EmptyState } from '~/components/shared/EmptyState';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '~/components/ui/pagination';

// Tala type from @rasika/core domain/tala
type Tala = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const page = Number.parseInt(url.searchParams.get('page') || '1', 10);
  const limit = 12; // Items per page

  try {
    const results = await client.tala.list.query({
      limit: limit * 10, // Get enough items for pagination
    });

    const totalItems = results.items?.length || 0;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTalas = results.items?.slice(startIndex, endIndex) || [];

    return json({
      talas: paginatedTalas,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Failed to load talas:', error);
    throw new Response('Failed to load talas', { status: 500 });
  }
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Talas - Indian Classical Music - Rasika.life' },
    {
      name: 'description',
      content:
        'Explore traditional Indian classical talas. Discover the rhythmic foundations and time cycles of Carnatic music.',
    },
    {
      name: 'keywords',
      content:
        'Indian classical talas, Carnatic talas, rhythmic cycles, classical music rhythm, tala music, time cycles',
    },
  ];
};

export default function TalasIndex() {
  const { talas, pagination } = useLoaderData<{
    talas: Tala[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
          Talas
        </h1>
        <p className="text-xl text-muted-foreground">Explore traditional Indian classical talas</p>
      </header>

      {talas.length === 0 ? (
        <EmptyState message="No talas available at the moment." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {talas.map(tala => (
              <TalaCard key={tala.id} tala={tala} />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  {pagination.hasPrevPage ? (
                    <Link to={`?page=${pagination.currentPage - 1}`}>
                      <PaginationPrevious />
                    </Link>
                  ) : (
                    <PaginationPrevious className="pointer-events-none opacity-50" />
                  )}
                </PaginationItem>

                {/* Page numbers */}
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    const distance = Math.abs(page - pagination.currentPage);
                    return (
                      distance === 0 ||
                      distance === 1 ||
                      page === 1 ||
                      page === pagination.totalPages
                    );
                  })
                  .map((page, index, array) => {
                    const prevPage = array[index - 1];
                    const showEllipsis = prevPage && page - prevPage > 1;

                    return (
                      <PaginationItem key={page}>
                        {showEllipsis && <PaginationEllipsis />}
                        <Link to={`?page=${page}`}>
                          <PaginationLink isActive={page === pagination.currentPage}>
                            {page}
                          </PaginationLink>
                        </Link>
                      </PaginationItem>
                    );
                  })}

                <PaginationItem>
                  {pagination.hasNextPage ? (
                    <Link to={`?page=${pagination.currentPage + 1}`}>
                      <PaginationNext />
                    </Link>
                  ) : (
                    <PaginationNext className="pointer-events-none opacity-50" />
                  )}
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </main>
  );
}

export function ErrorBoundary() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
      <p className="text-muted-foreground">
        We're having trouble loading the talas. Please try again later.
      </p>
      <Link to="/carnatic/talas" className="text-blue-600 hover:underline">
        Back to Talas
      </Link>
    </div>
  );
}
