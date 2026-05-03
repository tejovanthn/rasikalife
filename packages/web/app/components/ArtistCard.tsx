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
          <CardTitle className="text-lg group-hover:underline">
            {artist.title ? `${artist.title} ` : ''}
            {artist.name}
          </CardTitle>
          {primaryRole && <p className="text-sm text-muted-foreground capitalize">{primaryRole}</p>}
        </CardHeader>
      </Card>
    </Link>
  );
}
