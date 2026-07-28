import * as Auth from '@rasika/core/auth';
import type { Guru } from '@rasika/core/domain/artist/client';
import type { Edit } from '@rasika/core/domain/edit/client';
import { EditEntityTypes, EditStatus } from '@rasika/core/domain/edit/client';
import { SOCIAL_PLATFORM_LABELS, SocialPlatform } from '@rasika/core/domain/social-link';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Save,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import {
  Form,
  data,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
} from 'react-router';
import { toast } from 'sonner';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { ImageUpload } from '~/components/ImageUpload';
import { SearchSelect } from '~/components/SearchSelect';
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
import { computePhotoReorder, nextPhotoOrder } from '~/lib/gallery-order';
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

  // Membership is only meaningful once isGroup is actually persisted, and the
  // editor path never renders it — so skip the extra query everywhere else.
  const members =
    isModerator && artist.isGroup
      ? await serverClient.artist.listMembers.query({ groupId: artist.id })
      : [];

  // The Recognition step's three sections seed from these. Only the moderator
  // wizard renders them, so the editor path pays for none of it.
  const [awards, performances, photos] = isModerator
    ? await Promise.all([
        serverClient.artist.listAwards.query({ artistId: artist.id }),
        serverClient.event.byArtist.query({ artistId: artist.id, limit: 50 }),
        serverClient.artist.listPhotos.query({ artistId: artist.id }),
      ])
    : [[], { items: [] }, { items: [] }];

  return data({
    artist,
    user,
    activeEdit,
    isModerator,
    members,
    awards,
    performances: performances.items,
    photos: photos.items,
  });
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

    // Parallel arrays, one entry per guru row — the same shape socialLinks
    // below uses. Gurus are part of the Artist record, so the whole list is
    // always sent (unlike the scalar fields above, which omit rather than
    // clear): a moderator who removes every row means to publish zero gurus,
    // not to leave the stored list untouched.
    const guruIds = formData.getAll('guruId') as string[];
    const guruNames = formData.getAll('guruName') as string[];
    const guruFromYears = formData.getAll('guruFromYear') as string[];
    const guruToYears = formData.getAll('guruToYear') as string[];
    const guruDisciplines = formData.getAll('guruDiscipline') as string[];
    const gurus = guruNames
      .map((rawName, i) => {
        const guruName = rawName.trim();
        if (!guruName) return undefined;
        const fromYearRaw = (guruFromYears[i] || '').trim();
        const toYearRaw = (guruToYears[i] || '').trim();
        const discipline = (guruDisciplines[i] || '').trim();
        return {
          id: (guruIds[i] || '').trim() || undefined,
          name: guruName,
          fromYear: fromYearRaw ? Number.parseInt(fromYearRaw, 10) || undefined : undefined,
          toYear: toYearRaw ? Number.parseInt(toYearRaw, 10) || undefined : undefined,
          discipline: discipline || undefined,
        };
      })
      .filter((guru): guru is NonNullable<typeof guru> => guru !== undefined);

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
          gurus,
        },
      });

      return data({ success: true, redirectUrl: generateArtistUrl(name, slugId) });
    } catch (error) {
      console.error('Failed to update artist:', error);
      return data({ error: 'Failed to update artist. Please try again.' }, { status: 500 });
    }
  }

  const name = ((formData.get('name') as string) || '').trim();
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
  const storedGuruById = new Map(storedGurus.filter(g => g.id).map(g => [g.id as string, g]));
  const storedGuruByName = new Map(storedGurus.map(g => [g.name, g]));
  // This form edits guru names only. Correlate each row to its stored entry by the
  // hidden guruId, carrying the id, years and discipline forward — so *renaming* a
  // guru keeps its link and metadata instead of matching by the now-changed name and
  // dropping them. Freshly added rows have no id and fall back to a name match.
  const guruIds = formData.getAll('guruId') as string[];
  const guruNames = formData.getAll('guruName') as string[];
  const gurus = guruNames
    .map((rawName, i) => {
      const name = (rawName as string).trim();
      if (!name) return undefined;
      const id = (guruIds[i] || '').trim();
      const stored = (id && storedGuruById.get(id)) || storedGuruByName.get(name);
      return { ...stored, name };
    })
    .filter((g): g is NonNullable<typeof g> => g !== undefined);
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
  type Guru = { id?: string; name: string };

  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    (proposed.socialLinks as SocialLink[] | undefined) ??
      (artist.socialLinks as SocialLink[] | undefined) ??
      []
  );
  const [gurus, setGurus] = useState<Guru[]>(
    (proposed.gurus as Guru[] | undefined) ??
      (artist.gurus as Array<{ id?: string; name: string }> | undefined)?.map(g => ({
        id: g.id,
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
                  {/* Carry the stored id alongside the name so a rename keeps the link
                      and the years/discipline the wizard added, rather than matching by
                      the changed name and dropping them. */}
                  <input type="hidden" name="guruId" value={guru.id ?? ''} />
                  <Input
                    name="guruName"
                    placeholder="Guru name"
                    value={guru.name}
                    onChange={e =>
                      setGurus(prev =>
                        prev.map((g, j) => (j === i ? { ...g, name: e.target.value } : g))
                      )
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

const STEP_LABELS = ['Identity', 'About', 'Relationships', 'Recognition', 'Review'];
const TOTAL_STEPS = 5;

type GuruRow = {
  id?: string;
  name: string;
  fromYear: string;
  toYear: string;
  discipline: string;
};

function ModeratorArtistWizard() {
  const { artist, members, awards, performances, photos } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const artistUrl = generateArtistUrl(artist.name, artist.id);
  // The wizard's own isGroup checkbox is staged, not yet published — a
  // moderator who just ticked it can't add members until that write lands.
  // Membership must gate on the persisted value from the loader instead.
  const isGroupPersisted = (artist.isGroup as boolean | undefined) ?? false;

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

  const [gurus, setGurus] = useState<GuruRow[]>(
    ((artist.gurus as Guru[] | undefined) ?? []).map(guru => ({
      id: guru.id,
      name: guru.name,
      fromYear: guru.fromYear?.toString() ?? '',
      toYear: guru.toYear?.toString() ?? '',
      discipline: guru.discipline ?? '',
    }))
  );

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
          <Form
            method="post"
            className="space-y-6"
            onKeyDown={e => {
              // Publish is the form's only submit control, so a bare Enter in any field
              // would publish and yank the moderator out of the wizard mid-flow, past
              // the step-advance validity gate. Swallow Enter unless it is in a textarea
              // (where it means newline) or on the submit button itself.
              const target = e.target as HTMLElement;
              const isSubmit =
                target.tagName === 'BUTTON' && (target as HTMLButtonElement).type === 'submit';
              if (e.key === 'Enter' && target.tagName !== 'TEXTAREA' && !isSubmit) {
                e.preventDefault();
              }
            }}
          >
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

                {isGroupPersisted && !form.isGroup && members.length > 0 && (
                  <p className="text-xs text-amber-600">
                    Unchecking this leaves {members.length} member{members.length === 1 ? '' : 's'}{' '}
                    linked but hidden — the group's membership is not removed. Detach members first
                    if you mean to convert this to an individual.
                  </p>
                )}

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

            {/* Step 2 — Relationships */}
            <div
              ref={el => {
                stepRefs.current[2] = el;
              }}
              className={step === 2 ? '' : 'hidden'}
            >
              <div className="space-y-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Gurus</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setGurus(prev => [
                          ...prev,
                          { name: '', fromYear: '', toYear: '', discipline: '' },
                        ])
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The guru links save with the rest of this form when you publish. Adding a guru
                    by a new name creates that artist record straight away, though.
                  </p>
                  {gurus.length === 0 && (
                    <p className="text-xs text-muted-foreground">No gurus added.</p>
                  )}
                  {gurus.map((guru, i) => (
                    <GuruRowFields
                      key={i}
                      index={i}
                      guru={guru}
                      onChange={updated =>
                        setGurus(prev => prev.map((g, j) => (j === i ? updated : g)))
                      }
                      onRemove={() => setGurus(prev => prev.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>

                <div className="space-y-3 border-t pt-6">
                  <Label>Group Members</Label>
                  {isGroupPersisted ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Membership changes save immediately — unlike the rest of this form, they do
                        not wait for Publish.
                      </p>
                      <MembershipEditor groupId={artist.id} initialMembers={members} />
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Mark this artist as a group and publish, then reopen to add members.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3 — Recognition */}
            <div
              ref={el => {
                stepRefs.current[3] = el;
              }}
              className={step === 3 ? '' : 'hidden'}
            >
              <div className="space-y-8">
                <p className="text-xs text-muted-foreground">
                  Awards, performances and photos save immediately — like membership, they do not
                  wait for Publish.
                </p>

                <div className="space-y-3">
                  <Label>Awards</Label>
                  <AwardsEditor
                    artistId={artist.id}
                    artistName={artist.name}
                    initialAwards={awards}
                  />
                </div>

                <div className="space-y-3 border-t pt-6">
                  <Label>Notable performances</Label>
                  <PerformancesEditor
                    artistId={artist.id}
                    artistName={artist.name}
                    initialPerformances={performances}
                  />
                </div>

                <div className="space-y-3 border-t pt-6">
                  <Label>Gallery</Label>
                  <GalleryEditor artistId={artist.id} initialPhotos={photos} />
                </div>

                <div className="space-y-3 border-t pt-6">
                  <Label>Hand this profile to the artist</Label>
                  <ClaimInviteEditor artistId={artist.id} artistName={artist.name} />
                </div>
              </div>
            </div>

            {/* Step 4 — Review */}
            <div className={step === 4 ? '' : 'hidden'}>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This writes straight to the artist's profile — there is no draft or approval step.
                  Review the values below, then publish.
                </p>

                <div className="divide-y divide-border rounded-md border text-sm">
                  <SummaryRow label="Name" value={form.name} />
                  <SummaryRow
                    label="Title"
                    value={form.title}
                    stored={(artist.title as string | undefined) ?? ''}
                  />
                  <SummaryRow label="Group" value={form.isGroup ? 'Yes' : 'No'} />
                  <SummaryRow
                    label="Instrument"
                    value={form.instrument}
                    stored={(artist.instrument as string | undefined) ?? ''}
                  />
                  <SummaryRow
                    label="City"
                    value={form.city}
                    stored={(artist.city as string | undefined) ?? ''}
                  />
                  <SummaryRow
                    label="Biography"
                    value={form.biography}
                    stored={(artist.biography as string | undefined) ?? ''}
                  />
                  <SummaryRow
                    label="Specialisations"
                    value={form.specialisations}
                    stored={((artist.specialisations as string[] | undefined) ?? []).join(', ')}
                  />
                  <SummaryRow
                    label="Birth Year"
                    value={form.birthYear}
                    stored={(artist.birthYear as number | undefined)?.toString() ?? ''}
                  />
                  <SummaryRow
                    label="Birth Place"
                    value={form.birthPlace}
                    stored={(artist.birthPlace as string | undefined) ?? ''}
                  />
                  <SummaryRow
                    label="Practice Start Year"
                    value={form.practiceStartYear}
                    stored={(artist.practiceStartYear as number | undefined)?.toString() ?? ''}
                  />
                  <SummaryRow
                    label="Debut Year"
                    value={form.debutYear}
                    stored={(artist.debutYear as number | undefined)?.toString() ?? ''}
                  />
                  <SummaryRow
                    label="Active Years"
                    value={form.activeYears}
                    stored={(artist.activeYears as string | undefined) ?? ''}
                  />
                  <SummaryRow
                    label="Website"
                    value={form.website}
                    stored={(artist.website as string | undefined) ?? ''}
                  />
                  <SummaryRow label="Gurus" value={gurus.map(guru => guru.name).join(', ')} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Membership, awards, performances and photos are saved as you go — they are not
                  part of this publish. A blank field above keeps its current value rather than
                  clearing it.
                </p>

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

function SummaryRow({ label, value, stored }: { label: string; value: string; stored?: string }) {
  // A blank preserve-on-blank field (see the action) is NOT cleared on publish —
  // it keeps its stored value. Showing "—" here would promise a clearing that
  // never happens, so a blanked field with a stored value renders that value,
  // tagged unchanged. `stored` is omitted for fields that really do take the
  // form value as-is (isGroup, gurus), where blank means blank.
  const cleared = !value && stored;
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-words">
        {value || stored || '—'}
        {cleared && <span className="ml-1 text-xs text-muted-foreground">(unchanged)</span>}
      </span>
    </div>
  );
}

type ResolveArtistResult = { id: string; name: string; title?: string; created: boolean };

// One guru row: a name (picked from an existing artist, or resolved via
// find-or-create) plus its own from/to years and discipline. The picker's own
// resolve request lives here, one fetcher per row, so creating a new artist
// name on row 2 can never race or overwrite an in-flight create on row 1.
function GuruRowFields({
  guru,
  index,
  onChange,
  onRemove,
}: {
  guru: GuruRow;
  index: number;
  onChange: (guru: GuruRow) => void;
  onRemove: () => void;
}) {
  const resolveFetcher = useFetcher<ResolveArtistResult | { error: string }>();

  // Only react to a new resolve result landing, not to guru/onChange identity
  // — those change on every keystroke in this row and would refire the effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (resolveFetcher.data && 'id' in resolveFetcher.data) {
      onChange({ ...guru, id: resolveFetcher.data.id, name: resolveFetcher.data.name });
    }
  }, [resolveFetcher.data]);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <SearchSelect
            label="Guru"
            placeholder="Search artists..."
            searchUrl="/api/search/artist-live"
            inputId={`guru-picker-${index}`}
            fieldName="guruPicker"
            value={guru.id ? { id: guru.id, name: guru.name } : null}
            onChange={entity =>
              onChange({ ...guru, id: entity?.id, name: entity?.name ?? guru.name })
            }
            createNew={name => {
              onChange({ ...guru, id: undefined, name });
              resolveFetcher.submit({ name }, { method: 'post', action: '/api/artist/resolve' });
            }}
          />
        </div>
        <Button type="button" variant="ghost" size="icon" className="mt-6" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <input type="hidden" name="guruId" value={guru.id ?? ''} />
      <input type="hidden" name="guruName" value={guru.name} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`guru-from-${index}`}>From Year</Label>
          <Input
            id={`guru-from-${index}`}
            name="guruFromYear"
            type="number"
            min={1800}
            max={2100}
            value={guru.fromYear}
            onChange={e => onChange({ ...guru, fromYear: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`guru-to-${index}`}>To Year</Label>
          <Input
            id={`guru-to-${index}`}
            name="guruToYear"
            type="number"
            min={1800}
            max={2100}
            value={guru.toYear}
            onChange={e => onChange({ ...guru, toYear: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`guru-discipline-${index}`}>Discipline</Label>
          <Input
            id={`guru-discipline-${index}`}
            name="guruDiscipline"
            type="text"
            placeholder="e.g. Vocal"
            value={guru.discipline}
            onChange={e => onChange({ ...guru, discipline: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

type Member = {
  groupId: string;
  groupName: string;
  memberId: string;
  memberName: string;
  role?: string;
  rank?: number;
  createdAt: string;
};

type AddMemberResult = { success: true; member: Member } | { error: string };
type RemoveMemberResult = { success: true; memberId: string } | { error: string };

// Membership writes go straight to their own junction entity — no draft, no
// Publish step — so every add/remove here fires its own fetcher immediately
// and reconciles local state from the response rather than waiting on the
// surrounding form's submit.
function MembershipEditor({
  groupId,
  initialMembers,
}: { groupId: string; initialMembers: Member[] }) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const addFetcher = useFetcher<AddMemberResult>();
  const removeFetcher = useFetcher<RemoveMemberResult>();
  const addIsIdle = addFetcher.state === 'idle';

  useEffect(() => {
    if (!addFetcher.data) return;
    if ('error' in addFetcher.data) {
      toast.error(addFetcher.data.error);
      return;
    }
    const { member } = addFetcher.data;
    setMembers(prev => (prev.some(m => m.memberId === member.memberId) ? prev : [...prev, member]));
    toast.success(`${member.memberName} added`);
  }, [addFetcher.data]);

  useEffect(() => {
    if (!removeFetcher.data) return;
    if ('error' in removeFetcher.data) {
      toast.error(removeFetcher.data.error);
      return;
    }
    const { memberId } = removeFetcher.data;
    setMembers(prev => prev.filter(m => m.memberId !== memberId));
    toast.success('Member removed');
  }, [removeFetcher.data]);

  return (
    <div className="space-y-3">
      {members.length === 0 && <p className="text-xs text-muted-foreground">No members yet.</p>}
      {members.map(member => (
        <div
          key={member.memberId}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <span>
            {member.memberName}
            {member.role ? ` — ${member.role}` : ''}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={removeFetcher.state !== 'idle'}
            onClick={() =>
              removeFetcher.submit(
                { intent: 'remove', groupId, memberId: member.memberId },
                { method: 'post', action: '/api/artist/membership' }
              )
            }
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <SearchSelect
        label="Add member"
        placeholder="Search existing artists..."
        searchUrl="/api/search/artist-live"
        fieldName="memberPicker"
        value={null}
        onChange={entity => {
          if (!entity || !addIsIdle) return;
          addFetcher.submit(
            { intent: 'add', groupId, memberId: entity.id },
            { method: 'post', action: '/api/artist/membership' }
          );
        }}
        createNew={name => {
          // Serialize adds the way removes are serialized. A second add fired
          // while the first is in flight supersedes it in the fetcher, so the
          // first can land server-side yet never appear in the list until a
          // reload — then re-adding it hits a confusing "already a member".
          if (!addIsIdle) {
            toast.info('Please wait for the current member to be added.');
            return;
          }
          addFetcher.submit(
            { intent: 'add', groupId, memberName: name },
            { method: 'post', action: '/api/artist/membership' }
          );
        }}
      />
    </div>
  );
}

type Award = {
  artistId: string;
  awardId: string;
  awardName: string;
  year?: number;
  category?: string;
  notes?: string;
};

type AddAwardResult = { success: true; award: Award } | { error: string };
type RemoveAwardResult = { success: true; awardId: string } | { error: string };

// Awards land immediately in the ArtistAward junction. The add is a small
// staged form (name plus optional year/category/notes) rather than a
// fire-on-select picker, because the extra fields have to be gathered before
// the write. The award route resolves the typed name to a real award.
function AwardsEditor({
  artistId,
  artistName,
  initialAwards,
}: { artistId: string; artistName: string; initialAwards: Award[] }) {
  const [awards, setAwards] = useState<Award[]>(initialAwards);
  const [awardName, setAwardName] = useState('');
  const [year, setYear] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const addFetcher = useFetcher<AddAwardResult>();
  const removeFetcher = useFetcher<RemoveAwardResult>();
  const addIsIdle = addFetcher.state === 'idle';

  useEffect(() => {
    if (!addFetcher.data) return;
    if ('error' in addFetcher.data) {
      toast.error(addFetcher.data.error);
      return;
    }
    const { award } = addFetcher.data;
    setAwards(prev => (prev.some(a => a.awardId === award.awardId) ? prev : [...prev, award]));
    setAwardName('');
    setYear('');
    setCategory('');
    setNotes('');
    toast.success(`${award.awardName} added`);
  }, [addFetcher.data]);

  useEffect(() => {
    if (!removeFetcher.data) return;
    if ('error' in removeFetcher.data) {
      toast.error(removeFetcher.data.error);
      return;
    }
    const { awardId } = removeFetcher.data;
    setAwards(prev => prev.filter(a => a.awardId !== awardId));
    toast.success('Award removed');
  }, [removeFetcher.data]);

  return (
    <div className="space-y-3">
      {awards.length === 0 && <p className="text-xs text-muted-foreground">No awards yet.</p>}
      {awards.map(award => (
        <div
          key={award.awardId}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <span>
            {award.awardName}
            {award.year ? ` (${award.year})` : ''}
            {award.category ? ` — ${award.category}` : ''}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={removeFetcher.state !== 'idle'}
            onClick={() =>
              removeFetcher.submit(
                { intent: 'remove', artistId, awardId: award.awardId },
                { method: 'post', action: '/api/artist/award' }
              )
            }
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="space-y-2 rounded-md border border-dashed p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Input
            placeholder="Award name"
            value={awardName}
            onChange={e => setAwardName(e.target.value)}
          />
          <Input
            type="number"
            min={1900}
            max={2100}
            placeholder="Year"
            value={year}
            onChange={e => setYear(e.target.value)}
          />
          <Input
            placeholder="Category (optional)"
            value={category}
            onChange={e => setCategory(e.target.value)}
          />
          <Input
            placeholder="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!addIsIdle || !awardName.trim()}
          onClick={() =>
            addFetcher.submit(
              { intent: 'add', artistId, artistName, awardName, year, category, notes },
              { method: 'post', action: '/api/artist/award' }
            )
          }
        >
          <Plus className="h-4 w-4" />
          Add award
        </Button>
      </div>
    </div>
  );
}

type Performance = {
  eventId: string;
  eventTitle: string;
  eventStartDateTime: string;
  role?: string;
  isFeatured?: boolean;
  featureRank?: number;
};

type PerformanceResult = { success: true; performance: Performance } | { error: string };
type CreatePerformanceResult = { success: true; created: Performance } | { error: string };

// Toggles the per-artist featured flag on events the artist already performed
// at, and — via the create form below — records a known performance the poster
// pipeline never captured, tagging this artist. Both write immediately.
function PerformancesEditor({
  artistId,
  artistName,
  initialPerformances,
}: { artistId: string; artistName: string; initialPerformances: Performance[] }) {
  const [performances, setPerformances] = useState<Performance[]>(initialPerformances);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [venueName, setVenueName] = useState('');
  const [role, setRole] = useState('');
  const featureFetcher = useFetcher<PerformanceResult>();
  const createFetcher = useFetcher<CreatePerformanceResult>();
  const createIsIdle = createFetcher.state === 'idle';

  useEffect(() => {
    if (!featureFetcher.data) return;
    if ('error' in featureFetcher.data) {
      toast.error(featureFetcher.data.error);
      return;
    }
    const { performance } = featureFetcher.data;
    setPerformances(prev =>
      prev.map(p =>
        p.eventId === performance.eventId
          ? { ...p, isFeatured: performance.isFeatured, featureRank: performance.featureRank }
          : p
      )
    );
  }, [featureFetcher.data]);

  useEffect(() => {
    if (!createFetcher.data) return;
    if ('error' in createFetcher.data) {
      toast.error(createFetcher.data.error);
      return;
    }
    const { created } = createFetcher.data;
    setPerformances(prev =>
      prev.some(p => p.eventId === created.eventId) ? prev : [created, ...prev]
    );
    setTitle('');
    setDate('');
    setVenueName('');
    setRole('');
    toast.success(`${created.eventTitle} added`);
  }, [createFetcher.data]);

  return (
    <div className="space-y-3">
      {performances.length === 0 ? (
        <p className="text-xs text-muted-foreground">No events yet — add one below.</p>
      ) : (
        performances.map(performance => (
          <div
            key={performance.eventId}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="truncate">{performance.eventTitle}</div>
              <div className="text-xs text-muted-foreground">
                {performance.eventStartDateTime.slice(0, 10)}
                {performance.role ? ` — ${performance.role}` : ''}
              </div>
            </div>
            <Button
              type="button"
              variant={performance.isFeatured ? 'default' : 'outline'}
              size="sm"
              disabled={featureFetcher.state !== 'idle'}
              onClick={() =>
                featureFetcher.submit(
                  {
                    eventId: performance.eventId,
                    artistId,
                    featured: performance.isFeatured ? 'false' : 'true',
                  },
                  { method: 'post', action: '/api/artist/performance' }
                )
              }
            >
              {performance.isFeatured ? 'Featured' : 'Feature'}
            </Button>
          </div>
        ))
      )}

      <div className="space-y-2 rounded-md border border-dashed p-3">
        <p className="text-xs text-muted-foreground">
          Add a performance the listings pipeline never captured. It is created as an approved event
          and featured on this profile.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Input placeholder="Event title" value={title} onChange={e => setTitle(e.target.value)} />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Input
            placeholder="Venue (optional)"
            value={venueName}
            onChange={e => setVenueName(e.target.value)}
          />
          <Input
            placeholder="Role (optional)"
            value={role}
            onChange={e => setRole(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!createIsIdle || !title.trim() || !date}
          onClick={() =>
            createFetcher.submit(
              { intent: 'create', artistId, artistName, title, date, venueName, role },
              { method: 'post', action: '/api/artist/performance' }
            )
          }
        >
          <Plus className="h-4 w-4" />
          Add performance
        </Button>
      </div>
    </div>
  );
}

type Photo = {
  id: string;
  imageUrl: string;
  caption?: string;
  credit?: string;
  order: number;
  featured: boolean;
};

type InviteResult = { success: true; email: string } | { error: string };

// The enrichment-time half of §4.3.1. A moderator building this profile is usually already
// emailing the artist, so recording that address here is the whole handover: next time they
// sign in with it, the profile is theirs — no claim form, no queue, nothing for them to do.
//
// The address is written to an ArtistClaim invite row, never to the Artist record. artist.get
// is a public procedure and the profile is edge-cached, so an email on that row would be
// served to every visitor.
function ClaimInviteEditor({ artistId, artistName }: { artistId: string; artistName: string }) {
  const [email, setEmail] = useState('');
  const fetcher = useFetcher<InviteResult>();
  const isIdle = fetcher.state === 'idle';

  useEffect(() => {
    if (!fetcher.data) return;
    if ('error' in fetcher.data) {
      toast.error(fetcher.data.error);
      return;
    }
    setEmail('');
    toast.success(`${fetcher.data.email} can now claim this profile by signing in`);
  }, [fetcher.data]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Use the address you have been corresponding with. Signing in with it grants {artistName}
        &rsquo;s profile straight away, so only add an address you have actually heard from.
      </p>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="artist@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!isIdle || !email.trim()}
          onClick={() =>
            fetcher.submit(
              { intent: 'invite', artistId, email },
              { method: 'post', action: '/api/artist/claim' }
            )
          }
        >
          Invite
        </Button>
      </div>
    </div>
  );
}

type AddPhotoResult = { success: true; photo: Photo } | { error: string };
type UpdatePhotoResult = { success: true; photo: Photo } | { error: string };
type DeletePhotoResult = { success: true; id: string } | { error: string };
// Both arms carry the stored list: on a partial failure the client still needs the truth.
type ReorderResult = { success: true; photos: Photo[] } | { error: string; photos?: Photo[] };

// Gallery photos are their own ArtistPhoto rows, added/edited/reordered/deleted
// immediately. ImageUpload posts the bytes to S3 and hands back a CDN url via
// onUploaded; this stores that url plus optional caption/credit as a row.
//
// Reorder is move-up/move-down buttons rather than the drag-to-reorder the spec
// describes (§5.4e): there's no drag-and-drop library in this codebase, and
// buttons are a fraction of the code, keyboard-accessible for free, and don't
// need a pointer. A move renumbers by position and writes only the rows that
// changed, in one request (see computePhotoReorder for why not a swap).
function GalleryEditor({ artistId, initialPhotos }: { artistId: string; initialPhotos: Photo[] }) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [pending, setPending] = useState<{ imageUrl: string; uploadId: string } | null>(null);
  const [caption, setCaption] = useState('');
  const [credit, setCredit] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editCredit, setEditCredit] = useState('');
  const addFetcher = useFetcher<AddPhotoResult>();
  const updateFetcher = useFetcher<UpdatePhotoResult>();
  const deleteFetcher = useFetcher<DeletePhotoResult>();
  const reorderFetcher = useFetcher<ReorderResult>();
  const addIsIdle = addFetcher.state === 'idle';
  const updateIsIdle = updateFetcher.state === 'idle';
  const reorderIsIdle = reorderFetcher.state === 'idle';

  useEffect(() => {
    if (!addFetcher.data) return;
    if ('error' in addFetcher.data) {
      toast.error(addFetcher.data.error);
      return;
    }
    const { photo } = addFetcher.data;
    setPhotos(prev => (prev.some(p => p.id === photo.id) ? prev : [...prev, photo]));
    setPending(null);
    setCaption('');
    setCredit('');
    toast.success('Photo added');
  }, [addFetcher.data]);

  useEffect(() => {
    if (!updateFetcher.data) return;
    if ('error' in updateFetcher.data) {
      toast.error(updateFetcher.data.error);
      return;
    }
    const { photo } = updateFetcher.data;
    setPhotos(prev => prev.map(p => (p.id === photo.id ? photo : p)));
    // Only close the edit form for the row that actually just saved — a featured
    // toggle on another row shares this fetcher and shouldn't discard an in-progress
    // caption edit elsewhere in the grid.
    setEditingId(prev => (prev === photo.id ? null : prev));
  }, [updateFetcher.data]);

  useEffect(() => {
    if (!deleteFetcher.data) return;
    if ('error' in deleteFetcher.data) {
      toast.error(deleteFetcher.data.error);
      return;
    }
    const { id } = deleteFetcher.data;
    setPhotos(prev => prev.filter(p => p.id !== id));
    toast.success('Photo removed');
  }, [deleteFetcher.data]);

  // Sync to what the server says is stored, never to a rolled-back guess: if only some of the
  // rows were written, the optimistic order and the table have already diverged, and only the
  // reply knows which. The list is authoritative on the error arm too.
  useEffect(() => {
    if (!reorderFetcher.data) return;
    if (reorderFetcher.data.photos) setPhotos(reorderFetcher.data.photos);
    if ('error' in reorderFetcher.data) toast.error(reorderFetcher.data.error);
  }, [reorderFetcher.data]);

  const sortedPhotos = [...photos].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  function startEdit(photo: Photo) {
    setEditingId(photo.id);
    setEditCaption(photo.caption ?? '');
    setEditCredit(photo.credit ?? '');
  }

  function handleMove(id: string, direction: 'up' | 'down') {
    const changes = computePhotoReorder(photos, id, direction);
    if (changes.length === 0) return;

    // Optimistic only until the reply lands. The whole move goes as one submission so the
    // server can answer with the stored list either way — see the reorder effect above, which
    // syncs to that list rather than rolling back to a guess that a partial write would make
    // wrong. A raw fetch() was the earlier shape and read a session-expiry redirect to the
    // login page as a 200, silently reporting success; a fetcher handles that redirect.
    setPhotos(prev =>
      prev.map(photo => {
        const change = changes.find(c => c.id === photo.id);
        return change ? { ...photo, order: change.order } : photo;
      })
    );
    reorderFetcher.submit(
      { intent: 'reorder', artistId, changes: JSON.stringify(changes) },
      { method: 'post', action: '/api/artist/photo' }
    );
  }

  return (
    <div className="space-y-3">
      {photos.length === 0 && <p className="text-xs text-muted-foreground">No photos yet.</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {sortedPhotos.map((photo, index) => (
          <div key={photo.id} className="space-y-1 rounded-md border p-2">
            <img
              src={photo.imageUrl}
              alt={photo.caption ?? ''}
              className="h-24 w-full rounded object-cover"
            />
            {editingId === photo.id ? (
              <>
                <Input
                  placeholder="Caption (optional)"
                  value={editCaption}
                  onChange={e => setEditCaption(e.target.value)}
                />
                <Input
                  placeholder="Credit (optional)"
                  value={editCredit}
                  onChange={e => setEditCredit(e.target.value)}
                />
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!updateIsIdle}
                    onClick={() =>
                      updateFetcher.submit(
                        {
                          intent: 'update',
                          artistId,
                          id: photo.id,
                          caption: editCaption,
                          credit: editCredit,
                        },
                        { method: 'post', action: '/api/artist/photo' }
                      )
                    }
                  >
                    <Check className="h-4 w-4" />
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                {photo.caption && <div className="truncate text-xs">{photo.caption}</div>}
                {photo.credit && (
                  <div className="truncate text-xs text-muted-foreground">{photo.credit}</div>
                )}
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Edit caption and credit"
                    onClick={() => startEdit(photo)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant={photo.featured ? 'default' : 'outline'}
                    size="sm"
                    disabled={!updateIsIdle}
                    onClick={() =>
                      updateFetcher.submit(
                        {
                          intent: 'update',
                          artistId,
                          id: photo.id,
                          featured: photo.featured ? 'false' : 'true',
                        },
                        { method: 'post', action: '/api/artist/photo' }
                      )
                    }
                  >
                    {photo.featured ? 'Featured' : 'Feature'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Move up"
                    disabled={!reorderIsIdle || index === 0}
                    onClick={() => handleMove(photo.id, 'up')}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Move down"
                    disabled={!reorderIsIdle || index === sortedPhotos.length - 1}
                    onClick={() => handleMove(photo.id, 'down')}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    // Also held while a move is in flight: removing a row mid-reorder would
                    // race the reply, which overwrites the list wholesale.
                    disabled={deleteFetcher.state !== 'idle' || !reorderIsIdle}
                    onClick={() =>
                      deleteFetcher.submit(
                        { intent: 'delete', artistId, id: photo.id },
                        { method: 'post', action: '/api/artist/photo' }
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="space-y-2 rounded-md border border-dashed p-3">
        <ImageUpload
          urlFieldName="galleryPhotoUrl"
          uploadIdFieldName="galleryPhotoUploadId"
          entityType="artist"
          label="Add a photo"
          onUploaded={setPending}
        />
        {pending && (
          <>
            <Input
              placeholder="Caption (optional)"
              value={caption}
              onChange={e => setCaption(e.target.value)}
            />
            <Input
              placeholder="Credit (optional)"
              value={credit}
              onChange={e => setCredit(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!addIsIdle}
              onClick={() =>
                addFetcher.submit(
                  {
                    intent: 'add',
                    artistId,
                    imageUrl: pending.imageUrl,
                    uploadId: pending.uploadId,
                    caption,
                    credit,
                    // Append after the highest existing order, not the photo count —
                    // deleting a photo shrinks the count but not the max, so indexing
                    // by count risks colliding with a surviving photo's order.
                    order: String(nextPhotoOrder(photos)),
                  },
                  { method: 'post', action: '/api/artist/photo' }
                )
              }
            >
              <Plus className="h-4 w-4" />
              Add photo
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
