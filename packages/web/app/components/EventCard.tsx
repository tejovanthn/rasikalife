import {
  type EventCardEvent,
  type EventCardProps,
  type EventListProps,
  type RenderEventLink,
  type RenderEventPoster,
  EventCard as UiEventCard,
  EventList as UiEventList,
  listDayLabel,
} from '@rasika/ui';
import { Link } from 'react-router';
import { PosterImage } from '~/components/PosterImage';
import { generateEventUrl } from '~/lib/url-slug';

/**
 * The event row lives in `@rasika/ui` (`components/event-list.tsx`), shared with the scan page
 * and the sabha dashboard. These wrappers inject web's router link and `PosterImage`, so every
 * call site here keeps its imports and its output.
 */
export type { EventCardEvent };
export { listDayLabel };

const renderLink: RenderEventLink = ({ event, className, children }) => (
  <Link to={generateEventUrl(event.title, event.id)} className={className}>
    {children}
  </Link>
);

const renderPoster: RenderEventPoster = ({
  posterUrl,
  alt,
  className,
  width,
  height,
  priority,
}) => (
  <PosterImage
    posterUrl={posterUrl}
    alt={alt}
    priority={priority}
    className={className}
    width={width}
    height={height}
  />
);

export function EventCard(props: Omit<EventCardProps, 'renderLink' | 'renderPoster'>) {
  return <UiEventCard {...props} renderLink={renderLink} renderPoster={renderPoster} />;
}

export function EventList(props: Omit<EventListProps, 'renderLink' | 'renderPoster'>) {
  return <UiEventList {...props} renderLink={renderLink} renderPoster={renderPoster} />;
}
