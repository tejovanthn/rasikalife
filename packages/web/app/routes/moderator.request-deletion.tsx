import { Trash2 } from 'lucide-react';
import type { ActionFunction, LoaderFunction } from 'react-router';
import { Form, data, redirect, useLoaderData, useNavigation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { requireModerator } from '~/lib/auth.server';

type LoaderData =
  | { alreadyPending: true; entityName: string; entityType: string; entityId: string }
  | { alreadyPending: false; entityName: string; entityType: string; entityId: string };

export const loader: LoaderFunction = async ({ request }) => {
  await requireModerator(request);

  const url = new URL(request.url);
  const entityType = url.searchParams.get('entityType');
  const entityId = url.searchParams.get('entityId');

  if (!entityType || !entityId) {
    throw new Response('entityType and entityId are required', { status: 400 });
  }

  const serverClient = await createServerClient(request);

  // Fetch entity name
  let entityName = entityId;
  try {
    switch (entityType) {
      case 'artist': {
        const entity = await serverClient.artist.get.query({ id: entityId });
        if (entity) entityName = entity.name;
        break;
      }
      case 'composition': {
        const entity = await serverClient.composition.get.query({ id: entityId });
        if (entity) entityName = entity.title;
        break;
      }
      case 'raga': {
        const entity = await serverClient.raga.get.query({ id: entityId });
        if (entity) entityName = entity.name;
        break;
      }
      case 'tala': {
        const entity = await serverClient.tala.get.query({ id: entityId });
        if (entity) entityName = entity.name;
        break;
      }
      case 'venue': {
        const entity = await serverClient.venue.get.query({ id: entityId });
        if (entity) entityName = entity.name;
        break;
      }
      case 'organiser': {
        const entity = await serverClient.organiser.get.query({ id: entityId });
        if (entity) entityName = entity.name;
        break;
      }
      case 'event': {
        const entity = await serverClient.event.get.query({ id: entityId });
        if (entity) entityName = entity.title;
        break;
      }
    }
  } catch {
    // Entity may not exist
  }

  // Check if a deletion request is already pending
  let alreadyPending = false;
  try {
    const editsResult = await serverClient.edit.getEntityEdits.query({
      entityType: entityType as
        | 'artist'
        | 'composition'
        | 'raga'
        | 'tala'
        | 'event'
        | 'venue'
        | 'organiser',
      entityId,
      status: 'submitted',
    });
    alreadyPending = editsResult.items.some(e => e.operation === 'delete');
  } catch {
    // Ignore errors
  }

  return data({ alreadyPending, entityName, entityType, entityId } as LoaderData);
};

export const action: ActionFunction = async ({ request }) => {
  await requireModerator(request);

  const formData = await request.formData();
  const entityType = formData.get('entityType') as string;
  const entityId = formData.get('entityId') as string;
  const userNote = (formData.get('userNote') as string) || undefined;

  const serverClient = await createServerClient(request);
  await serverClient.edit.requestDeletion.mutate({
    entityType: entityType as
      | 'artist'
      | 'composition'
      | 'raga'
      | 'tala'
      | 'event'
      | 'venue'
      | 'organiser',
    entityId,
    userNote: userNote?.trim() ? userNote.trim() : undefined,
  });

  return redirect('/moderator/edits');
};

export default function RequestDeletion() {
  const loaderData = useLoaderData<typeof loader>() as LoaderData;
  const { entityName, entityType, entityId, alreadyPending } = loaderData;
  const navigation = useNavigation();

  return (
    <main className="container mx-auto px-4 py-8 max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Trash2 className="h-6 w-6 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">Request Deletion</h1>
      </div>

      <div className="bg-card rounded-lg border p-6 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{entityType}</p>
          <p className="text-lg font-semibold">{entityName}</p>
        </div>

        {alreadyPending ? (
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
              A deletion request is already pending for this {entityType}.
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              The existing request must be approved or rejected before submitting a new one.
            </p>
          </div>
        ) : (
          <Form method="post" className="space-y-4">
            <input type="hidden" name="entityType" value={entityType} />
            <input type="hidden" name="entityId" value={entityId} />

            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-200">
                This will submit a deletion request for <strong>{entityName}</strong>. When approved
                by another moderator, the {entityType} will be soft-deleted and return 404 to all
                users.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userNote">Reason (optional)</Label>
              <Textarea
                id="userNote"
                name="userNote"
                placeholder="Explain why this should be deleted..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                {navigation.state === 'submitting' ? 'Submitting…' : 'Submit Deletion Request'}
              </Button>
              <Button type="button" variant="outline" disabled={navigation.state === 'submitting'} onClick={() => history.back()}>
                Cancel
              </Button>
            </div>
          </Form>
        )}

        {alreadyPending && (
          <div className="pt-2">
            <Button variant="outline" onClick={() => history.back()}>
              Go Back
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
