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
import { PRIVATE_PAGE_CACHE_CONTROL, publicPageCacheControl } from '~/lib/auth.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { generateArtistUrl, parseSlug } from '~/lib/url-slug';

interface GalleryPhoto {
  id: string;
  imageUrl: string;
  caption?: string;
  credit?: string;
  /** Absent on every photo stored before dimensions were captured at upload. */
  width?: number;
  height?: number;
}

// This page's own content is identical for every viewer, but the document it ships in is
// not: the root loader renders the signed-in viewer's name and email into the header. The
// loader decides per request (see publicPageCacheControl); this only forwards the decision,
// defaulting to private so a loader that somehow set nothing is never shared-cached.
export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? PRIVATE_PAGE_CACHE_CONTROL,
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

    return data(
      {
        artist,
        photos: result.items,
        hasMore: result.hasMore,
        nextToken: result.nextToken,
        prevToken: nextToken,
      },
      { headers: { 'Cache-Control': await publicPageCacheControl(request) } }
    );
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
          {/* Masonry via CSS columns: photographs of performances are a mix of portrait and
              landscape, and a square crop threw away most of each frame. Columns need no
              measuring pass and no library. The trade is reading order — content flows down
              each column before moving across — which is right for a gallery, where the
              photographs have no sequence, and would be wrong for prose.

              Each tile reserves its own aspect ratio from the stored dimensions, so the page
              does not reflow as images arrive. Photos stored before dimensions were captured
              have none, and simply size themselves on load. */}
          <div className="columns-2 gap-4 sm:columns-3 [&>figure]:mb-4">
            {photos.map(photo => (
              <figure
                key={photo.id}
                className="overflow-hidden break-inside-avoid rounded-lg border"
              >
                {/* Empty alt when a caption is showing: the figcaption below already carries
                    that text, and repeating it in alt makes a screen reader read it twice.
                    Without a caption the image needs a description of its own. */}
                <img
                  src={photo.imageUrl}
                  alt={photo.caption ? '' : `${artist.name}, photograph`}
                  loading="lazy"
                  width={photo.width}
                  height={photo.height}
                  style={
                    photo.width && photo.height
                      ? { aspectRatio: `${photo.width} / ${photo.height}` }
                      : undefined
                  }
                  className="w-full object-cover"
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
