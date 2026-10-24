import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { EventDayGroup } from '~/components/EventDayGroup';
import { HOME_LOCATION_ERRORS, HomeLocationForm } from '~/components/events/home-location-form';
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
  monthGrid,
  rangeDates,
  shiftMonth,
} from '~/lib/event-filters';
import type { EventListingData } from '~/lib/event-listing.server';
import { formatDayLabel, groupByEventDate } from '~/lib/event-time';
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

/** Where the sidebar's PIN form sits, for the jump link above the list. */
const HOME_FORM_ID = 'home-location';

function pluralConcerts(count: number): string {
  return `${count} ${count === 1 ? 'concert' : 'concerts'}`;
}

/**
 * A count in brackets, the one style the listing uses for every count: "Bengaluru (18)". The
 * brackets are hidden from a screen reader, which hears ", 18 concerts" instead.
 */
function Count({ n, className }: { n: number; className?: string }) {
  return (
    <>
      <span aria-hidden="true" className={cn('ml-1.5 font-normal', className)}>
        ({n})
      </span>
      <span className="sr-only">, {pluralConcerts(n)}</span>
    </>
  );
}

/**
 * One line above the list on every width, so a reader on a phone learns about distances before
 * scrolling past every concert. A signed-out reader gets nothing here: the sign-in prompt stays
 * in the sidebar, since a line asking for an account above the concerts is in the way.
 */
function DistanceStatus({
  viewer,
  pinError,
}: {
  viewer: EventListingData['viewer'];
  pinError?: string;
}) {
  if (!viewer.signedIn) return null;
  if (viewer.home) {
    return (
      <p className="mb-4 text-sm text-muted-foreground">
        Straight-line distances from {viewer.home.label} ·{' '}
        <Link to="/settings/location">Change</Link>
      </p>
    );
  }
  const error = pinError ? HOME_LOCATION_ERRORS[pinError] : undefined;
  return error ? (
    <p className="mb-4 text-sm text-destructive">
      Your PIN code was not saved. {error} <a href={`#${HOME_FORM_ID}`}>Try again</a>
    </p>
  ) : (
    <p className="mb-4 text-sm">
      <a href={`#${HOME_FORM_ID}`}>Show distances: save your PIN code</a>
    </p>
  );
}

/**
 * "≈ 6 km away" needs an account: the reader's location is saved to it, and the distances are
 * computed on the server for a page that is private anyway. A signed-out reader sees why. A
 * reader with a home has nothing here: the line above the list already says where from.
 */
function DistanceControl({
  viewer,
  here,
  pinError,
}: {
  viewer: EventListingData['viewer'];
  here: string;
  pinError?: string;
}) {
  if (viewer.home) return null;
  return (
    <section
      id={HOME_FORM_ID}
      aria-labelledby="distance-heading"
      className="space-y-2 scroll-mt-20"
    >
      <h2 id="distance-heading" className="text-sm font-semibold">
        Distance from you
      </h2>
      {!viewer.signedIn ? (
        <p className="text-sm text-muted-foreground">
          <Link to={`/auth/login?${new URLSearchParams({ redirectTo: here })}`}>Sign in</Link> to
          see how far each concert is from you.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Save a PIN code to see how far each concert is.
          </p>
          <HomeLocationForm
            redirectTo={here}
            error={pinError ? HOME_LOCATION_ERRORS[pinError] : undefined}
          />
          <p className="text-xs text-muted-foreground">Straight-line distance.</p>
        </>
      )}
    </section>
  );
}

/**
 * The arrows browse (`cal`) and leave the list alone; the month name and the days choose
 * (`when`). Browsing used to set `when`, so looking ahead to December emptied October's list.
 * "Previous" stops at this month and "next" at the last month with a concert.
 */
function Calendar({
  scope,
  state,
  calendar,
  today,
}: {
  scope: ListingScope;
  state: ListingState;
  calendar: EventListingData['calendar'];
  today: string;
}) {
  const { month, counts, lastMonth, defaultMonth } = calendar;
  const href = (when: string | null) => listingHref(scope, { ...state, when, cal: null });
  // Back on the month the calendar opens at anyway, the URL drops `cal` and stays the plain one.
  const browse = (to: string) =>
    listingHref(scope, { ...state, cal: to === defaultMonth ? null : to });
  const thisMonth = today.slice(0, 7);
  return (
    <section aria-labelledby="calendar-heading" className="space-y-2">
      <div className="flex items-center justify-between">
        {month > thisMonth ? (
          <Link
            to={browse(shiftMonth(month, -1))}
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
          {/* Underlined at rest: a phone has no hover to reveal that the name is a link. */}
          <Link
            to={href(month)}
            preventScrollReset
            aria-label={`All concerts in ${formatMonthLabel(month)}`}
            aria-current={state.when === month ? 'true' : undefined}
            className="inline-flex min-h-11 md:min-h-9 items-center text-foreground underline underline-offset-4"
          >
            {formatMonthLabel(month)}
          </Link>
        </h2>
        {lastMonth && month < lastMonth ? (
          <Link
            to={browse(shiftMonth(month, 1))}
            preventScrollReset
            aria-label="Next month"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon' }),
              'h-11 w-11 md:h-9 md:w-9'
            )}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className="h-11 w-11 md:h-9 md:w-9" />
        )}
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
                const label = `${formatDayLabel(day)}, ${count === 0 ? 'no concerts' : pluralConcerts(count)}`;
                // The visible digits are hidden from a screen reader, which hears the sentence
                // instead ("Sat, 24 Oct, 7 concerts"). A link carries it as its name; a plain day
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
  const { scope, state, range, groups, cities, calendar, today, upcomingFallback } = data;
  // A new date also puts the calendar back on that date's month, so `cal` goes with it.
  const href = (change: Partial<ListingState>) =>
    listingHref(scope, { ...state, ...('when' in change ? { cal: null } : {}), ...change });
  const isDigest = state.view === 'whatsapp';
  const dates = range ? rangeDates(range) : undefined;
  const cityState = { when: state.when, free: state.free, sort: state.sort };
  const fallbackGroups = groupByEventDate(upcomingFallback);

  return (
    <>
      {intro}

      {/* On a phone the date and city rows each scroll sideways as one line, so the first
          concert is near the top of the screen rather than under six rows of buttons. */}
      <nav aria-label="Filter events" className="mb-6 space-y-3">
        <div className={SCROLL_ROW}>
          <FilterLink to={href({ when: null })} active={!state.when} className="shrink-0">
            All upcoming
            <Count n={data.presetCounts.all} />
          </FilterLink>
          {DATE_PRESETS.map(p => {
            const n = data.presetCounts[p.value];
            const active = state.when === p.value;
            // Still a link, since "nothing today" is worth being able to check, but muted, so
            // an empty preset reads as empty before it is pressed. Not when chosen: muted grey
            // on the selected fill was 3.23:1.
            return (
              <FilterLink
                key={p.value}
                to={href({ when: p.value })}
                active={active}
                className={cn('shrink-0', n === 0 && !active && 'text-muted-foreground')}
              >
                {p.label}
                <Count n={n} />
              </FilterLink>
            );
          })}
        </div>
        {/* Cities, on a phone only: the sidebar list sits below every concert there. From md
            up the sidebar is beside the list and this row is hidden, so only one set of these
            links is ever reachable. */}
        {cities.length > 1 && (
          <div className={cn(SCROLL_ROW, 'md:hidden')}>
            <FilterLink
              to={listingHref({ kind: 'all' }, cityState)}
              active={scope.kind === 'all'}
              className="shrink-0"
            >
              All cities
            </FilterLink>
            {cities.map(city => (
              <FilterLink
                key={city.slug}
                to={listingHref({ kind: 'city', slug: city.slug }, cityState)}
                active={scope.kind === 'city' && scope.slug === city.slug}
                className="shrink-0"
              >
                {city.name}
                <Count n={city.count} />
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
          {/* Only with a home to measure from; the digest keeps date order, so not there. */}
          {data.viewer.home && !isDigest && (
            <>
              <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
              <FilterLink to={href({ sort: null })} active={!data.nearest}>
                By date
              </FilterLink>
              <FilterLink to={href({ sort: 'near' })} active={data.nearest}>
                Nearest first
              </FilterLink>
            </>
          )}
        </div>
      </nav>

      {/* The list comes first in the document, so a keyboard or screen reader reaches the
          concerts before thirty calendar days; the sidebar is raised beside it from md up. */}
      <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
        <div className="min-w-0">
          <DistanceStatus viewer={data.viewer} pinError={data.pinError} />
          {range && (
            <h2 className="mb-4 text-lg font-semibold">
              {range.label}
              <span className="text-sm font-normal text-muted-foreground">
                {dates && ` · ${dates}`}
                <Count n={data.count} />
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
              {groups.map((group, i) => (
                // Nearest first can show a day twice, so the index keeps the keys apart.
                <EventDayGroup
                  key={`${group.date}-${i}`}
                  date={group.date}
                  events={group.events}
                  first={i === 0}
                />
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
              {fallbackGroups.length > 0 && (
                <section aria-labelledby="next-heading" className="mt-8">
                  <h2 id="next-heading" className="mb-3 font-semibold">
                    Coming up next
                  </h2>
                  {/* Under day headers like the list itself: a card here shows its time and
                      not its day, and "7:00 PM" alone after an empty range names no day. */}
                  <div className="space-y-8">
                    {fallbackGroups.map((group, i) => (
                      <EventDayGroup
                        key={group.date}
                        date={group.date}
                        events={group.events}
                        first={i === 0}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
        <aside className="md:order-first space-y-8">
          <Calendar scope={scope} state={state} calendar={calendar} today={today} />
          {/* From md up only; on a phone the city row in the filters stands in for it. */}
          {cities.length > 1 && (
            <section aria-labelledby="cities-heading" className="hidden md:block space-y-2">
              <h2 id="cities-heading" className="text-sm font-semibold">
                Cities
              </h2>
              <ul className="space-y-1 text-sm">
                {scope.kind === 'city' && (
                  <li>
                    <Link to={listingHref({ kind: 'all' }, cityState)}>All cities</Link>
                  </li>
                )}
                {cities.map(city => (
                  <li key={city.slug}>
                    {scope.kind === 'city' && scope.slug === city.slug ? (
                      <span aria-current="page" className="font-semibold">
                        {city.name}
                        <Count n={city.count} />
                      </span>
                    ) : (
                      <Link to={listingHref({ kind: 'city', slug: city.slug }, cityState)}>
                        {city.name}
                        <Count n={city.count} />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <DistanceControl viewer={data.viewer} here={href({})} pinError={data.pinError} />
        </aside>
      </div>
    </>
  );
}
