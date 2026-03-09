import type { CompositionWithRelations } from '@rasika/core/types/entities';
import { type LoaderFunction, type MetaFunction, data } from 'react-router';
import { Link, Outlet, useLoaderData, useLocation } from 'react-router';
import { client } from '~/api.server';
import { EntityCompositions } from '~/components/shared/EntityCompositions';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { ApplicationError } from '~/lib/errors';

export const meta: MetaFunction = ({ data: loaderData }) => {
  const language = (loaderData as { language: string } | undefined)?.language;
  if (!language) return [{ title: 'Language - Rasika.life' }];
  const canonicalUrl = `https://rasika.life/carnatic/languages/${encodeURIComponent(language)}`;
  return [
    { title: `${language} - Indian Classical Music Language - Rasika.life` },
    {
      name: 'description',
      content: `Browse compositions and explore ${language} in Indian classical music.`,
    },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
  ];
};

export const loader: LoaderFunction = async ({ params }) => {
  const { language } = params;

  if (!language) {
    throw new Response('Language is required', { status: 400 });
  }

  try {
    // Fetch compositions in this language (6 to show + 1 to check for more)
    const compositions = await client.composition.byLanguage.query({
      language: decodeURIComponent(language),
      limit: 7,
    });

    return data({
      language: decodeURIComponent(language),
      compositions: compositions.items.slice(0, 6),
      hasMoreCompositions: compositions.hasMore || compositions.items.length > 6,
    });
  } catch (error) {
    console.error('Failed to load language compositions:', error);
    if (error instanceof ApplicationError) {
      // Handle application errors
    }
    throw new Response('Failed to load compositions', { status: 500 });
  }
};

export default function LanguageDetails() {
  const { language, compositions, hasMoreCompositions } = useLoaderData<{
    language: string;
    compositions: CompositionWithRelations[];
    hasMoreCompositions: boolean;
  }>();

  // Check if we're on a nested route (like /compositions)
  const isNestedRoute = useLocation().pathname.includes('/compositions');

  if (isNestedRoute) {
    return <Outlet />;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{language}</h1>
        <p className="text-lg text-muted-foreground">Indian Classical Music Language</p>
      </header>

      <section className="mb-8 p-6 bg-muted rounded-lg">
        <h2 className="text-xl font-semibold mb-4">About</h2>
        <div className="space-y-2 text-sm">
          <p>
            <strong>Language:</strong> {language}
          </p>
          <p>
            <strong>Type:</strong> Indian Classical Music Language
          </p>
        </div>
      </section>

      <EntityCompositions
        compositions={compositions}
        entityType="language"
        entitySlug={language}
        showViewMore={hasMoreCompositions}
      />

      {/* Cross-linking section */}
      <section className="mt-8 pt-8 border-t">
        <h2 className="text-xl font-semibold mb-4">Explore Related Content</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to="/carnatic/compositions"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">All Compositions</h3>
            <p className="text-sm text-muted-foreground">Browse all compositions</p>
          </Link>

          <Link
            to="/carnatic"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Carnatic Music</h3>
            <p className="text-sm text-muted-foreground">Discover the tradition</p>
          </Link>

          <Link
            to="/artists"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Artists</h3>
            <p className="text-sm text-muted-foreground">Explore musicians</p>
          </Link>
        </div>
      </section>
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Carnatic', item: 'https://rasika.life/carnatic' },
          { name: 'Languages', item: 'https://rasika.life/carnatic/languages' },
          {
            name: language,
            item: `https://rasika.life/carnatic/languages/${encodeURIComponent(language)}`,
          },
        ]}
      />
    </div>
  );
}
