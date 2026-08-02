import { creditBalanceLabel, isLowBalance } from '@rasika/core/domain/class-enrollment/client';
import { programDisplayTitle } from '@rasika/core/domain/class-program/client';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageTitle,
  buttonVariants,
} from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, Link, data, redirect, useLoaderData, useNavigation } from 'react-router';
import { Chrome, SignOutButton } from '~/components/chrome';
import { ContextSwitcher } from '~/components/context-switcher';
import { InstallPrompt } from '~/components/install-prompt';
import { createServerClient } from '~/lib/api.server';
import { requireUser, requireUserId } from '~/lib/auth.server';
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

  const cards = active ? await trpc.classes.learnerHome.query({ learnerId: active.id }) : [];

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
    // No date is sent. `sessionDate` is computed server-side in the teacher's zone — a student
    // in California pressing this at 9pm Monday is marking the teacher's Tuesday.
    await trpc.classes.markAttended.mutate({ programId, learnerId });
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
  const navigation = useNavigation();
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
      <div className="space-y-4">
        <PageTitle>{active ? active.name : 'My classes'}</PageTitle>

        {cards.length === 0 ? (
          <EmptyState title="No programs yet">
            {active?.name} is not on a program yet. Your teacher adds one when classes start.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {cards.map(({ enrollment, program }) => (
              <li key={enrollment.programId}>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle>
                        {programDisplayTitle({
                          title: enrollment.programTitle,
                          type: enrollment.programType,
                        })}
                      </CardTitle>
                      {program?.archivedAt ? <Badge>Ended</Badge> : null}
                    </div>
                    <p
                      className={
                        isLowBalance(enrollment.creditsRemaining)
                          ? 'text-sm font-medium text-destructive'
                          : 'text-sm text-muted-foreground'
                      }
                    >
                      {creditBalanceLabel(enrollment.creditsRemaining)}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {/* An archived program keeps every note it ever held — that is the durable
                        value of this product — but nothing new can be marked against it. */}
                    {enrollment.status === 'active' && !program?.archivedAt ? (
                      <Form method="post">
                        <input type="hidden" name="programId" value={enrollment.programId} />
                        <input type="hidden" name="learnerId" value={enrollment.learnerId} />
                        <Button
                          type="submit"
                          pending={navigation.state === 'submitting'}
                          pendingLabel="Marking…"
                        >
                          I attended today
                        </Button>
                      </Form>
                    ) : null}
                    {/* A real link wearing the button's classes, not a button that navigates:
                        it opens in a new tab, it can be copied, and it works before hydration. */}
                    <Link
                      to={`/learners/${enrollment.learnerId}/${enrollment.programId}`}
                      className={buttonVariants({ variant: 'outline' })}
                    >
                      History
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <InstallPrompt />
      </div>
    </Chrome>
  );
}
