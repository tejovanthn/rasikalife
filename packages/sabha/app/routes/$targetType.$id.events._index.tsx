import { Badge, EmptyState, SectionTitle, buttonVariants } from '@rasika/ui';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, data, useLoaderData, useSearchParams } from 'react-router';
import { useDashboard } from '~/components/dashboard-context';
import { createServerClient } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { dashboardPath, formatEventWhen, isOwner, isTargetType } from '~/lib/sabha';

export const meta = () => pageMeta(SABHA_COPY.tabs.events);

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  const { targetType, id } = params;
  if (!isTargetType(targetType) || !id) throw data(null, { status: 404 });
  const trpc = await createServerClient(request);
  return trpc.partner.events.query({ targetType, targetId: id });
}

type EventRow = Awaited<ReturnType<typeof loader>>['upcoming'][number];

function Row({
  event,
  editHref,
}: {
  event: EventRow;
  editHref?: string;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 border-b border-border py-3 last:border-0">
      <div className="min-w-0">
        <p className="font-medium">{event.title}</p>
        <p className="text-sm text-muted-foreground">
          {formatEventWhen(event.startDateTime, event.timezone)}
          {event.venueName ? ` · ${event.venueName}` : ''}
          {event.spaceName ? ` · ${event.spaceName}` : ''}
        </p>
        {event.artists.length > 0 ? (
          <p className="text-sm text-muted-foreground">{event.artists.join(', ')}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {event.status === 'submitted' ? (
          <Badge tone="warning">{SABHA_EXTRA_COPY.eventsReviewWait}</Badge>
        ) : null}
        {editHref ? (
          <Link className="text-sm text-primary underline" to={editHref}>
            {SABHA_EXTRA_COPY.eventsEdit}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Upcoming and past concerts of this organiser, or at this venue. An owner of an organiser can
 * add and edit; every other case is read-only, and says so.
 */
export default function Events() {
  const { upcoming, past } = useLoaderData<typeof loader>();
  const { targetType, targetId, overview } = useDashboard();
  const [params] = useSearchParams();
  const canEdit = targetType === 'organiser' && isOwner(overview.role as 'owner');

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
        <ul className="mb-8 mt-2">
          {upcoming.map(event => (
            <Row
              key={event.id}
              event={event}
              editHref={
                canEdit ? dashboardPath(targetType, targetId, `events/${event.id}`) : undefined
              }
            />
          ))}
        </ul>
      )}

      <SectionTitle>{SABHA_EXTRA_COPY.eventsPast}</SectionTitle>
      {past.length === 0 ? (
        <div className="mt-2">
          <EmptyState title={SABHA_EXTRA_COPY.eventsNone} />
        </div>
      ) : (
        <ul className="mt-2">
          {past.map(event => (
            <Row key={event.id} event={event} />
          ))}
        </ul>
      )}
    </>
  );
}
