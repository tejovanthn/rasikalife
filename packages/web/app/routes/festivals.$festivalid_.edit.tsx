import { EditEntityTypes, EditStatus } from '@rasika/core/domain/edit/client';
import { ArrowLeft, Loader2, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MetaFunction } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { getUser } from '~/lib/auth.server';
import { generateFestivalUrl, parseSlug } from '~/lib/url-slug';

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex, nofollow' }];
};

interface SponsorEntry {
  name: string;
  type?: string;
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { festivalid?: string };
}) {
  const user = await getUser(request);
  if (!user) {
    return redirect(`/auth/login?redirectTo=${new URL(request.url).pathname}`);
  }

  const { festivalid } = params;
  if (!festivalid) {
    throw new Response('Festival ID is required', { status: 400 });
  }

  const parsed = parseSlug(festivalid);
  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const { id: slugId } = parsed;
  const serverClient = await createServerClient(request);
  const festival = await serverClient.festival.get.query({ id: slugId });

  if (!festival) {
    throw new Response('Festival not found', { status: 404 });
  }

  if (festival.status !== 'approved') {
    throw new Response('Only approved festivals can be edited via this form', { status: 400 });
  }

  const activeEdit = await serverClient.edit.getActiveEditForEntity.query({
    entityType: EditEntityTypes.FESTIVAL,
    entityId: festival.id,
  });

  if (activeEdit?.status === EditStatus.SUBMITTED) {
    return redirect(`/my-edits?editId=${activeEdit.id}`);
  }

  return data({ festival, user, activeEdit });
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { festivalid?: string };
}) {
  const user = await getUser(request);
  if (!user) {
    return redirect('/auth/login');
  }

  const { festivalid } = params;
  if (!festivalid) {
    return data({ error: 'Festival ID is required' }, { status: 400 });
  }

  const parsed = parseSlug(festivalid);
  if (!parsed) {
    return data({ error: 'Invalid URL format' }, { status: 400 });
  }

  const { id: slugId } = parsed;
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  const serverClient = await createServerClient(request);
  const festival = await serverClient.festival.get.query({ id: slugId });

  if (!festival) {
    return data({ error: 'Festival not found' }, { status: 404 });
  }

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;
  const organiserName = formData.get('organiserName') as string;
  const tagsRaw = formData.get('tags') as string;
  const userNote = formData.get('userNote') as string;

  const tags = tagsRaw
    ? tagsRaw
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
    : [];

  // Parse sponsors from form (indexed fields)
  const sponsors: SponsorEntry[] = [];
  let i = 0;
  while (formData.has(`sponsors[${i}].name`)) {
    const sponsorName = formData.get(`sponsors[${i}].name`) as string;
    if (sponsorName) {
      sponsors.push({
        name: sponsorName,
        type: (formData.get(`sponsors[${i}].type`) as string) || undefined,
      });
    }
    i++;
  }

  const proposedValues: Record<string, unknown> = {};

  if (name !== (festival.name || '')) proposedValues.name = name;
  if (description !== (festival.description || ''))
    proposedValues.description = description || null;
  if (startDate && startDate !== (festival.startDate || '')) proposedValues.startDate = startDate;
  if (endDate && endDate !== (festival.endDate || '')) proposedValues.endDate = endDate;
  if (organiserName !== (festival.organiserName || ''))
    proposedValues.organiserName = organiserName || null;

  const currentTags = (festival.tags || []) as string[];
  const tagsChanged =
    tags.length !== currentTags.length || tags.some((t, idx) => t !== currentTags[idx]);
  if (tagsChanged) proposedValues.tags = tags;

  const currentSponsors = (festival.sponsors || []) as SponsorEntry[];
  const sponsorsChanged =
    sponsors.length !== currentSponsors.length ||
    sponsors.some((s, idx) => {
      const c = currentSponsors[idx];
      return !c || s.name !== c.name || (s.type || '') !== (c.type || '');
    });
  if (sponsorsChanged) proposedValues.sponsors = sponsors;

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
        entityType: EditEntityTypes.FESTIVAL,
        entityId: slugId,
        proposedValues,
        userNote: userNote || undefined,
        editId,
      });

      editId = result.id;

      if (intent === 'submit') {
        await serverClient.edit.submit.mutate({ editId });
        return data({
          success: true,
          redirectUrl: generateFestivalUrl(name || festival.name, slugId),
        });
      }

      return data({ success: true, editId });
    } catch (error) {
      console.error('Failed to save changes:', error);
      return data({ error: 'Failed to save changes. Please try again.' }, { status: 500 });
    }
  }

  return data({ error: 'Invalid action' }, { status: 400 });
}

export default function EditFestival() {
  const { festival, activeEdit } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const festivalUrl = generateFestivalUrl(festival.name, festival.id);

  const proposed = activeEdit?.proposedValues || {};

  const currentTags = (festival.tags || []) as string[];
  const proposedTags = proposed.tags as string[] | undefined;

  const [sponsors, setSponsors] = useState<SponsorEntry[]>(
    (
      (proposed.sponsors as SponsorEntry[] | undefined) ||
      (festival.sponsors as SponsorEntry[] | undefined) ||
      []
    ).map(s => ({ name: s.name, type: s.type || undefined }))
  );

  const defaultValues = {
    name: (proposed.name as string | undefined) || festival.name,
    description:
      (proposed.description as string | undefined) ??
      (festival.description as string | undefined) ??
      '',
    startDate: (proposed.startDate as string | undefined) || festival.startDate,
    endDate: (proposed.endDate as string | undefined) || festival.endDate,
    organiserName:
      (proposed.organiserName as string | undefined) ??
      (festival.organiserName as string | undefined) ??
      '',
    tags: (proposedTags || currentTags).join(', '),
    userNote: activeEdit?.userNote || '',
  };

  function addSponsor() {
    setSponsors(prev => [...prev, { name: '' }]);
  }

  function removeSponsor(idx: number) {
    setSponsors(prev => prev.filter((_, i) => i !== idx));
  }

  function updateSponsor(idx: number, field: keyof SponsorEntry, value: string) {
    setSponsors(prev => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  useEffect(() => {
    if (
      actionData &&
      'success' in actionData &&
      actionData.success &&
      'redirectUrl' in actionData
    ) {
      window.location.href = actionData.redirectUrl as string;
    }
  }, [actionData]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: 'Festivals', path: '/festivals' },
          { label: festival.name, path: festivalUrl },
          { label: activeEdit ? 'Continue Editing' : 'Edit', path: '#' },
        ]}
      />

      <div className="mt-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {activeEdit ? 'Continue Editing Festival' : 'Edit Festival'}
          </h1>
        </div>
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <Form method="post" className="space-y-6">
            {activeEdit && <input type="hidden" name="editId" value={activeEdit.id} />}

            <div className="space-y-2">
              <Label htmlFor="name">Festival Name</Label>
              <Input id="name" name="name" type="text" defaultValue={defaultValues.name} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={defaultValues.description}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={defaultValues.startDate}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={defaultValues.endDate}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organiserName">Organiser Name</Label>
              <Input
                id="organiserName"
                name="organiserName"
                type="text"
                defaultValue={defaultValues.organiserName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                name="tags"
                type="text"
                defaultValue={defaultValues.tags}
                placeholder="e.g. carnatic, classical, music"
              />
            </div>

            {/* Sponsors */}
            <fieldset className="space-y-3">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-medium">Sponsors</legend>
                <Button type="button" variant="outline" size="sm" onClick={addSponsor}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Sponsor
                </Button>
              </div>
              {sponsors.map((sponsor, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end border rounded p-3"
                >
                  <div className="space-y-1">
                    <Label htmlFor={`sponsors-${idx}-name`} className="text-xs">
                      Name *
                    </Label>
                    <Input
                      id={`sponsors-${idx}-name`}
                      name={`sponsors[${idx}].name`}
                      type="text"
                      value={sponsor.name}
                      onChange={e => updateSponsor(idx, 'name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`sponsors-${idx}-type`} className="text-xs">
                      Type
                    </Label>
                    <Input
                      id={`sponsors-${idx}-type`}
                      name={`sponsors[${idx}].type`}
                      type="text"
                      value={sponsor.type || ''}
                      onChange={e => updateSponsor(idx, 'type', e.target.value)}
                      placeholder="e.g. Gold, Silver"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSponsor(idx)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </fieldset>

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
              <p className="text-sm text-destructive">{actionData.error as string}</p>
            )}

            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <a
                href={festivalUrl}
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
