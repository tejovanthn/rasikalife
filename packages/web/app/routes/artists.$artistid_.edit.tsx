import * as Auth from '@rasika/core/auth';
import {
  MEDIA_TYPES,
  MEDIA_TYPE_LABELS,
  type MediaType,
  sortArtistMedia,
} from '@rasika/core/domain/artist-media/client';
import {
  type Credential,
  GURU_RELATIONSHIPS,
  GURU_RELATIONSHIP_LABELS,
  type Guru,
  type GuruRelationship,
  type Work,
  isGuruRelationship,
} from '@rasika/core/domain/artist/client';
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
import type { SocialLink } from '~/components/SocialLinksEditor';
import { SocialLinksEditor, readSocialLinks } from '~/components/SocialLinksEditor';
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
import { affiliationPeriod } from '~/lib/affiliation-display';
import { requireUser } from '~/lib/auth.server';
import { readRepeatedRows } from '~/lib/form-fields';
import { GALLERY_EDITOR_PAGE_SIZE, computePhotoReorder, nextPhotoOrder } from '~/lib/gallery-order';
import type { UploadedImage } from '~/lib/image-upload';
import { uploadImageFile } from '~/lib/image-upload';
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
  const [awards, performances, photos, claims, media, affiliations] = isModerator
    ? await Promise.all([
        serverClient.artist.listAwards.query({ artistId: artist.id }),
        serverClient.event.byArtist.query({ artistId: artist.id, limit: 50 }),
        // Same page size the reorder endpoint replies with, so the grid the moderator sees
        // and the list it is replaced by after a move can never be different lengths.
        serverClient.artist.listPhotos.query({
          artistId: artist.id,
          limit: GALLERY_EDITOR_PAGE_SIZE,
        }),
        serverClient.artistClaim.listForArtist.query({ artistId: artist.id }),
        serverClient.artist.listMedia.query({ artistId: artist.id }),
        serverClient.artist.listAffiliations.query({ artistId: artist.id }),
      ])
    : [[], { items: [] }, { items: [] }, [], [], []];

  // The record stores arangetram guru and venue as bare ids, so resolve each to a name for
  // the wizard's pickers. Both come back null for a dangling reference, which the picker
  // renders as empty rather than as a stale name.
  const [arangetramGuruRef, arangetramVenueRef] = isModerator
    ? await Promise.all([
        artist.arangetramGuruId
          ? serverClient.artist.get
              .query({ id: artist.arangetramGuruId as string })
              .then(guru => (guru ? { id: guru.id, name: guru.name } : null))
          : Promise.resolve(null),
        artist.arangetramVenueId
          ? serverClient.venue.get
              .query({ id: artist.arangetramVenueId as string })
              .then(venue => (venue ? { id: venue.id, name: venue.name } : null))
          : Promise.resolve(null),
      ])
    : [null, null];

  return data({
    artist,
    user,
    activeEdit,
    isModerator,
    members,
    awards,
    performances: performances.items,
    photos: photos.items,
    media,
    affiliations,
    arangetramGuruRef,
    arangetramVenueRef,
    // Only the invite addresses; the rows also carry the moderator's private note.
    invitedEmails: (claims as Array<{ kind: string; email?: string }>)
      .filter(c => c.kind === 'invite' && c.email)
      .map(c => c.email as string),
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
    // Blanking a field clears it. Every field in this wizard renders pre-filled with what is
    // stored, so emptying one is a deliberate act, and the previous rule — blank preserves —
    // meant a website or a biography could be added but never removed.
    //
    // An undefined value alone cannot carry that intent, since it is indistinguishable from
    // "not submitted". So the blank ones are named in clearFields and core removes those
    // attributes; see updateArtist for why a value cannot express it.
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
    const arangetramYearRaw = ((formData.get('arangetramYear') as string) || '').trim();
    const arangetramYear = arangetramYearRaw
      ? Number.parseInt(arangetramYearRaw, 10) || undefined
      : undefined;
    const arangetramGuruId =
      ((formData.get('arangetramGuruId') as string) || '').trim() || undefined;
    const arangetramVenueId =
      ((formData.get('arangetramVenueId') as string) || '').trim() || undefined;
    // §5.3 step 3 specced website *and* social links into this step; only website was built,
    // so the moderator surface could not set them at all. Unlike the scalars above, an empty
    // list is meaningful here — removing every row means "clear them" — so it is always sent.
    const socialLinks = readSocialLinks(formData);

    // Everything the moderator left empty, which core will remove. Built from the parsed
    // values rather than the raw form so it agrees exactly with what is being written: a
    // field that failed to parse into a number is blank as far as the record is concerned.
    const clearFields = (
      [
        ['title', title],
        ['instrument', instrument],
        ['city', city],
        ['photoUrl', photoUrl],
        ['photoUploadId', photoUploadId],
        ['biography', biography],
        ['specialisations', specialisations],
        ['birthYear', birthYear],
        ['birthPlace', birthPlace],
        ['practiceStartYear', practiceStartYear],
        ['debutYear', debutYear],
        ['activeYears', activeYears],
        ['website', website],
        ['arangetramYear', arangetramYear],
        ['arangetramGuruId', arangetramGuruId],
        ['arangetramVenueId', arangetramVenueId],
      ] as const
    )
      .filter(([, value]) => value === undefined)
      .map(([field]) => field);

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
    const guruRelationships = formData.getAll('guruRelationship') as string[];
    const gurus = guruNames
      .map((rawName, i) => {
        const guruName = rawName.trim();
        if (!guruName) return undefined;
        const fromYearRaw = (guruFromYears[i] || '').trim();
        const toYearRaw = (guruToYears[i] || '').trim();
        const discipline = (guruDisciplines[i] || '').trim();
        const relationship = (guruRelationships[i] || '').trim();
        return {
          id: (guruIds[i] || '').trim() || undefined,
          name: guruName,
          fromYear: fromYearRaw ? Number.parseInt(fromYearRaw, 10) || undefined : undefined,
          toYear: toYearRaw ? Number.parseInt(toYearRaw, 10) || undefined : undefined,
          discipline: discipline || undefined,
          // Validated against the closed set rather than trusted: a stray value would fail
          // the Zod parse for the whole artist, losing every other edit in the submission.
          relationship: isGuruRelationship(relationship) ? relationship : undefined,
        };
      })
      .filter((guru): guru is NonNullable<typeof guru> => guru !== undefined);

    const credentials = readRepeatedRows(formData, {
      required: 'credentialQualification',
      strings: { institution: 'credentialInstitution' },
      numbers: { year: 'credentialYear' },
    }).map(row => ({ qualification: row.required, ...row.rest }));

    const works = readRepeatedRows(formData, {
      required: 'workTitle',
      strings: { role: 'workRole' },
      numbers: { year: 'workYear' },
    }).map(row => ({ title: row.required, ...row.rest }));

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
          socialLinks,
          gurus,
          credentials,
          works,
          arangetramYear,
          arangetramGuruId,
          arangetramVenueId,
        },
        clearFields,
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
  // Mirrors the stored shape so the spread below carries every field forward, not just the
  // ones this form renders. `relationship` and `source` are the reason that matters now: an
  // editor renaming a guru must not silently downgrade a classified lineage to unlabelled.
  type StoredGuru = {
    id?: string;
    name: string;
    fromYear?: number;
    toYear?: number;
    discipline?: string;
    relationship?: GuruRelationship;
    source?: string;
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
  const socialLinks = readSocialLinks(formData);
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
                    // One row per guru under the section's "Gurus" Label — see DESIGN.md density rule.
                    aria-label="Guru name"
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

            <SocialLinksEditor value={socialLinks} onChange={setSocialLinks} />

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

/**
 * The word count past which the bio counter turns to a warning.
 *
 * Soft on purpose. Long bios are the problem this addresses — a 500-word programme note
 * repeats the sidebar, buries the facts that belong in fields, and reads identically to every
 * other artist's. But a hard cap would truncate real work mid-edit, so the schema still
 * accepts far more and this only nudges.
 */
const BIO_SOFT_WORD_CAP = 200;

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

type GuruRow = {
  id?: string;
  name: string;
  fromYear: string;
  toYear: string;
  discipline: string;
  // '' means "not stated", which is a real answer and not a missing one — most stored rows
  // predate the field, and guessing 'primary' for them would assert lineage nobody verified.
  relationship: GuruRelationship | '';
};

// Credentials and works are attributes on the artist record, so unlike affiliations they ride
// the form's Publish rather than writing immediately. Years are held as strings here for the
// same reason the rest of `form` is: an <input type="number"> hands back '' while being typed,
// and coercing on every keystroke makes the field impossible to clear.
type CredentialRow = {
  qualification: string;
  institution: string;
  year: string;
};

type WorkRow = {
  title: string;
  year: string;
  role: string;
};

function ModeratorArtistWizard() {
  const {
    artist,
    members,
    awards,
    performances,
    photos,
    media,
    affiliations,
    arangetramGuruRef,
    arangetramVenueRef,
    invitedEmails,
  } = useLoaderData<typeof loader>();
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
    arangetramYear: (artist.arangetramYear as number | undefined)?.toString() ?? '',
  });
  // The arangetram guru and venue are entity references: the record stores only the ids, so
  // the loader resolves each to a name for the picker to display. A reference that no longer
  // resolves — a deleted venue — comes back null and the picker simply shows empty, which is
  // the honest rendering of a dangling id.
  const [arangetramGuru, setArangetramGuru] = useState(arangetramGuruRef);
  const [arangetramVenue, setArangetramVenue] = useState(arangetramVenueRef);
  // A list, so it sits outside `form`, which holds scalars the Review step diffs one by one.
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    (artist.socialLinks as SocialLink[] | undefined) ?? []
  );

  const [gurus, setGurus] = useState<GuruRow[]>(
    ((artist.gurus as Guru[] | undefined) ?? []).map(guru => ({
      id: guru.id,
      name: guru.name,
      fromYear: guru.fromYear?.toString() ?? '',
      toYear: guru.toYear?.toString() ?? '',
      discipline: guru.discipline ?? '',
      relationship: guru.relationship ?? '',
    }))
  );

  const [credentials, setCredentials] = useState<CredentialRow[]>(
    ((artist.credentials as Credential[] | undefined) ?? []).map(credential => ({
      qualification: credential.qualification,
      institution: credential.institution ?? '',
      year: credential.year?.toString() ?? '',
    }))
  );

  const [works, setWorks] = useState<WorkRow[]>(
    ((artist.works as Work[] | undefined) ?? []).map(work => ({
      title: work.title,
      year: work.year?.toString() ?? '',
      role: work.role ?? '',
    }))
  );

  const bioWordCount = countWords(form.biography);
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
                  <p className="text-xs text-warning">
                    Unchecking this leaves {members.length} member{members.length === 1 ? '' : 's'}{' '}
                    linked but hidden — the group's membership is not removed. Detach members first
                    if you mean to convert this to an individual.
                  </p>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="instrument">Instruments</Label>
                    <Input
                      id="instrument"
                      name="instrument"
                      type="text"
                      placeholder="e.g. Mridangam, Vocal"
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

                {/* The arangetram is the debut recital that ends formal training, and in this
                    domain it is a stronger credential than any degree — which is why it gets
                    flat fields here rather than a row in the credentials list. */}
                <div className="space-y-3 border-t pt-6">
                  <Label>Arangetram / debut recital</Label>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="arangetramYear" className="text-xs text-muted-foreground">
                        Year
                      </Label>
                      <Input
                        id="arangetramYear"
                        name="arangetramYear"
                        type="number"
                        min={1800}
                        max={2100}
                        value={form.arangetramYear}
                        onChange={e => setForm(f => ({ ...f, arangetramYear: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <SearchSelect
                        label="Guru"
                        placeholder="Search artists..."
                        searchUrl="/api/search/artist-live"
                        inputId="arangetram-guru-picker"
                        fieldName="arangetramGuruPicker"
                        value={arangetramGuru}
                        onChange={entity => setArangetramGuru(entity)}
                      />
                    </div>
                    <div className="space-y-2">
                      <SearchSelect
                        label="Venue"
                        placeholder="Search venues..."
                        searchUrl="/api/search/venue"
                        inputId="arangetram-venue-picker"
                        fieldName="arangetramVenuePicker"
                        value={arangetramVenue}
                        onChange={entity => setArangetramVenue(entity)}
                      />
                    </div>
                  </div>
                  {/* Only the ids are submitted; the profile resolves both to names on read,
                      so nothing here has to be kept fresh when a venue is renamed. */}
                  <input type="hidden" name="arangetramGuruId" value={arangetramGuru?.id ?? ''} />
                  <input type="hidden" name="arangetramVenueId" value={arangetramVenue?.id ?? ''} />
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
                  {/* A soft cap, not a maxLength: the schema still accepts 10,000 characters,
                      and cutting someone off mid-sentence would lose work. The count is a
                      nudge toward the register — neutral and factual, like a reference work
                      rather than a programme note. */}
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                      Aim for about 200 words of narrative. Gurus, awards, affiliations,
                      qualifications and productions each have their own fields — facts kept there
                      are searchable and linked, and repeating them here only makes every bio read
                      the same.
                    </p>
                    <span
                      className={`shrink-0 text-xs tabular-nums ${
                        bioWordCount > BIO_SOFT_WORD_CAP ? 'text-warning' : 'text-muted-foreground'
                      }`}
                    >
                      {bioWordCount} {bioWordCount === 1 ? 'word' : 'words'}
                    </span>
                  </div>
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

                {/* Beside the website rather than in Relationships, where §5.3 put it: both
                    answer "where else can this artist be found", and splitting them across
                    steps would have a moderator enter half the answer twice. */}
                <SocialLinksEditor value={socialLinks} onChange={setSocialLinks} />
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
                          { name: '', fromYear: '', toYear: '', discipline: '', relationship: '' },
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
                  <Label>Affiliations</Label>
                  <p className="text-xs text-muted-foreground">
                    Schools, institutions and ensembles this artist founded, directs or teaches at.
                    These save immediately — like membership, they do not wait for Publish — and
                    each one also lists the artist on the organisation's own page.
                  </p>
                  <AffiliationsEditor artistId={artist.id} initialAffiliations={affiliations} />
                </div>

                <div className="space-y-3 border-t pt-6">
                  <Label>Qualifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Degrees and diplomas. Most artists have none, and that is not a gap — the
                    arangetram and the guru lineage above are the credentials that matter here.
                  </p>
                  <CredentialsEditor credentials={credentials} onChange={setCredentials} />
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
                  Awards, performances, photos and media save immediately — like membership, they do
                  not wait for Publish. Works are the exception on this step: they are part of the
                  artist record, so they save when you publish.
                </p>

                <div className="space-y-3">
                  <Label>Works & productions</Label>
                  <p className="text-xs text-muted-foreground">
                    Pieces this artist choreographed or directed — not the repertoire they perform,
                    which comes from setlists.
                  </p>
                  <WorksEditor works={works} onChange={setWorks} />
                </div>

                <div className="space-y-3 border-t pt-6">
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
                  <Label>Publications & media</Label>
                  <p className="text-xs text-muted-foreground">
                    Reviews, interviews and features. The link is required; add the image later if
                    you do not have one to hand.
                  </p>
                  <MediaEditor artistId={artist.id} initialMedia={media} />
                </div>

                <div className="space-y-3 border-t pt-6">
                  <Label>Hand this profile to the artist</Label>
                  <ClaimInviteEditor
                    artistId={artist.id}
                    artistName={artist.name}
                    initialInvites={invitedEmails}
                  />
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
                  Membership, awards, performances, photos and media are saved as you go — they are
                  not part of this publish. A field left blank above is cleared.
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
  // Blanking a field now clears it, so this row says so. It used to render the stored value
  // tagged "(unchanged)", which was honest about the old preserve-on-blank rule and would be
  // a lie about this one.
  const clearing = !value && !!stored;
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-words">
        {value || '—'}
        {clearing && (
          <span className="ml-1 text-xs text-destructive">(clearing &ldquo;{stored}&rdquo;)</span>
        )}
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
      {/* Select writes no form value of its own, so the choice rides a hidden input like the
          id and name above — the action reads all four as parallel arrays. */}
      <input type="hidden" name="guruRelationship" value={guru.relationship} />
      <div className="space-y-2">
        <Label htmlFor={`guru-relationship-${index}`}>Relationship</Label>
        <Select
          value={guru.relationship || 'unspecified'}
          onValueChange={value =>
            onChange({
              ...guru,
              relationship: value === 'unspecified' ? '' : (value as GuruRelationship),
            })
          }
        >
          <SelectTrigger id={`guru-relationship-${index}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* An explicit "not stated" option, not just an empty default: it has to be
                choosable, because leaving it unset is the honest answer for an inherited row
                and a moderator must be able to return to it. */}
            <SelectItem value="unspecified">Not stated</SelectItem>
            {GURU_RELATIONSHIPS.map(relationship => (
              <SelectItem key={relationship} value={relationship}>
                {GURU_RELATIONSHIP_LABELS[relationship]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Only primary and advanced count as lineage on the profile. A workshop teacher or a
          professor who taught a degree course is not a guru in the discipleship sense.
        </p>
      </div>
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

type Affiliation = {
  artistId: string;
  artistName: string;
  organiserId: string;
  organisationName: string;
  role?: string;
  discipline?: string;
  startYear?: number;
  endYear?: number;
  isCurrent?: boolean;
};

type AddAffiliationResult = { success: true; affiliation: Affiliation } | { error: string };
type RemoveAffiliationResult = { success: true; organiserId: string } | { error: string };

/**
 * Institutional roles — founder, artistic director, faculty.
 *
 * Writes land immediately in the ArtistAffiliation junction, like memberships and unlike the
 * rest of this form, so each add/remove fires its own fetcher rather than waiting for Publish.
 *
 * The organisation must resolve to an Organiser record, which is why this uses a SearchSelect
 * rather than a free-text box: the junction is keyed on the artist/organiser pair, and a row
 * with no organiser is not representable. Typing a name that matches nothing creates the
 * organisation, which is safe here because a moderator is making the call — the bulk
 * extraction path is forbidden from doing the same thing unattended.
 */
function AffiliationsEditor({
  artistId,
  initialAffiliations,
}: { artistId: string; initialAffiliations: Affiliation[] }) {
  const [affiliations, setAffiliations] = useState<Affiliation[]>(initialAffiliations);
  const [organisation, setOrganisation] = useState<{ id: string; name: string } | null>(null);
  const [newOrganisationName, setNewOrganisationName] = useState('');
  const [role, setRole] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const addFetcher = useFetcher<AddAffiliationResult>();
  const removeFetcher = useFetcher<RemoveAffiliationResult>();
  const addIsIdle = addFetcher.state === 'idle';

  useEffect(() => {
    if (!addFetcher.data) return;
    if ('error' in addFetcher.data) {
      toast.error(addFetcher.data.error);
      return;
    }
    const { affiliation } = addFetcher.data;
    // Replace rather than append when the pair already exists: the write is an upsert, so
    // re-adding an organisation is how a role or an end year gets corrected.
    setAffiliations(prev => [
      ...prev.filter(a => a.organiserId !== affiliation.organiserId),
      affiliation,
    ]);
    setOrganisation(null);
    setNewOrganisationName('');
    setRole('');
    setDiscipline('');
    setStartYear('');
    setEndYear('');
    setIsCurrent(false);
    toast.success(`${affiliation.organisationName} added`);
  }, [addFetcher.data]);

  useEffect(() => {
    if (!removeFetcher.data) return;
    if ('error' in removeFetcher.data) {
      toast.error(removeFetcher.data.error);
      return;
    }
    const { organiserId } = removeFetcher.data;
    setAffiliations(prev => prev.filter(a => a.organiserId !== organiserId));
    toast.success('Affiliation removed');
  }, [removeFetcher.data]);

  const canAdd = Boolean(organisation?.id || newOrganisationName.trim());

  return (
    <div className="space-y-3">
      {affiliations.length === 0 && (
        <p className="text-xs text-muted-foreground">No affiliations yet.</p>
      )}
      {affiliations.map(affiliation => {
        const period = affiliationPeriod(affiliation);
        return (
          <div
            key={affiliation.organiserId}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <span>
              <span className="font-medium">{affiliation.organisationName}</span>
              {affiliation.role ? (
                <span className="text-muted-foreground"> — {affiliation.role}</span>
              ) : null}
              {period ? <span className="text-muted-foreground"> · {period}</span> : null}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={removeFetcher.state !== 'idle'}
              onClick={() =>
                removeFetcher.submit(
                  { intent: 'remove', artistId, organiserId: affiliation.organiserId },
                  { method: 'post', action: '/api/artist/affiliation' }
                )
              }
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
      <div className="space-y-2 rounded-md border border-dashed p-3">
        <SearchSelect
          label="Organisation"
          placeholder="Search organisations..."
          searchUrl="/api/search/organiser"
          inputId="affiliation-organiser-picker"
          fieldName="affiliationOrganiserPicker"
          value={organisation}
          onChange={entity => {
            setOrganisation(entity);
            if (entity) setNewOrganisationName('');
          }}
          createNew={name => {
            setOrganisation(null);
            setNewOrganisationName(name);
          }}
        />
        {newOrganisationName && (
          <p className="text-xs text-muted-foreground">
            "{newOrganisationName}" will be created as a new organisation.
          </p>
        )}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Input
            placeholder="Role, e.g. founder, artistic director"
            aria-label="Affiliation role"
            value={role}
            onChange={e => setRole(e.target.value)}
          />
          <Input
            placeholder="Discipline (optional)"
            aria-label="Affiliation discipline"
            value={discipline}
            onChange={e => setDiscipline(e.target.value)}
          />
          <Input
            type="number"
            min={1800}
            max={2100}
            placeholder="Start year"
            aria-label="Affiliation start year"
            value={startYear}
            onChange={e => setStartYear(e.target.value)}
          />
          <Input
            type="number"
            min={1800}
            max={2100}
            placeholder="End year"
            aria-label="Affiliation end year"
            value={endYear}
            onChange={e => setEndYear(e.target.value)}
            disabled={isCurrent}
          />
        </div>
        {/* Held apart from a blank end year on purpose: "faculty since some unrecorded date"
            is the common shape, so an empty endYear cannot mean either current or ended. */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isCurrent}
            onChange={e => {
              setIsCurrent(e.target.checked);
              if (e.target.checked) setEndYear('');
            }}
            className="h-4 w-4 rounded border-input"
          />
          Still holds this role
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!addIsIdle || !canAdd}
          onClick={() =>
            addFetcher.submit(
              {
                intent: 'add',
                artistId,
                organiserId: organisation?.id ?? '',
                organisationName: organisation ? '' : newOrganisationName,
                role,
                discipline,
                startYear,
                endYear,
                isCurrent: isCurrent ? 'true' : '',
              },
              { method: 'post', action: '/api/artist/affiliation' }
            )
          }
        >
          <Plus className="h-4 w-4" />
          Add affiliation
        </Button>
      </div>
    </div>
  );
}

/**
 * Formal qualifications. Unlike affiliations these are an attribute on the artist record, so
 * the rows ride the form's Publish rather than writing immediately — the same as gurus.
 *
 * Rows submit as parallel arrays of repeated field names, correlated by index, which is why
 * every row renders all three inputs even when two are blank.
 */
function CredentialsEditor({
  credentials,
  onChange,
}: { credentials: CredentialRow[]; onChange: (rows: CredentialRow[]) => void }) {
  return (
    <div className="space-y-3">
      {credentials.length === 0 && (
        <p className="text-xs text-muted-foreground">No qualifications added.</p>
      )}
      {credentials.map((credential, index) => (
        <div key={index} className="flex items-start gap-2 rounded-md border p-3">
          <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-3">
            <Input
              name="credentialQualification"
              placeholder="Qualification, e.g. MA Bharatanatyam"
              aria-label="Qualification"
              value={credential.qualification}
              onChange={e =>
                onChange(
                  credentials.map((c, i) =>
                    i === index ? { ...c, qualification: e.target.value } : c
                  )
                )
              }
            />
            <Input
              name="credentialInstitution"
              placeholder="Institution (optional)"
              aria-label="Institution"
              value={credential.institution}
              onChange={e =>
                onChange(
                  credentials.map((c, i) =>
                    i === index ? { ...c, institution: e.target.value } : c
                  )
                )
              }
            />
            <Input
              name="credentialYear"
              type="number"
              min={1800}
              max={2100}
              placeholder="Year"
              aria-label="Qualification year"
              value={credential.year}
              onChange={e =>
                onChange(
                  credentials.map((c, i) => (i === index ? { ...c, year: e.target.value } : c))
                )
              }
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(credentials.filter((_, i) => i !== index))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...credentials, { qualification: '', institution: '', year: '' }])}
      >
        <Plus className="h-4 w-4" />
        Add qualification
      </Button>
    </div>
  );
}

/**
 * Productions, ballets and choreographed pieces — an artist's authored work, as against the
 * repertoire they perform, which is what Composition holds. An attribute on the record, so it
 * publishes with the form.
 */
function WorksEditor({
  works,
  onChange,
}: { works: WorkRow[]; onChange: (rows: WorkRow[]) => void }) {
  return (
    <div className="space-y-3">
      {works.length === 0 && <p className="text-xs text-muted-foreground">No works added.</p>}
      {works.map((work, index) => (
        <div key={index} className="flex items-start gap-2 rounded-md border p-3">
          <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-3">
            <Input
              name="workTitle"
              placeholder="Title, e.g. Matrutvam"
              aria-label="Work title"
              value={work.title}
              onChange={e =>
                onChange(works.map((w, i) => (i === index ? { ...w, title: e.target.value } : w)))
              }
            />
            <Input
              name="workRole"
              placeholder="Role, e.g. director (optional)"
              aria-label="Work role"
              value={work.role}
              onChange={e =>
                onChange(works.map((w, i) => (i === index ? { ...w, role: e.target.value } : w)))
              }
            />
            <Input
              name="workYear"
              type="number"
              min={1800}
              max={2100}
              placeholder="Year"
              aria-label="Work year"
              value={work.year}
              onChange={e =>
                onChange(works.map((w, i) => (i === index ? { ...w, year: e.target.value } : w)))
              }
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(works.filter((_, i) => i !== index))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...works, { title: '', year: '', role: '' }])}
      >
        <Plus className="h-4 w-4" />
        Add work
      </Button>
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
type MediaItem = {
  id: string;
  title: string;
  url: string;
  mediaType: MediaType;
  outlet?: string;
  publishedOn?: string;
  imageUrl?: string;
};

type AddMediaResult = { success: true; media: MediaItem } | { error: string };
type DeleteMediaResult = { success: true; deletedId: string } | { error: string };

/**
 * Press and media coverage. Writes immediately, like awards and the gallery beside it.
 *
 * The link is required and the image is not: a mention can be logged the moment it appears
 * and the scan added later, which is the difference between coverage getting recorded and
 * getting forgotten.
 */
function MediaEditor({ artistId, initialMedia }: { artistId: string; initialMedia: MediaItem[] }) {
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('article');
  const [outlet, setOutlet] = useState('');
  const [publishedOn, setPublishedOn] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const addFetcher = useFetcher<AddMediaResult>();
  const deleteFetcher = useFetcher<DeleteMediaResult>();
  const addIsIdle = addFetcher.state === 'idle';

  useEffect(() => {
    if (!addFetcher.data) return;
    if ('error' in addFetcher.data) {
      toast.error(addFetcher.data.error);
      return;
    }
    const added = addFetcher.data.media;
    setMedia(prev => (prev.some(m => m.id === added.id) ? prev : [added, ...prev]));
    setTitle('');
    setUrl('');
    setOutlet('');
    setPublishedOn('');
    setImageUrl('');
    toast.success(`${added.title} added`);
  }, [addFetcher.data]);

  useEffect(() => {
    if (!deleteFetcher.data) return;
    if ('error' in deleteFetcher.data) {
      toast.error(deleteFetcher.data.error);
      return;
    }
    const { deletedId } = deleteFetcher.data;
    setMedia(prev => prev.filter(m => m.id !== deletedId));
    toast.success('Item removed');
  }, [deleteFetcher.data]);

  return (
    <div className="space-y-3">
      {media.length === 0 && (
        <p className="text-xs text-muted-foreground">No coverage recorded yet.</p>
      )}

      {sortArtistMedia(media).map(item => (
        <div
          key={item.id}
          className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="no-ext-arrow font-medium text-primary hover:underline"
            >
              {item.title}
            </a>
            <div className="text-xs text-muted-foreground">
              {[MEDIA_TYPE_LABELS[item.mediaType], item.outlet, item.publishedOn]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove ${item.title}`}
            disabled={deleteFetcher.state !== 'idle'}
            onClick={() =>
              deleteFetcher.submit(
                { intent: 'delete', artistId, id: item.id },
                { method: 'post', action: '/api/artist/media' }
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
            aria-label="Coverage title"
            placeholder="Headline or title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <Input
            aria-label="Link to the coverage"
            placeholder="https://..."
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <Select value={mediaType} onValueChange={v => setMediaType(v as MediaType)}>
            <SelectTrigger aria-label="Kind of coverage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEDIA_TYPES.map(t => (
                <SelectItem key={t} value={t}>
                  {MEDIA_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label="Publication or outlet"
            placeholder="Outlet (optional)"
            value={outlet}
            onChange={e => setOutlet(e.target.value)}
          />
          <Input
            aria-label="Publication date"
            type="date"
            value={publishedOn}
            onChange={e => setPublishedOn(e.target.value)}
          />
          <Input
            aria-label="Image URL"
            placeholder="Image URL (optional)"
            type="url"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!addIsIdle || !title.trim() || !url.trim()}
          onClick={() =>
            addFetcher.submit(
              { artistId, title, url, mediaType, outlet, publishedOn, imageUrl },
              { method: 'post', action: '/api/artist/media' }
            )
          }
        >
          <Plus className="h-4 w-4" />
          Add coverage
        </Button>
      </div>
    </div>
  );
}

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
            aria-label="Award name"
            value={awardName}
            onChange={e => setAwardName(e.target.value)}
          />
          <Input
            type="number"
            min={1900}
            max={2100}
            placeholder="Year"
            aria-label="Award year"
            value={year}
            onChange={e => setYear(e.target.value)}
          />
          <Input
            placeholder="Category (optional)"
            aria-label="Award category"
            value={category}
            onChange={e => setCategory(e.target.value)}
          />
          <Input
            placeholder="Notes (optional)"
            aria-label="Award notes"
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

// One row of the performances list: the feature toggle, plus a rank box that appears once
// the row is featured. Rank orders the profile's notable-performances teaser — lowest
// first, unranked entries after the ranked ones, most recent first within a tie. Leaving
// every row unranked is the ordinary case and gives a most-recent-first list.
//
// It is its own component so the input can hold a draft value without re-rendering the
// whole list on every keystroke, and so the effect that re-syncs it after a write watches
// one row's rank rather than the array.
function PerformanceRow({
  performance,
  disabled,
  onToggle,
  onRank,
}: {
  performance: Performance;
  disabled: boolean;
  onToggle: () => void;
  onRank: (rank: string) => void;
}) {
  const storedRank = performance.featureRank?.toString() ?? '';
  const [rank, setRank] = useState(storedRank);

  // The server is the authority on what stuck: re-sync when it echoes a different value,
  // including the clear that unfeaturing performs.
  useEffect(() => {
    setRank(storedRank);
  }, [storedRank]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="truncate">{performance.eventTitle}</div>
        <div className="text-xs text-muted-foreground">
          {performance.eventStartDateTime.slice(0, 10)}
          {performance.role ? ` — ${performance.role}` : ''}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {performance.isFeatured && (
          <Input
            type="number"
            min="1"
            inputMode="numeric"
            aria-label={`Rank for ${performance.eventTitle}`}
            placeholder="Rank"
            className="w-20"
            value={rank}
            disabled={disabled}
            onChange={e => setRank(e.target.value)}
            // Commit on blur rather than per keystroke: typing "12" would otherwise write
            // rank 1 first, reordering the teaser under the moderator's hands.
            onBlur={() => {
              if (rank.trim() !== storedRank) onRank(rank.trim());
            }}
          />
        )}
        <Button
          type="button"
          variant={performance.isFeatured ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          onClick={onToggle}
        >
          {performance.isFeatured ? 'Featured' : 'Feature'}
        </Button>
      </div>
    </div>
  );
}

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
          <PerformanceRow
            key={performance.eventId}
            performance={performance}
            disabled={featureFetcher.state !== 'idle'}
            onToggle={() =>
              featureFetcher.submit(
                {
                  eventId: performance.eventId,
                  artistId,
                  featured: performance.isFeatured ? 'false' : 'true',
                },
                { method: 'post', action: '/api/artist/performance' }
              )
            }
            onRank={rank =>
              featureFetcher.submit(
                { eventId: performance.eventId, artistId, featured: 'true', featureRank: rank },
                { method: 'post', action: '/api/artist/performance' }
              )
            }
          />
        ))
      )}

      <div className="space-y-2 rounded-md border border-dashed p-3">
        <p className="text-xs text-muted-foreground">
          Add a performance the listings pipeline never captured. It is created as an approved event
          and featured on this profile.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Input
            placeholder="Event title"
            aria-label="Event title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <Input
            type="date"
            aria-label="Event date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <Input
            placeholder="Venue (optional)"
            aria-label="Venue"
            value={venueName}
            onChange={e => setVenueName(e.target.value)}
          />
          <Input
            placeholder="Role (optional)"
            aria-label="Role"
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
  courtesyArtist?: boolean;
  photographerId?: string;
  photographerName?: string;
  order: number;
  featured: boolean;
};

type InviteResult = { success: true; intent: string; email: string } | { error: string };

// The enrichment-time half of §4.3.1. A moderator building this profile is usually already
// emailing the artist, so recording that address here is the whole handover: next time they
// sign in with it, the profile is theirs — no claim form, no queue, nothing for them to do.
//
// The address is written to an ArtistClaim invite row, never to the Artist record. artist.get
// is a public procedure and the profile is edge-cached, so an email on that row would be
// served to every visitor.
function ClaimInviteEditor({
  artistId,
  artistName,
  initialInvites,
}: { artistId: string; artistName: string; initialInvites: string[] }) {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [invites, setInvites] = useState<string[]>(initialInvites);
  const fetcher = useFetcher<InviteResult>();
  const isIdle = fetcher.state === 'idle';

  useEffect(() => {
    if (!fetcher.data) return;
    if ('error' in fetcher.data) {
      toast.error(fetcher.data.error);
      return;
    }
    const { intent, email: actioned } = fetcher.data;
    if (intent === 'invite') {
      setInvites(prev => (prev.includes(actioned) ? prev : [...prev, actioned]));
      setEmail('');
      setNote('');
      toast.success(`${actioned} can now claim this profile by signing in`);
      return;
    }
    setInvites(prev => prev.filter(e => e !== actioned));
    toast.success(`Withdrew the invite to ${actioned}`);
  }, [fetcher.data]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Use the address you have been corresponding with. Signing in with it grants {artistName}
        &rsquo;s profile straight away with no further review, so only add an address you have
        actually heard from — and check the spelling, because whoever owns a mistyped address can
        claim this profile.
      </p>

      {/* Outstanding invites are listed because they are otherwise invisible: a typo would be a
          standing offer of this profile, with nothing in the product to show or undo it. */}
      {invites.length > 0 && (
        <ul className="space-y-1">
          {invites.map(invited => (
            <li key={invited} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate">{invited}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!isIdle}
                onClick={() =>
                  fetcher.submit(
                    { intent: 'revoke', artistId, email: invited },
                    { method: 'post', action: '/api/artist/claim' }
                  )
                }
              >
                Withdraw
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Input
        type="email"
        placeholder="artist@example.com"
        aria-label="Artist email address"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <Input
        placeholder="How do you know this address is theirs?"
        aria-label="How do you know this address is theirs?"
        value={note}
        onChange={e => setNote(e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!isIdle || !email.trim() || !note.trim()}
        onClick={() =>
          fetcher.submit(
            { intent: 'invite', artistId, email, moderatorNote: note },
            { method: 'post', action: '/api/artist/claim' }
          )
        }
      >
        Invite
      </Button>
    </div>
  );
}

type PhotographerResult = { success: true; id: string; name: string } | { error: string };

type AddPhotoResult = { success: true; photos: Photo[]; failedCount: number } | { error: string };
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
  const [uploading, setUploading] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  // Courtesy of the artist unless a photographer is named. Checked by default because the
  // artist is usually the uploader, so naming a photographer is their call to make.
  const [editCourtesy, setEditCourtesy] = useState(true);
  const [editPhotographer, setEditPhotographer] = useState<{ id?: string; name: string }>({
    name: '',
  });
  const addFetcher = useFetcher<AddPhotoResult>();
  const updateFetcher = useFetcher<UpdatePhotoResult>();
  const deleteFetcher = useFetcher<DeletePhotoResult>();
  const reorderFetcher = useFetcher<ReorderResult>();
  const photographerFetcher = useFetcher<PhotographerResult>();
  const addIsIdle = addFetcher.state === 'idle';
  const updateIsIdle = updateFetcher.state === 'idle';
  const reorderIsIdle = reorderFetcher.state === 'idle';

  useEffect(() => {
    if (!addFetcher.data) return;
    if ('error' in addFetcher.data) {
      toast.error(addFetcher.data.error);
      return;
    }
    const { photos: added, failedCount } = addFetcher.data;
    // Dedup by id: the effect reruns whenever the fetcher's data object changes identity, and
    // appending blindly would double a batch on a re-render.
    setPhotos(prev => {
      const known = new Set(prev.map(p => p.id));
      return [...prev, ...added.filter(p => !known.has(p.id))];
    });
    if (added.length > 0) {
      toast.success(`${added.length} photo${added.length > 1 ? 's' : ''} added`);
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} photo${failedCount > 1 ? 's' : ''} could not be saved`);
    }
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

  /**
   * Upload every chosen file, then record the ones that landed in a single request.
   *
   * Uploads run together because they are independent S3 PUTs, and `allSettled` so one
   * unreadable file cannot take the batch down with it. The database writes go in one
   * `addMany` call rather than N: each photo's `order` has to follow the last, and parallel
   * requests would all read the same starting point.
   */
  async function handleFiles(files: FileList) {
    const chosen = Array.from(files);
    setUploading(chosen.length);

    const results = await Promise.allSettled(
      chosen.map(async file => {
        try {
          return await uploadImageFile(file, 'artist');
        } finally {
          setUploading(n => n - 1);
        }
      })
    );

    const uploaded = results
      .filter((r): r is PromiseFulfilledResult<UploadedImage> => r.status === 'fulfilled')
      .map(r => r.value);
    const failedUploads = results.length - uploaded.length;
    if (failedUploads > 0) {
      toast.error(`${failedUploads} file${failedUploads > 1 ? 's' : ''} could not be uploaded`);
    }
    if (uploaded.length === 0) return;

    addFetcher.submit(
      {
        intent: 'addMany',
        artistId,
        photos: JSON.stringify(uploaded),
        // Past the highest existing order, not the count: deleting a photo shrinks the count
        // but not the max, so indexing by count risks colliding with a surviving photo.
        startOrder: String(nextPhotoOrder(photos)),
      },
      { method: 'post', action: '/api/artist/photo' }
    );
  }

  // A photographer created from the picker comes back with its new id, which the edit form
  // needs before Save can link it.
  useEffect(() => {
    if (!photographerFetcher.data) return;
    if ('error' in photographerFetcher.data) {
      toast.error(photographerFetcher.data.error);
      return;
    }
    const { id, name } = photographerFetcher.data;
    setEditPhotographer({ id, name });
  }, [photographerFetcher.data]);

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
    setEditCourtesy(photo.courtesyArtist ?? true);
    setEditPhotographer({ id: photo.photographerId, name: photo.photographerName ?? '' });
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
                  aria-label="Photo caption"
                  value={editCaption}
                  onChange={e => setEditCaption(e.target.value)}
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={editCourtesy}
                    onChange={e => {
                      setEditCourtesy(e.target.checked);
                      // Turning courtesy back on drops the photographer, so a photo is never
                      // left crediting both the artist and someone else.
                      if (e.target.checked) setEditPhotographer({ name: '' });
                    }}
                  />
                  Courtesy of the artist
                </label>
                {!editCourtesy && (
                  <SearchSelect
                    label="Photographer"
                    placeholder="Search or add a photographer..."
                    searchUrl="/api/search/artist-live"
                    inputId={`photographer-${photo.id}`}
                    fieldName="photographerPicker"
                    value={
                      editPhotographer.id
                        ? { id: editPhotographer.id, name: editPhotographer.name }
                        : null
                    }
                    onChange={entity =>
                      setEditPhotographer({ id: entity?.id, name: entity?.name ?? '' })
                    }
                    createNew={name => {
                      setEditPhotographer({ name });
                      photographerFetcher.submit(
                        { name },
                        { method: 'post', action: '/api/artist/photographer' }
                      );
                    }}
                  />
                )}
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
                          courtesyArtist: String(editCourtesy),
                          // Blank clears, so unchecking and naming nobody reverts to courtesy
                          // rather than storing a credit with an empty name.
                          photographerId: editCourtesy ? '' : (editPhotographer.id ?? ''),
                          photographerName: editCourtesy ? '' : editPhotographer.name,
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
                <div className="truncate text-xs text-muted-foreground">
                  {photo.courtesyArtist === false && photo.photographerName
                    ? `© ${photo.photographerName}`
                    : 'Courtesy of the artist'}
                </div>
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
        {/* Multi-select. Caption and credit are no longer asked for up front: they made sense
            when one photo went in at a time, and asking for twenty before anything is stored
            would be absurd. Every row already has an edit form for them. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          aria-label="Choose photos to upload"
          onChange={e => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            // Cleared so choosing the same file again still fires a change event.
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading > 0 || !addIsIdle}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading > 0 ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {uploading > 0 ? `Uploading ${uploading}…` : 'Add photos'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Select as many as you like. Add captions and credits afterwards.
        </p>
      </div>
    </div>
  );
}
