import { Link } from 'react-router';
import { Card, CardHeader, CardTitle } from '~/components/ui/card';
import { generateArtistUrl } from '~/lib/url-slug';

interface ArtistCardProps {
  artist: {
    id: string;
    name: string;
    title?: string | null;
    specialisations?: unknown;
  };
}

function ArtistAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div
      className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
      aria-hidden="true"
    >
      <span className="text-sm font-semibold text-primary">{initials}</span>
    </div>
  );
}

export function ArtistCard({ artist }: ArtistCardProps) {
  const specs = Array.isArray(artist.specialisations)
    ? (artist.specialisations as string[]).filter(Boolean)
    : [];
  const primaryRole = specs[0];

  return (
    <Link
      to={generateArtistUrl(artist.name, artist.id)}
      className="group block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
      aria-label={`View artist: ${artist.name}`}
    >
      <Card className="h-full transition-shadow duration-150 group-hover:shadow-md group-hover:border-primary/40">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <ArtistAvatar name={artist.name} />
            <div className="min-w-0">
              <CardTitle className="text-lg group-hover:underline leading-snug">
                {artist.title ? `${artist.title} ` : ''}
                {artist.name}
              </CardTitle>
              {primaryRole && (
                <p className="text-sm text-muted-foreground capitalize mt-0.5">{primaryRole}</p>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
