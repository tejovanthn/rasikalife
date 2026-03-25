import { Merge } from 'lucide-react';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { Form, data, redirect, useLoaderData, useNavigation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { requireModerator } from '~/lib/auth.server';

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex, nofollow' }];
};

type EntityType = 'artist' | 'composition' | 'raga' | 'tala' | 'event' | 'venue' | 'organiser';

interface EntityInfo {
  id: string;
  name: string;
  score: number;
}

type LoaderData =
  | {
      step: 1;
      entityType: EntityType;
      entityId: string;
      entityName: string;
    }
  | {
      step: 2;
      entityType: EntityType;
      loser: EntityInfo;
      canonical: EntityInfo;
      suggestedCanonicalId: string;
    };

async function fetchEntityName(
  serverClient: Awaited<ReturnType<typeof createServerClient>>,
  entityType: EntityType,
  id: string
): Promise<string> {
  try {
    switch (entityType) {
      case 'artist': {
        const e = await serverClient.artist.get.query({ id });
        return e?.name ?? id;
      }
      case 'composition': {
        const e = await serverClient.composition.get.query({ id });
        return e?.title ?? id;
      }
      case 'raga': {
        const e = await serverClient.raga.get.query({ id });
        return e?.name ?? id;
      }
      case 'tala': {
        const e = await serverClient.tala.get.query({ id });
        return e?.name ?? id;
      }
      case 'venue': {
        const e = await serverClient.venue.get.query({ id });
        return e?.name ?? id;
      }
      case 'organiser': {
        const e = await serverClient.organiser.get.query({ id });
        return e?.name ?? id;
      }
      case 'event': {
        const e = await serverClient.event.get.query({ id });
        return e?.title ?? id;
      }
    }
  } catch {
    return id;
  }
}

async function getMergeSuggestion(
  serverClient: Awaited<ReturnType<typeof createServerClient>>,
  entityType: EntityType,
  idA: string,
  idB: string
) {
  switch (entityType) {
    case 'artist':
      return serverClient.artist.getMergeSuggestion.query({ idA, idB });
    case 'composition':
      return serverClient.composition.getMergeSuggestion.query({ idA, idB });
    case 'raga':
      return serverClient.raga.getMergeSuggestion.query({ idA, idB });
    case 'tala':
      return serverClient.tala.getMergeSuggestion.query({ idA, idB });
    case 'venue':
      return serverClient.venue.getMergeSuggestion.query({ idA, idB });
    case 'organiser':
      return serverClient.organiser.getMergeSuggestion.query({ idA, idB });
    case 'event':
      return serverClient.event.getMergeSuggestion.query({ idA, idB });
  }
}

export const loader: LoaderFunction = async ({ request }) => {
  await requireModerator(request);

  const url = new URL(request.url);
  const entityType = url.searchParams.get('entityType') as EntityType | null;
  const entityId = url.searchParams.get('entityId');
  const targetId = url.searchParams.get('targetId');

  if (!entityType || !entityId) {
    throw new Response('entityType and entityId are required', { status: 400 });
  }

  const serverClient = await createServerClient(request);

  if (!targetId) {
    const entityName = await fetchEntityName(serverClient, entityType, entityId);
    return data<LoaderData>({ step: 1, entityType, entityId, entityName });
  }

  const suggestion = await getMergeSuggestion(serverClient, entityType, entityId, targetId);

  if (!suggestion || !suggestion.entityA || !suggestion.entityB) {
    throw new Response('One or both entities not found', { status: 404 });
  }

  const entityA = suggestion.entityA as EntityInfo;
  const entityB = suggestion.entityB as EntityInfo;
  const isACanonical = suggestion.suggestedCanonicalId === entityA.id;

  return data<LoaderData>({
    step: 2,
    entityType,
    loser: isACanonical ? entityB : entityA,
    canonical: isACanonical ? entityA : entityB,
    suggestedCanonicalId: suggestion.suggestedCanonicalId,
  });
};

export const action: ActionFunction = async ({ request }) => {
  await requireModerator(request);

  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'lookup') {
    const entityType = formData.get('entityType') as string;
    const entityId = formData.get('entityId') as string;
    const targetId = formData.get('targetId') as string;

    if (!targetId?.trim()) {
      throw new Response('Target entity ID is required', { status: 400 });
    }

    const url = new URL(request.url);
    url.searchParams.set('entityType', entityType);
    url.searchParams.set('entityId', entityId);
    url.searchParams.set('targetId', targetId.trim());
    return redirect(url.pathname + url.search);
  }

  if (intent === 'merge') {
    const entityType = formData.get('entityType') as string;
    const loserId = formData.get('loserId') as string;
    const canonicalId = formData.get('canonicalId') as string;
    const userNote = (formData.get('userNote') as string) || undefined;

    const serverClient = await createServerClient(request);
    await serverClient.edit.requestMerge.mutate({
      entityType: entityType as EntityType,
      entityId: loserId,
      mergeTargetId: canonicalId,
      userNote: userNote?.trim() ? userNote.trim() : undefined,
    });

    return redirect('/moderator/edits');
  }

  throw new Response('Invalid intent', { status: 400 });
};

export default function MergeEntities() {
  const loaderData = useLoaderData() as LoaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  if (loaderData.step === 1) {
    const { entityType, entityId, entityName } = loaderData;
    return (
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <Merge className="h-6 w-6 text-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Merge Duplicate</h1>
        </div>

        <div className="bg-card rounded-lg border p-6 space-y-6">
          <div>
            <p className="text-sm text-muted-foreground capitalize">{entityType}</p>
            <p className="text-lg font-semibold">{entityName}</p>
            <p className="text-xs text-muted-foreground mt-1">ID: {entityId}</p>
          </div>

          <p className="text-sm text-muted-foreground">
            Enter the ID of the other {entityType} to merge with. The system will suggest which one
            to keep as canonical based on popularity.
          </p>

          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="lookup" />
            <input type="hidden" name="entityType" value={entityType} />
            <input type="hidden" name="entityId" value={entityId} />

            <div className="space-y-2">
              <Label htmlFor="targetId">Other {entityType} ID</Label>
              <Input
                id="targetId"
                name="targetId"
                placeholder="Enter ID of the duplicate..."
                required
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                <Merge className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Loading…' : 'Compare Entities'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => history.back()}
              >
                Cancel
              </Button>
            </div>
          </Form>
        </div>
      </main>
    );
  }

  const { entityType, loser, canonical, suggestedCanonicalId } = loaderData;

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Merge className="h-6 w-6 text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Confirm Merge</h1>
      </div>

      <div className="space-y-6">
        {/* Side-by-side comparison */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card rounded-lg border p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Will be redirected (loser)
            </p>
            <p className="font-semibold">{loser.name}</p>
            <p className="text-xs text-muted-foreground">ID: {loser.id}</p>
            <p className="text-xs text-muted-foreground">Score: {loser.score}</p>
          </div>
          <div className="bg-card rounded-lg border border-primary p-4 space-y-2">
            <p className="text-xs font-medium text-primary uppercase tracking-wide">
              Will be kept (canonical)
            </p>
            <p className="font-semibold">{canonical.name}</p>
            <p className="text-xs text-muted-foreground">ID: {canonical.id}</p>
            <p className="text-xs text-muted-foreground">Score: {canonical.score}</p>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>{loser.name}</strong> will be merged into <strong>{canonical.name}</strong>. All
            references to the loser will be updated to point to the canonical record. The loser will
            return a 301 redirect.
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            This requires approval by another moderator before taking effect.
          </p>
        </div>

        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="merge" />
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="loserId" value={loser.id} />
          <input type="hidden" name="canonicalId" value={canonical.id} />

          <div className="space-y-2">
            <Label htmlFor="userNote">Reason (optional)</Label>
            <Textarea
              id="userNote"
              name="userNote"
              placeholder="Explain why these are duplicates..."
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              <Merge className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Submitting…' : 'Submit Merge Request'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => history.back()}
            >
              Flip Canonical / Go Back
            </Button>
          </div>
        </Form>
      </div>
    </main>
  );
}
