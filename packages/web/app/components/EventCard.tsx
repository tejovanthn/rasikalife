import { Link } from 'react-router';
import { PosterImage } from '~/components/PosterImage';
import { EventTime } from '~/components/events/event-time';
import { Badge, type BadgeProps } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { castLine } from '~/lib/artist-display';
import { formatDistance } from '~/lib/distance';
import { eventZone } from '~/lib/event-time';
import { generateEventUrl } from '~/lib/url-slug';

export interface EventCardEvent {
  id: string;
  title: string;
  startDateTime: string;
  timezone?: string | null;
  venueName?: string;
  /** From the signed-in reader's saved location, computed by the listing loader. */
  distanceKm?: number;
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

/** Performers named on a card before the rest are counted. Four covers a concert's cast. */
const CARD_CAST_MAX = 4;

export function EventCard({ event, isGeneric = false }: EventCardProps) {
  const artists = event.artists?.length ? event.artists : null;
  const heading = isGeneric ? (event.venueName ?? event.title) : event.title;
  const showVenueInline = !isGeneric && event.venueName;

  return (
    <Link
      to={generateEventUrl(event.title, event.id)}
      className="block no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
    >
      {/* A fixed shape: title, time and cast are clamped and the entry badge sits at the foot,
          so cards in a row line up whatever one poster credited. */}
      <Card className="h-full flex flex-col hover:border-primary/50 hover:shadow-md transition-all duration-200">
        {event.posterUrl && (
          <PosterImage
            posterUrl={event.posterUrl}
            alt={event.title}
            className="w-full h-28 md:h-36 object-cover rounded-t-lg"
            width={400}
            height={144}
          />
        )}
        <CardContent className="py-4 flex flex-1 flex-col gap-1.5">
          <h3 className="font-semibold text-foreground leading-snug line-clamp-2">{heading}</h3>
          <p className="text-sm font-medium text-warning line-clamp-2">
            <EventTime start={event.startDateTime} zone={eventZone(event)} />
            {showVenueInline && (
              <span className="font-normal text-muted-foreground"> · {event.venueName}</span>
            )}
          </p>
          {artists && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {castLine(artists, { max: CARD_CAST_MAX })}
            </p>
          )}
          {event.distanceKm !== undefined && (
            <p className="text-sm text-muted-foreground">{formatDistance(event.distanceKm)} away</p>
          )}
          {event.entryType && (
            <div className="mt-auto pt-1">
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
