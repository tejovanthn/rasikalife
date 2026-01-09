import { Link } from '@remix-run/react';

interface ArtistCardProps {
  artist: any;
}

export function ArtistCard({ artist }: ArtistCardProps) {
  return (
    <Link
      to={`/carnatic/artists/${artist.name.toLowerCase().replace(/\s+/g, '-')}-${artist.id}`}
      className="block p-4 border rounded-lg hover:shadow-md transition-shadow bg-white"
    >
      <h3 className="font-medium">{artist.name}</h3>
      <p className="text-sm text-gray-600">Artist</p>
    </Link>
  );
}
