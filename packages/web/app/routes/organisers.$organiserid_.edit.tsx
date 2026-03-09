import { EditEntityTypes, EditStatus } from '@rasika/core/domain/edit/client';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MetaFunction } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import { toast } from 'sonner';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { ImageUpload } from '~/components/ImageUpload';
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
import { generateOrganiserUrl, parseSlug } from '~/lib/url-slug';

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex, nofollow' }];
};

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { organiserid?: string };
}) {
  const user = await getUser(request);
  if (!user) {
    return redirect(`/auth/login?redirectTo=${new URL(request.url).pathname}`);
  }

  const { organiserid } = params;
  if (!organiserid) {
    throw new Response('Organiser ID is required', { status: 400 });
  }

  const parsed = parseSlug(organiserid);
  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const { id: slugId } = parsed;
  const serverClient = await createServerClient(request);
  const organiser = await serverClient.organiser.get.query({ id: slugId });

  if (!organiser) {
    throw new Response('Organiser not found', { status: 404 });
  }

  const activeEdit = await serverClient.edit.getActiveEditForEntity.query({
    entityType: EditEntityTypes.ORGANISER,
    entityId: organiser.id,
  });

  if (activeEdit?.status === EditStatus.SUBMITTED) {
    return redirect(`/my-edits?editId=${activeEdit.id}`);
  }

  return data({ organiser, user, activeEdit });
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { organiserid?: string };
}) {
  const user = await getUser(request);
  if (!user) {
    return redirect('/auth/login');
  }

  const { organiserid } = params;
  if (!organiserid) {
    return data({ error: 'Organiser ID is required' }, { status: 400 });
  }

  const parsed = parseSlug(organiserid);
  if (!parsed) {
    return data({ error: 'Invalid URL format' }, { status: 400 });
  }

  const { id: slugId } = parsed;
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  const serverClient = await createServerClient(request);
  const organiser = await serverClient.organiser.get.query({ id: slugId });

  if (!organiser) {
    return data({ error: 'Organiser not found' }, { status: 404 });
  }

  const name = (formData.get('name') as string) || '';
  const organisationType = ((formData.get('organisationType') as string) || '').trim();
  const foundedYearRaw = (formData.get('foundedYear') as string) || '';
  const foundedYear = foundedYearRaw ? Number.parseInt(foundedYearRaw) || undefined : undefined;
  const description = ((formData.get('description') as string) || '').trim();
  const logoUrl = ((formData.get('logoUrl') as string) || '').trim();
  const logoUploadId = ((formData.get('logoUploadId') as string) || '').trim();
  const tags = formData.getAll('tags') as string[];
  const city = ((formData.get('city') as string) || '').trim();
  const street = (formData.get('street') as string) || '';
  const addrCity = (formData.get('addrCity') as string) || '';
  const state = (formData.get('state') as string) || '';
  const postalCode = (formData.get('postalCode') as string) || '';
  const country = (formData.get('country') as string) || '';
  const phone = ((formData.get('phone') as string) || '').trim();
  const email = ((formData.get('email') as string) || '').trim();
  const website = ((formData.get('website') as string) || '').trim();
  const venueName = ((formData.get('venueName') as string) || '').trim();
  const venueId = ((formData.get('venueId') as string) || '').trim();
  const socialLinkPlatforms = formData.getAll('socialLinkPlatform') as string[];
  const socialLinkUrls = formData.getAll('socialLinkUrl') as string[];
  const socialLinks = socialLinkPlatforms
    .map((platform, i) => ({ platform: platform.trim(), url: (socialLinkUrls[i] || '').trim() }))
    .filter((sl) => sl.platform && sl.url);
  const userNote = formData.get('userNote') as string;

  const proposedValues: Record<string, unknown> = {};

  if (name !== (organiser.name || '')) proposedValues.name = name;
  if (organisationType !== (organiser.organisationType || ''))
    proposedValues.organisationType = organisationType || undefined;
  if (foundedYear !== organiser.foundedYear) proposedValues.foundedYear = foundedYear;
  if (description !== (organiser.description || ''))
    proposedValues.description = description || undefined;
  if (logoUrl && logoUrl !== (organiser.logoUrl || '')) {
    proposedValues.logoUrl = logoUrl;
    if (logoUploadId) proposedValues.logoUploadId = logoUploadId;
  }

  const sortedNewTags = [...tags].sort();
  const sortedCurrentTags = [...((organiser.tags as string[]) || [])].sort();
  if (JSON.stringify(sortedNewTags) !== JSON.stringify(sortedCurrentTags)) {
    proposedValues.tags = tags;
  }

  if (city !== (organiser.city || '')) proposedValues.city = city || undefined;

  const currentAddress =
    (organiser.address as Record<string, string | undefined> | undefined) || {};
  const newAddress: Record<string, string> = {};
  if (street) newAddress.street = street;
  if (addrCity) newAddress.city = addrCity;
  if (state) newAddress.state = state;
  if (postalCode) newAddress.postalCode = postalCode;
  if (country) newAddress.country = country;

  if (
    street !== (currentAddress.street || '') ||
    addrCity !== (currentAddress.city || '') ||
    state !== (currentAddress.state || '') ||
    postalCode !== (currentAddress.postalCode || '') ||
    country !== (currentAddress.country || '')
  ) {
    proposedValues.address = newAddress;
  }

  if (phone !== (organiser.phone || '')) proposedValues.phone = phone || undefined;
  if (email !== (organiser.email || '')) proposedValues.email = email || undefined;
  if (website !== (organiser.website || '')) proposedValues.website = website || undefined;
  if (venueName !== (organiser.venueName || '')) proposedValues.venueName = venueName || undefined;
  if (venueId !== (organiser.venueId || '')) proposedValues.venueId = venueId || undefined;

  const sortedNewLinks = [...socialLinks].sort((a, b) => a.platform.localeCompare(b.platform));
  const sortedCurrentLinks = [
    ...((organiser.socialLinks as Array<{ platform: string; url: string }>) || []),
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
        entityType: EditEntityTypes.ORGANISER,
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
          redirectUrl: generateOrganiserUrl(name || organiser.name, slugId),
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

const ORGANISER_TAGS = [
  'carnatic',
  'hindustani',
  'bharatanatyam',
  'dance',
  'instrumental',
  'jugalbandi',
  'lecture-demo',
  'music-school',
  'music-competition',
  'award-conferring',
  'publication',
  'free-entry',
  'ticketed',
  'festival-organiser',
  'year-round',
  'charitable',
  'other',
] as const;

const STEP_LABELS = ['About', 'Location & Contact', 'Review'];
const TOTAL_STEPS = 3;

export default function EditOrganiser() {
  const { organiser, activeEdit } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const organiserUrl = generateOrganiserUrl(organiser.name, organiser.id);

  const [step, setStep] = useState(0);

  const proposed = activeEdit?.proposedValues || {};

  type SocialLink = { platform: string; url: string };
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    (proposed.socialLinks as SocialLink[] | undefined) ??
      (organiser.socialLinks as SocialLink[] | undefined) ??
      []
  );
  const proposedAddress = (proposed.address as Record<string, string> | undefined) || {};
  const currentAddress =
    (organiser.address as Record<string, string | undefined> | undefined) || {};
  const currentTags =
    (proposed.tags as string[] | undefined) ?? (organiser.tags as string[] | undefined) ?? [];

  const defaultValues = {
    name: (proposed.name as string | undefined) ?? organiser.name,
    organisationType:
      (proposed.organisationType as string | undefined) ??
      (organiser.organisationType as string | undefined) ??
      '',
    foundedYear:
      (proposed.foundedYear as number | undefined) ??
      (organiser.foundedYear as number | undefined) ??
      '',
    description:
      (proposed.description as string | undefined) ??
      (organiser.description as string | undefined) ??
      '',
    logoUrl:
      (proposed.logoUrl as string | undefined) ?? (organiser.logoUrl as string | undefined) ?? '',
    city: (proposed.city as string | undefined) ?? (organiser.city as string | undefined) ?? '',
    street: proposedAddress.street ?? currentAddress.street ?? '',
    addrCity: proposedAddress.city ?? currentAddress.city ?? '',
    state: proposedAddress.state ?? currentAddress.state ?? '',
    postalCode: proposedAddress.postalCode ?? currentAddress.postalCode ?? '',
    country: proposedAddress.country ?? currentAddress.country ?? '',
    phone:
      (proposed.phone as string | undefined) ?? (organiser.phone as string | undefined) ?? '',
    email:
      (proposed.email as string | undefined) ?? (organiser.email as string | undefined) ?? '',
    website:
      (proposed.website as string | undefined) ?? (organiser.website as string | undefined) ?? '',
    venueName:
      (proposed.venueName as string | undefined) ??
      (organiser.venueName as string | undefined) ??
      '',
    venueId:
      (proposed.venueId as string | undefined) ?? (organiser.venueId as string | undefined) ?? '',
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
      window.location.href = actionData.redirectUrl as string;
    }
  }, [actionData]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: 'Events', path: '/events' },
          { label: organiser.name, path: organiserUrl },
          { label: activeEdit ? 'Continue Editing' : 'Edit', path: '#' },
        ]}
      />

      <div className="mt-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {activeEdit ? 'Continue Editing Organiser' : 'Edit Organiser'}
          </h1>
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
            {activeEdit && <input type="hidden" name="editId" value={activeEdit.id} />}

            {/* Step 0 — About */}
            <div className={step === 0 ? '' : 'hidden'}>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    defaultValue={defaultValues.name}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organisationType">Organisation Type</Label>
                  <Select
                    name="organisationType"
                    defaultValue={defaultValues.organisationType || 'none'}
                  >
                    <SelectTrigger id="organisationType">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      <SelectItem value="sabha">Sabha</SelectItem>
                      <SelectItem value="trust">Trust</SelectItem>
                      <SelectItem value="ngo">NGO</SelectItem>
                      <SelectItem value="temple">Temple</SelectItem>
                      <SelectItem value="university">University</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="foundedYear">Founded Year</Label>
                  <Input
                    id="foundedYear"
                    name="foundedYear"
                    type="number"
                    min={1800}
                    max={2100}
                    defaultValue={defaultValues.foundedYear}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={4}
                    maxLength={5000}
                    placeholder="Describe the organisation..."
                    defaultValue={defaultValues.description}
                  />
                </div>

                <ImageUpload
                  urlFieldName="logoUrl"
                  uploadIdFieldName="logoUploadId"
                  currentUrl={defaultValues.logoUrl}
                  entityType="organiser"
                  label="Organisation Logo"
                />

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">Tags</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {ORGANISER_TAGS.map((tag) => (
                      <label key={tag} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="tags"
                          value={tag}
                          defaultChecked={currentTags.includes(tag)}
                          className="h-4 w-4 rounded border-input"
                        />
                        <span className="text-sm">{tag.replace(/-/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>

            {/* Step 1 — Location & Contact */}
            <div className={step === 1 ? '' : 'hidden'}>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    type="text"
                    maxLength={100}
                    defaultValue={defaultValues.city}
                  />
                </div>

                <fieldset className="space-y-4">
                  <legend className="text-sm font-medium">Address</legend>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="street">Street</Label>
                      <Input
                        id="street"
                        name="street"
                        type="text"
                        defaultValue={defaultValues.street}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addrCity">City</Label>
                      <Input
                        id="addrCity"
                        name="addrCity"
                        type="text"
                        defaultValue={defaultValues.addrCity}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        name="state"
                        type="text"
                        defaultValue={defaultValues.state}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        name="postalCode"
                        type="text"
                        defaultValue={defaultValues.postalCode}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        name="country"
                        type="text"
                        defaultValue={defaultValues.country}
                      />
                    </div>
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      maxLength={30}
                      defaultValue={defaultValues.phone}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={defaultValues.email}
                    />
                  </div>
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
                    <span className="text-sm font-medium">Social Links</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSocialLinks((prev) => [...prev, { platform: '', url: '' }])
                      }
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
                      <Input
                        name="socialLinkPlatform"
                        placeholder="Platform (e.g. YouTube)"
                        value={link.platform}
                        onChange={(e) =>
                          setSocialLinks((prev) =>
                            prev.map((l, j) => (j === i ? { ...l, platform: e.target.value } : l))
                          )
                        }
                        className="flex-1"
                      />
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
                        onClick={() =>
                          setSocialLinks((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="venueName">Primary Venue Name</Label>
                    <Input
                      id="venueName"
                      name="venueName"
                      type="text"
                      placeholder="e.g. Music Academy"
                      defaultValue={defaultValues.venueName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venueId">Venue ID (optional)</Label>
                    <Input
                      id="venueId"
                      name="venueId"
                      type="text"
                      placeholder="Link to venue record"
                      defaultValue={defaultValues.venueId}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 — Review & Submit */}
            <div className={step === 2 ? '' : 'hidden'}>
              <div className="space-y-6">
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
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                {step === 0 ? (
                  <a
                    href={organiserUrl}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                  </a>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {step < TOTAL_STEPS - 1 ? (
                  <Button type="button" variant="default" onClick={() => setStep((s) => s + 1)}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <>
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
                  </>
                )}
              </div>
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
