import { EventCard, type EventCardEvent } from '~/components/EventCard';
import { formatDayLabel } from '~/lib/event-time';

interface EventDayGroupProps {
  /** `YYYY-MM-DD`, the day in the events' own zone (`groupByEventDate`). */
  date: string;
  events: Array<EventCardEvent & { isGeneric: boolean }>;
  /** This is the first group on the page, so its first poster gets load priority. */
  first?: boolean;
}

export function EventDayGroup({ date, events, first = false }: EventDayGroupProps) {
  return (
    <section>
      {/* Sticks below the site nav (h-14, md:h-16), which is itself sticky at top-0 and above
          it; at top-0 the date slid underneath and vanished just when it was needed. A solid
          page colour rather than a blur, which was decoration. */}
      <div className="sticky top-14 md:top-16 z-10 bg-background border-b py-3 mb-3">
        <h2 className="font-semibold text-base">
          {formatDayLabel(date, { year: true })}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            · {events.length} {events.length === 1 ? 'event' : 'events'}
          </span>
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {events.map((event, i) => (
          <EventCard
            key={event.id}
            event={event}
            isGeneric={event.isGeneric}
            priority={first && i === 0}
          />
        ))}
      </div>
    </section>
  );
}
