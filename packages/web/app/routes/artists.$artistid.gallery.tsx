import { type HeadersFunction, type LoaderFunction, type MetaFunction, data } from 'react-router';
import { Link, useLoaderData, useParams, useSearchParams } from 'react-router';
// Unauthenticated client: this subroute renders only public photos and carries no
// per-viewer chrome, so it is safe to fetch without a session and to cache publicly.
// If listPhotos ever gains moderator-only unpublished photos, switch to the authed client
// and make the caching conditional like the profile index.
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { generateArtistUrl, parseSlug } from '~/lib/url-slug';

interface GalleryPhoto {
  id: string;
  imageUrl: string;
  caption?: string;
  credit?: string;
}

// Public content, identical for every viewer — safe to cache at the edge unconditionally.
export const headers: HeadersFunction = () => ({
  'Cache-Control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=600',
});

export const meta: MetaFunction = ({ data }) => {
  const loaderData = data as
    | { artist: { id: string; name: string; isGroup?: boolean } }
    | undefined;
  if (!loaderData) return [{ title: 'Gallery - Rasika.life' }];
  const { artist } = loaderData;
  const canonicalUrl = `https://rasika.life${generateArtistUrl(artist.name, artist.id)}/gallery`;
  const noun = artist.isGroup ? 'a performing group' : 'an artist';
  return [
    { title: `Photos of ${artist.name} - Rasika.life` },
    {
      name: 'description',
      content: `Browse photographs of ${artist.name}, ${noun} in Indian classical music.`,
    },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
  ];
};

export const loader: LoaderFunction = async ({ params, request }) => {
  const { artistid } = params;

  if (!artistid) {
    throw new Response('Artist ID is required', { status: 400 });
  }

  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');

  const parsed = parseSlug(artistid);

  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  try {
    const artist = await client.artist.get.query({ id: parsed.id });
    if (!artist) {
      throw new Response('Artist not found', { status: 404 });
    }

    const result = await client.artist.listPhotos.query({
      artistId: artist.id,
      limit: 24,
      nextToken: nextToken || undefined,
    });

    return data({
      artist,
      photos: result.items,
      hasMore: result.hasMore,
      nextToken: result.nextToken,
      prevToken: nextToken,
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('Failed to load artist gallery:', error);
    if (error instanceof ApplicationError && error.code === ErrorCode.ARTIST_NOT_FOUND) {
      throw new Response(error.message, { status: 404 });
    }
    if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
      throw new Response('Artist not found', { status: 404 });
    }
    throw new Response('Failed to load gallery', { status: 500 });
  }
};

export default function ArtistGallery() {
  const { artistid } = useParams();

  const { artist, photos, hasMore, nextToken } = useLoaderData<{
    artist: { id: string; name: string };
    photos: GalleryPhoto[];
    hasMore: boolean;
    nextToken: string | null;
    prevToken: string | null;
  }>();

  const [searchParams] = useSearchParams();
  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <Link
          to={`/artists/${artistid}`}
          className="mb-2 inline-block text-primary hover:underline"
        >
          &larr; Back to {artist.name}
        </Link>
        <h1 className="text-3xl font-bold">Photos of {artist.name}</h1>
      </div>
      {!photos.length ? (
        <EmptyState
          message="No photos found"
          description={`${artist.name} doesn't have any photos in our database yet.`}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {photos.map(photo => (
              <figure key={photo.id} className="overflow-hidden rounded-lg border">
                <img
                  src={photo.imageUrl}
                  alt={photo.caption ?? artist.name}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
                {(photo.caption || photo.credit) && (
                  <figcaption className="px-2 py-1 text-xs text-muted-foreground">
                    {photo.caption}
                    {photo.credit ? (
                      <span className="block text-[0.7rem]">© {photo.credit}</span>
                    ) : null}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>

          <EntityPagination
            currentPage={currentPage}
            hasMore={hasMore}
            nextToken={nextToken}
            baseUrl={`/artists/${artistid}/gallery`}
          />
        </>
      )}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Artists', item: 'https://rasika.life/artists' },
          {
            name: artist.name,
            item: `https://rasika.life${generateArtistUrl(artist.name, artist.id)}`,
          },
          {
            name: 'Gallery',
            item: `https://rasika.life${generateArtistUrl(artist.name, artist.id)}/gallery`,
          },
        ]}
      />
    </main>
  );
}
