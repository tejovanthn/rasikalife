import { creditBalanceLabel, isLowBalance } from '@rasika/core/domain/class-enrollment/client';
import { programDisplayTitle } from '@rasika/core/domain/class-program/client';
import { Badge, EmptyState, PageTitle, SectionTitle, buttonVariants } from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Link, data, redirect, useActionData, useLoaderData } from 'react-router';
import { AddClassDialog } from '~/components/add-class-dialog';
import { Chrome, SignOutButton } from '~/components/chrome';
import { ContextSwitcher } from '~/components/context-switcher';
import { InstallPrompt } from '~/components/install-prompt';
import { LocalTime } from '~/components/local-time';
import { createServerClient } from '~/lib/api.server';
import { requireUser, requireUserId } from '~/lib/auth.server';
import {
  SESSION_STATUS_LABELS,
  SESSION_STATUS_TONES,
  formatSessionDate,
  formatSessionDateStable,
} from '~/lib/format';
import { pageMeta } from '~/lib/meta';

export const meta = () => pageMeta('My classes');

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const trpc = await createServerClient(request);
  const url = new URL(request.url);

  const contexts = await trpc.classes.getMyContexts.query();
  const learners = contexts.learners;

  // The selection is a URL parameter rather than state, so a card's links carry it and a refresh
  // does not silently swap which child is on screen.
  const requested = url.searchParams.get('learner');
  const active = learners.find(l => l.id === requested) ?? learners[0] ?? null;

  const cards = active
    ? await trpc.classes.learnerHomeDetailed.query({ learnerId: active.id, recent: 3 })
    : [];

  return data({ user, contexts, learners, active, cards });
}

export async function action({ request }: ActionFunctionArgs) {
  // The one action that was not gated. Without it an expired cookie produced a raw UNAUTHORIZED
  // rendered on the page instead of a trip to the login screen.
  await requireUserId(request);
  const formData = await request.formData();
  const trpc = await createServerClient(request);

  const programId = String(formData.get('programId') ?? '');
  const learnerId = String(formData.get('learnerId') ?? '');
  if (!programId || !learnerId) {
    return data({ error: 'Something was missing. Try again.' }, { status: 400 });
  }

  try {
    // A date is optional and bounded server-side: never the future, never over a month back.
    // Omitted, it is today on the *teacher's* wall — a student in California pressing this at
    // 9pm Monday is marking the teacher's Tuesday.
    await trpc.classes.markAttended.mutate({
      programId,
      learnerId,
      sessionDate: String(formData.get('sessionDate') ?? '') || undefined,
      notes: String(formData.get('notes') ?? '').trim() || undefined,
    });
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : 'Could not mark that class' },
      { status: 400 }
    );
  }

  // `/home`, not `/`. `/` is the context resolver: it ignores the query string and sends the
  // viewer wherever their stored context points, so a guru who also learns marked her own class
  // and landed on the teaching roster, and a guardian of two children landed back on the first.
  return redirect(`/home?learner=${encodeURIComponent(learnerId)}&marked=1`);
}

export default function StudentHome() {
  const { user, contexts, learners, active, cards } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const isTeacher = contexts.teaching.length > 0;

  /**
   * §A5: a guardian whose last access row was removed. The resolver would send them to
   * `/welcome`, but a bookmark or a back button lands them here — so this says what happened
   * rather than rendering an empty list. Their session is untouched.
   */
  if (learners.length === 0) {
    return (
      <Chrome isTeacher={isTeacher} headerRight={<SignOutButton />}>
        <EmptyState
          title="No classes yet"
          action={
            isTeacher ? (
              <Link to="/teaching" className={buttonVariants({ variant: 'outline' })}>
                Go to your students
              </Link>
            ) : null
          }
        >
          {`Nothing is shared with ${user.email} at the moment. When your guru adds you, it appears here.`}
        </EmptyState>
      </Chrome>
    );
  }

  return (
    <Chrome
      isTeacher={isTeacher}
      isLearner
      headerRight={
        <div className="flex items-center gap-2">
          {/* One control for teaching contexts and children alike — see ContextSwitcher for why
              they are not two. Renders nothing for the single-context majority. */}
          {active ? (
            <ContextSwitcher
              contexts={contexts}
              current={{ kind: 'learner', learnerId: active.id }}
            />
          ) : null}
          <SignOutButton />
        </div>
      }
    >
      <div className="space-y-6">
        <PageTitle>{active ? active.name : 'My classes'}</PageTitle>

        {actionData && 'error' in actionData && actionData.error ? (
          <p className="text-sm text-destructive" role="alert">
            {actionData.error}
          </p>
        ) : null}

        {cards.length === 0 ? (
          <EmptyState title="No programs yet">
            {active?.name} is not on a program yet. Your teacher adds one when classes start.
          </EmptyState>
        ) : (
          /*
            One open section per program, with the last few classes in it.
            
            The card used to be a balance and two buttons, so "what did we do last week" — the
            question a student actually opens this for — was always one navigation away. The
            notes are the durable value of the product; they belong on the first screen.
          */
          <ul className="space-y-4">
            {cards.map(({ enrollment, program, recent, total, today, earliest }) => {
              const title = programDisplayTitle({
                title: enrollment.programTitle,
                type: enrollment.programType,
              });
              const closed = enrollment.status !== 'active' || Boolean(program?.archivedAt);

              return (
                <li key={enrollment.programId}>
                  <section className="rounded-lg border border-border">
                    <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-2">
                      <div>
                        <SectionTitle>{title}</SectionTitle>
                        <p
                          className={
                            isLowBalance(enrollment.creditsRemaining)
                              ? 'text-sm font-medium text-destructive'
                              : 'text-sm text-muted-foreground'
                          }
                        >
                          {creditBalanceLabel(enrollment.creditsRemaining)}
                          {closed ? ' · ended' : ''}
                        </p>
                      </div>
                      {/* An archived program keeps every note it ever held — that is the durable
                          value of this product — but nothing new can be marked against it. */}
                      {closed ? null : (
                        <AddClassDialog
                          programId={enrollment.programId}
                          learnerId={enrollment.learnerId}
                          programTitle={title}
                          today={today}
                          earliest={earliest}
                        />
                      )}
                    </div>

                    {recent.length === 0 ? (
                      <p className="px-4 pb-4 text-sm text-muted-foreground">
                        No classes recorded yet.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border border-t border-border">
                        {recent.map(session => (
                          <li key={session.id} className="px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">
                                <LocalTime fallback={formatSessionDateStable(session)}>
                                  {() => formatSessionDate(session)}
                                </LocalTime>
                              </span>
                              <Badge tone={SESSION_STATUS_TONES[session.status]}>
                                {SESSION_STATUS_LABELS[session.status]}
                              </Badge>
                            </div>
                            {session.notes ? (
                              <p className="mt-1 text-sm text-muted-foreground">{session.notes}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="border-t border-border p-3">
                      <Link
                        to={`/learners/${enrollment.learnerId}/${enrollment.programId}`}
                        className="text-sm text-primary underline"
                      >
                        View all{total > recent.length ? ` ${total} classes` : ''} and payments
                      </Link>
                    </div>
                  </section>
                </li>
              );
            })}
          </ul>
        )}

        <InstallPrompt />
      </div>
    </Chrome>
  );
}
