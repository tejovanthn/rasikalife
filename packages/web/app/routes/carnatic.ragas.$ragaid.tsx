import type { Edit } from '@rasika/core/domain/edit/client';
import type { CompositionWithRelations, RagaType } from '@rasika/core/types/entities';
import { type MetaFunction, data, redirect } from 'react-router';
import { Link, Outlet, useLoaderData, useLocation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { DetailPageHeader } from '~/components/DetailPageHeader';
import { EntityCompositions } from '~/components/shared/EntityCompositions';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { getUser } from '~/lib/auth.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { generateRagaUrl, generateSlug } from '~/lib/url-slug';
import { formatDate } from '~/lib/utils';

export async function loader({
  params,
  request,
}: { params: { ragaid?: string }; request: Request }) {
  const { ragaid } = params;

  if (!ragaid) {
    throw new Response('Raga ID is required', { status: 400 });
  }

  const slugId = ragaid.split('-').pop();

  if (!slugId) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  try {
    const client = await createServerClient(request);
    const raga = await client.raga.get.query({ id: slugId });

    if (!raga) {
      throw new Response('Raga not found', { status: 404 });
    }

    if (raga.mergedIntoId) {
      const canonical = await client.raga.get.query({ id: raga.mergedIntoId });
      if (canonical && !canonical.mergedIntoId) {
        throw redirect(generateRagaUrl(canonical.name, canonical.id), 301);
      }
    }

    // Fetch compositions in this raga (limit to 6 for preview)
    const compositions = await client.composition.byRaga.query({
      ragaId: raga.id,
      limit: 6,
    });

    // Check if user has an active edit for this raga
    const user = await getUser(request);
    let activeEdit: Edit | null = null;
    if (user) {
      activeEdit = await client.edit.getActiveEditForEntity.query({
        entityType: 'raga',
        entityId: raga.id,
      });
    }

    return data({
      raga,
      compositions: compositions.items,
      hasMoreCompositions: compositions.hasMore,
      activeEdit,
      isModerator: user?.role === 'moderator' || user?.role === 'admin',
    });
  } catch (error) {
    console.error('Failed to load raga:', error);
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.RAGA_NOT_FOUND) {
        throw new Response(error.message, { status: 404 });
      }
      // Handle other error codes as needed
    }
    throw new Response('Failed to load raga', { status: 500 });
  }
}

export const meta: MetaFunction = ({ data }) => {
  const raga = (data as { raga?: RagaType })?.raga;

  if (raga) {
    return [
      { title: `${raga.name} Raga - Indian Classical Music - Rasika.life` },
      {
        name: 'description',
        content: `Learn about the ${raga.name} raga in Indian classical music. Discover this traditional melodic mode used in Carnatic and Hindustani traditions.`,
      },
      {
        name: 'keywords',
        content: `${raga.name} raga, Indian classical raga, Carnatic raga, Hindustani raga, melodic mode, classical music scale`,
      },
      // Open Graph tags for social sharing
      { property: 'og:title', content: `${raga.name} Raga - Indian Classical Music` },
      {
        property: 'og:description',
        content: `Learn about the ${raga.name} raga, a fundamental melodic mode in Indian classical music`,
      },
      { property: 'og:type', content: 'article' },
      {
        property: 'og:url',
        content: `https://rasika.life${generateRagaUrl(raga.name, raga.id)}`,
      },
      // Twitter Card tags
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `${raga.name} Raga` },
      { name: 'twitter:description', content: `Indian classical raga ${raga.name}` },
      // Canonical URL
      {
        tagName: 'link',
        rel: 'canonical',
        href: `https://rasika.life${generateRagaUrl(raga.name, raga.id)}`,
      },
    ];
  }

  return [
    { title: 'Raga - Rasika.life' },
    {
      name: 'description',
      content: 'Explore detailed information about Indian classical ragas.',
    },
  ];
};

export default function RagaDetails() {
  const location = useLocation();

  const { raga, compositions, hasMoreCompositions, activeEdit, isModerator } = useLoaderData<{
    raga: RagaType;
    compositions: CompositionWithRelations[];
    hasMoreCompositions: boolean;
    activeEdit: Edit | null;
    isModerator: boolean;
  }>();

  // Check if we're on a nested route (like /compositions)
  const isNestedRoute = location.pathname.includes('/compositions');

  if (isNestedRoute) {
    return <Outlet />;
  }

  const shareUrl = `https://rasika.life${generateRagaUrl(raga.name, raga.id)}`;

  const breadcrumbItems = [
    { label: 'Home', path: '/' },
    { label: 'Carnatic', path: '/carnatic' },
    { label: 'Ragas', path: '/carnatic/ragas' },
    {
      label: raga.name,
      path: generateRagaUrl(raga.name, raga.id),
    },
  ];

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumb items={breadcrumbItems} />
      <DetailPageHeader
        title={raga.name}
        subtitle="Indian Classical Raga"
        shareUrl={shareUrl}
        shareTitle={`${raga.name} Raga - Indian Classical Music`}
        shareDescription={`Learn about the ${raga.name} raga, a fundamental melodic mode in Indian classical music`}
        editUrl={`${generateRagaUrl(raga.name, raga.id)}/edit`}
        activeEdit={activeEdit}
        isModerator={isModerator}
        requestDeletionUrl={`/moderator/request-deletion?entityType=raga&entityId=${raga.id}`}
        mergeUrl={isModerator ? `/moderator/merge?entityType=raga&entityId=${raga.id}` : undefined}
      />
      <section className="mb-8 p-6 bg-muted rounded-lg">
        <h2 className="text-xl font-semibold mb-4">About</h2>
        <div className="space-y-2 text-sm">
          <p>
            <strong>Name:</strong> {raga.name}
          </p>
          <p>
            <strong>Added:</strong> {formatDate(raga.createdAt)}
          </p>
        </div>
      </section>
      <EntityCompositions
        compositions={compositions}
        entityType="raga"
        entitySlug={`${generateSlug(raga.name)}-${raga.id}`}
        showViewMore={hasMoreCompositions}
        customHeading={`Compositions in ${raga.name} raga`}
      />
      {/* Cross-linking section */}
      <section className="mt-8 pt-8 border-t">
        <h2 className="text-xl font-semibold mb-4">Explore Related Content</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to="/carnatic/ragas"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">All Ragas</h3>
            <p className="text-sm text-muted-foreground">Browse other ragas</p>
          </Link>

          <Link
            to="/carnatic/compositions"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Compositions</h3>
            <p className="text-sm text-muted-foreground">Find compositions in this raga</p>
          </Link>

          <Link
            to="/carnatic"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Carnatic Music</h3>
            <p className="text-sm text-muted-foreground">Learn about the tradition</p>
          </Link>
        </div>
      </section>

      {/* Structured Data for SEO */}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Carnatic', item: 'https://rasika.life/carnatic' },
          { name: 'Ragas', item: 'https://rasika.life/carnatic/ragas' },
          {
            name: `${raga.name} Raga`,
            item: `https://rasika.life${generateRagaUrl(raga.name, raga.id)}`,
          },
        ]}
      />
    </main>
  );
}
