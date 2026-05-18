import { Calendar, MapPin, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, data, useLoaderData } from 'react-router';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { createServerClient } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { DetailPageHeader } from '~/components/DetailPageHeader';
import { PosterImage } from '~/components/PosterImage';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData, FestivalStructuredData } from '~/components/structured-data';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { getUser } from '~/lib/auth.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import {
  generateEventUrl,
  generateFestivalUrl,
  generateOrganiserUrl,
  parseSlug,
} from '~/lib/url-slug';

interface FestivalDetail {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  posterUrl?: string;
  organiserName?: string;
  organiserId?: string;
  tags?: string[];
  sponsors?: Array<{ name: string; type?: string }>;
  status?: string;
}

interface FestivalEvent {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime?: string;
  venueName?: string;
  artists?: Array<{ title?: string; name: string; role?: string }>;
  tags?: string[];
  entryType?: string;
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const { festivalid } = params;
  if (!festivalid) {
    throw new Response('Festival ID is required', { status: 400 });
  }

  const parsed = parseSlug(festivalid);
  if (!parsed) {
    throw new Response('Festival not found', { status: 404 });
  }
  const { id } = parsed;

  try {
    const user = await getUser(request);
    const serverClient = await createServerClient(request);
    const festival = await serverClient.festival.get.query({ id });

    if (!festival) {
      throw new Response('Festival not found', { status: 410 });
    }

    const events = await serverClient.event.byFestival.query({
      festivalId: id,
      limit: 50,
    });

    return data({
      festival,
      events: events.items,
      user,
      isModerator: user?.role === 'moderator' || user?.role === 'admin',
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.FESTIVAL_NOT_FOUND) {
        throw new Response(error.message, { status: 410 });
      }
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response('Festival not found', { status: 410 });
    }
    console.error('Failed to load festival:', error);
    throw new Response('Failed to load festival', { status: 500 });
  }
};

export const action: ActionFunction = async ({ request, params }) => {
  const { festivalid } = params;
  if (!festivalid) {
    return data({ error: 'Festival ID is required' }, { status: 400 });
  }

  const parsed = parseSlug(festivalid);
  if (!parsed) {
    throw new Response('Festival not found', { status: 404 });
  }
  const { id } = parsed;

  const user = await getUser(request);
  if (!user || (user.role !== 'moderator' && user.role !== 'admin')) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'updatePoster') {
    const posterUrl = formData.get('posterUrl') as string;
    const posterUploadId = formData.get('posterUploadId') as string;

    if (!posterUrl || !posterUploadId) {
      return data({ error: 'Missing poster data' }, { status: 400 });
    }

    try {
      const serverClient = await createServerClient(request);
      await serverClient.festival.updatePoster.mutate({ id, posterUrl, posterUploadId });
      return data({ success: true });
    } catch (error) {
      console.error('Failed to update poster:', error);
      return data({ error: 'Failed to update poster' }, { status: 500 });
    }
  }

  return data({ error: 'Invalid action' }, { status: 400 });
};

export const meta: MetaFunction = ({ data: loaderData }) => {
  const festival = (loaderData as { festival: FestivalDetail } | undefined)?.festival;
  if (!festival) {
    return [{ title: 'Festival Not Found - Rasika.life' }];
  }

  const year = new Date(festival.startDate).getFullYear();
  const title = `${festival.name} ${year} | Rasika.life`;
  const desc =
    festival.description ||
    `${festival.name} ${year} — Indian classical arts festival${festival.organiserName ? ` presented by ${festival.organiserName}` : ''}.`;
  const canonicalUrl = `https://rasika.life${generateFestivalUrl(festival.name, festival.id)}`;

  return [
    { title },
    { name: 'description', content: desc },
    { property: 'og:title', content: `${festival.name} ${year}` },
    { property: 'og:description', content: desc },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:image', content: festival.posterUrl || 'https://rasika.life/og-image.png' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: `${festival.name} ${year}` },
    { name: 'twitter:description', content: desc },
    { name: 'twitter:image', content: festival.posterUrl || 'https://rasika.life/og-image.png' },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
  ];
};

function groupEventsByDate(events: FestivalEvent[]): Map<string, FestivalEvent[]> {
  const groups = new Map<string, FestivalEvent[]>();
  for (const event of events) {
    const dateKey = event.startDateTime.split('T')[0];
    const existing = groups.get(dateKey) || [];
    existing.push(event);
    groups.set(dateKey, existing);
  }
  return new Map([...groups.entries()].sort());
}

function PosterUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setStatus('uploading');
    setError(null);

    try {
      const urlRes = await fetch('/events/new/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          intent: 'getUploadUrl',
          fileName: file.name,
          contentType: file.type,
        }),
      });
      if (!urlRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, posterUrl, posterUploadId } = await urlRes.json();

      const s3Res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!s3Res.ok) throw new Error('Failed to upload image');

      const updateForm = new FormData();
      updateForm.append('intent', 'updatePoster');
      updateForm.append('posterUrl', posterUrl);
      updateForm.append('posterUploadId', posterUploadId);

      const updateRes = await fetch(window.location.href, {
        method: 'POST',
        body: updateForm,
        credentials: 'include',
      });
      if (!updateRes.ok) throw new Error('Failed to update poster');

      window.location.reload();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 mt-4">
      <h3 className="text-sm font-semibold">Replace Poster</h3>
      <input
        type="file"
        accept="image/*"
        onChange={e => setFile(e.target.files?.[0] ?? null)}
        className="text-sm w-full"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={handleUpload}
        disabled={!file || status === 'uploading'}
      >
        <Upload className="h-4 w-4 mr-2" />
        {status === 'uploading' ? 'Uploading...' : 'Replace Poster'}
      </Button>
    </div>
  );
}

export default function FestivalDetail() {
  const { festival, events, user, isModerator } = useLoaderData<{
    festival: FestivalDetail;
    events: FestivalEvent[];
    user: { id: string; role: string } | null;
    isModerator: boolean;
  }>();

  const groupedEvents = groupEventsByDate(events);
  const startDateStr = new Date(festival.startDate).toLocaleDateString('en-IN', {
    dateStyle: 'long',
  });
  const endDateStr =
    festival.startDate !== festival.endDate
      ? new Date(festival.endDate).toLocaleDateString('en-IN', { dateStyle: 'long' })
      : null;
  const dateRangeStr = endDateStr ? `${startDateStr} – ${endDateStr}` : startDateStr;
  const shareUrl = `https://rasika.life${generateFestivalUrl(festival.name, festival.id)}`;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumb
        items={[
          { label: 'Festivals', path: '/festivals' },
          { label: festival.name, path: '#' },
        ]}
      />

      <DetailPageHeader
        title={festival.name}
        subtitle={dateRangeStr}
        shareUrl={shareUrl}
        shareTitle={festival.name}
        shareDescription={`${festival.name} – ${dateRangeStr}`}
        editUrl={
          user && festival.status === 'approved'
            ? `${generateFestivalUrl(festival.name, festival.id)}/edit`
            : undefined
        }
        isModerator={isModerator}
        requestDeletionUrl={`/moderator/request-deletion?entityType=festival&entityId=${festival.id}`}
      />

      <div className="grid md:grid-cols-[300px_1fr] gap-8">
        {(festival.posterUrl || isModerator) && (
          <div>
            {festival.posterUrl && (
              <PosterImage
                posterUrl={festival.posterUrl}
                alt={`${festival.name} poster`}
                className="w-full rounded-lg shadow-md"
                loading="eager"
                width={300}
                height={400}
              />
            )}
            {isModerator && <PosterUploader />}
          </div>
        )}

        <div className="space-y-4">
          {festival.description && <p className="text-muted-foreground">{festival.description}</p>}

          <div className="flex items-center gap-2 text-foreground">
            <Calendar className="h-5 w-5 text-primary" />
            <span>
              {new Date(festival.startDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}
              {festival.startDate !== festival.endDate && (
                <>
                  {' - '}
                  {new Date(festival.endDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                </>
              )}
            </span>
          </div>

          {festival.organiserName && (
            <p className="text-muted-foreground">
              Organised by{' '}
              {festival.organiserId ? (
                <Link
                  to={generateOrganiserUrl(festival.organiserName, festival.organiserId)}
                  className="text-primary"
                >
                  {festival.organiserName}
                </Link>
              ) : (
                <span className="font-medium">{festival.organiserName}</span>
              )}
            </p>
          )}

          {festival.tags && festival.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {festival.tags.map(tag => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Schedule */}
      <section className="mt-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-heading">Schedule</h2>
          {user && (
            <Button asChild size="sm">
              <Link
                to={`/events/new?festivalId=${festival.id}&festivalName=${encodeURIComponent(festival.name)}`}
              >
                <Upload className="h-4 w-4 mr-2" />
                Add Events
              </Link>
            </Button>
          )}
        </div>

        {events.length === 0 ? (
          <EmptyState message="No events scheduled yet." />
        ) : (
          <div className="space-y-8">
            {[...groupedEvents.entries()].map(([dateKey, dayEvents]) => (
              <div key={dateKey}>
                <h3 className="font-semibold text-lg mb-3 border-b pb-2">
                  {new Date(dateKey).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                <div className="space-y-3">
                  {dayEvents
                    .sort(
                      (a, b) =>
                        new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
                    )
                    .map(event => (
                      <Link
                        key={event.id}
                        to={generateEventUrl(event.title, event.id)}
                        className="block no-underline"
                      >
                        <Card className="hover:border-primary/50 transition-colors">
                          <CardContent className="py-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-foreground">{event.title}</p>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                  <span>
                                    {new Date(event.startDateTime).toLocaleTimeString('en-IN', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    })}
                                    {event.endDateTime &&
                                      ` - ${new Date(event.endDateTime).toLocaleTimeString(
                                        'en-IN',
                                        {
                                          hour: 'numeric',
                                          minute: '2-digit',
                                        }
                                      )}`}
                                  </span>
                                  {event.venueName && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {event.venueName}
                                    </span>
                                  )}
                                </div>
                                {event.artists && event.artists.length > 0 && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {event.artists
                                      .map(a => `${a.title ? `${a.title} ` : ''}${a.name}`)
                                      .join(', ')}
                                  </p>
                                )}
                              </div>
                              {event.entryType && (
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {event.entryType}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sponsors */}
      {festival.sponsors && festival.sponsors.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Sponsors</h2>
          <div className="flex gap-2 flex-wrap">
            {festival.sponsors.map(sponsor => (
              <Badge key={sponsor.name} variant="outline">
                {sponsor.name}
                {sponsor.type && ` (${sponsor.type})`}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Festivals', item: 'https://rasika.life/festivals' },
          {
            name: festival.name,
            item: `https://rasika.life${generateFestivalUrl(festival.name, festival.id)}`,
          },
        ]}
      />
      <FestivalStructuredData
        festival={{
          name: festival.name,
          description: festival.description,
          startDate: festival.startDate,
          endDate: festival.endDate,
          organiserName: festival.organiserName,
          posterUrl: festival.posterUrl,
          url: `https://rasika.life${generateFestivalUrl(festival.name, festival.id)}`,
        }}
      />
    </main>
  );
}
