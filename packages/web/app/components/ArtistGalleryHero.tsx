import { Images } from 'lucide-react';
import { Link } from 'react-router';

export interface HeroPhoto {
  id: string;
  url: string;
  caption?: string;
}

/**
 * The gallery-first hero: images lead, the record follows.
 *
 * For a dancer the photograph *is* part of the credential, and a 100px circular avatar spent
 * none of that. This gives the images the top of the page the way a listing site does.
 *
 * **It adapts to how many photos exist, and that is the whole design problem.** The obvious
 * version is a five-slot mosaic, which looks deliberate on a well-documented artist and broken
 * on everyone else — and today almost every artist has one portrait and nothing more. So the
 * layout steps down: five or more fills the mosaic, four or three use a large frame with a
 * stack beside it, two split evenly, and one runs wide on its own. Zero renders nothing at all
 * and the page keeps its text-led header, because a gallery hero with no gallery is worse than
 * no hero.
 *
 * Mobile shows the lead image only. A 2×2 grid of thumbnails on a phone is four unreadable
 * squares, and many readers are on a phone in a dark hall.
 */
export function ArtistGalleryHero({
  photos,
  artistName,
  galleryUrl,
  totalCount,
}: {
  photos: HeroPhoto[];
  artistName: string;
  galleryUrl: string;
  /** Every photo the artist has, which may exceed what this hero shows. */
  totalCount: number;
}) {
  if (photos.length === 0) return null;

  const [lead, ...rest] = photos;

  // object-top, not object-center. These are performance photographs — full-body poses and
  // faces both sit in the upper half, and a centred crop of a standing dancer is a torso.
  const frame =
    'relative block overflow-hidden rounded-lg border bg-muted transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

  const image = 'h-full w-full object-cover object-top';

  function Frame({ photo, className }: { photo: HeroPhoto; className?: string }) {
    return (
      <Link to={galleryUrl} className={`${frame} ${className ?? ''}`}>
        <img
          src={photo.url}
          alt={photo.caption || `${artistName}, photograph`}
          loading="eager"
          className={image}
        />
      </Link>
    );
  }

  return (
    <div className="relative mt-6">
      {/* One photo runs wide; more than one splits. Both cap their height so a hero cannot push
          the name and the record off the top of the screen. */}
      {photos.length === 1 ? (
        <Frame photo={lead} className="aspect-[4/3] max-h-[26rem] w-full sm:aspect-[2/1]" />
      ) : (
        <>
          <Frame photo={lead} className="aspect-[4/3] w-full sm:hidden" />

          <div className="hidden gap-2 sm:grid sm:h-[22rem] sm:grid-cols-2 lg:h-[26rem]">
            <Frame photo={lead} className="h-full" />

            {/* Two, three or four beside the lead, each arrangement filling the same height so
                the hero's silhouette does not change with the artist's photo count. */}
            {rest.length === 1 && <Frame photo={rest[0]} className="h-full" />}

            {rest.length === 2 && (
              <div className="grid grid-rows-2 gap-2">
                {rest.map(photo => (
                  <Frame key={photo.id} photo={photo} className="h-full" />
                ))}
              </div>
            )}

            {rest.length === 3 && (
              <div className="grid grid-cols-2 grid-rows-2 gap-2">
                <Frame photo={rest[0]} className="row-span-2 h-full" />
                <Frame photo={rest[1]} className="h-full" />
                <Frame photo={rest[2]} className="h-full" />
              </div>
            )}

            {rest.length >= 4 && (
              <div className="grid grid-cols-2 grid-rows-2 gap-2">
                {rest.slice(0, 4).map(photo => (
                  <Frame key={photo.id} photo={photo} className="h-full" />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Only when there is more to see. A "show all" over a single photograph is a button that
          lies about what is behind it. 44px tall, because this is a phone target. */}
      {totalCount > photos.length && (
        <Link
          to={galleryUrl}
          className="absolute bottom-3 right-3 inline-flex min-h-11 items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Images className="h-4 w-4" />
          Show all {totalCount} photos
        </Link>
      )}
    </div>
  );
}
