import { DEFAULT_EVENT_TIMEZONE } from '@rasika/core/domain/event/client';
import { todayInTimeZone } from '@rasika/core/shared/timezone';
import type { ReactNode } from 'react';
import { castLine } from '../lib/cast-line';
import { formatDistance } from '../lib/distance';
import { eventDateKey, eventZone, formatDayLabel } from '../lib/event-time';
import { venueLine } from '../lib/venue-line';
import { EventTime } from './event-time';

export interface EventCardEvent {
  id: string;
  title: string;
  startDateTime: string;
  timezone?: string | null;
  venueName?: string;
  /** The venue's city, from the listing loader. */
  city?: string;
  /** From the signed-in reader's saved location, computed by the listing loader. */
  distanceKm?: number;
  artists?: Array<{ title?: string; name: string; role?: string }>;
  posterUrl?: string;
  entryType?: string;
}

/** What a link renderer is given: the event, the row's classes and the row's content. */
export interface EventLinkProps {
  event: EventCardEvent;
  className: string;
  children: ReactNode;
}

/** Draws the row's link. Web passes a React Router `<Link>`; sabha a plain `<a>`. */
export type RenderEventLink = (props: EventLinkProps) => ReactNode;

export interface PosterProps {
  posterUrl: string;
  alt: string;
  className: string;
  width: number;
  height: number;
  priority: boolean;
}

/** Draws the poster thumbnail. Default is a plain lazy `<img>`; web passes its `PosterImage`. */
export type RenderEventPoster = (props: PosterProps) => ReactNode;

const entryTypeLabel: Record<string, string> = {
  free: 'Free',
  ticketed: 'Ticketed',
  'by-invitation': 'By invitation',
};

// Free stays green on purpose: it is the one entry type a reader filters by. Ticketed and
// By invitation are neutral, because raga violet and tala amber mean raga and tala and nothing
// else (DESIGN.md, the Vocabulary Rule). The classes are written out in full so Tailwind keeps
// them.
const BADGE_BASE =
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
const entryTypeBadgeClass: Record<string, string> = {
  free: 'border-transparent bg-success text-success-foreground',
  ticketed: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
  'by-invitation': 'text-foreground',
};

/** Performers named on a row before the rest are counted. Four covers a concert's cast. */
const CARD_CAST_MAX = 4;

/**
 * `Sat, 24 Oct` for a `YYYY-MM-DD`, with the year only when it is not this year in India.
 * Most of the site's readers and all of its concerts are there, and a year on every date this
 * year was noise; on a past concert from last year it is the fact that matters.
 */
export function listDayLabel(date: string): string {
  const thisYear = todayInTimeZone(DEFAULT_EVENT_TIMEZONE).slice(0, 4);
  return formatDayLabel(date, { year: date.slice(0, 4) !== thisYear });
}

const ROW_CLASS =
  'flex gap-3 px-2 py-3 no-underline transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring rounded-sm';

const defaultRenderLink: RenderEventLink = ({ event, className, children }) => (
  <a href={`/events/${event.id}`} className={className}>
    {children}
  </a>
);

const defaultRenderPoster: RenderEventPoster = ({
  posterUrl,
  alt,
  className,
  width,
  height,
  priority,
}) => (
  <img
    src={posterUrl}
    alt={alt}
    className={className}
    width={width}
    height={height}
    loading={priority ? 'eager' : 'lazy'}
  />
);

export interface EventCardProps {
  event: EventCardEvent;
  isGeneric?: boolean;
  /** The first row on the page: its poster loads at once rather than lazily. */
  priority?: boolean;
  /**
   * Print the day above the time. Off only under a day header, which already says it; anywhere
   * else a row with a time and no date cannot be acted on.
   */
  showDate?: boolean;
  /** Print the venue's city after the venue. Off on a city page, where it is redundant. */
  showCity?: boolean;
  /** Print the venue name. Off where every row is at one venue. */
  showVenue?: boolean;
  renderLink?: RenderEventLink;
  renderPoster?: RenderEventPoster;
}

/**
 * One event as a row: when on the left, what and where in the middle, a small poster on the
 * right. DESIGN.md: "a list of rows is a list, not a stack of cards". The poster-strip card
 * cropped every flyer to a letterbox that showed neither the names nor the date printed on it;
 * a portrait thumbnail anchored at the top shows the head of the flyer, which is where both are.
 *
 * The link and the poster are injected, so each app keeps its own router link and image
 * component. Render it inside `EventList` (or an `<li>` of a `divide-y` list): the row draws no
 * border of its own, so the hairlines come from the list.
 */
export function EventCard({
  event,
  isGeneric = false,
  priority = false,
  showDate = true,
  showCity = true,
  showVenue: venueWanted = true,
  renderLink = defaultRenderLink,
  renderPoster = defaultRenderPoster,
}: EventCardProps) {
  const artists = event.artists?.length ? event.artists : null;
  const heading = isGeneric ? (event.venueName ?? event.title) : event.title;
  const showVenue = venueWanted && !isGeneric && event.venueName;
  const zone = eventZone(event);

  return renderLink({
    event,
    className: ROW_CLASS,
    children: (
      <>
        <div className="w-[4.5rem] shrink-0 text-sm tabular-nums">
          {showDate && (
            <span className="block font-semibold text-foreground">
              {listDayLabel(eventDateKey(event))}
            </span>
          )}
          <span className={showDate ? 'block text-muted-foreground' : 'block font-semibold'}>
            <EventTime start={event.startDateTime} zone={zone} />
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          {/* The global h3 and p rules set a large size, a top margin and loose leading for
              prose; a row overrides all three. */}
          <h3 className="mt-0 text-base md:text-lg font-semibold tracking-normal text-foreground leading-snug line-clamp-2">
            {heading}
          </h3>
          {showVenue && (
            <p className="text-sm leading-snug text-muted-foreground line-clamp-2">
              {venueLine(event.venueName ?? '', showCity ? event.city : undefined)}
            </p>
          )}
          {artists && (
            <p className="text-sm leading-snug text-muted-foreground line-clamp-2">
              {castLine(artists, { max: CARD_CAST_MAX })}
            </p>
          )}
          {(event.distanceKm !== undefined || event.entryType) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-sm text-muted-foreground">
              {event.entryType && (
                <span
                  className={`${BADGE_BASE} ${entryTypeBadgeClass[event.entryType] ?? entryTypeBadgeClass.ticketed}`}
                >
                  {entryTypeLabel[event.entryType] ?? event.entryType}
                </span>
              )}
              {event.distanceKm !== undefined && (
                <span>{formatDistance(event.distanceKm)} away</span>
              )}
            </div>
          )}
        </div>
        {event.posterUrl &&
          // Decorative: the link already announces the title, and alt text here read it twice.
          renderPoster({
            posterUrl: event.posterUrl,
            alt: '',
            priority,
            className: 'h-[88px] w-16 shrink-0 rounded-md bg-muted object-cover object-top',
            width: 64,
            height: 88,
          })}
      </>
    ),
  });
}

export interface EventListProps {
  events: Array<EventCardEvent & { isGeneric?: boolean }>;
  /** The list is the first thing on the page, so its first poster loads at once. */
  priorityFirst?: boolean;
  showDate?: boolean;
  showCity?: boolean;
  showVenue?: boolean;
  className?: string;
  renderLink?: RenderEventLink;
  renderPoster?: RenderEventPoster;
  /** Content under a row, inside its `<li>`: an Edit link, a status badge. Never inside the link. */
  renderAfter?: (event: EventCardEvent) => ReactNode;
}

/**
 * Events as a hairline-separated list of rows. Use this rather than a grid of `EventCard`s:
 * a grid lines rows up side by side, and a row is built to be read down a column.
 */
export function EventList({
  events,
  priorityFirst = false,
  showDate = true,
  showCity = true,
  showVenue = true,
  className = '',
  renderLink,
  renderPoster,
  renderAfter,
}: EventListProps) {
  return (
    <ul className={`divide-y divide-border ${className}`.trim()}>
      {events.map((event, i) => (
        <li key={event.id}>
          <EventCard
            event={event}
            isGeneric={event.isGeneric}
            priority={priorityFirst && i === 0}
            showDate={showDate}
            showCity={showCity}
            showVenue={showVenue}
            renderLink={renderLink}
            renderPoster={renderPoster}
          />
          {renderAfter?.(event)}
        </li>
      ))}
    </ul>
  );
}
