import { Images } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

export interface HeroPhoto {
  id: string;
  url: string;
  caption?: string;
  width?: number;
  height?: number;
}

/**
 * How much wider the challenger must be before the lead is worth swapping.
 *
 * A swap that happens after the images load is visible, so it has to buy something. Two photos
 * within a few percent of each other crop about the same, and shuffling between them would be
 * motion for nothing.
 */
const LEAD_SWAP_MARGIN = 1.15;

/**
 * Puts the widest photograph in the lead frame.
 *
 * The lead frame is landscape; a portrait photograph dropped into it loses most of its height to
 * the crop, which is how the mosaic ended up leading with a sliver of a dancer lying down. The
 * smaller cells are nearer to square and take a portrait shot far better, so trading the lead
 * for the widest available image improves both.
 *
 * Only reorders *within* what it is given, so a moderator's featured photographs still come
 * ahead of the rest: this picks the best lead among them, it does not overrule the choice of
 * which photographs matter.
 *
 * `ratios` is a lookup by photo id rather than a read of `photo.width`, because **most stored
 * photographs have no dimensions**. They are optional on the entity and only written by the
 * multi-select upload path, so every row predating it measures as square — which made the
 * first version of this a silent no-op on every real profile. The caller supplies what it
 * knows and measures the rest.
 */
export function leadWithWidest(photos: HeroPhoto[], ratios: Record<string, number>): HeroPhoto[] {
  if (photos.length < 2) return photos;

  const ratioOf = (p: HeroPhoto) => ratios[p.id] ?? (p.width && p.height ? p.width / p.height : 1);

  let best = 0;
  for (let i = 1; i < photos.length; i++) {
    if (ratioOf(photos[i]) > ratioOf(photos[best])) best = i;
  }
  if (best === 0 || ratioOf(photos[best]) < ratioOf(photos[0]) * LEAD_SWAP_MARGIN) {
    return photos;
  }

  return [photos[best], ...photos.filter((_, i) => i !== best)];
}

/**
 * Fills in the aspect ratios the database does not have, by asking the browser.
 *
 * The images are being downloaded regardless, so `new Image()` on the same URL resolves from
 * cache and costs nothing extra. Photographs that already carry stored dimensions are skipped,
 * so this does nothing at all once the corpus has been through an upload path that records them.
 *
 * The cost is honest: on a first, uncached view the lead can swap once the sizes are known. It
 * is a swap inside a fixed grid, so nothing reflows and no text moves — only which photograph
 * sits in which frame — and `LEAD_SWAP_MARGIN` keeps it from happening for a negligible gain.
 */
function useMeasuredRatios(photos: HeroPhoto[]): Record<string, number> {
  const [ratios, setRatios] = useState<Record<string, number>>({});

  // Keyed on the ids so this re-runs when the artist changes, not on every render.
  const key = photos.map(p => p.id).join(',');

  // Depends on `key`, not on `photos`: the array is rebuilt every render, so listing it would
  // re-measure on every keystroke elsewhere on the page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the photo ids, see above
  useEffect(() => {
    const unmeasured = photos.filter(p => !(p.width && p.height));
    if (unmeasured.length === 0) return;

    let live = true;
    Promise.all(
      unmeasured.map(
        photo =>
          new Promise<[string, number] | null>(resolve => {
            const img = new Image();
            img.onload = () =>
              resolve(
                img.naturalHeight > 0 ? [photo.id, img.naturalWidth / img.naturalHeight] : null
              );
            // A photo that will not load tells us nothing; leave it at its default.
            img.onerror = () => resolve(null);
            img.src = photo.url;
          })
      )
    ).then(results => {
      if (!live) return;
      const measured = Object.fromEntries(results.filter((r): r is [string, number] => r !== null));
      if (Object.keys(measured).length > 0) setRatios(measured);
    });

    return () => {
      live = false;
    };
  }, [key]);

  return ratios;
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
  const measured = useMeasuredRatios(photos);

  if (photos.length === 0) return null;

  const [lead, ...rest] = leadWithWidest(photos, measured);

  const frame =
    'relative block min-h-0 overflow-hidden rounded-lg border bg-muted transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

  /**
   * Absolutely positioned, and that is what keeps the hero a fixed height.
   *
   * An `h-full` image inside an `h-full` grid item only resolves if every ancestor has a
   * definite height. A grid with `grid-cols-2` and no explicit rows has one *auto* row, so the
   * chain broke at the row: the image fell back to its natural size, the row grew to match, and
   * the photographs overflowed the hero and painted over the biography and the rail beneath it.
   *
   * Taking the image out of flow removes it from the sizing calculation altogether. The frame
   * is sized by the grid, the image fills the frame, and no photograph can push anything.
   *
   * Centred, not top-anchored. Anchoring to the top was a guess from headshots — faces sit high
   * in a portrait — and it is wrong for this material. A dance photographer composes the whole
   * figure in the frame, so the top third is usually stage and air: the first lead image it
   * produced was an empty backdrop and one hand. Centre is where the subject is.
   */
  const image = 'absolute inset-0 h-full w-full object-cover';

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

          {/* grid-rows-1 is not redundant. Without an explicit row track the single implicit row
              is `auto`, every `h-full` beneath it resolves against nothing, and the hero's fixed
              height stops meaning anything. Same reason the nested grids state their rows. */}
          <div className="hidden gap-2 sm:grid sm:h-[22rem] sm:grid-cols-2 sm:grid-rows-1 lg:h-[26rem]">
            <Frame photo={lead} />

            {/* Two, three or four beside the lead, each arrangement filling the same height so
                the hero's silhouette does not change with the artist's photo count. */}
            {rest.length === 1 && <Frame photo={rest[0]} />}

            {rest.length === 2 && (
              <div className="grid min-h-0 grid-rows-2 gap-2">
                {rest.map(photo => (
                  <Frame key={photo.id} photo={photo} />
                ))}
              </div>
            )}

            {rest.length === 3 && (
              <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-2">
                <Frame photo={rest[0]} className="row-span-2" />
                <Frame photo={rest[1]} />
                <Frame photo={rest[2]} />
              </div>
            )}

            {rest.length >= 4 && (
              <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-2">
                {rest.slice(0, 4).map(photo => (
                  <Frame key={photo.id} photo={photo} />
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
          // text-foreground explicitly: a bare Link inherits the accent colour, and an orange
          // label on a white chip over a photograph read as a stray link rather than a control.
          className="absolute bottom-3 right-3 inline-flex min-h-11 items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Images className="h-4 w-4" />
          Show all {totalCount} photos
        </Link>
      )}
    </div>
  );
}
