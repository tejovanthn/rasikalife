import type { EventCardContent } from '@rasika/core/shared/event-card';

/**
 * The poster slot for an event with no poster: the same facts as the share image, as text.
 * Styled as a card (a bordered panel with a label), so it does not pass for a poster, and it is
 * real HTML, so a screen reader reads it and no image has to load. Every part is optional;
 * `buildEventCardContent` leaves out what the record does not hold.
 */
export function EventTextCard({ content }: { content: EventCardContent }) {
  const when = [content.date, content.time].filter(Boolean);
  return (
    <section
      aria-label="Concert details"
      className="rounded-lg border border-border bg-card p-5 text-card-foreground"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Concert details
      </p>
      <h2 className="mt-2 text-xl font-semibold leading-snug text-balance">{content.title}</h2>
      {when.length > 0 && (
        <p className="mt-3 text-sm font-medium text-primary">
          {when.map((part, i) => (
            <span key={part} className="block">
              {part}
              {i < when.length - 1 && <span className="sr-only">,</span>}
            </span>
          ))}
        </p>
      )}
      {content.artists.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {content.artists.map(a => (
            <li key={`${a.name}-${a.role ?? ''}`}>
              {a.name}
              {a.role && <span className="text-muted-foreground"> {a.role}</span>}
            </li>
          ))}
          {content.moreArtists > 0 && (
            <li className="text-muted-foreground">and {content.moreArtists} more</li>
          )}
        </ul>
      )}
      {content.place && <p className="mt-4 text-sm text-muted-foreground">{content.place}</p>}
    </section>
  );
}
