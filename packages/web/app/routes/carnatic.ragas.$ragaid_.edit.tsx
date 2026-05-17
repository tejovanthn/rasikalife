import type { Edit } from '@rasika/core/domain/edit/client';
import { EditEntityTypes, EditStatus } from '@rasika/core/domain/edit/client';
import { ArrowLeft, Loader2, Pencil, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import { toast } from 'sonner';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { EditDisclaimer } from '~/components/shared';
import { SearchSelect } from '~/components/SearchSelect';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { getUser } from '~/lib/auth.server';
import { generateRagaUrl, parseSlug } from '~/lib/url-slug';

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex, nofollow' }];
};

export async function loader({
  request,
  params,
}: { request: Request; params: { ragaid?: string } }) {
  const user = await getUser(request);
  if (!user) {
    return redirect(`/auth/login?redirectTo=${new URL(request.url).pathname}`);
  }

  const { ragaid } = params;
  if (!ragaid) {
    throw new Response('Raga ID is required', { status: 400 });
  }

  const parsed = parseSlug(ragaid);
  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const { id: slugId } = parsed;
  const serverClient = await createServerClient(request);
  const raga = await serverClient.raga.get.query({ id: slugId });

  if (!raga) {
    throw new Response('Raga not found', { status: 404 });
  }

  const activeEdit = await serverClient.edit.getActiveEditForEntity.query({
    entityType: EditEntityTypes.RAGA,
    entityId: raga.id,
  });

  if (activeEdit?.status === EditStatus.SUBMITTED) {
    return redirect(`/my-edits?editId=${activeEdit.id}`);
  }

  // Enrich activeEdit with parentRaga name if needed
  let enrichedEdit = activeEdit;
  if (activeEdit?.proposedValues?.parentRagaId) {
    const parentRaga = await serverClient.raga.get.query({
      id: activeEdit.proposedValues.parentRagaId as string,
    });
    if (parentRaga) {
      enrichedEdit = {
        ...activeEdit,
        proposedValues: {
          ...activeEdit.proposedValues,
          parentRaga: { id: parentRaga.id, name: parentRaga.name },
        },
      };
    }
  }

  return data({ raga, user, activeEdit: enrichedEdit });
}

export async function action({
  request,
  params,
}: { request: Request; params: { ragaid?: string } }) {
  const user = await getUser(request);
  if (!user) {
    return redirect('/auth/login');
  }

  const { ragaid } = params;
  if (!ragaid) {
    return data({ error: 'Raga ID is required' }, { status: 400 });
  }

  const parsed = parseSlug(ragaid);
  if (!parsed) {
    return data({ error: 'Invalid URL format' }, { status: 400 });
  }

  const { id: slugId } = parsed;
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  const serverClient = await createServerClient(request);
  const raga = await serverClient.raga.get.query({ id: slugId });

  if (!raga) {
    return data({ error: 'Raga not found' }, { status: 404 });
  }

  const name = formData.get('name') as string;
  const description = (formData.get('description') as string) || '';
  const traditionRaw = (formData.get('tradition') as string) || '';
  const tradition = traditionRaw === 'none' ? '' : traditionRaw;
  const arohanam = (formData.get('arohanam') as string) || '';
  const avarohanam = (formData.get('avarohanam') as string) || '';
  const alternateScalesRaw = (formData.get('alternateScales') as string) || '';
  const rasa = (formData.get('rasa') as string) || '';
  const timeOfDayRaw = (formData.get('timeOfDay') as string) || '';
  const timeOfDay = timeOfDayRaw === 'none' ? '' : timeOfDayRaw;
  const season = (formData.get('season') as string) || '';
  const melaNumberRaw = (formData.get('melaNumber') as string) || '';
  const parentRagaId = (formData.get('parentRaga_id') as string) || '';
  const userNote = formData.get('userNote') as string;

  const proposedValues: Record<string, unknown> = {};

  if (name !== raga.name) proposedValues.name = name;
  if (description !== (raga.description ?? ''))
    proposedValues.description = description || undefined;
  if (tradition !== (raga.tradition ?? '')) proposedValues.tradition = tradition || undefined;
  if (arohanam !== (raga.arohanam ?? '')) proposedValues.arohanam = arohanam || undefined;
  if (avarohanam !== (raga.avarohanam ?? '')) proposedValues.avarohanam = avarohanam || undefined;

  const alternateScales = alternateScalesRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const currentAlternateScales = raga.alternateScales ?? [];
  if (
    JSON.stringify(alternateScales.sort()) !== JSON.stringify([...currentAlternateScales].sort())
  ) {
    proposedValues.alternateScales = alternateScales.length > 0 ? alternateScales : undefined;
  }

  if (rasa !== (raga.rasa ?? '')) proposedValues.rasa = rasa || undefined;
  if (timeOfDay !== (raga.timeOfDay ?? '')) proposedValues.timeOfDay = timeOfDay || undefined;
  if (season !== (raga.season ?? '')) proposedValues.season = season || undefined;

  const melaNumber = melaNumberRaw ? Number.parseInt(melaNumberRaw, 10) : undefined;
  if (melaNumber !== raga.melaNumber) proposedValues.melaNumber = melaNumber;

  const currentParentRagaId = raga.parentRaga?.id ?? '';
  if (parentRagaId !== currentParentRagaId) {
    if (parentRagaId) {
      const parentRaga = await serverClient.raga.get.query({ id: parentRagaId });
      if (!parentRaga) {
        return data({ error: 'Parent raga not found' }, { status: 400 });
      }
      proposedValues.parentRaga = { id: parentRaga.id, name: parentRaga.name };
    } else {
      proposedValues.parentRaga = undefined;
    }
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
        entityType: EditEntityTypes.RAGA,
        entityId: slugId,
        proposedValues,
        userNote: userNote || undefined,
        editId,
      });

      editId = result.id;

      if (intent === 'submit') {
        await serverClient.edit.submit.mutate({ editId });
        return data({ success: true, redirectUrl: generateRagaUrl(name, slugId) });
      }

      return data({ success: true, editId });
    } catch (error) {
      console.error('Failed to save changes:', error);
      return data({ error: 'Failed to save changes. Please try again.' }, { status: 500 });
    }
  }

  return data({ error: 'Invalid action' }, { status: 400 });
}

export default function EditRaga() {
  const { raga, user, activeEdit } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const ragaUrl = generateRagaUrl(raga.name, raga.id);

  const proposed = activeEdit?.proposedValues ?? {};

  const defaultValues = {
    name: (proposed.name as string | undefined) ?? raga.name,
    description: (proposed.description as string | undefined) ?? raga.description ?? '',
    tradition: (proposed.tradition as string | undefined) ?? raga.tradition ?? 'none',
    arohanam: (proposed.arohanam as string | undefined) ?? raga.arohanam ?? '',
    avarohanam: (proposed.avarohanam as string | undefined) ?? raga.avarohanam ?? '',
    alternateScales: (
      (proposed.alternateScales as string[] | undefined) ??
      raga.alternateScales ??
      []
    ).join(', '),
    rasa: (proposed.rasa as string | undefined) ?? raga.rasa ?? '',
    timeOfDay: (proposed.timeOfDay as string | undefined) ?? raga.timeOfDay ?? 'none',
    season: (proposed.season as string | undefined) ?? raga.season ?? '',
    melaNumber:
      (proposed.melaNumber as number | undefined) ?? raga.melaNumber ?? ('' as number | ''),
    parentRaga:
      (proposed.parentRaga as { id: string; name: string } | undefined) ?? raga.parentRaga ?? null,
    userNote: activeEdit?.userNote ?? '',
  };

  const [selectedParentRaga, setSelectedParentRaga] = useState<{
    id: string;
    name: string;
  } | null>(defaultValues.parentRaga);

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
          { label: 'Ragas', path: '/carnatic/ragas' },
          { label: raga.name, path: ragaUrl },
          { label: activeEdit ? 'Continue Editing' : 'Edit', path: '#' },
        ]}
      />

      <div className="mt-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {activeEdit ? 'Continue Editing Raga' : 'Edit Raga'}
          </h1>
        </div>
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <Form method="post" className="space-y-6">
            {activeEdit && <input type="hidden" name="editId" value={activeEdit.id} />}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" type="text" defaultValue={defaultValues.name} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                placeholder="Brief description of this raga..."
                defaultValue={defaultValues.description}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tradition">Tradition</Label>
                <Select name="tradition" defaultValue={defaultValues.tradition}>
                  <SelectTrigger id="tradition">
                    <SelectValue placeholder="Select tradition..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="carnatic">Carnatic</SelectItem>
                    <SelectItem value="hindustani">Hindustani</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="melaNumber">Mela Number (1–72)</Label>
                <Input
                  id="melaNumber"
                  name="melaNumber"
                  type="number"
                  min={1}
                  max={72}
                  defaultValue={defaultValues.melaNumber === '' ? '' : defaultValues.melaNumber}
                  placeholder="e.g. 29"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="arohanam">Arohanam</Label>
                <Input
                  id="arohanam"
                  name="arohanam"
                  type="text"
                  defaultValue={defaultValues.arohanam}
                  placeholder="e.g. S R2 G3 M1 P D2 N3 S"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avarohanam">Avarohanam</Label>
                <Input
                  id="avarohanam"
                  name="avarohanam"
                  type="text"
                  defaultValue={defaultValues.avarohanam}
                  placeholder="e.g. S N3 D2 P M1 G3 R2 S"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alternateScales">Alternate Scales</Label>
              <Input
                id="alternateScales"
                name="alternateScales"
                type="text"
                defaultValue={defaultValues.alternateScales}
                placeholder="Comma-separated list of alternate scale names"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rasa">Rasa</Label>
                <Input
                  id="rasa"
                  name="rasa"
                  type="text"
                  defaultValue={defaultValues.rasa}
                  placeholder="e.g. Shantha, Karuna"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="season">Season</Label>
                <Input
                  id="season"
                  name="season"
                  type="text"
                  defaultValue={defaultValues.season}
                  placeholder="e.g. Rainy season"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeOfDay">Time of Day</Label>
              <Select name="timeOfDay" defaultValue={defaultValues.timeOfDay}>
                <SelectTrigger id="timeOfDay">
                  <SelectValue placeholder="Select time of day..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                  <SelectItem value="universal">Universal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <SearchSelect
              label="Parent Raga"
              placeholder="Search for parent raga..."
              searchUrl="/api/search/raga"
              value={selectedParentRaga}
              onChange={setSelectedParentRaga}
              inputId="parentRaga"
              fieldName="parentRaga_id"
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

            {actionData && 'error' in actionData && (
              <p className="text-sm text-destructive">{actionData.error}</p>
            )}

            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <a
                href={ragaUrl}
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
        <EditDisclaimer />
      </div>
    </div>
  );
}
