import { EmptyState } from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Link, data, redirect, useActionData, useLoaderData } from 'react-router';
import { useDashboard } from '~/components/dashboard-context';
import { EventForm } from '~/components/event-form';
import { createServerClient, errorMessage, loadVenueOptions } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import {
  dashboardPath,
  eventFormDateTime,
  isOwner,
  isTargetType,
  readEventForm,
} from '~/lib/sabha';

export const meta = () => pageMeta(SABHA_EXTRA_COPY.eventsEditTitle);

function target(params: LoaderFunctionArgs['params']) {
  const { targetType, id, eventId } = params;
  if (!isTargetType(targetType) || !id || !eventId) throw data(null, { status: 404 });
  return { targetType, targetId: id, eventId };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  const { targetType, targetId, eventId } = target(params);
  const trpc = await createServerClient(request);
  const [events, venues] = await Promise.all([
    trpc.partner.events.query({ targetType, targetId }),
    loadVenueOptions(trpc),
  ]);
  // Only this dashboard's own events can be opened here. An id from somewhere else is a 404.
  const event = [...events.upcoming, ...events.past].find(row => row.id === eventId);
  if (!event) throw data(null, { status: 404 });
  const spaces = event.venueId
    ? await trpc.partner.spacesForVenue.query({ targetType, targetId, venueId: event.venueId })
    : [];
  return { event, venues, spaces };
}

const FORM_ERRORS = {
  title: SABHA_COPY.addConcert.fields.title,
  date: SABHA_COPY.addConcert.fields.date,
  time: SABHA_COPY.addConcert.fields.startTime,
  venue: SABHA_EXTRA_COPY.eventsVenueRequired,
} as const;

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUser(request);
  const input = target(params);
  const read = readEventForm(await request.formData());
  if (!read.ok) return data({ error: FORM_ERRORS[read.error] }, { status: 400 });
  const trpc = await createServerClient(request);
  try {
    const result = await trpc.partner.updateEvent.mutate({ ...input, ...read.values });
    const done = result.sentToReview ? 'review' : 'saved';
    return redirect(`${dashboardPath(input.targetType, input.targetId, 'events')}?done=${done}`);
  } catch (error) {
    return data({ error: errorMessage(error) }, { status: 400 });
  }
}

export default function EditEvent() {
  const { event, venues, spaces } = useLoaderData<typeof loader>();
  const { targetType, targetId, overview } = useDashboard();
  const result = useActionData<typeof action>();
  const back = dashboardPath(targetType, targetId, 'events');

  if (targetType !== 'organiser' || !isOwner(overview.role as 'owner')) {
    return <EmptyState title={SABHA_EXTRA_COPY.eventsOwnersOnly} />;
  }

  const { date, time } = eventFormDateTime(event.startDateTime, event.timezone);
  return (
    <>
      <p className="mb-4 text-sm">
        <Link className="text-primary underline" to={back}>
          {SABHA_EXTRA_COPY.eventsBack}
        </Link>
      </p>
      <EventForm
        targetType={targetType}
        targetId={targetId}
        venues={venues}
        initialSpaces={spaces}
        initial={{
          title: event.title,
          date,
          startTime: time,
          venueId: event.venueId ?? '',
          spaceId: event.spaceId,
          artists: event.artists.join(', '),
          notes: event.description,
        }}
        submitLabel={SABHA_EXTRA_COPY.eventsSave}
        error={result?.error}
      />
    </>
  );
}
