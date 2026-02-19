import type { Edit } from '@rasika/core/domain/edit/client';
import { EditEntityTypes, EditStatus } from '@rasika/core/domain/edit/client';
import { ArrowLeft, Loader2, Pencil, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ActionFunction, LoaderFunction } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import { toast } from 'sonner';
import { client, createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { SearchSelect } from '~/components/SearchSelect';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { getUser } from '~/lib/auth.server';
import { generateCompositionUrl, parseSlug } from '~/lib/url-slug';

export async function loader({
  request,
  params,
}: { request: Request; params: { compositionid?: string } }) {
  const user = await getUser(request);
  if (!user) {
    return redirect(`/auth/login?redirectTo=${new URL(request.url).pathname}`);
  }

  const { compositionid } = params;
  if (!compositionid) {
    throw new Response('Composition ID is required', { status: 400 });
  }

  const parsed = parseSlug(compositionid);
  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const { id: slugId } = parsed;
  const composition = await client.composition.get.query({ id: slugId });

  if (!composition) {
    throw new Response('Composition not found', { status: 404 });
  }

  const serverClient = await createServerClient(request);
  const activeEdit = await serverClient.edit.getActiveEditForEntity.query({
    entityType: EditEntityTypes.COMPOSITION,
    entityId: composition.id,
  });

  if (activeEdit?.status === EditStatus.SUBMITTED) {
    return redirect(`/my-edits?editId=${activeEdit.id}`);
  }

  // Enrich activeEdit with raga/tala names for proper display
  let enrichedEdit = activeEdit;
  if (activeEdit?.proposedValues) {
    const proposedValues = { ...activeEdit.proposedValues };

    // Fetch raga names if ragaIds exist
    if (proposedValues.ragaIds && Array.isArray(proposedValues.ragaIds)) {
      const ragas = await Promise.all(
        (proposedValues.ragaIds as string[]).map(async id => {
          const raga = await serverClient.raga.get.query({ id });
          return raga ? { id: raga.id, name: raga.name } : null;
        })
      );
      proposedValues.ragas = ragas.filter((r): r is { id: string; name: string } => r !== null);
    }

    // Fetch tala names if talaIds exist
    if (proposedValues.talaIds && Array.isArray(proposedValues.talaIds)) {
      const talas = await Promise.all(
        (proposedValues.talaIds as string[]).map(async id => {
          const tala = await serverClient.tala.get.query({ id });
          return tala ? { id: tala.id, name: tala.name } : null;
        })
      );
      proposedValues.talas = talas.filter((t): t is { id: string; name: string } => t !== null);
    }

    enrichedEdit = { ...activeEdit, proposedValues };
  }

  return data({ composition, user, activeEdit: enrichedEdit });
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { compositionid?: string };
}) {
  const user = await getUser(request);
  if (!user) {
    return redirect('/auth/login');
  }

  const { compositionid } = params;
  if (!compositionid) {
    return data({ error: 'Composition ID is required' }, { status: 400 });
  }

  const parsed = parseSlug(compositionid);
  if (!parsed) {
    return data({ error: 'Invalid URL format' }, { status: 400 });
  }

  const { id: slugId } = parsed;
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  const serverClient = await createServerClient(request);

  const composition = await client.composition.get.query({ id: slugId });
  if (!composition) {
    return data({ error: 'Composition not found' }, { status: 404 });
  }

  const title = formData.get('title') as string;
  const language = formData.get('language') as string;
  const composerId = formData.get('composer_id') as string;
  const composerName = formData.get('composer_name') as string;
  const userNote = formData.get('userNote') as string;

  // Get raga and tala IDs from form data (array format: raga_ids[0], raga_ids[1], etc.)
  const ragaIds: string[] = [];
  const talaIds: string[] = [];

  for (const [key, value] of formData.entries()) {
    if (key.startsWith('raga_ids[') && typeof value === 'string') {
      ragaIds.push(value);
    }
    if (key.startsWith('tala_ids[') && typeof value === 'string') {
      talaIds.push(value);
    }
  }

  // Only include fields that actually changed
  const proposedValues: Record<string, unknown> = {};

  if (title !== composition.title) {
    proposedValues.title = title;
  }

  if (language !== composition.language) {
    proposedValues.language = language;
  }

  if (composerId !== composition.composer.id) {
    proposedValues.composer = { id: composerId, name: composerName };
  }

  // Check if ragas changed
  const currentRagaIds = composition.ragas.map(r => r.id).sort();
  const newRagaIds = [...ragaIds].sort();
  if (JSON.stringify(currentRagaIds) !== JSON.stringify(newRagaIds)) {
    proposedValues.ragaIds = ragaIds;
  }

  // Check if talas changed
  const currentTalaIds = composition.talas.map(t => t.id).sort();
  const newTalaIds = [...talaIds].sort();
  if (JSON.stringify(currentTalaIds) !== JSON.stringify(newTalaIds)) {
    proposedValues.talaIds = talaIds;
  }

  if (Object.keys(proposedValues).length === 0) {
    return data(
      { error: 'No changes detected. Please modify at least one field.' },
      { status: 400 }
    );
  }

  if (intent === 'save-draft' || intent === 'submit') {
    try {
      let editId = formData.get('editId') as string | undefined;

      const result = await serverClient.edit.saveChanges.mutate({
        entityType: EditEntityTypes.COMPOSITION,
        entityId: slugId,
        proposedValues,
        userNote: userNote || undefined,
        editId,
      });

      editId = result.id;

      if (intent === 'submit') {
        await serverClient.edit.submit.mutate({ editId });
        return data({ success: true, redirectUrl: generateCompositionUrl(title, slugId) });
      }

      return data({ success: true, editId });
    } catch (error) {
      console.error('Failed to save changes:', error);
      return data({ error: 'Failed to save changes. Please try again.' }, { status: 500 });
    }
  }

  return data({ error: 'Invalid action' }, { status: 400 });
}

export default function EditComposition() {
  const { composition, user, activeEdit } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const compositionUrl = generateCompositionUrl(composition.title, composition.id);

  // Use draft values if editing an existing draft, otherwise use current entity values
  const defaultValues = {
    title: (activeEdit?.proposedValues.title as string | undefined) || composition.title,
    language: (activeEdit?.proposedValues.language as string | undefined) || composition.language,
    composer: activeEdit?.proposedValues.composer
      ? (activeEdit.proposedValues.composer as { id: string; name: string })
      : composition.composer,
    ragas: (activeEdit?.proposedValues.ragas as Array<{ id: string; name: string }> | undefined)
      ? (activeEdit.proposedValues.ragas as Array<{ id: string; name: string }>)
      : composition.ragas || [],
    talas: (activeEdit?.proposedValues.talas as Array<{ id: string; name: string }> | undefined)
      ? (activeEdit.proposedValues.talas as Array<{ id: string; name: string }>)
      : composition.talas || [],
    userNote: activeEdit?.userNote || '',
  };

  const [selectedComposer, setSelectedComposer] = useState<{ id: string; name: string } | null>(
    defaultValues.composer
  );
  const [selectedRagas, setSelectedRagas] = useState<{ id: string; name: string }[]>(
    defaultValues.ragas
  );
  const [selectedTalas, setSelectedTalas] = useState<{ id: string; name: string }[]>(
    defaultValues.talas
  );

  // Show toast and redirect on successful submission
  useEffect(() => {
    if (
      actionData &&
      'success' in actionData &&
      actionData.success &&
      'redirectUrl' in actionData
    ) {
      toast.success('Edit submitted for review');
      window.location.href = actionData.redirectUrl;
    }
  }, [actionData]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: 'Carnatic', path: '/carnatic' },
          { label: 'Compositions', path: '/carnatic/compositions' },
          { label: composition.title, path: compositionUrl },
          { label: activeEdit ? 'Continue Editing' : 'Edit', path: '#' },
        ]}
      />

      <div className="mt-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {activeEdit ? 'Continue Editing Composition' : 'Edit Composition'}
          </h1>
          <span className="text-sm text-muted-foreground">v{composition.version}</span>
        </div>

        <div className="bg-card rounded-lg shadow-sm border p-6">
          <Form method="post" className="space-y-6">
            {activeEdit && <input type="hidden" name="editId" value={activeEdit.id} />}

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                type="text"
                defaultValue={defaultValues.title}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Input
                id="language"
                name="language"
                type="text"
                defaultValue={defaultValues.language}
                required
              />
            </div>

            <SearchSelect
              label="Composer"
              placeholder="Search for composer..."
              searchUrl="/api/search/artist"
              value={selectedComposer}
              onChange={setSelectedComposer}
              inputId="composer"
            />
            <input type="hidden" name="composer_id" value={selectedComposer?.id ?? ''} />
            <input type="hidden" name="composer_name" value={selectedComposer?.name ?? ''} />

            <SearchSelect
              multiple
              label="Ragas"
              placeholder="Search for ragas..."
              searchUrl="/api/search/raga"
              value={selectedRagas}
              onChange={setSelectedRagas}
              inputId="ragas"
              fieldName="raga_ids"
            />

            <SearchSelect
              multiple
              label="Talas"
              placeholder="Search for talas..."
              searchUrl="/api/search/tala"
              value={selectedTalas}
              onChange={setSelectedTalas}
              inputId="talas"
              fieldName="tala_ids"
            />

            <div className="space-y-2">
              <Label htmlFor="userNote">Edit Note (optional)</Label>
              <Textarea
                id="userNote"
                name="userNote"
                rows={3}
                placeholder="Explain the changes you're making..."
                defaultValue={defaultValues.userNote}
              />
            </div>

            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <a
                href={compositionUrl}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Cancel
              </a>
              <Button variant="ghost" type="submit" name="intent" value="save-draft">
                {navigation.formData?.get('intent') === 'save-draft' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Draft
                  </>
                )}
              </Button>
              <Button variant="default" type="submit" name="intent" value="submit">
                {navigation.formData?.get('intent') === 'submit' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Pencil className="mr-2 h-4 w-4" />
                    Submit for Review
                  </>
                )}
              </Button>
            </div>
          </Form>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-950 dark:border-yellow-800">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            About Edit Submissions
          </h3>
          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            Your edit will be submitted for review by a moderator. Once approved, the changes will
            be visible to everyone.
          </p>
        </div>
      </div>
    </div>
  );
}
