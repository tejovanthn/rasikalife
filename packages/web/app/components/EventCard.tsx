import { Link } from 'react-router';
import { PosterImage } from '~/components/PosterImage';
import { EventTime } from '~/components/events/event-time';
import { EventDistance } from '~/components/events/near-me';
import { Badge, type BadgeProps } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { eventZone } from '~/lib/event-time';
import { generateEventUrl } from '~/lib/url-slug';

export interface EventCardEvent {
  id: string;
  title: string;
  startDateTime: string;
  timezone?: string | null;
  venueName?: string;
  /** The venue's coordinates, when known, for "≈ 6 km away". */
  venueLat?: number | null;
  venueLng?: number | null;
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

function artistLine(artists: Array<{ title?: string; name: string }>) {
  return artists.map(a => `${a.title ? `${a.title} ` : ''}${a.name}`).join(' · ');
}

export function EventCard({ event, isGeneric = false }: EventCardProps) {
  const artists = event.artists?.length ? event.artists : null;
  const heading = isGeneric ? (event.venueName ?? event.title) : event.title;
  const showVenueInline = !isGeneric && event.venueName;

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
            <EventTime start={event.startDateTime} zone={eventZone(event)} />
            {showVenueInline && (
              <span className="font-normal text-muted-foreground"> · {event.venueName}</span>
            )}
          </p>
          {artists && <p className="text-sm text-muted-foreground">{artistLine(artists)}</p>}
          <EventDistance lat={event.venueLat} lng={event.venueLng} />
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
