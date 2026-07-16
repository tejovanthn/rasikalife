import { VENUE_AMENITIES } from '@rasika/core/domain/venue/client';
import { Loader2, Plus } from 'lucide-react';
import type { MetaFunction } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
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
import { requireModerator } from '~/lib/auth.server';
import { generateVenueUrl } from '~/lib/url-slug';

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex, nofollow' }];
};

export async function loader({ request }: { request: Request }) {
  const user = await requireModerator(request);
  return data({ user });
}

export async function action({ request }: { request: Request }) {
  await requireModerator(request);

  const formData = await request.formData();

  const name = (formData.get('name') as string | null)?.trim();
  if (!name) {
    return data({ error: 'Name is required' }, { status: 400 });
  }

  const street = (formData.get('street') as string | null)?.trim() || undefined;
  const city = (formData.get('city') as string | null)?.trim() || undefined;
  const state = (formData.get('state') as string | null)?.trim() || undefined;
  const postalCode = (formData.get('postalCode') as string | null)?.trim() || undefined;
  const country = (formData.get('country') as string | null)?.trim() || undefined;
  const mapLink = (formData.get('mapLink') as string | null)?.trim() || undefined;
  const capacityRaw = (formData.get('capacity') as string | null)?.trim();
  const capacity = capacityRaw ? Number.parseInt(capacityRaw, 10) || undefined : undefined;
  const website = (formData.get('website') as string | null)?.trim() || undefined;
  const phone = (formData.get('phone') as string | null)?.trim() || undefined;
  const email = (formData.get('email') as string | null)?.trim() || undefined;
  const description = (formData.get('description') as string | null)?.trim() || undefined;
  const nearestTransit = (formData.get('nearestTransit') as string | null)?.trim() || undefined;
  const foundedYearRaw = (formData.get('foundedYear') as string | null)?.trim();
  const foundedYear = foundedYearRaw ? Number.parseInt(foundedYearRaw, 10) || undefined : undefined;
  const photoUrl = (formData.get('photoUrl') as string | null)?.trim() || undefined;
  const photoUploadId = (formData.get('photoUploadId') as string | null)?.trim() || undefined;
  const amenities = formData.getAll('amenities') as string[];

  const venueTypeRaw = formData.get('venueType') as string | null;
  const venueType =
    venueTypeRaw && venueTypeRaw !== 'none'
      ? (venueTypeRaw as
          | 'auditorium'
          | 'sabha-hall'
          | 'temple-hall'
          | 'open-air'
          | 'pandal'
          | 'terrace'
          | 'community-hall'
          | 'heritage-building'
          | 'university'
          | 'other')
      : undefined;

  const address =
    street || city || state || postalCode || country
      ? { street, city, state, postalCode, country }
      : undefined;

  try {
    const serverClient = await createServerClient(request);
    const venue = await serverClient.venue.create.mutate({
      name,
      venueType,
      address,
      mapLink,
      capacity,
      website,
      phone,
      email,
      description,
      nearestTransit,
      foundedYear,
      photoUrl,
      photoUploadId,
      amenities:
        amenities.length > 0
          ? (amenities as (
              | 'ac'
              | 'parking'
              | 'floor-seating'
              | 'chair-seating'
              | 'green-room'
              | 'canteen'
              | 'wheelchair-accessible'
              | 'hearing-loop'
              | 'elevator'
              | 'restrooms'
              | 'metro-nearby'
              | 'bus-stop-nearby'
              | 'sound-system'
              | 'live-streaming'
              | 'library'
              | 'other'
            )[])
          : undefined,
    });

    return redirect(generateVenueUrl(venue.name, venue.id));
  } catch (error) {
    console.error('Failed to create venue:', error);
    return data({ error: 'Failed to create venue. Please try again.' }, { status: 500 });
  }
}

export default function NewVenue() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: 'Venues', path: '/venues' },
          { label: 'New Venue', path: '#' },
        ]}
      />

      <div className="mt-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">Create New Venue</h1>
          <span className="text-sm text-muted-foreground">{user.role}</span>
        </div>

        <div className="bg-card rounded-lg shadow-sm border p-6">
          <Form method="post" className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" type="text" required maxLength={200} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venueType">Venue Type</Label>
              <Select name="venueType">
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
                <Input id="foundedYear" name="foundedYear" type="number" min={1800} max={2100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input id="capacity" name="capacity" type="number" min={1} />
              </div>
            </div>

            <fieldset className="space-y-4">
              <legend className="text-sm font-medium">Address</legend>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="street">Street</Label>
                  <Input id="street" name="street" type="text" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" type="text" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" name="state" type="text" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input id="postalCode" name="postalCode" type="text" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" name="country" type="text" />
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nearestTransit">Nearest Transit</Label>
              <Input
                id="nearestTransit"
                name="nearestTransit"
                type="text"
                placeholder="e.g. Chennai Central (0.5 km)"
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" maxLength={30} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" type="url" placeholder="https://..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                rows={4}
                maxLength={5000}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Describe the venue..."
              />
            </div>

            <ImageUpload
              urlFieldName="photoUrl"
              uploadIdFieldName="photoUploadId"
              entityType="venue"
              label="Venue Photo"
            />

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Amenities</legend>
              <div className="grid grid-cols-2 gap-2">
                {VENUE_AMENITIES.map(amenity => (
                  <label key={amenity} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="amenities"
                      value={amenity}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="text-sm">{amenity.replace(/-/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {actionData && 'error' in actionData && (
              <p className="text-sm text-destructive">{actionData.error as string}</p>
            )}

            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <a
                href="/venues"
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </a>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Venue
                  </>
                )}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
