import type { Composition } from '@rasika/core/domain/composition/entity';
import type { Edit } from '@rasika/core/domain/edit/client';
import type { Tala } from '@rasika/core/domain/tala/entity';
import { fromItrans } from '@rasika/core/utils/transliteration';
import { type MetaFunction, data, redirect } from 'react-router';
import { Link, Outlet, useLoaderData, useLocation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { DetailPageHeader } from '~/components/DetailPageHeader';
import { EntityCompositions } from '~/components/shared/EntityCompositions';
import { BreadcrumbStructuredData, DefinedTermStructuredData } from '~/components/structured-data';
import { getUser } from '~/lib/auth.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { generateSlug, generateTalaUrl, parseSlug } from '~/lib/url-slug';
import { formatDate, titleCaseName } from '~/lib/utils';
import { scriptSessionResolver } from '~/sessions.server';

export async function loader({
  params,
  request,
}: { params: { talaid?: string }; request: Request }) {
  const { talaid } = params;

  if (!talaid) {
    throw new Response('Tala ID is required', { status: 400 });
  }

  const parsed = parseSlug(talaid);

  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const slugId = parsed.id;

  try {
    const client = await createServerClient(request);
    const tala = await client.tala.get.query({ id: slugId });

    if (!tala) {
      throw new Response('Tala not found', { status: 410 });
    }

    if (tala.mergedIntoId) {
      const canonical = await client.tala.get.query({ id: tala.mergedIntoId });
      if (canonical && !canonical.mergedIntoId) {
        throw redirect(generateTalaUrl(canonical.name, canonical.id), 301);
      }
    }

    // Fetch compositions in this tala (limit to 6 for preview)
    const compositions = await client.composition.byTala.query({
      talaId: tala.id,
      limit: 6,
    });

    // Check if user has an active edit for this tala
    const user = await getUser(request);
    let activeEdit: Edit | null = null;
    if (user) {
      activeEdit = await client.edit.getActiveEditForEntity.query({
        entityType: 'tala',
        entityId: tala.id,
      });
    }

    const script = await scriptSessionResolver.getScript(request);
    const displayTala = {
      ...tala,
      name: titleCaseName(fromItrans(tala.name, script)),
    };

    return data({
      tala: displayTala,
      rawName: tala.name,
      compositions: compositions.items,
      hasMoreCompositions: compositions.hasMore,
      activeEdit,
      isLoggedIn: !!user,
      isModerator: user?.role === 'moderator' || user?.role === 'admin',
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.TALA_NOT_FOUND) {
        throw new Response(error.message, { status: 410 });
      }
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response('Tala not found', { status: 410 });
    }
    console.error('Failed to load tala:', error);
    throw new Response('Failed to load tala', { status: 500 });
  }
}

export const meta: MetaFunction = ({ data }) => {
  const { tala, rawName } = (data as { tala?: Tala; rawName?: string }) ?? {};
  const canonicalName = rawName ?? tala?.name ?? '';

  if (tala) {
    return [
      { title: `${tala.name} Tala - Indian Classical Music - Rasika.life` },
      {
        name: 'description',
        content: `Learn about the ${tala.name} tala in Indian classical music. Discover this traditional rhythmic cycle used in Carnatic music.`,
      },
      {
        name: 'keywords',
        content: `${tala.name} tala, Indian classical tala, Carnatic tala, rhythmic cycle, classical music rhythm`,
      },
      // Open Graph tags for social sharing
      { property: 'og:title', content: `${tala.name} Tala - Indian Classical Music` },
      {
        property: 'og:description',
        content: `Learn about the ${tala.name} tala, a fundamental rhythmic cycle in Indian classical music`,
      },
      { property: 'og:type', content: 'article' },
      {
        property: 'og:url',
        content: `https://rasika.life${generateTalaUrl(canonicalName, tala.id)}`,
      },
      // Twitter Card tags
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `${tala.name} Tala` },
      { name: 'twitter:description', content: `Indian classical tala ${tala.name}` },
      // Canonical URL
      {
        tagName: 'link',
        rel: 'canonical',
        href: `https://rasika.life${generateTalaUrl(canonicalName, tala.id)}`,
      },
      // The breadcrumb is emitted once, by <BreadcrumbStructuredData> in the component below.
      // A second copy used to be built here with a bare JSON.stringify, which put two
      // BreadcrumbLists on the page and skipped the `<` escaping every other payload gets —
      // and it interpolated a tala name, which is entity data like any other.
    ];
  }

  return [
    { title: 'Tala - Rasika.life' },
    {
      name: 'description',
      content: 'Explore detailed information about Indian classical talas.',
    },
  ];
};

export default function TalaDetails() {
  const location = useLocation();

  const { tala, rawName, compositions, hasMoreCompositions, isLoggedIn, activeEdit, isModerator } =
    useLoaderData<{
      tala: Tala;
      rawName: string;
      compositions: Composition[];
      hasMoreCompositions: boolean;
      activeEdit: Edit | null;
      isLoggedIn: boolean;
      isModerator: boolean;
    }>();

  // Check if we're on a nested route (like /compositions)
  const isNestedRoute = location.pathname.includes('/compositions');

  if (isNestedRoute) {
    return <Outlet />;
  }

  const shareUrl = `https://rasika.life${generateTalaUrl(rawName, tala.id)}`;

  const breadcrumbItems = [
    { label: 'Home', path: '/' },
    { label: 'Carnatic', path: '/carnatic' },
    { label: 'Talas', path: '/carnatic/talas' },
    {
      label: tala.name,
      path: generateTalaUrl(rawName, tala.id),
    },
  ];

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumb items={breadcrumbItems} />
      <DetailPageHeader
        title={tala.name}
        subtitle="Indian Classical Tala"
        shareUrl={shareUrl}
        shareTitle={`${tala.name} Tala - Indian Classical Music`}
        shareDescription={`Learn about the ${tala.name} tala, a fundamental rhythmic cycle in Indian classical music`}
        editUrl={isLoggedIn ? `${generateTalaUrl(rawName, tala.id)}/edit` : undefined}
        activeEdit={activeEdit}
        isModerator={isModerator}
        requestDeletionUrl={`/moderator/request-deletion?entityType=tala&entityId=${tala.id}`}
        mergeUrl={isModerator ? `/moderator/merge?entityType=tala&entityId=${tala.id}` : undefined}
      />
      <section className="mb-8 p-6 bg-muted rounded-lg">
        <h2 className="text-xl font-semibold mb-4">About</h2>
        <div className="space-y-2 text-sm">
          <p>
            <strong>Name:</strong> {tala.name}
          </p>
          <p>
            <strong>Added:</strong> {formatDate(tala.createdAt)}
          </p>
        </div>
      </section>
      <EntityCompositions
        compositions={compositions}
        entityType="tala"
        entitySlug={`${generateSlug(tala.name)}-${tala.id}`}
        showViewMore={hasMoreCompositions}
      />
      {/* Three identical cards saying "Browse other talas", "Find compositions in this tala"
          and "Learn about the tradition" told a reader nothing they could not guess. A plain
          row of links keeps the navigation and drops the furniture. */}
      <nav aria-label="Browse elsewhere" className="mt-10 border-t pt-6">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li>
            <Link to="/carnatic/talas" className="text-primary hover:underline">
              All Talas
            </Link>
          </li>
          <li>
            <Link to="/carnatic/compositions" className="text-primary hover:underline">
              Compositions
            </Link>
          </li>
          <li>
            <Link to="/carnatic" className="text-primary hover:underline">
              Carnatic Music
            </Link>
          </li>
        </ul>
      </nav>

      {/* Structured Data for SEO */}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Carnatic', item: 'https://rasika.life/carnatic' },
          { name: 'Talas', item: 'https://rasika.life/carnatic/talas' },
          {
            name: `${tala.name} Tala`,
            item: `https://rasika.life${generateTalaUrl(rawName, tala.id)}`,
          },
        ]}
      />
      {/* A tala is a named term in a rhythmic vocabulary, the same shape as a raga. Nothing
          authored Adi tala, so it must not be typed as a work with a composer and a date. */}
      <DefinedTermStructuredData
        term={{
          name: tala.name,
          url: shareUrl,
          description: tala.description,
          setName: tala.tradition === 'hindustani' ? 'Hindustani talas' : 'Carnatic talas',
          setUrl: 'https://rasika.life/carnatic/talas',
        }}
      />
    </main>
  );
}
