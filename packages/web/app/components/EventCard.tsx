import { Link } from 'react-router';
import { PosterImage } from '~/components/PosterImage';
import { Badge, type BadgeProps } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { generateEventUrl } from '~/lib/url-slug';

export interface EventCardEvent {
  id: string;
  title: string;
  startDateTime: string;
  venueName?: string;
  artists?: Array<{ title?: string; name: string; role?: string }>;
  posterUrl?: string;
  entryType?: string;
}

interface EventCardProps {
  event: EventCardEvent;
  isGeneric?: boolean;
}

const entryTypeLabel: Record<string, string> = {
  free: 'Free',
  ticketed: 'Ticketed',
  'by-invitation': 'By Invitation',
};

const entryTypeBadgeVariant: Record<string, BadgeProps['variant']> = {
  free: 'success',
  ticketed: 'tala',
  'by-invitation': 'raga',
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function artistLine(artists: Array<{ title?: string; name: string }>) {
  return artists.map(a => `${a.title ? `${a.title} ` : ''}${a.name}`).join(' · ');
}

export function EventCard({ event, isGeneric = false }: EventCardProps) {
  const artists = event.artists?.length ? event.artists : null;
  const heading = isGeneric ? (event.venueName ?? event.title) : event.title;
  const showVenueInline = !isGeneric && event.venueName;
  const time = formatTime(event.startDateTime);

  return (
    <Link
      to={generateEventUrl(event.title, event.id)}
      className="block no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
    >
      <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all duration-200">
        {event.posterUrl && (
          <PosterImage
            posterUrl={event.posterUrl}
            alt={event.title}
            className="w-full h-28 md:h-36 object-cover rounded-t-lg"
            width={400}
            height={144}
          />
        )}
        <CardContent className="py-4 space-y-1.5">
          <h3 className="font-semibold text-foreground leading-snug">{heading}</h3>
          <p className="text-sm font-medium text-warning">
            {time}
            {showVenueInline && (
              <span className="font-normal text-muted-foreground"> · {event.venueName}</span>
            )}
          </p>
          {artists && <p className="text-sm text-muted-foreground">{artistLine(artists)}</p>}
          {event.entryType && (
            <div>
              <Badge variant={entryTypeBadgeVariant[event.entryType] ?? 'secondary'}>
                {entryTypeLabel[event.entryType] ?? event.entryType}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
