import * as Auth from '@rasika/core/auth';
import type { Edit } from '@rasika/core/domain/edit/client';
import { EditEntityTypes, EditStatus } from '@rasika/core/domain/edit/client';
import { SOCIAL_PLATFORM_LABELS, SocialPlatform } from '@rasika/core/domain/social-link';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Save,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import { toast } from 'sonner';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { ImageUpload } from '~/components/ImageUpload';
import { EditDisclaimer } from '~/components/shared';
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

  const isModerator = user.role === Auth.ROLE.MODERATOR || user.role === Auth.ROLE.ADMIN;

  return data({ artist, user, activeEdit, isModerator });
}

export async function action({
  request,
  params,
}: { request: Request; params: { artistid?: string } }) {
  const user = await requireUser(request);

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

  // Moderators write the core fields straight through, no draft. Which
  // branch runs is decided by the caller's real role, never by the hidden
  // `formPath` field alone — that field only says which UI submitted, so a
  // crafted request from an editor still falls through to the draft path
  // below instead of reaching the direct write.
  if (formData.get('formPath') === 'moderator') {
    const isModerator = user.role === Auth.ROLE.MODERATOR || user.role === Auth.ROLE.ADMIN;
    if (!isModerator) {
      return data({ error: 'Only moderators can publish changes directly.' }, { status: 403 });
    }

    const name = ((formData.get('name') as string) || '').trim();
    if (!name) {
      return data({ error: 'Name is required' }, { status: 400 });
    }
    const title = ((formData.get('title') as string) || '').trim() || undefined;
    const isGroup = formData.get('isGroup') === 'on';
    const instrument = ((formData.get('instrument') as string) || '').trim() || undefined;
    const city = ((formData.get('city') as string) || '').trim() || undefined;
    const photoUrl = ((formData.get('photoUrl') as string) || '').trim() || undefined;
    const photoUploadId = ((formData.get('photoUploadId') as string) || '').trim() || undefined;
    const biography = ((formData.get('biography') as string) || '').trim() || undefined;
    // Blank preserves rather than clears, matching every scalar below: an
    // omitted field is dropped from the JSON payload and so left unwritten.
    // This wizard therefore cannot empty a field — a deliberate, consistent
    // rule rather than "specialisations clear but biography doesn't", which is
    // what sending [] here would have produced.
    const specialisationsRaw = ((formData.get('specialisations') as string) || '').trim();
    const specialisations = specialisationsRaw
      ? specialisationsRaw
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : undefined;
    const birthYearRaw = ((formData.get('birthYear') as string) || '').trim();
    const birthYear = birthYearRaw ? Number.parseInt(birthYearRaw, 10) || undefined : undefined;
    const birthPlace = ((formData.get('birthPlace') as string) || '').trim() || undefined;
    const practiceStartYearRaw = ((formData.get('practiceStartYear') as string) || '').trim();
    const practiceStartYear = practiceStartYearRaw
      ? Number.parseInt(practiceStartYearRaw, 10) || undefined
      : undefined;
    const debutYearRaw = ((formData.get('debutYear') as string) || '').trim();
    const debutYear = debutYearRaw ? Number.parseInt(debutYearRaw, 10) || undefined : undefined;
    const activeYears = ((formData.get('activeYears') as string) || '').trim() || undefined;
    const website = ((formData.get('website') as string) || '').trim() || undefined;

    try {
      await serverClient.artist.update.mutate({
        id: slugId,
        data: {
          name,
          title,
          isGroup,
          instrument,
          city,
          photoUrl,
          photoUploadId,
          biography,
          specialisations,
          birthYear,
          birthPlace,
          practiceStartYear,
          debutYear,
          activeYears,
          website,
        },
      });

      return data({ success: true, redirectUrl: generateArtistUrl(name, slugId) });
    } catch (error) {
      console.error('Failed to update artist:', error);
      return data({ error: 'Failed to update artist. Please try again.' }, { status: 500 });
    }
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
    ? specialisationsRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : [];
  type StoredGuru = {
    id?: string;
    name: string;
    fromYear?: number;
    toYear?: number;
    discipline?: string;
  };
  const storedGurus = (artist.gurus as StoredGuru[]) || [];
  const storedGuruByName = new Map(storedGurus.map(g => [g.name, g]));
  // This form edits guru names only. Carry the rest of each stored row forward,
  // or saving any unrelated change would strip the id, years and discipline that
  // the moderator wizard adds.
  const gurus = formData
    .getAll('guruName')
    .map(n => (n as string).trim())
    .filter(Boolean)
    .map(name => ({ ...storedGuruByName.get(name), name }));
  const socialLinkPlatforms = formData.getAll('socialLinkPlatform') as string[];
  const socialLinkUrls = formData.getAll('socialLinkUrl') as string[];
  const socialLinks = socialLinkPlatforms
    .map((platform, i) => ({ platform: platform.trim(), url: (socialLinkUrls[i] || '').trim() }))
    .filter(sl => sl.platform && sl.url);
  const userNote = formData.get('userNote') as string;

  const proposedValues: Record<string, unknown> = {};

  if (name !== (artist.name || '')) proposedValues.name = name;
  if (title !== (artist.title || '')) proposedValues.title = title || undefined;
  if (biography !== (artist.biography || '')) proposedValues.biography = biography || undefined;
  if (birthYear !== artist.birthYear) proposedValues.birthYear = birthYear;
  if (birthPlace !== (artist.birthPlace || '')) proposedValues.birthPlace = birthPlace || undefined;
  if (activeYears !== (artist.activeYears || ''))
    proposedValues.activeYears = activeYears || undefined;
  if (website !== (artist.website || '')) proposedValues.website = website || undefined;

  const sortedNewSpecs = [...specialisations].sort();
  const sortedCurrentSpecs = [...((artist.specialisations as string[]) || [])].sort();
  if (JSON.stringify(sortedNewSpecs) !== JSON.stringify(sortedCurrentSpecs)) {
    proposedValues.specialisations = specialisations;
  }

  // Compare names only: they are the sole thing this form can change, and the
  // carried-forward fields would otherwise always look like a diff.
  const sortedNewGuruNames = gurus.map(g => g.name).sort();
  const sortedCurrentGuruNames = storedGurus.map(g => g.name).sort();
  if (JSON.stringify(sortedNewGuruNames) !== JSON.stringify(sortedCurrentGuruNames)) {
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
  const { isModerator } = useLoaderData<typeof loader>();

  if (isModerator) {
    return <ModeratorArtistWizard />;
  }

  return <EditorArtistForm />;
}

function EditorArtistForm() {
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
      (artist.gurus as Array<{ id?: string; name: string }> | undefined)?.map(g => ({
        name: g.name,
      })) ??
      []
  );

  const defaultValues = {
    name: (proposed.name as string | undefined) ?? artist.name,
    title: (proposed.title as string | undefined) ?? (artist.title as string | undefined) ?? '',
    biography:
      (proposed.biography as string | undefined) ?? (artist.biography as string | undefined) ?? '',
    birthYear:
      (proposed.birthYear as number | undefined) ?? (artist.birthYear as number | undefined) ?? '',
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
    specialisations: (
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
                  onClick={() => setGurus(prev => [...prev, { name: '' }])}
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
                    onChange={e =>
                      setGurus(prev => prev.map((g, j) => (j === i ? { name: e.target.value } : g)))
                    }
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setGurus(prev => prev.filter((_, j) => j !== i))}
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
                  onClick={() => setSocialLinks(prev => [...prev, { platform: '', url: '' }])}
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
                    onValueChange={val =>
                      setSocialLinks(prev =>
                        prev.map((l, j) => (j === i ? { ...l, platform: val } : l))
                      )
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select platform..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SocialPlatform.options.map(p => (
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
                    onChange={e =>
                      setSocialLinks(prev =>
                        prev.map((l, j) => (j === i ? { ...l, url: e.target.value } : l))
                      )
                    }
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSocialLinks(prev => prev.filter((_, j) => j !== i))}
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

        <EditDisclaimer />
      </div>
    </div>
  );
}

const STEP_LABELS = ['Identity', 'About', 'Review'];
const TOTAL_STEPS = 3;

function ModeratorArtistWizard() {
  const { artist } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const artistUrl = generateArtistUrl(artist.name, artist.id);

  const [step, setStep] = useState(0);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Advancing carries the current step's fields into a hidden container, where
  // a browser cannot focus an invalid control to report it — so submit would
  // later fail silently. Validate while the step is still on screen and refuse
  // to advance past a bad value. Going back never validates.
  function goToStep(next: number) {
    if (next > step) {
      const container = stepRefs.current[step];
      const controls = container?.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('input, select, textarea');
      for (const control of controls ?? []) {
        if (!control.checkValidity()) {
          control.reportValidity();
          return;
        }
      }
    }
    setStep(next);
  }

  const [form, setForm] = useState({
    name: artist.name,
    title: (artist.title as string | undefined) ?? '',
    isGroup: (artist.isGroup as boolean | undefined) ?? false,
    instrument: (artist.instrument as string | undefined) ?? '',
    city: (artist.city as string | undefined) ?? '',
    biography: (artist.biography as string | undefined) ?? '',
    specialisations: ((artist.specialisations as string[] | undefined) ?? []).join(', '),
    birthYear: (artist.birthYear as number | undefined)?.toString() ?? '',
    birthPlace: (artist.birthPlace as string | undefined) ?? '',
    practiceStartYear: (artist.practiceStartYear as number | undefined)?.toString() ?? '',
    debutYear: (artist.debutYear as number | undefined)?.toString() ?? '',
    activeYears: (artist.activeYears as string | undefined) ?? '',
    website: (artist.website as string | undefined) ?? '',
  });

  const isSubmitting = navigation.state === 'submitting';

  useEffect(() => {
    if (
      actionData &&
      'success' in actionData &&
      actionData.success &&
      'redirectUrl' in actionData
    ) {
      toast.success('Changes published');
      window.location.href = actionData.redirectUrl;
    }
  }, [actionData]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: 'Artists', path: '/artists' },
          { label: artist.name, path: artistUrl },
          { label: 'Edit', path: '#' },
        ]}
      />

      <div className="mt-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">Edit Artist</h1>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 mb-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          Step {step + 1} of {TOTAL_STEPS}: {STEP_LABELS[step]}
        </p>

        <div className="bg-card rounded-lg shadow-sm border p-6">
          <Form method="post" className="space-y-6">
            <input type="hidden" name="formPath" value="moderator" />

            {/* Step 0 — Identity */}
            <div
              ref={el => {
                stepRefs.current[0] = el;
              }}
              className={step === 0 ? '' : 'hidden'}
            >
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title / Honorific</Label>
                  <Input
                    id="title"
                    name="title"
                    type="text"
                    placeholder="e.g. Dr., Vidushi, Pandit"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isGroup"
                    checked={form.isGroup}
                    onChange={e => setForm(f => ({ ...f, isGroup: e.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">
                    This is a group, not an individual — e.g. Saralaya Sisters
                  </span>
                </label>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="instrument">Instrument</Label>
                    <Input
                      id="instrument"
                      name="instrument"
                      type="text"
                      placeholder="e.g. Vocal, Violin, Mridangam"
                      value={form.instrument}
                      onChange={e => setForm(f => ({ ...f, instrument: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      type="text"
                      value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                </div>

                <ImageUpload
                  urlFieldName="photoUrl"
                  uploadIdFieldName="photoUploadId"
                  currentUrl={(artist.photoUrl as string | undefined) ?? ''}
                  entityType="artist"
                  label="Artist Photo"
                />
              </div>
            </div>

            {/* Step 1 — About */}
            <div
              ref={el => {
                stepRefs.current[1] = el;
              }}
              className={step === 1 ? '' : 'hidden'}
            >
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="biography">Biography</Label>
                  <Textarea
                    id="biography"
                    name="biography"
                    rows={6}
                    placeholder="About the artist..."
                    value={form.biography}
                    onChange={e => setForm(f => ({ ...f, biography: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialisations">Specialisations</Label>
                  <Input
                    id="specialisations"
                    name="specialisations"
                    type="text"
                    placeholder="Comma-separated, e.g. Vocal, Veena"
                    value={form.specialisations}
                    onChange={e => setForm(f => ({ ...f, specialisations: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="birthYear">Birth Year</Label>
                    <Input
                      id="birthYear"
                      name="birthYear"
                      type="number"
                      min={1800}
                      max={2100}
                      placeholder="e.g. 1950"
                      value={form.birthYear}
                      onChange={e => setForm(f => ({ ...f, birthYear: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthPlace">Birth Place</Label>
                    <Input
                      id="birthPlace"
                      name="birthPlace"
                      type="text"
                      placeholder="e.g. Chennai, Tamil Nadu"
                      value={form.birthPlace}
                      onChange={e => setForm(f => ({ ...f, birthPlace: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="practiceStartYear">Practice Start Year</Label>
                    <Input
                      id="practiceStartYear"
                      name="practiceStartYear"
                      type="number"
                      min={1800}
                      max={2100}
                      value={form.practiceStartYear}
                      onChange={e => setForm(f => ({ ...f, practiceStartYear: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="debutYear">Debut Year</Label>
                    <Input
                      id="debutYear"
                      name="debutYear"
                      type="number"
                      min={1800}
                      max={2100}
                      value={form.debutYear}
                      onChange={e => setForm(f => ({ ...f, debutYear: e.target.value }))}
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
                    value={form.activeYears}
                    onChange={e => setForm(f => ({ ...f, activeYears: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    name="website"
                    type="url"
                    placeholder="https://..."
                    value={form.website}
                    onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Step 2 — Review */}
            <div className={step === 2 ? '' : 'hidden'}>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This writes straight to the artist's profile — there is no draft or approval step.
                  Review the values below, then publish.
                </p>

                <div className="divide-y divide-border rounded-md border text-sm">
                  <SummaryRow label="Name" value={form.name} />
                  <SummaryRow label="Title" value={form.title} />
                  <SummaryRow label="Group" value={form.isGroup ? 'Yes' : 'No'} />
                  <SummaryRow label="Instrument" value={form.instrument} />
                  <SummaryRow label="City" value={form.city} />
                  <SummaryRow label="Biography" value={form.biography} />
                  <SummaryRow label="Specialisations" value={form.specialisations} />
                  <SummaryRow label="Birth Year" value={form.birthYear} />
                  <SummaryRow label="Birth Place" value={form.birthPlace} />
                  <SummaryRow label="Practice Start Year" value={form.practiceStartYear} />
                  <SummaryRow label="Debut Year" value={form.debutYear} />
                  <SummaryRow label="Active Years" value={form.activeYears} />
                  <SummaryRow label="Website" value={form.website} />
                </div>

                {actionData && 'error' in actionData && (
                  <p className="text-sm text-destructive">{actionData.error as string}</p>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                {step === 0 ? (
                  <a
                    href={artistUrl}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                  </a>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => goToStep(step - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {step < TOTAL_STEPS - 1 ? (
                  <Button type="button" variant="default" onClick={() => goToStep(step + 1)}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="default" type="submit">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Publish changes
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-words">{value || '—'}</span>
    </div>
  );
}
