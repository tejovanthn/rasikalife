import { Loader2, Plus } from 'lucide-react';
import type { MetaFunction } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { ImageUpload } from '~/components/ImageUpload';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { requireModerator } from '~/lib/auth.server';
import { generateArtistUrl } from '~/lib/url-slug';

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

  const title = (formData.get('title') as string | null)?.trim() || undefined;
  const instrument = (formData.get('instrument') as string | null)?.trim() || undefined;
  const city = (formData.get('city') as string | null)?.trim() || undefined;
  const biography = (formData.get('biography') as string | null)?.trim() || undefined;
  const birthPlace = (formData.get('birthPlace') as string | null)?.trim() || undefined;
  const activeYears = (formData.get('activeYears') as string | null)?.trim() || undefined;
  const website = (formData.get('website') as string | null)?.trim() || undefined;
  const photoUrl = (formData.get('photoUrl') as string | null)?.trim() || undefined;
  const photoUploadId = (formData.get('photoUploadId') as string | null)?.trim() || undefined;
  const isGroup = formData.get('isGroup') === 'on';

  const birthYearRaw = (formData.get('birthYear') as string | null)?.trim();
  const birthYear = birthYearRaw ? Number.parseInt(birthYearRaw, 10) || undefined : undefined;
  const practiceStartYearRaw = (formData.get('practiceStartYear') as string | null)?.trim();
  const practiceStartYear = practiceStartYearRaw
    ? Number.parseInt(practiceStartYearRaw, 10) || undefined
    : undefined;
  const debutYearRaw = (formData.get('debutYear') as string | null)?.trim();
  const debutYear = debutYearRaw ? Number.parseInt(debutYearRaw, 10) || undefined : undefined;

  const specialisationsRaw = (formData.get('specialisations') as string | null)?.trim();
  const specialisations = specialisationsRaw
    ? specialisationsRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : undefined;

  try {
    const serverClient = await createServerClient(request);
    const artist = await serverClient.artist.create.mutate({
      name,
      title,
      instrument,
      city,
      biography,
      specialisations,
      birthYear,
      birthPlace,
      practiceStartYear,
      debutYear,
      activeYears,
      website,
      photoUrl,
      photoUploadId,
      isGroup,
    });

    return redirect(generateArtistUrl(artist.name, artist.id));
  } catch (error) {
    console.error('Failed to create artist:', error);
    return data({ error: 'Failed to create artist. Please try again.' }, { status: 500 });
  }
}

export default function NewArtist() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: 'Artists', path: '/artists' },
          { label: 'New Artist', path: '#' },
        ]}
      />

      <div className="mt-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">Create New Artist</h1>
          <span className="text-sm text-muted-foreground">{user.role}</span>
        </div>

        <div className="bg-card rounded-lg shadow-sm border p-6">
          <Form method="post" className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" type="text" required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title / Honorific</Label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  placeholder="e.g. Dr., Vidushi, Pandit"
                  maxLength={50}
                />
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" name="isGroup" className="mt-1 h-4 w-4 rounded border-input" />
              <span className="text-sm">
                This is a group, not an individual — e.g. Saralaya Sisters or Ganesh Kumaresh.
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
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" type="text" maxLength={200} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="biography">Biography</Label>
              <textarea
                id="biography"
                name="biography"
                rows={4}
                maxLength={10000}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="About the artist..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialisations">Specialisations</Label>
              <Input
                id="specialisations"
                name="specialisations"
                type="text"
                placeholder="Comma-separated, e.g. Vocal, Veena"
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthPlace">Birth Place</Label>
                <Input
                  id="birthPlace"
                  name="birthPlace"
                  type="text"
                  placeholder="e.g. Chennai, Tamil Nadu"
                  maxLength={200}
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="debutYear">Debut Year</Label>
                <Input id="debutYear" name="debutYear" type="number" min={1800} max={2100} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activeYears">Active Years</Label>
              <Input
                id="activeYears"
                name="activeYears"
                type="text"
                placeholder="e.g. 1970–present"
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" type="url" placeholder="https://..." />
            </div>

            <ImageUpload
              urlFieldName="photoUrl"
              uploadIdFieldName="photoUploadId"
              entityType="artist"
              label="Artist Photo"
            />

            <p className="text-sm text-muted-foreground">
              Gurus, social links and collaborators are added later, from the artist's edit screen.
            </p>

            {actionData && 'error' in actionData && (
              <p className="text-sm text-destructive">{actionData.error as string}</p>
            )}

            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <a
                href="/artists"
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
                    Create Artist
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
