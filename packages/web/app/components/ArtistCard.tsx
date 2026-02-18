import { Link } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { generateArtistUrl } from '~/lib/url-slug';

interface ArtistCardProps {
  artist: {
    id: string;
    name: string;
  };
}

export function ArtistCard({ artist }: ArtistCardProps) {
  return (
    <Link
      to={generateArtistUrl(artist.name, artist.id)}
      className="block cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
      aria-label={`View artist: ${artist.name}`}
    >
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg hover:underline">{artist.name}</CardTitle>
          <Badge variant="secondary">Artist</Badge>
        </CardHeader>
      </Card>
    </Link>
  );
}
