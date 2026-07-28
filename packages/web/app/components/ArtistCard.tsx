import { BadgeCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardHeader, CardTitle } from '~/components/ui/card';
import { artistTagline } from '~/lib/artist-display';
import { generateArtistUrl } from '~/lib/url-slug';
import { capitalize } from '~/lib/utils';

interface ArtistCardProps {
  artist: {
    id: string;
    name: string;
    title?: string | null;
    photoUrl?: string | null;
    instrument?: string | null;
    city?: string | null;
    claimStatus?: string | null;
    specialisations?: unknown;
  };
}

function ArtistAvatar({ photoUrl, name }: { photoUrl?: string | null; name: string }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        loading="lazy"
        className="h-10 w-10 shrink-0 rounded-full border object-cover"
      />
    );
  }

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

  // Instrument and city are what the profile hero leads with, so the card leads with them
  // too, through the same helper. Specialisations are the fallback for the many records
  // nobody has enriched yet, and for search results, which come from the Fuse index and
  // carry a name and nothing else.
  const line = artistTagline(artist) ?? (specs[0] ? capitalize(specs[0]) : undefined);

  return (
    <Link
      to={generateArtistUrl(artist.name, artist.id)}
      className="group block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
      aria-label={`View artist: ${artist.name}`}
    >
      <Card className="h-full transition-shadow duration-150 group-hover:shadow-md group-hover:border-primary/40">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <ArtistAvatar photoUrl={artist.photoUrl} name={artist.name} />
            <div className="min-w-0">
              <CardTitle className="text-lg group-hover:underline leading-snug">
                {artist.title ? `${artist.title} ` : ''}
                {artist.name}
                {artist.claimStatus === 'verified' && (
                  <BadgeCheck
                    className="ml-1 inline-block h-4 w-4 align-text-bottom text-primary"
                    aria-label="Verified artist"
                  />
                )}
              </CardTitle>
              {line && <p className="text-sm text-muted-foreground mt-0.5 truncate">{line}</p>}
            </div>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
