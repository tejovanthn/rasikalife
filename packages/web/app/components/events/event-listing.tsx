import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { EventCard } from '~/components/EventCard';
import { EventDayGroup } from '~/components/EventDayGroup';
import { HomeLocationForm } from '~/components/events/home-location-form';
import { WhatsAppDigest } from '~/components/events/whatsapp-digest';
import { FilterLink } from '~/components/filter-link';
import { EmptyState } from '~/components/shared/EmptyState';
import { buttonVariants } from '~/components/ui/button';
import {
  DATE_PRESETS,
  type ListingScope,
  type ListingState,
  formatMonthLabel,
  listingHref,
  monthButtonLabel,
  monthGrid,
  shiftMonth,
} from '~/lib/event-filters';
import type { EventListingData } from '~/lib/event-listing.server';
import { formatDayLabel } from '~/lib/event-time';
import { cn } from '~/lib/utils';

/**
 * The body of `/events` and every `/<city>/concerts` page. Every control is a link built by
 * `listingHref`, so the page needs no JavaScript to filter and each filtered view is its own
 * cached, shareable URL. Filters are buttons, not chips: a chip in this design system labels a
 * thing and never toggles (DESIGN.md).
 */

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

/** One sideways-scrolling line on a phone, wrapping from md up. Bleeds to the screen edge. */
const SCROLL_ROW =
  '-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0';

/**
 * "≈ 6 km away" needs an account: the reader's location is saved to it, and the distances are
 * computed on the server for a page that is private anyway. A signed-out reader sees why.
 */
function DistanceControl({
  viewer,
  here,
}: {
  viewer: EventListingData['viewer'];
  here: string;
}) {
  return (
    <section aria-labelledby="distance-heading" className="space-y-2">
      <h2 id="distance-heading" className="text-sm font-semibold">
        Distance from you
      </h2>
      {!viewer.signedIn ? (
        <p className="text-sm text-muted-foreground">
          <Link to={`/auth/login?${new URLSearchParams({ redirectTo: here })}`}>Sign in</Link> to
          see how far each concert is from you.
        </p>
      ) : viewer.home ? (
        <p className="text-sm text-muted-foreground">
          Measured from {viewer.home.label}. <Link to="/settings/location">Change</Link>
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Save a PIN code to see how far each concert is.
          </p>
          <HomeLocationForm redirectTo={here} />
        </>
      )}
      <p className="text-xs text-muted-foreground">Straight-line distance.</p>
    </section>
  );
}

function Calendar({
  scope,
  state,
  month,
  counts,
  today,
}: {
  scope: ListingScope;
  state: ListingState;
  month: string;
  counts: Record<string, number>;
  today: string;
}) {
  const href = (when: string | null) => listingHref(scope, { ...state, when });
  const thisMonth = today.slice(0, 7);
  return (
    <section aria-labelledby="calendar-heading" className="space-y-2">
      <div className="flex items-center justify-between">
        {month > thisMonth ? (
          <Link
            to={href(shiftMonth(month, -1))}
            preventScrollReset
            aria-label="Previous month"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon' }),
              'h-11 w-11 md:h-9 md:w-9'
            )}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className="h-11 w-11 md:h-9 md:w-9" />
        )}
        <h2 id="calendar-heading" className="text-sm font-semibold">
          <Link
            to={href(month)}
            preventScrollReset
            className="text-foreground no-underline hover:underline"
          >
            {formatMonthLabel(month)}
          </Link>
        </h2>
        <Link
          to={href(shiftMonth(month, 1))}
          preventScrollReset
          aria-label="Next month"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon' }),
            'h-11 w-11 md:h-9 md:w-9'
          )}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <table className="w-full table-fixed text-center text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            {WEEKDAYS.map(d => (
              <th key={d} scope="col" className="font-normal pb-1">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month).map(week => (
            // Every week holds at least one day of the month, so its first day names it.
            <tr key={week.find(Boolean) ?? month}>
              {WEEKDAYS.map((weekday, col) => {
                const day = week[col];
                if (!day) return <td key={weekday} />;
                const count = counts[day] ?? 0;
                const selected = state.when === day;
                const label = `${formatDayLabel(day)}, ${count === 0 ? 'no events' : `${count} ${count === 1 ? 'event' : 'events'}`}`;
                // The visible digits are hidden from a screen reader, which hears the sentence
                // instead ("Sat, 24 Oct, 7 events"). A link carries it as its name; a plain day
                // carries it as hidden text, since aria-label on a span is not read.
                const inner = (
                  <span aria-hidden="true" className="flex flex-col items-center">
                    <span className={cn(day === today && 'underline underline-offset-4')}>
                      {Number(day.slice(8))}
                    </span>
                    {count > 0 && (
                      <span
                        className={cn(
                          'block text-xs leading-none font-semibold',
                          // Primary fails on the selected and hover fills; ink does not.
                          selected
                            ? 'text-secondary-foreground'
                            : 'text-primary group-hover:text-foreground'
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </span>
                );
                return (
                  <td key={weekday} className="p-0.5">
                    {count > 0 && day >= today ? (
                      <Link
                        to={href(day)}
                        preventScrollReset
                        aria-label={label}
                        aria-current={selected ? 'date' : undefined}
                        className={cn(
                          'group flex h-11 md:h-10 flex-col items-center justify-center rounded-md no-underline text-foreground hover:bg-accent',
                          selected && 'bg-secondary text-secondary-foreground font-semibold'
                        )}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <span className="flex h-11 md:h-10 flex-col items-center justify-center text-muted-foreground">
                        {inner}
                        <span className="sr-only">{label}</span>
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function EventListing({ data, intro }: { data: EventListingData; intro?: ReactNode }) {
  const { scope, state, range, groups, months, cities, calendar, today, upcomingFallback } = data;
  const href = (change: Partial<ListingState>) => listingHref(scope, { ...state, ...change });
  const isDigest = state.view === 'whatsapp';

  return (
    <>
      {intro}

      {/* On a phone the date and month rows each scroll sideways as one line, so the first
          concert is near the top of the screen rather than under six rows of buttons. */}
      <nav aria-label="Filter events" className="mb-6 space-y-3">
        <div className={SCROLL_ROW}>
          <FilterLink to={href({ when: null })} active={!state.when} className="shrink-0">
            All upcoming
          </FilterLink>
          {DATE_PRESETS.map(p => (
            <FilterLink
              key={p.value}
              to={href({ when: p.value })}
              active={state.when === p.value}
              className="shrink-0"
            >
              {p.label}
            </FilterLink>
          ))}
        </div>
        {months.length > 0 && (
          <div className={cn(SCROLL_ROW, 'items-center')}>
            <span className="shrink-0 text-sm text-muted-foreground mr-1">By month</span>
            {months.map(([month, count]) => (
              <FilterLink
                key={month}
                to={href({ when: month })}
                active={state.when === month}
                label={`${formatMonthLabel(month)}, ${count} ${count === 1 ? 'event' : 'events'}`}
                className="shrink-0"
              >
                {monthButtonLabel(month, today)}
                {/* The button's own colour: muted grey on the selected fill was 3.23:1. */}
                <span className="ml-1 font-normal">({count})</span>
              </FilterLink>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={href({ free: !state.free })}
            preventScrollReset
            className="inline-flex items-center gap-2 text-sm min-h-11 md:min-h-9 pr-3 no-underline text-foreground"
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                state.free && 'bg-primary text-primary-foreground'
              )}
            >
              {state.free && <Check className="h-3 w-3" />}
            </span>
            Free only
            <span className="sr-only">{state.free ? ' (on)' : ' (off)'}</span>
          </Link>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <FilterLink to={href({ view: null })} active={!isDigest}>
            List
          </FilterLink>
          <FilterLink to={href({ view: 'whatsapp' })} active={isDigest}>
            WhatsApp text
          </FilterLink>
        </div>
      </nav>

      {/* The list comes first in the document, so a keyboard or screen reader reaches the
          concerts before thirty calendar days; the sidebar is raised beside it from md up. */}
      <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
        <div className="min-w-0">
          {range && (
            <h2 className="mb-4 text-lg font-semibold">
              {range.label}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · {data.count} {data.count === 1 ? 'event' : 'events'}
              </span>
            </h2>
          )}

          {isDigest && data.digest ? (
            <WhatsAppDigest
              text={data.digest}
              options={[
                {
                  label: 'Performers',
                  on: state.cast !== false,
                  href: href({ cast: state.cast === false }),
                },
                {
                  label: 'Link to each event',
                  on: Boolean(state.links),
                  href: href({ links: !state.links }),
                },
              ]}
            />
          ) : groups.length > 0 ? (
            <div className="space-y-8">
              {groups.map(group => (
                <EventDayGroup key={group.date} date={group.date} events={group.events} />
              ))}
            </div>
          ) : (
            <>
              <EmptyState
                message={
                  range
                    ? `Nothing listed for ${range.label.toLowerCase()}${state.free ? ' that is free' : ''}.`
                    : 'No upcoming events at the moment.'
                }
              />
              {upcomingFallback.length > 0 && (
                <section aria-labelledby="next-heading" className="mt-8">
                  <h2 id="next-heading" className="mb-3 font-semibold">
                    Coming up next
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {upcomingFallback.map(event => (
                      <EventCard key={event.id} event={event} isGeneric={event.isGeneric} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
        <aside className="md:order-first space-y-8">
          <Calendar
            scope={scope}
            state={state}
            month={calendar.month}
            counts={calendar.counts}
            today={today}
          />
          {cities.length > 1 && (
            <section aria-labelledby="cities-heading" className="space-y-2">
              <h2 id="cities-heading" className="text-sm font-semibold">
                Cities
              </h2>
              <ul className="space-y-1 text-sm">
                {scope.kind === 'city' && (
                  <li>
                    <Link to={listingHref({ kind: 'all' }, { when: state.when, free: state.free })}>
                      All cities
                    </Link>
                  </li>
                )}
                {cities.map(city => (
                  <li key={city.slug}>
                    {scope.kind === 'city' && scope.slug === city.slug ? (
                      <span aria-current="page" className="font-semibold">
                        {city.name} · {city.count}
                      </span>
                    ) : (
                      <Link
                        to={listingHref(
                          { kind: 'city', slug: city.slug },
                          { when: state.when, free: state.free }
                        )}
                      >
                        {city.name} · {city.count}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <DistanceControl viewer={data.viewer} here={href({})} />
        </aside>
      </div>
    </>
  );
}
