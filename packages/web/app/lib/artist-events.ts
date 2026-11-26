import type { EventCardEvent } from '~/components/EventCard';

/** What the artist's event rows need from the full event record, read back by id. */
export type EventMeta = {
  venueName?: string | null;
  venueCity?: string | null;
  timezone?: string | null;
  posterUrl?: string | null;
};

/** The junction row (`EventArtist`) copies only the title and start time. */
type JunctionRow = {
  eventId: string;
  eventTitle: string;
  eventStartDateTime: string;
  eventDatePrecision?: string | null;
};

/**
 * One of an artist's events as the shared event row takes it, so the artist page shows time,
 * venue and city like `/events` does. A search for an artist is mostly "where and when is
 * X singing next". Venue, city and zone come from the event record: the junction row has none.
 */
export function artistEventRow(row: JunctionRow, meta: EventMeta | undefined): EventCardEvent {
  return {
    id: row.eventId,
    title: row.eventTitle,
    startDateTime: row.eventStartDateTime,
    datePrecision: row.eventDatePrecision ?? undefined,
    timezone: meta?.timezone ?? undefined,
    venueName: meta?.venueName ?? undefined,
    city: meta?.venueCity ?? undefined,
    posterUrl: meta?.posterUrl ?? undefined,
  };
}
