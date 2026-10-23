import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { EventCard } from '~/components/EventCard';
import { EventDayGroup } from '~/components/EventDayGroup';
import { NearMeControl, NearProvider } from '~/components/events/near-me';
import { WhatsAppDigest } from '~/components/events/whatsapp-digest';
import { EmptyState } from '~/components/shared/EmptyState';
import { buttonVariants } from '~/components/ui/button';
import {
  DATE_PRESETS,
  type ListingScope,
  type ListingState,
  formatMonthLabel,
  listingHref,
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

function FilterLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      preventScrollReset
      aria-current={active ? 'page' : undefined}
      className={cn(
        buttonVariants({ variant: active ? 'secondary' : 'outline', size: 'sm' }),
        'min-h-11 md:min-h-9 no-underline',
        active && 'font-semibold'
      )}
    >
      {children}
    </Link>
  );
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

function shortMonth(month: string) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    month: 'short',
  });
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
                const inner = (
                  <>
                    <span className={cn(day === today && 'underline underline-offset-4')}>
                      {Number(day.slice(8))}
                    </span>
                    {count > 0 && (
                      <span className="block text-[10px] leading-none text-primary font-semibold">
                        {count}
                      </span>
                    )}
                  </>
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
                          'flex h-11 md:h-10 flex-col items-center justify-center rounded-md no-underline text-foreground hover:bg-accent',
                          selected && 'bg-secondary font-semibold'
                        )}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <span
                        aria-label={label}
                        className="flex h-11 md:h-10 flex-col items-center justify-center text-muted-foreground"
                      >
                        {inner}
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
    <NearProvider>
      {intro}

      <nav aria-label="Filter events" className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <FilterLink to={href({ when: null })} active={!state.when}>
            All upcoming
          </FilterLink>
          {DATE_PRESETS.map(p => (
            <FilterLink key={p.value} to={href({ when: p.value })} active={state.when === p.value}>
              {p.label}
            </FilterLink>
          ))}
          {months.map(([month, count]) => (
            <FilterLink key={month} to={href({ when: month })} active={state.when === month}>
              {shortMonth(month)} · {count}
            </FilterLink>
          ))}
        </div>
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

      <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
        <aside className="order-last md:order-first space-y-8">
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
          <NearMeControl />
        </aside>

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
      </div>
    </NearProvider>
  );
}
