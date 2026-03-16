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
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function pickItem<T>(items: T[], dateOffset: number, seed: number): T | null {
  if (items.length === 0) return null;
  return items[(dateOffset + seed) % items.length];
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

  const entities: PickedEntity[] = [];

  const artistItem = pickItem(artists.items, dateOffset, seeds.artist);
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
    });
  }

  const ragaItem = pickItem(ragas.items, dateOffset, seeds.raga);
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
    });
  }

  const talaItem = pickItem(talas.items, dateOffset, seeds.tala);
  if (talaItem) {
    entities.push({
      key: 'tala',
      label: 'Tala',
      id: talaItem.id,
      name: talaItem.name,
      viewUrl: generateTalaUrl(talaItem.name, talaItem.id),
      editUrl: `${generateTalaUrl(talaItem.name, talaItem.id)}/edit`,
      total: talas.items.length,
    });
  }

  const compositionItem = pickItem(compositions.items, dateOffset, seeds.composition);
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
    });
  }

  const venueItem = pickItem(venues.items, dateOffset, seeds.venue);
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
    });
  }

  const organiserItem = pickItem(organisers.items, dateOffset, seeds.organiser);
  if (organiserItem) {
    entities.push({
      key: 'organiser',
      label: 'Organiser',
      id: organiserItem.id,
      name: organiserItem.name,
      viewUrl: generateOrganiserUrl(organiserItem.name, organiserItem.id),
      editUrl: `${generateOrganiserUrl(organiserItem.name, organiserItem.id)}/edit`,
      total: organisers.items.length,
    });
  }

  const festivalItem = pickItem(festivals.items, dateOffset, seeds.festival);
  if (festivalItem) {
    entities.push({
      key: 'festival',
      label: 'Festival',
      id: festivalItem.id,
      name: festivalItem.name,
      viewUrl: generateFestivalUrl(festivalItem.name, festivalItem.id),
      editUrl: `${generateFestivalUrl(festivalItem.name, festivalItem.id)}/edit`,
      total: festivals.items.length,
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

export default function ModeratorEnrich() {
  const { entities, seeds } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Daily Enrichment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          One entity of each type selected for today. Refresh any card to swap it for a different
          one.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {entities.map(entity => (
          <div key={entity.key} className="border rounded-lg p-4 bg-card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                {entity.label}
              </Badge>
              <span className="text-xs text-muted-foreground">{entity.total} total</span>
            </div>
            <div className="flex-1 min-h-[3rem]">
              <p className="font-semibold text-base leading-snug">{entity.name}</p>
              {entity.subtitle ? (
                <p className="text-sm text-muted-foreground mt-1">{entity.subtitle}</p>
              ) : null}
            </div>
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
