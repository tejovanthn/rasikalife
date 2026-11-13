import { Badge, EmptyState, EventList, SectionTitle, buttonVariants } from '@rasika/ui';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, data, useLoaderData, useSearchParams } from 'react-router';
import { useDashboard } from '~/components/dashboard-context';
import { createServerClient } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { dashboardPath, isOwner, isTargetType, mainSiteUrl } from '~/lib/sabha';

export const meta = () => pageMeta(SABHA_COPY.tabs.events);

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  const { targetType, id } = params;
  if (!isTargetType(targetType) || !id) throw data(null, { status: 404 });
  const trpc = await createServerClient(request);
  const events = await trpc.partner.events.query({ targetType, targetId: id });
  return { ...events, siteUrl: mainSiteUrl() };
}

type EventRow = Awaited<ReturnType<typeof loader>>['upcoming'][number];

/** What sits under a row, outside its link: the hall, a review note, the owner's Edit link. */
function RowExtras({ event, editHref }: { event: EventRow; editHref?: string }) {
  if (!event.spaceName && event.status !== 'submitted' && !editHref) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 px-2 pb-3 pl-[5.25rem]">
      {event.spaceName ? (
        <span className="text-sm text-muted-foreground">{event.spaceName}</span>
      ) : null}
      {event.status === 'submitted' ? (
        <Badge tone="warning">{SABHA_EXTRA_COPY.eventsReviewWait}</Badge>
      ) : null}
      {editHref ? (
        <Link className="text-sm text-primary underline" to={editHref}>
          {SABHA_EXTRA_COPY.eventsEdit}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * The shared event row (`@rasika/ui`), each row linking to the public page on rasika.life. An
 * event still in review has no public page yet (the site shows approved events only), so its row
 * is not a link. The venue name is hidden on a venue dashboard, where every row is that venue.
 */
function Rows({
  events,
  siteUrl,
  showVenue,
  editHrefOf,
}: {
  events: EventRow[];
  siteUrl: string;
  showVenue: boolean;
  editHrefOf?: (event: EventRow) => string;
}) {
  const byId = new Map(events.map(event => [event.id, event]));
  return (
    <EventList
      className="mt-2"
      events={events.map(event => ({
        id: event.id,
        title: event.title,
        startDateTime: event.startDateTime,
        timezone: event.timezone,
        venueName: event.venueName,
        artists: event.artists.map(name => ({ name })),
      }))}
      showVenue={showVenue}
      renderLink={({ event, className, children }) =>
        byId.get(event.id)?.status === 'submitted' ? (
          <div className={className}>{children}</div>
        ) : (
          <a href={`${siteUrl}/events/${event.id}`} className={className}>
            {children}
          </a>
        )
      }
      renderAfter={event => {
        const row = byId.get(event.id);
        return row ? <RowExtras event={row} editHref={editHrefOf?.(row)} /> : null;
      }}
    />
  );
}

/**
 * Upcoming and past concerts of this organiser, or at this venue. An owner of an organiser can
 * add and edit; every other case is read-only, and says so.
 */
export default function Events() {
  const { upcoming, past, siteUrl } = useLoaderData<typeof loader>();
  const { targetType, targetId, overview } = useDashboard();
  const [params] = useSearchParams();
  const canEdit = targetType === 'organiser' && isOwner(overview.role as 'owner');
  const showVenue = targetType !== 'venue';

  const done = params.get('done');
  const doneEvent = [...upcoming, ...past].find(event => event.id === params.get('event'));
  const message =
    done === 'published'
      ? SABHA_COPY.addConcert.publishedAt(doneEvent?.venueName ?? overview.target.name)
      : done === 'review'
        ? SABHA_EXTRA_COPY.eventsSubmitted
        : done === 'saved'
          ? SABHA_EXTRA_COPY.eventsSaved
          : null;

  return (
    <>
      {message ? <output className="block mb-4 text-sm">{message}</output> : null}

      {canEdit ? (
        <p className="mb-6">
          <Link className={buttonVariants()} to={dashboardPath(targetType, targetId, 'events/new')}>
            {SABHA_EXTRA_COPY.eventsAdd}
          </Link>
        </p>
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">
          {targetType === 'venue'
            ? SABHA_EXTRA_COPY.eventsOrganiserOnly
            : SABHA_EXTRA_COPY.eventsOwnersOnly}
        </p>
      )}

      <SectionTitle>{SABHA_EXTRA_COPY.eventsUpcoming}</SectionTitle>
      {upcoming.length === 0 ? (
        <div className="mb-8 mt-2">
          <EmptyState title={SABHA_EXTRA_COPY.eventsNone} />
        </div>
      ) : (
        <div className="mb-8">
          <Rows
            events={upcoming}
            siteUrl={siteUrl}
            showVenue={showVenue}
            editHrefOf={
              canEdit
                ? event => dashboardPath(targetType, targetId, `events/${event.id}`)
                : undefined
            }
          />
        </div>
      )}

      <SectionTitle>{SABHA_EXTRA_COPY.eventsPast}</SectionTitle>
      {past.length === 0 ? (
        <div className="mt-2">
          <EmptyState title={SABHA_EXTRA_COPY.eventsNone} />
        </div>
      ) : (
        <Rows events={past} siteUrl={siteUrl} showVenue={showVenue} />
      )}
    </>
  );
}
