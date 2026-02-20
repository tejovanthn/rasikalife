import { EditEntityTypes, EditStatus } from '@rasika/core/domain/edit/client';
import { ArrowLeft, Loader2, Pencil, Save } from 'lucide-react';
import { useEffect } from 'react';
import type { MetaFunction } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import { toast } from 'sonner';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
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
  const street = formData.get('street') as string;
  const city = formData.get('city') as string;
  const state = formData.get('state') as string;
  const postalCode = formData.get('postalCode') as string;
  const country = formData.get('country') as string;
  const mapLink = formData.get('mapLink') as string;
  const userNote = formData.get('userNote') as string;

  const proposedValues: Record<string, unknown> = {};

  if (name !== (venue.name || '')) proposedValues.name = name;

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

export default function EditVenue() {
  const { venue, activeEdit } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const venueUrl = generateVenueUrl(venue.name, venue.id);

  const proposed = activeEdit?.proposedValues || {};
  const proposedAddress = (proposed.address as Record<string, string> | undefined) || {};
  const currentAddress = (venue.address as Record<string, string | undefined> | undefined) || {};

  const defaultValues = {
    name: (proposed.name as string | undefined) || venue.name,
    street: proposedAddress.street ?? currentAddress.street ?? '',
    city: proposedAddress.city ?? currentAddress.city ?? '',
    state: proposedAddress.state ?? currentAddress.state ?? '',
    postalCode: proposedAddress.postalCode ?? currentAddress.postalCode ?? '',
    country: proposedAddress.country ?? currentAddress.country ?? '',
    mapLink:
      (proposed.mapLink as string | undefined) ?? (venue.mapLink as string | undefined) ?? '',
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
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <Form method="post" className="space-y-6">
            {activeEdit && <input type="hidden" name="editId" value={activeEdit.id} />}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" type="text" defaultValue={defaultValues.name} required />
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
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" type="text" defaultValue={defaultValues.city} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" name="state" type="text" defaultValue={defaultValues.state} />
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
              <Label htmlFor="userNote">Edit Note (optional)</Label>
              <textarea
                id="userNote"
                name="userNote"
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Explain the changes you're making..."
                defaultValue={defaultValues.userNote}
              />
            </div>

            {actionData && 'error' in actionData && (
              <p className="text-sm text-destructive">{actionData.error as string}</p>
            )}

            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <a
                href={venueUrl}
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
