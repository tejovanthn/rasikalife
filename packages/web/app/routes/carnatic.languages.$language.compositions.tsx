import type { CompositionWithRelations } from '@rasika/core/types/entities';
import { type LoaderFunction, data } from 'react-router';
import { Link, useLoaderData, useSearchParams } from 'react-router';
import { client } from '~/api.server';
import { CompositionCard } from '~/components/CompositionCard';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';
import { ApplicationError } from '~/lib/errors';

export const loader: LoaderFunction = async ({ params, request }) => {
  const { language } = params;

  if (!language) {
    throw new Response('Language is required', { status: 400 });
  }

  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const itemsPerPage = 36;

  try {
    const decodedLanguage = decodeURIComponent(language);

    const result = await client.composition.byLanguage.query({
      language: decodedLanguage,
      limit: itemsPerPage,
      nextToken: nextToken || undefined,
    });

    return data({
      language: decodedLanguage,
      compositions: result.items,
      hasMore: result.hasMore,
      nextToken: result.nextToken,
      prevToken: nextToken,
    });
  } catch (error) {
    console.error('Failed to load language compositions:', error);
    if (error instanceof ApplicationError) {
      // Handle application errors
    }
    throw new Response('Failed to load compositions', { status: 500 });
  }
};

export default function LanguageCompositions() {
  const { language, compositions, hasMore, nextToken, prevToken } = useLoaderData<{
    language: string;
    compositions: CompositionWithRelations[];
    hasMore: boolean;
    nextToken: string | null;
    prevToken: string | null;
  }>();

  const [searchParams] = useSearchParams();
  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <Link
          to={`/carnatic/languages/${encodeURIComponent(language)}`}
          className="text-primary hover:underline mb-2 inline-block"
        >
          ← Back to {language}
        </Link>
        <h1 className="text-3xl font-bold">Compositions in {language}</h1>
        <p className="text-muted-foreground mt-2">All compositions in the {language} language</p>
      </div>

      {!compositions.length ? (
        <EmptyState
          message="No compositions found"
          description={`There are no compositions in ${language} in our database yet.`}
        />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {compositions.map(composition => (
              <CompositionCard
                key={composition.id}
                composition={composition}
                showLanguage={false}
              />
            ))}
          </div>

          <EntityPagination
            currentPage={currentPage}
            hasMore={hasMore}
            nextToken={nextToken}
            baseUrl={`/carnatic/languages/${encodeURIComponent(language)}/compositions`}
          />
        </>
      )}
    </div>
  );
}
