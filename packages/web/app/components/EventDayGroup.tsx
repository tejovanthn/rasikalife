import { EventCard, type EventCardEvent } from '~/components/EventCard';

interface EventDayGroupProps {
  date: string;
  events: Array<EventCardEvent & { isGeneric: boolean }>;
}

function formatGroupDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function EventDayGroup({ date, events }: EventDayGroupProps) {
  return (
    <section>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b py-3 mb-3">
        <h2 className="font-semibold text-base">
          {formatGroupDate(date)}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            · {events.length} {events.length === 1 ? 'event' : 'events'}
          </span>
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {events.map(event => (
          <EventCard key={event.id} event={event} isGeneric={event.isGeneric} />
        ))}
      </div>
    </section>
  );
}
