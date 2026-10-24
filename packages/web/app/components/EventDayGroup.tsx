import { type EventCardEvent, EventList, listDayLabel } from '~/components/EventCard';

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
      <div className="sticky top-14 md:top-16 z-10 bg-background border-b border-border py-3">
        <h2 className="font-semibold text-base">
          {listDayLabel(date)}
          {/* The count in brackets, as the month filters print it. */}
          <span aria-hidden="true" className="ml-1.5 text-sm font-normal text-muted-foreground">
            ({events.length})
          </span>
          <span className="sr-only">
            , {events.length} {events.length === 1 ? 'event' : 'events'}
          </span>
        </h2>
      </div>
      {/* The header says the day, so each row leads with the time alone. */}
      <EventList events={events} priorityFirst={first} showDate={false} />
    </section>
  );
}
