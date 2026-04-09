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
      className="group block cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
      aria-label={`View artist: ${artist.name}`}
    >
      <Card className="h-full">
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
