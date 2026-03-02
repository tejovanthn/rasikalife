import { Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { PosterImage } from '~/components/PosterImage';
import { Card, CardContent } from '~/components/ui/card';
import { generateEventUrl } from '~/lib/url-slug';

interface EventCardProps {
  event: {
    id: string;
    title: string;
    startDateTime: string;
    venueName?: string;
    artists?: Array<{ title?: string; name: string; role?: string }>;
    posterUrl?: string;
  };
}

function formatEventDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function EventCard({ event }: EventCardProps) {
  return (
    <Link to={generateEventUrl(event.title, event.id)} className="block no-underline">
      <Card className="h-full hover:border-primary/50 transition-colors">
        {event.posterUrl && (
          <PosterImage
            posterUrl={event.posterUrl}
            alt={event.title}
            className="w-full h-36 object-cover rounded-t-lg"
            width={400}
            height={144}
          />
        )}
        <CardContent className="py-4">
          <h3 className="font-semibold text-foreground leading-snug mb-2">{event.title}</h3>
          <div className="space-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {formatEventDate(event.startDateTime)}
            </span>
            {event.venueName && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {event.venueName}
              </span>
            )}
          </div>
          {event.artists && event.artists.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              {event.artists.map(a => `${a.title ? `${a.title} ` : ''}${a.name}`).join(', ')}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
