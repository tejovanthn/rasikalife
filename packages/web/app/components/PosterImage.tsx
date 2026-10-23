interface PosterImageProps {
  posterUrl: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  /**
   * The page's largest image (usually the first poster in a listing): loaded at once and at
   * high priority. Lazy-loading it held back LCP by about a second on slow 4G.
   */
  priority?: boolean;
  width?: number;
  height?: number;
}

function getWebpUrl(url: string): string | null {
  const match = url.match(/^(.+)\.(jpe?g|png)(\?.*)?$/i);
  if (!match) return null;
  return `${match[1]}.webp${match[3] ?? ''}`;
}

export function PosterImage({
  posterUrl,
  alt,
  className,
  loading = 'lazy',
  priority = false,
  width,
  height,
}: PosterImageProps) {
  const webpUrl = getWebpUrl(posterUrl);
  // React 18 has no `fetchPriority` prop but passes an unknown lowercase attribute through.
  const fetchHint = priority ? ({ fetchpriority: 'high' } as Record<string, string>) : {};
  const loadingMode = priority ? 'eager' : loading;
  if (!webpUrl) {
    return (
      <img
        {...fetchHint}
        src={posterUrl}
        alt={alt}
        className={className}
        loading={loadingMode}
        decoding="async"
        width={width}
        height={height}
      />
    );
  }
  return (
    <picture>
      <source srcSet={webpUrl} type="image/webp" />
      <img
        {...fetchHint}
        src={posterUrl}
        alt={alt}
        className={className}
        loading={loadingMode}
        decoding="async"
        width={width}
        height={height}
      />
    </picture>
  );
}
