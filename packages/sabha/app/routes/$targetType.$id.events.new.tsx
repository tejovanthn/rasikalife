import { EmptyState } from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Link, data, redirect, useActionData, useLoaderData } from 'react-router';
import { useDashboard } from '~/components/dashboard-context';
import { EventForm } from '~/components/event-form';
import { createServerClient, errorMessage, loadVenueOptions } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { dashboardPath, isOwner, isTargetType, readEventForm } from '~/lib/sabha';

export const meta = () => pageMeta(SABHA_EXTRA_COPY.eventsAdd);

function organiserTarget(params: LoaderFunctionArgs['params']) {
  const { targetType, id } = params;
  if (!isTargetType(targetType) || !id) throw data(null, { status: 404 });
  return { targetType, targetId: id };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  organiserTarget(params);
  const trpc = await createServerClient(request);
  return { venues: await loadVenueOptions(trpc) };
}

const FORM_ERRORS = {
  title: SABHA_COPY.addConcert.fields.title,
  date: SABHA_COPY.addConcert.fields.date,
  time: SABHA_COPY.addConcert.fields.startTime,
  venue: SABHA_EXTRA_COPY.eventsVenueRequired,
} as const;

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUser(request);
  const input = organiserTarget(params);
  const read = readEventForm(await request.formData());
  if (!read.ok) {
    return data({ error: FORM_ERRORS[read.error] }, { status: 400 });
  }
  const trpc = await createServerClient(request);
  try {
    const result = await trpc.partner.createEvent.mutate({ ...input, ...read.values });
    const back = dashboardPath(input.targetType, input.targetId, 'events');
    return redirect(
      result.published ? `${back}?done=published&event=${result.eventId}` : `${back}?done=review`
    );
  } catch (error) {
    return data({ error: errorMessage(error) }, { status: 400 });
  }
}

export default function NewEvent() {
  const { venues } = useLoaderData<typeof loader>();
  const { targetType, targetId, overview } = useDashboard();
  const result = useActionData<typeof action>();
  const back = dashboardPath(targetType, targetId, 'events');

  if (targetType !== 'organiser' || !isOwner(overview.role as 'owner')) {
    return (
      <EmptyState
        title={
          targetType !== 'organiser'
            ? SABHA_EXTRA_COPY.eventsOrganiserOnly
            : SABHA_EXTRA_COPY.eventsOwnersOnly
        }
      />
    );
  }

  // The button says what will happen: published at once, or sent to a moderator.
  const willReview = !overview.target.verifiedAt || overview.target.requireEventReview;

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
        submitLabel={
          willReview ? SABHA_COPY.addConcert.submitReview : SABHA_COPY.addConcert.submitPublish
        }
        error={result?.error}
      />
    </>
  );
}
