import type { Edit } from '@rasika/core/domain/edit/client';
import { EditEntityTypes, EditStatus } from '@rasika/core/domain/edit/client';
import { SOCIAL_PLATFORM_LABELS, SocialPlatform } from '@rasika/core/domain/social-link';
import { ArrowLeft, Loader2, Pencil, Plus, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import { toast } from 'sonner';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
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
import { requireUser } from '~/lib/auth.server';
import { generateArtistUrl, parseSlug } from '~/lib/url-slug';

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex, nofollow' }];
};

export async function loader({
  request,
  params,
}: { request: Request; params: { artistid?: string } }) {
  const user = await requireUser(request);

  const { artistid } = params;
  if (!artistid) {
    throw new Response('Artist ID is required', { status: 400 });
  }

  const parsed = parseSlug(artistid);
  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const { id: slugId } = parsed;
  const serverClient = await createServerClient(request);
  const artist = await serverClient.artist.get.query({ id: slugId });

  if (!artist) {
    throw new Response('Artist not found', { status: 404 });
  }

  const activeEdit = await serverClient.edit.getActiveEditForEntity.query({
    entityType: EditEntityTypes.ARTIST,
    entityId: artist.id,
  });

  if (activeEdit?.status === EditStatus.SUBMITTED) {
    return redirect(`/my-edits?editId=${activeEdit.id}`);
  }

  return data({ artist, user, activeEdit });
}

export async function action({
  request,
  params,
}: { request: Request; params: { artistid?: string } }) {
  await requireUser(request);

  const { artistid } = params;
  if (!artistid) {
    return data({ error: 'Artist ID is required' }, { status: 400 });
  }

  const parsed = parseSlug(artistid);
  if (!parsed) {
    return data({ error: 'Invalid URL format' }, { status: 400 });
  }

  const { id: slugId } = parsed;
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  const serverClient = await createServerClient(request);

  const artist = await serverClient.artist.get.query({ id: slugId });

  if (!artist) {
    return data({ error: 'Artist not found' }, { status: 404 });
  }

  const name = (formData.get('name') as string).trim();
  const title = ((formData.get('title') as string) || '').trim();
  const biography = ((formData.get('biography') as string) || '').trim();
  const birthYear = formData.get('birthYear') ? Number(formData.get('birthYear')) : undefined;
  const birthPlace = ((formData.get('birthPlace') as string) || '').trim();
  const activeYears = ((formData.get('activeYears') as string) || '').trim();
  const website = ((formData.get('website') as string) || '').trim();
  const specialisationsRaw = ((formData.get('specialisations') as string) || '').trim();
  const specialisations = specialisationsRaw
    ? specialisationsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const guruNames = formData.getAll('guruName') as string[];
  const gurus = guruNames.map((n) => ({ name: n.trim() })).filter((g) => g.name);
  const socialLinkPlatforms = formData.getAll('socialLinkPlatform') as string[];
  const socialLinkUrls = formData.getAll('socialLinkUrl') as string[];
  const socialLinks = socialLinkPlatforms
    .map((platform, i) => ({ platform: platform.trim(), url: (socialLinkUrls[i] || '').trim() }))
    .filter((sl) => sl.platform && sl.url);
  const userNote = formData.get('userNote') as string;

  const proposedValues: Record<string, unknown> = {};

  if (name !== (artist.name || '')) proposedValues.name = name;
  if (title !== (artist.title || '')) proposedValues.title = title || undefined;
  if (biography !== (artist.biography || '')) proposedValues.biography = biography || undefined;
  if (birthYear !== artist.birthYear) proposedValues.birthYear = birthYear;
  if (birthPlace !== (artist.birthPlace || '')) proposedValues.birthPlace = birthPlace || undefined;
  if (activeYears !== (artist.activeYears || '')) proposedValues.activeYears = activeYears || undefined;
  if (website !== (artist.website || '')) proposedValues.website = website || undefined;

  const sortedNewSpecs = [...specialisations].sort();
  const sortedCurrentSpecs = [...((artist.specialisations as string[]) || [])].sort();
  if (JSON.stringify(sortedNewSpecs) !== JSON.stringify(sortedCurrentSpecs)) {
    proposedValues.specialisations = specialisations;
  }

  const sortedNewGurus = [...gurus].sort((a, b) => a.name.localeCompare(b.name));
  const sortedCurrentGurus = [...((artist.gurus as Array<{ id?: string; name: string }>) || [])]
    .map((g) => ({ name: g.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (JSON.stringify(sortedNewGurus) !== JSON.stringify(sortedCurrentGurus)) {
    proposedValues.gurus = gurus;
  }

  const sortedNewLinks = [...socialLinks].sort((a, b) => a.platform.localeCompare(b.platform));
  const sortedCurrentLinks = [
    ...((artist.socialLinks as Array<{ platform: string; url: string }>) || []),
  ].sort((a, b) => a.platform.localeCompare(b.platform));
  if (JSON.stringify(sortedNewLinks) !== JSON.stringify(sortedCurrentLinks)) {
    proposedValues.socialLinks = socialLinks;
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
        entityType: EditEntityTypes.ARTIST,
        entityId: slugId,
        proposedValues,
        userNote: userNote || undefined,
        editId,
      });

      editId = result.id;

      if (intent === 'submit') {
        await serverClient.edit.submit.mutate({ editId });
        return data({ success: true, redirectUrl: generateArtistUrl(name, slugId) });
      }

      return data({ success: true, editId });
    } catch (error) {
      console.error('Failed to save changes:', error);
      return data({ error: 'Failed to save changes. Please try again.' }, { status: 500 });
    }
  }

  return data({ error: 'Invalid action' }, { status: 400 });
}

export default function EditArtist() {
  const { artist, user, activeEdit } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const artistUrl = generateArtistUrl(artist.name, artist.id);

  const proposed = activeEdit?.proposedValues || {};

  type SocialLink = { platform: string; url: string };
  type Guru = { name: string };

  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    (proposed.socialLinks as SocialLink[] | undefined) ??
      (artist.socialLinks as SocialLink[] | undefined) ??
      []
  );
  const [gurus, setGurus] = useState<Guru[]>(
    (proposed.gurus as Guru[] | undefined) ??
      ((artist.gurus as Array<{ id?: string; name: string }> | undefined)?.map((g) => ({
        name: g.name,
      })) ?? [])
  );

  const defaultValues = {
    name: (proposed.name as string | undefined) ?? artist.name,
    title: (proposed.title as string | undefined) ?? (artist.title as string | undefined) ?? '',
    biography:
      (proposed.biography as string | undefined) ??
      (artist.biography as string | undefined) ??
      '',
    birthYear:
      (proposed.birthYear as number | undefined) ??
      (artist.birthYear as number | undefined) ??
      '',
    birthPlace:
      (proposed.birthPlace as string | undefined) ??
      (artist.birthPlace as string | undefined) ??
      '',
    activeYears:
      (proposed.activeYears as string | undefined) ??
      (artist.activeYears as string | undefined) ??
      '',
    website:
      (proposed.website as string | undefined) ?? (artist.website as string | undefined) ?? '',
    specialisations:
      (
        (proposed.specialisations as string[] | undefined) ??
        (artist.specialisations as string[] | undefined) ??
        []
      ).join(', '),
    userNote: activeEdit?.userNote || '',
  };

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
          { label: 'Artists', path: '/artists' },
          { label: artist.name, path: artistUrl },
          { label: activeEdit ? 'Continue Editing' : 'Edit', path: '#' },
        ]}
      />

      <div className="mt-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {activeEdit ? 'Continue Editing Artist' : 'Edit Artist'}
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
              <Label htmlFor="title">Title / Honorific</Label>
              <Input
                id="title"
                name="title"
                type="text"
                placeholder="e.g. Dr., Vidushi, Pandit"
                defaultValue={defaultValues.title}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="biography">Biography</Label>
              <Textarea
                id="biography"
                name="biography"
                rows={6}
                placeholder="About the artist..."
                defaultValue={defaultValues.biography}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthYear">Birth Year</Label>
                <Input
                  id="birthYear"
                  name="birthYear"
                  type="number"
                  min={1800}
                  max={2100}
                  placeholder="e.g. 1950"
                  defaultValue={defaultValues.birthYear}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthPlace">Birth Place</Label>
                <Input
                  id="birthPlace"
                  name="birthPlace"
                  type="text"
                  placeholder="e.g. Chennai, Tamil Nadu"
                  defaultValue={defaultValues.birthPlace}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activeYears">Active Years</Label>
              <Input
                id="activeYears"
                name="activeYears"
                type="text"
                placeholder="e.g. 1970–present"
                defaultValue={defaultValues.activeYears}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialisations">Specialisations</Label>
              <Input
                id="specialisations"
                name="specialisations"
                type="text"
                placeholder="Comma-separated, e.g. Vocal, Veena"
                defaultValue={defaultValues.specialisations}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                type="url"
                placeholder="https://..."
                defaultValue={defaultValues.website}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Gurus</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGurus((prev) => [...prev, { name: '' }])}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              {gurus.length === 0 && (
                <p className="text-xs text-muted-foreground">No gurus added.</p>
              )}
              {gurus.map((guru, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    name="guruName"
                    placeholder="Guru name"
                    value={guru.name}
                    onChange={(e) =>
                      setGurus((prev) =>
                        prev.map((g, j) => (j === i ? { name: e.target.value } : g))
                      )
                    }
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setGurus((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Social Links</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSocialLinks((prev) => [...prev, { platform: '', url: '' }])}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              {socialLinks.length === 0 && (
                <p className="text-xs text-muted-foreground">No social links added.</p>
              )}
              {socialLinks.map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    name="socialLinkPlatform"
                    value={link.platform}
                    onValueChange={(val) =>
                      setSocialLinks((prev) =>
                        prev.map((l, j) => (j === i ? { ...l, platform: val } : l))
                      )
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select platform..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SocialPlatform.options.map((p) => (
                        <SelectItem key={p} value={p}>
                          {SOCIAL_PLATFORM_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    name="socialLinkUrl"
                    placeholder="https://..."
                    type="url"
                    value={link.url}
                    onChange={(e) =>
                      setSocialLinks((prev) =>
                        prev.map((l, j) => (j === i ? { ...l, url: e.target.value } : l))
                      )
                    }
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSocialLinks((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

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
                href={artistUrl}
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
