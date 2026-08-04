import type { Edit } from '@rasika/core/domain/edit/client';
import type { CompositionWithRelations, RagaType } from '@rasika/core/types/entities';
import { formatSwaras, fromItrans } from '@rasika/core/utils';
import { type MetaFunction, data, redirect } from 'react-router';
import { Link, Outlet, useLoaderData, useLocation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { DetailPageHeader } from '~/components/DetailPageHeader';
import { EntityCompositions } from '~/components/shared/EntityCompositions';
import { BreadcrumbStructuredData, RagaFaqStructuredData } from '~/components/structured-data';
import { getUser } from '~/lib/auth.server';
import { MELAKARTA_NAMES } from '~/lib/carnatic';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { ragaOgImageUrl } from '~/lib/og';
import { generateCompositionUrl, generateRagaUrl, generateSlug, parseSlug } from '~/lib/url-slug';
import { capitalize, titleCaseName } from '~/lib/utils';
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
    const [raga, user] = await Promise.all([
      client.raga.get.query({ id: slugId }),
      getUser(request),
    ]);

    if (!raga) {
      throw new Response('Raga not found', { status: 410 });
    }

    if (raga.mergedIntoId) {
      const canonical = await client.raga.get.query({ id: raga.mergedIntoId });
      if (canonical && !canonical.mergedIntoId) {
        throw redirect(generateRagaUrl(canonical.name, canonical.id), 301);
      }
    }

    const [compositions, similarRagas, repertoireStats, activeEdit, script] = await Promise.all([
      client.composition.byRaga.query({ ragaId: raga.id, limit: 6 }),
      raga.melaNumber
        ? client.raga.byMela.query({ melaNumber: raga.melaNumber, excludeId: raga.id })
        : Promise.resolve([]),
      client.raga.getRepertoireStats.query({ ragaId: raga.id }),
      user
        ? client.edit.getActiveEditForEntity.query({ entityType: 'raga', entityId: raga.id })
        : Promise.resolve(null),
      scriptSessionResolver.getScript(request),
    ]);

    const displayRaga = {
      ...raga,
      name: titleCaseName(fromItrans(raga.name, script)),
      // Swaras are notation, not words — see formatSwaras.
      arohanam: raga.arohanam ? formatSwaras(raga.arohanam) : raga.arohanam,
      avarohanam: raga.avarohanam ? formatSwaras(raga.avarohanam) : raga.avarohanam,
      alternateScales: raga.alternateScales
        ? raga.alternateScales.map(s => formatSwaras(s))
        : raga.alternateScales,
      parentRaga: raga.parentRaga
        ? { ...raga.parentRaga, name: titleCaseName(fromItrans(raga.parentRaga.name, script)) }
        : raga.parentRaga,
    };

    return data({
      raga: displayRaga,
      rawName: raga.name,
      rawArohanam: raga.arohanam,
      rawAvarohanam: raga.avarohanam,
      compositions: compositions.items,
      hasMoreCompositions: compositions.hasMore,
      similarRagas: similarRagas.slice(0, 6).map(r => ({
        ...r,
        name: titleCaseName(fromItrans(r.name, script)),
        arohanam: r.arohanam ? formatSwaras(r.arohanam) : r.arohanam,
        avarohanam: r.avarohanam ? formatSwaras(r.avarohanam) : r.avarohanam,
      })),
      performanceCount: repertoireStats.performanceCount,
      topCompositions: repertoireStats.topCompositions.slice(0, 5),
      activeEdit,
      isLoggedIn: !!user,
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

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const { raga, rawName } = data ?? {};
  if (!raga) return [{ title: 'Raga not found | Rasika.life' }];

  const canonicalName = rawName ?? raga.name;
  const isJanya = !!raga.parentRaga;
  const subtitle = isJanya
    ? 'Janya Raga: Arohana, Avarohana'
    : raga.melaNumber
      ? `Melakarta ${raga.melaNumber}: Arohana, Avarohana`
      : 'Raga: Arohana, Avarohana';

  const title = `${raga.name} ${subtitle} | Carnatic Music – Rasika.life`;

  const descParts = [`${raga.name} raga in Carnatic music.`];
  if (raga.arohanam) descParts.push(`Arohanam: ${raga.arohanam}.`);
  if (raga.avarohanam) descParts.push(`Avarohanam: ${raga.avarohanam}.`);
  // A janya raga carries its parent's mela number. Reporting that bare said
  // "Melakarta 20" on a page whose own title read "Janya Raga" — two claims in one
  // result, and the wrong one is the claim an arohanam search is there to check.
  if (isJanya) {
    const parentName = raga.parentRaga?.name ?? '';
    const mela = raga.melaNumber ? ` (melakarta ${raga.melaNumber})` : '';
    descParts.push(`Janya raga derived from ${parentName}${mela}.`);
  } else if (raga.melaNumber) {
    descParts.push(`Melakarta ${raga.melaNumber}.`);
  }
  const description = descParts.join(' ');

  const canonicalUrl = `https://rasika.life${generateRagaUrl(canonicalName, raga.id)}`;

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: `${raga.name} Raga | Rasika.life` },
    {
      property: 'og:description',
      content: `Arohanam, avarohanam and compositions in ${raga.name}.`,
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:image', content: ragaOgImageUrl(raga.id) },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:type', content: 'image/jpeg' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: `${raga.name} Raga` },
    {
      name: 'twitter:description',
      content: `Arohanam, avarohanam and compositions in ${raga.name}.`,
    },
    { name: 'twitter:image', content: ragaOgImageUrl(raga.id) },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
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
    performanceCount,
    topCompositions,
    activeEdit,
    isLoggedIn,
    isModerator,
  } = useLoaderData<{
    raga: RagaType;
    rawName: string;
    compositions: CompositionWithRelations[];
    hasMoreCompositions: boolean;
    similarRagas: RagaType[];
    performanceCount: number;
    topCompositions: { id: string; title: string; count: number }[];
    activeEdit: Edit | null;
    isLoggedIn: boolean;
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
        editUrl={isLoggedIn ? `${generateRagaUrl(rawName, raga.id)}/edit` : undefined}
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
      {performanceCount > 0 && (
        <section className="mt-8 pt-8 border-t">
          <div className="flex items-baseline gap-2 mb-4">
            <h2 className="text-xl font-semibold">Performed at concerts</h2>
            <span className="text-sm text-muted-foreground">
              {performanceCount} logged performance{performanceCount !== 1 ? 's' : ''}
            </span>
          </div>
          <ul className="space-y-2">
            {topCompositions.map(comp => (
              <li key={comp.id} className="flex items-center justify-between gap-4">
                <Link
                  to={generateCompositionUrl(comp.title, comp.id)}
                  className="text-sm hover:underline underline-offset-2 truncate"
                >
                  {comp.title}
                </Link>
                <span className="text-xs text-muted-foreground shrink-0">{comp.count}×</span>
              </li>
            ))}
          </ul>
        </section>
      )}
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

      {/* Three identical cards saying "Browse other ragas", "Find compositions in this raga"
          and "Learn about the tradition" told a reader nothing they could not guess. A plain
          row of links keeps the navigation and drops the furniture. */}
      <nav aria-label="Browse elsewhere" className="mt-10 border-t pt-6">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li>
            <Link to="/carnatic/ragas" className="text-primary hover:underline">
              All Ragas
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
          { name: 'Ragas', item: 'https://rasika.life/carnatic/ragas' },
          {
            name: `${raga.name} Raga`,
            item: `https://rasika.life${generateRagaUrl(rawName, raga.id)}`,
          },
        ]}
      />
      <RagaFaqStructuredData
        name={raga.name}
        arohanam={raga.arohanam}
        avarohanam={raga.avarohanam}
        melaNumber={raga.melaNumber}
        parentRagaName={raga.parentRaga?.name}
      />
    </main>
  );
}
