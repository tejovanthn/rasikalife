import type { Edit } from '@rasika/core/domain/edit/client';
import type { CompositionWithRelations, RagaType } from '@rasika/core/types/entities';
import { fromItrans } from '@rasika/core/utils';
import { type MetaFunction, data, redirect } from 'react-router';
import { Link, Outlet, useLoaderData, useLocation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { DetailPageHeader } from '~/components/DetailPageHeader';
import { EntityCompositions } from '~/components/shared/EntityCompositions';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { getUser } from '~/lib/auth.server';
import { MELAKARTA_NAMES } from '~/lib/carnatic';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { generateRagaUrl, generateSlug, parseSlug } from '~/lib/url-slug';
import { capitalize } from '~/lib/utils';
import { scriptSessionResolver } from '~/sessions.server';

export async function loader({
  params,
  request,
}: { params: { ragaid?: string }; request: Request }) {
  const { ragaid } = params;

  if (!ragaid) {
    throw new Response('Raga ID is required', { status: 400 });
  }

  const parsed = parseSlug(ragaid);

  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const slugId = parsed.id;

  try {
    const client = await createServerClient(request);
    const raga = await client.raga.get.query({ id: slugId });

    if (!raga) {
      throw new Response('Raga not found', { status: 410 });
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

    // Fetch similar ragas from the same melakarta
    const similarRagas = raga.melaNumber
      ? await client.raga.byMela.query({ melaNumber: raga.melaNumber, excludeId: raga.id })
      : [];

    // Check if user has an active edit for this raga
    const user = await getUser(request);
    let activeEdit: Edit | null = null;
    if (user) {
      activeEdit = await client.edit.getActiveEditForEntity.query({
        entityType: 'raga',
        entityId: raga.id,
      });
    }

    const script = await scriptSessionResolver.getScript(request);
    const displayRaga = {
      ...raga,
      name: fromItrans(raga.name, script),
      arohanam: raga.arohanam ? fromItrans(raga.arohanam, script) : raga.arohanam,
      avarohanam: raga.avarohanam ? fromItrans(raga.avarohanam, script) : raga.avarohanam,
      alternateScales: raga.alternateScales
        ? raga.alternateScales.map(s => fromItrans(s, script))
        : raga.alternateScales,
      parentRaga: raga.parentRaga
        ? { ...raga.parentRaga, name: fromItrans(raga.parentRaga.name, script) }
        : raga.parentRaga,
    };

    return data({
      raga: displayRaga,
      rawName: raga.name,
      compositions: compositions.items,
      hasMoreCompositions: compositions.hasMore,
      similarRagas: similarRagas.slice(0, 6).map(r => ({
        ...r,
        name: fromItrans(r.name, script),
        arohanam: r.arohanam ? fromItrans(r.arohanam, script) : r.arohanam,
        avarohanam: r.avarohanam ? fromItrans(r.avarohanam, script) : r.avarohanam,
      })),
      activeEdit,
      isModerator: user?.role === 'moderator' || user?.role === 'admin',
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.RAGA_NOT_FOUND) {
        throw new Response(error.message, { status: 410 });
      }
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response('Raga not found', { status: 410 });
    }
    console.error('Failed to load raga:', error);
    throw new Response('Failed to load raga', { status: 500 });
  }
}

export const meta: MetaFunction = ({ data }) => {
  const { raga, rawName } = (data as { raga?: RagaType; rawName?: string }) ?? {};
  const canonicalName = rawName ?? raga?.name ?? '';

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
        content: `https://rasika.life${generateRagaUrl(canonicalName, raga.id)}`,
      },
      // Twitter Card tags
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `${raga.name} Raga` },
      { name: 'twitter:description', content: `Indian classical raga ${raga.name}` },
      // Canonical URL
      {
        tagName: 'link',
        rel: 'canonical',
        href: `https://rasika.life${generateRagaUrl(canonicalName, raga.id)}`,
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

function RagaGrid({ ragas }: { ragas: RagaType[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
      {ragas.map(r => (
        <Link
          key={r.id}
          to={generateRagaUrl(r.name, r.id)}
          className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
        >
          <p className="font-medium">{r.name}</p>
          {(r.arohanam || r.avarohanam) && (
            <div className="text-xs text-muted-foreground font-mono mt-1 space-y-0.5">
              {r.arohanam && <p className="truncate">{r.arohanam}</p>}
              {r.avarohanam && <p className="truncate">{r.avarohanam}</p>}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

export default function RagaDetails() {
  const location = useLocation();

  const {
    raga,
    rawName,
    compositions,
    hasMoreCompositions,
    similarRagas,
    activeEdit,
    isModerator,
  } = useLoaderData<{
    raga: RagaType;
    rawName: string;
    compositions: CompositionWithRelations[];
    hasMoreCompositions: boolean;
    similarRagas: RagaType[];
    activeEdit: Edit | null;
    isModerator: boolean;
  }>();

  // Check if we're on a nested route (like /compositions)
  const isNestedRoute = location.pathname.includes('/compositions');

  if (isNestedRoute) {
    return <Outlet />;
  }

  const shareUrl = `https://rasika.life${generateRagaUrl(rawName, raga.id)}`;

  const breadcrumbItems = [
    { label: 'Home', path: '/' },
    { label: 'Carnatic', path: '/carnatic' },
    { label: 'Ragas', path: '/carnatic/ragas' },
    {
      label: raga.name,
      path: generateRagaUrl(rawName, raga.id),
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
        editUrl={`${generateRagaUrl(rawName, raga.id)}/edit`}
        activeEdit={activeEdit}
        isModerator={isModerator}
        requestDeletionUrl={`/moderator/request-deletion?entityType=raga&entityId=${raga.id}`}
        mergeUrl={isModerator ? `/moderator/merge?entityType=raga&entityId=${raga.id}` : undefined}
      />
      <section className="mb-8 space-y-6">
        {raga.description && (
          <p className="text-muted-foreground leading-relaxed">{raga.description}</p>
        )}

        {/* Scale */}
        {(raga.arohanam || raga.avarohanam) && (
          <div className="p-5 bg-muted rounded-lg space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Scale
            </h2>
            <div className="grid gap-2 text-sm">
              {raga.arohanam && (
                <div className="flex gap-3">
                  <span className="w-28 shrink-0 text-muted-foreground">Arohanam</span>
                  <span className="font-mono">{raga.arohanam}</span>
                </div>
              )}
              {raga.avarohanam && (
                <div className="flex gap-3">
                  <span className="w-28 shrink-0 text-muted-foreground">Avarohanam</span>
                  <span className="font-mono">{raga.avarohanam}</span>
                </div>
              )}
              {raga.alternateScales && raga.alternateScales.length > 0 && (
                <div className="flex gap-3">
                  <span className="w-28 shrink-0 text-muted-foreground">Alternate</span>
                  <div className="flex flex-wrap gap-1">
                    {raga.alternateScales.map(scale => (
                      <span
                        key={scale}
                        className="font-mono text-xs px-2 py-0.5 bg-background rounded border"
                      >
                        {scale}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
          {raga.tradition && (
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Tradition</dt>
              <dd className="mt-0.5 font-medium">{capitalize(raga.tradition)}</dd>
            </div>
          )}
          {raga.melaNumber && (
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Mela</dt>
              <dd className="mt-0.5 font-medium">{raga.melaNumber}</dd>
            </div>
          )}
          {raga.parentRaga && (
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Parent Raga</dt>
              <dd className="mt-0.5 font-medium">
                <Link
                  to={generateRagaUrl(raga.parentRaga.name, raga.parentRaga.id)}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {raga.parentRaga.name}
                </Link>
              </dd>
            </div>
          )}
          {raga.rasa && (
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Rasa</dt>
              <dd className="mt-0.5 font-medium">{raga.rasa}</dd>
            </div>
          )}
          {raga.timeOfDay && (
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Time of Day</dt>
              <dd className="mt-0.5 font-medium">{capitalize(raga.timeOfDay)}</dd>
            </div>
          )}
          {raga.season && (
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Season</dt>
              <dd className="mt-0.5 font-medium">{raga.season}</dd>
            </div>
          )}
        </div>
      </section>
      <EntityCompositions
        compositions={compositions}
        entityType="raga"
        entitySlug={`${generateSlug(raga.name)}-${raga.id}`}
        showViewMore={hasMoreCompositions}
        customHeading={`Compositions in ${raga.name} raga`}
      />
      {/* Similar ragas from the same melakarta */}
      {similarRagas.length > 0 && raga.melaNumber && (
        <section className="mt-8 pt-8 border-t">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">
              Janya ragas of {MELAKARTA_NAMES[raga.melaNumber]}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Other ragas derived from the same parent melakarta (mela {raga.melaNumber})
            </p>
          </div>
          <RagaGrid ragas={similarRagas} />
        </section>
      )}

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
            item: `https://rasika.life${generateRagaUrl(rawName, raga.id)}`,
          },
        ]}
      />
    </main>
  );
}
