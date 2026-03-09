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
import { generateVenueUrl, parseSlug } from '~/lib/url-slug';

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex, nofollow' }];
};

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { venueid?: string };
}) {
  const user = await getUser(request);
  if (!user) {
    return redirect(`/auth/login?redirectTo=${new URL(request.url).pathname}`);
  }

  const { venueid } = params;
  if (!venueid) {
    throw new Response('Venue ID is required', { status: 400 });
  }

  const parsed = parseSlug(venueid);
  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const { id: slugId } = parsed;
  const serverClient = await createServerClient(request);
  const venue = await serverClient.venue.get.query({ id: slugId });

  if (!venue) {
    throw new Response('Venue not found', { status: 404 });
  }

  const activeEdit = await serverClient.edit.getActiveEditForEntity.query({
    entityType: EditEntityTypes.VENUE,
    entityId: venue.id,
  });

  if (activeEdit?.status === EditStatus.SUBMITTED) {
    return redirect(`/my-edits?editId=${activeEdit.id}`);
  }

  return data({ venue, user, activeEdit });
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { venueid?: string };
}) {
  const user = await getUser(request);
  if (!user) {
    return redirect('/auth/login');
  }

  const { venueid } = params;
  if (!venueid) {
    return data({ error: 'Venue ID is required' }, { status: 400 });
  }

  const parsed = parseSlug(venueid);
  if (!parsed) {
    return data({ error: 'Invalid URL format' }, { status: 400 });
  }

  const { id: slugId } = parsed;
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  const serverClient = await createServerClient(request);
  const venue = await serverClient.venue.get.query({ id: slugId });

  if (!venue) {
    return data({ error: 'Venue not found' }, { status: 404 });
  }

  const name = formData.get('name') as string;
  const venueType = ((formData.get('venueType') as string) || '').trim();
  const foundedYearRaw = (formData.get('foundedYear') as string) || '';
  const foundedYear = foundedYearRaw ? Number.parseInt(foundedYearRaw) || undefined : undefined;
  const capacityRaw = (formData.get('capacity') as string) || '';
  const capacity = capacityRaw ? Number.parseInt(capacityRaw) || undefined : undefined;
  const description = ((formData.get('description') as string) || '').trim();
  const photoUrl = ((formData.get('photoUrl') as string) || '').trim();
  const photoUploadId = ((formData.get('photoUploadId') as string) || '').trim();
  const street = (formData.get('street') as string) || '';
  const city = (formData.get('city') as string) || '';
  const state = (formData.get('state') as string) || '';
  const postalCode = (formData.get('postalCode') as string) || '';
  const country = (formData.get('country') as string) || '';
  const mapLink = ((formData.get('mapLink') as string) || '').trim();
  const nearestTransit = ((formData.get('nearestTransit') as string) || '').trim();
  const phone = ((formData.get('phone') as string) || '').trim();
  const email = ((formData.get('email') as string) || '').trim();
  const website = ((formData.get('website') as string) || '').trim();
  const amenities = formData.getAll('amenities') as string[];
  const socialLinkPlatforms = formData.getAll('socialLinkPlatform') as string[];
  const socialLinkUrls = formData.getAll('socialLinkUrl') as string[];
  const socialLinks = socialLinkPlatforms
    .map((platform, i) => ({ platform: platform.trim(), url: (socialLinkUrls[i] || '').trim() }))
    .filter((sl) => sl.platform && sl.url);
  const userNote = formData.get('userNote') as string;

  const proposedValues: Record<string, unknown> = {};

  if (name !== (venue.name || '')) proposedValues.name = name;
  if (venueType !== (venue.venueType || '')) proposedValues.venueType = venueType || undefined;
  if (foundedYear !== venue.foundedYear) proposedValues.foundedYear = foundedYear;
  if (capacity !== venue.capacity) proposedValues.capacity = capacity;
  if (description !== (venue.description || '')) proposedValues.description = description || undefined;
  if (photoUrl && photoUrl !== (venue.photoUrl || '')) {
    proposedValues.photoUrl = photoUrl;
    if (photoUploadId) proposedValues.photoUploadId = photoUploadId;
  }

  const currentAddress = (venue.address as Record<string, string | undefined> | undefined) || {};
  const newAddress: Record<string, string> = {};
  if (street) newAddress.street = street;
  if (city) newAddress.city = city;
  if (state) newAddress.state = state;
  if (postalCode) newAddress.postalCode = postalCode;
  if (country) newAddress.country = country;

  if (
    street !== (currentAddress.street || '') ||
    city !== (currentAddress.city || '') ||
    state !== (currentAddress.state || '') ||
    postalCode !== (currentAddress.postalCode || '') ||
    country !== (currentAddress.country || '')
  ) {
    proposedValues.address = newAddress;
  }

  if (mapLink !== (venue.mapLink || '')) proposedValues.mapLink = mapLink || undefined;
  if (nearestTransit !== (venue.nearestTransit || ''))
    proposedValues.nearestTransit = nearestTransit || undefined;
  if (phone !== (venue.phone || '')) proposedValues.phone = phone || undefined;
  if (email !== (venue.email || '')) proposedValues.email = email || undefined;
  if (website !== (venue.website || '')) proposedValues.website = website || undefined;

  const sortedNew = [...amenities].sort();
  const sortedCurrent = [...((venue.amenities as string[]) || [])].sort();
  if (JSON.stringify(sortedNew) !== JSON.stringify(sortedCurrent)) {
    proposedValues.amenities = amenities;
  }

  const sortedNewLinks = [...socialLinks].sort((a, b) => a.platform.localeCompare(b.platform));
  const sortedCurrentLinks = [
    ...((venue.socialLinks as Array<{ platform: string; url: string }>) || []),
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
        entityType: EditEntityTypes.VENUE,
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
          redirectUrl: generateVenueUrl(name || venue.name, slugId),
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

const VENUE_AMENITIES = [
  'ac',
  'parking',
  'floor-seating',
  'chair-seating',
  'green-room',
  'canteen',
  'wheelchair-accessible',
  'hearing-loop',
  'elevator',
  'restrooms',
  'metro-nearby',
  'bus-stop-nearby',
  'sound-system',
  'live-streaming',
  'library',
  'other',
] as const;

const STEP_LABELS = ['About', 'Location', 'Contact & Facilities', 'Review'];
const TOTAL_STEPS = 4;

export default function EditVenue() {
  const { venue, activeEdit } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const venueUrl = generateVenueUrl(venue.name, venue.id);

  const [step, setStep] = useState(0);

  const proposed = activeEdit?.proposedValues || {};

  type SocialLink = { platform: string; url: string };
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    (proposed.socialLinks as SocialLink[] | undefined) ??
      (venue.socialLinks as SocialLink[] | undefined) ??
      []
  );
  const proposedAddress = (proposed.address as Record<string, string> | undefined) || {};
  const currentAddress = (venue.address as Record<string, string | undefined> | undefined) || {};
  const currentAmenities =
    (proposed.amenities as string[] | undefined) ?? (venue.amenities as string[] | undefined) ?? [];

  const defaultValues = {
    name: (proposed.name as string | undefined) ?? venue.name,
    venueType: (proposed.venueType as string | undefined) ?? (venue.venueType as string | undefined) ?? '',
    foundedYear:
      (proposed.foundedYear as number | undefined) ?? (venue.foundedYear as number | undefined) ?? '',
    capacity:
      (proposed.capacity as number | undefined) ?? (venue.capacity as number | undefined) ?? '',
    description:
      (proposed.description as string | undefined) ?? (venue.description as string | undefined) ?? '',
    photoUrl: (proposed.photoUrl as string | undefined) ?? (venue.photoUrl as string | undefined) ?? '',
    street: proposedAddress.street ?? currentAddress.street ?? '',
    city: proposedAddress.city ?? currentAddress.city ?? '',
    state: proposedAddress.state ?? currentAddress.state ?? '',
    postalCode: proposedAddress.postalCode ?? currentAddress.postalCode ?? '',
    country: proposedAddress.country ?? currentAddress.country ?? '',
    mapLink:
      (proposed.mapLink as string | undefined) ?? (venue.mapLink as string | undefined) ?? '',
    nearestTransit:
      (proposed.nearestTransit as string | undefined) ??
      (venue.nearestTransit as string | undefined) ??
      '',
    phone: (proposed.phone as string | undefined) ?? (venue.phone as string | undefined) ?? '',
    email: (proposed.email as string | undefined) ?? (venue.email as string | undefined) ?? '',
    website: (proposed.website as string | undefined) ?? (venue.website as string | undefined) ?? '',
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
          { label: venue.name, path: venueUrl },
          { label: activeEdit ? 'Continue Editing' : 'Edit', path: '#' },
        ]}
      />

      <div className="mt-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {activeEdit ? 'Continue Editing Venue' : 'Edit Venue'}
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
                  <Label htmlFor="venueType">Venue Type</Label>
                  <Select name="venueType" defaultValue={defaultValues.venueType || 'none'}>
                    <SelectTrigger id="venueType">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      <SelectItem value="auditorium">Auditorium</SelectItem>
                      <SelectItem value="sabha-hall">Sabha Hall</SelectItem>
                      <SelectItem value="temple-hall">Temple Hall</SelectItem>
                      <SelectItem value="open-air">Open Air</SelectItem>
                      <SelectItem value="pandal">Pandal</SelectItem>
                      <SelectItem value="terrace">Terrace</SelectItem>
                      <SelectItem value="community-hall">Community Hall</SelectItem>
                      <SelectItem value="heritage-building">Heritage Building</SelectItem>
                      <SelectItem value="university">University</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input
                      id="capacity"
                      name="capacity"
                      type="number"
                      min={1}
                      defaultValue={defaultValues.capacity}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={4}
                    maxLength={5000}
                    placeholder="Describe the venue..."
                    defaultValue={defaultValues.description}
                  />
                </div>

                <ImageUpload
                  urlFieldName="photoUrl"
                  uploadIdFieldName="photoUploadId"
                  currentUrl={defaultValues.photoUrl}
                  entityType="venue"
                  label="Venue Photo"
                />
              </div>
            </div>

            {/* Step 1 — Location */}
            <div className={step === 1 ? '' : 'hidden'}>
              <div className="space-y-6">
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
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        name="city"
                        type="text"
                        defaultValue={defaultValues.city}
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

                <div className="space-y-2">
                  <Label htmlFor="mapLink">Map Link</Label>
                  <Input
                    id="mapLink"
                    name="mapLink"
                    type="url"
                    placeholder="https://maps.google.com/..."
                    defaultValue={defaultValues.mapLink}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nearestTransit">Nearest Transit</Label>
                  <Input
                    id="nearestTransit"
                    name="nearestTransit"
                    type="text"
                    placeholder="e.g. Chennai Central (0.5 km)"
                    defaultValue={defaultValues.nearestTransit}
                    maxLength={200}
                  />
                </div>
              </div>
            </div>

            {/* Step 2 — Contact & Facilities */}
            <div className={step === 2 ? '' : 'hidden'}>
              <div className="space-y-6">
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

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">Amenities</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {VENUE_AMENITIES.map((amenity) => (
                      <label key={amenity} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="amenities"
                          value={amenity}
                          defaultChecked={currentAmenities.includes(amenity)}
                          className="h-4 w-4 rounded border-input"
                        />
                        <span className="text-sm">{amenity.replace(/-/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>

            {/* Step 3 — Review & Submit */}
            <div className={step === 3 ? '' : 'hidden'}>
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
                    href={venueUrl}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                  </a>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep((s) => s - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {step < TOTAL_STEPS - 1 ? (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => setStep((s) => s + 1)}
                  >
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
