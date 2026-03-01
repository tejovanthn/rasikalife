interface PosterImageProps {
  posterUrl: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

function getWebpUrl(url: string): string | null {
  const match = url.match(/^(.+)\.(jpe?g|png)(\?.*)?$/i);
  if (!match) return null;
  return `${match[1]}.webp${match[3] ?? ''}`;
}

export function PosterImage({ posterUrl, alt, className, loading = 'lazy' }: PosterImageProps) {
  const webpUrl = getWebpUrl(posterUrl);
  if (!webpUrl) {
    return (
      <img src={posterUrl} alt={alt} className={className} loading={loading} decoding="async" />
    );
  }
  return (
    <picture>
      <source srcSet={webpUrl} type="image/webp" />
      <img src={posterUrl} alt={alt} className={className} loading={loading} decoding="async" />
    </picture>
  );
}
