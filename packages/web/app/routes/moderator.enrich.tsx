import { computeCompletionScore } from '@rasika/core/shared/completion';
import type { CompletionEntityType } from '@rasika/core/shared/completion';
import { Eye, Pencil, RefreshCw } from 'lucide-react';
import type { MetaFunction } from 'react-router';
import { Link, data, useLoaderData } from 'react-router';
import { createServerClient } from '~/api.server';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { requireModerator } from '~/lib/auth.server';
import {
  generateArtistUrl,
  generateCompositionUrl,
  generateFestivalUrl,
  generateOrganiserUrl,
  generateRagaUrl,
  generateTalaUrl,
  generateVenueUrl,
} from '~/lib/url-slug';

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex, nofollow' }];
};

const ENTITY_KEYS = [
  'artist',
  'raga',
  'tala',
  'composition',
  'venue',
  'organiser',
  'festival',
] as const;

type EntityKey = (typeof ENTITY_KEYS)[number];

interface PickedEntity {
  key: EntityKey;
  label: string;
  id: string;
  name: string;
  subtitle?: string;
  viewUrl: string;
  editUrl: string;
  total: number;
  completionScore: number;
  poolSize: number;
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function pickFromPool<T>(
  items: T[],
  scoreFn: (item: T) => number,
  dateOffset: number,
  seed: number
): { item: T | null; poolSize: number } {
  if (items.length === 0) return { item: null, poolSize: 0 };

  const sorted = [...items].sort((a, b) => scoreFn(a) - scoreFn(b));
  const poolSize = Math.max(1, Math.ceil(sorted.length / 2));
  const pool = sorted.slice(0, poolSize);
  return { item: pool[(dateOffset + seed) % pool.length], poolSize };
}

export async function loader({ request }: { request: Request }) {
  await requireModerator(request);
  const serverClient = await createServerClient(request);

  const url = new URL(request.url);
  const seeds: Record<EntityKey, number> = {
    artist: Number.parseInt(url.searchParams.get('artist') ?? '0', 10) || 0,
    raga: Number.parseInt(url.searchParams.get('raga') ?? '0', 10) || 0,
    tala: Number.parseInt(url.searchParams.get('tala') ?? '0', 10) || 0,
    composition: Number.parseInt(url.searchParams.get('composition') ?? '0', 10) || 0,
    venue: Number.parseInt(url.searchParams.get('venue') ?? '0', 10) || 0,
    organiser: Number.parseInt(url.searchParams.get('organiser') ?? '0', 10) || 0,
    festival: Number.parseInt(url.searchParams.get('festival') ?? '0', 10) || 0,
  };

  const dateOffset = getDayOfYear(new Date());

  const [artists, ragas, talas, compositions, venues, organisers, festivals] = await Promise.all([
    serverClient.artist.list.query({ limit: 100 }),
    serverClient.raga.list.query({ limit: 100 }),
    serverClient.tala.list.query({ limit: 100 }),
    serverClient.composition.list.query({ limit: 100 }),
    serverClient.venue.list.query({ limit: 100 }),
    serverClient.organiser.list.query({ limit: 100 }),
    serverClient.festival.list.query({ limit: 100 }),
  ]);

  const score = (item: Record<string, unknown>, type: CompletionEntityType) =>
    computeCompletionScore(item, type);

  const entities: PickedEntity[] = [];

  const { item: artistItem, poolSize: artistPoolSize } = pickFromPool(
    artists.items,
    item => score(item as Record<string, unknown>, 'artist'),
    dateOffset,
    seeds.artist
  );
  if (artistItem) {
    const subtitle =
      artistItem.specialisations?.join(', ') ||
      (artistItem.birthPlace ? artistItem.birthPlace : undefined);
    entities.push({
      key: 'artist',
      label: 'Artist',
      id: artistItem.id,
      name: artistItem.name,
      subtitle,
      viewUrl: generateArtistUrl(artistItem.name, artistItem.id),
      editUrl: `${generateArtistUrl(artistItem.name, artistItem.id)}/edit`,
      total: artists.items.length,
      completionScore: score(artistItem as Record<string, unknown>, 'artist'),
      poolSize: artistPoolSize,
    });
  }

  const { item: ragaItem, poolSize: ragaPoolSize } = pickFromPool(
    ragas.items,
    item => score(item as Record<string, unknown>, 'raga'),
    dateOffset,
    seeds.raga
  );
  if (ragaItem) {
    const parts = [
      ragaItem.tradition,
      ragaItem.melaNumber != null ? `mela #${ragaItem.melaNumber}` : null,
    ].filter(Boolean);
    entities.push({
      key: 'raga',
      label: 'Raga',
      id: ragaItem.id,
      name: ragaItem.name,
      subtitle: parts.length > 0 ? parts.join(' · ') : undefined,
      viewUrl: generateRagaUrl(ragaItem.name, ragaItem.id),
      editUrl: `${generateRagaUrl(ragaItem.name, ragaItem.id)}/edit`,
      total: ragas.items.length,
      completionScore: score(ragaItem as Record<string, unknown>, 'raga'),
      poolSize: ragaPoolSize,
    });
  }

  const { item: talaItem, poolSize: talaPoolSize } = pickFromPool(
    talas.items,
    item => score(item as Record<string, unknown>, 'tala'),
    dateOffset,
    seeds.tala
  );
  if (talaItem) {
    entities.push({
      key: 'tala',
      label: 'Tala',
      id: talaItem.id,
      name: talaItem.name,
      viewUrl: generateTalaUrl(talaItem.name, talaItem.id),
      editUrl: `${generateTalaUrl(talaItem.name, talaItem.id)}/edit`,
      total: talas.items.length,
      completionScore: score(talaItem as Record<string, unknown>, 'tala'),
      poolSize: talaPoolSize,
    });
  }

  const { item: compositionItem, poolSize: compositionPoolSize } = pickFromPool(
    compositions.items,
    item => score(item as Record<string, unknown>, 'composition'),
    dateOffset,
    seeds.composition
  );
  if (compositionItem) {
    const parts = [compositionItem.composer?.name, compositionItem.language].filter(Boolean);
    entities.push({
      key: 'composition',
      label: 'Composition',
      id: compositionItem.id,
      name: compositionItem.title,
      subtitle: parts.length > 0 ? parts.join(' · ') : undefined,
      viewUrl: generateCompositionUrl(compositionItem.title, compositionItem.id),
      editUrl: `${generateCompositionUrl(compositionItem.title, compositionItem.id)}/edit`,
      total: compositions.items.length,
      completionScore: score(compositionItem as Record<string, unknown>, 'composition'),
      poolSize: compositionPoolSize,
    });
  }

  const { item: venueItem, poolSize: venuePoolSize } = pickFromPool(
    venues.items,
    item => score(item as Record<string, unknown>, 'venue'),
    dateOffset,
    seeds.venue
  );
  if (venueItem) {
    entities.push({
      key: 'venue',
      label: 'Venue',
      id: venueItem.id,
      name: venueItem.name,
      subtitle: venueItem.address?.city || undefined,
      viewUrl: generateVenueUrl(venueItem.name, venueItem.id),
      editUrl: `${generateVenueUrl(venueItem.name, venueItem.id)}/edit`,
      total: venues.items.length,
      completionScore: score(venueItem as Record<string, unknown>, 'venue'),
      poolSize: venuePoolSize,
    });
  }

  const { item: organiserItem, poolSize: organiserPoolSize } = pickFromPool(
    organisers.items,
    item => score(item as Record<string, unknown>, 'organiser'),
    dateOffset,
    seeds.organiser
  );
  if (organiserItem) {
    entities.push({
      key: 'organiser',
      label: 'Organiser',
      id: organiserItem.id,
      name: organiserItem.name,
      viewUrl: generateOrganiserUrl(organiserItem.name, organiserItem.id),
      editUrl: `${generateOrganiserUrl(organiserItem.name, organiserItem.id)}/edit`,
      total: organisers.items.length,
      completionScore: score(organiserItem as Record<string, unknown>, 'organiser'),
      poolSize: organiserPoolSize,
    });
  }

  const { item: festivalItem, poolSize: festivalPoolSize } = pickFromPool(
    festivals.items,
    item => score(item as Record<string, unknown>, 'festival'),
    dateOffset,
    seeds.festival
  );
  if (festivalItem) {
    entities.push({
      key: 'festival',
      label: 'Festival',
      id: festivalItem.id,
      name: festivalItem.name,
      viewUrl: generateFestivalUrl(festivalItem.name, festivalItem.id),
      editUrl: `${generateFestivalUrl(festivalItem.name, festivalItem.id)}/edit`,
      total: festivals.items.length,
      completionScore: score(festivalItem as Record<string, unknown>, 'festival'),
      poolSize: festivalPoolSize,
    });
  }

  return data({ entities, seeds });
}

function buildRefreshUrl(seeds: Record<EntityKey, number>, key: EntityKey): string {
  const params = new URLSearchParams();
  for (const k of ENTITY_KEYS) {
    const newSeed = k === key ? seeds[k] + 1 : seeds[k];
    if (newSeed !== 0) {
      params.set(k, String(newSeed));
    }
  }
  const qs = params.toString();
  return `/moderator/enrich${qs ? `?${qs}` : ''}`;
}

function CompletionBadge({ score }: { score: number }) {
  const colorClass =
    score < 40 ? 'text-destructive' : score < 70 ? 'text-warning' : 'text-success';
  const barClass =
    score < 40 ? 'bg-destructive' : score < 70 ? 'bg-warning' : 'bg-success';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-medium tabular-nums ${colorClass}`}>{score}%</span>
    </div>
  );
}

export default function ModeratorEnrich() {
  const { entities, seeds } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Daily Enrichment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Showing entities that need the most work. Refresh any card to swap it for another
          low-scoring entity.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {entities.map(entity => (
          <div key={entity.key} className="border rounded-lg p-4 bg-card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                {entity.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {entity.poolSize} of {entity.total} need work
              </span>
            </div>
            <div className="flex-1 min-h-[3rem]">
              <p className="font-semibold text-base leading-snug">{entity.name}</p>
              {entity.subtitle ? (
                <p className="text-sm text-muted-foreground mt-1">{entity.subtitle}</p>
              ) : null}
            </div>
            <CompletionBadge score={entity.completionScore} />
            <div className="flex items-center gap-2">
              <Button asChild size="sm" className="flex-1">
                <Link to={entity.editUrl} prefetch="intent">
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Enrich
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={entity.viewUrl} prefetch="intent" target="_blank" rel="noreferrer">
                  <Eye className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to={buildRefreshUrl(seeds as Record<EntityKey, number>, entity.key)}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
