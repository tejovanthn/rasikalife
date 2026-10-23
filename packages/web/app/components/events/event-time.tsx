import { useEffect, useState } from 'react';
import { formatEventTime, needsZoneLabel, zoneLabel } from '~/lib/event-time';

/**
 * "6:00 pm – 8:30 pm", in the zone the concert happens in, with that zone named when the
 * reader could mistake it for their own (`needsZoneLabel`).
 *
 * The server renders the label only for a concert outside India. The reader's zone is known
 * only in the browser, so the label for a reader abroad is added after hydration; the first
 * client render matches the server's exactly.
 */
export function EventTime({
  start,
  end,
  zone,
}: {
  start: string;
  end?: string | null;
  zone: string;
}) {
  const [readerZone, setReaderZone] = useState<string | undefined>(undefined);
  useEffect(() => {
    try {
      setReaderZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // No zone known: keep the server's rendering.
    }
  }, []);

  const label = needsZoneLabel(start, zone, readerZone) ? ` ${zoneLabel(start, zone)}` : '';
  const range = end
    ? `${formatEventTime(start, zone)} – ${formatEventTime(end, zone)}`
    : formatEventTime(start, zone);
  return (
    <time dateTime={start}>
      {range}
      {label}
    </time>
  );
}
