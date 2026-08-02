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
  Select,
  buttonVariants,
} from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, Link, data, redirect, useLoaderData, useNavigation } from 'react-router';
import { Chrome, SignOutButton } from '~/components/chrome';
import { InstallPrompt } from '~/components/install-prompt';
import { createServerClient } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const trpc = await createServerClient(request);
  const url = new URL(request.url);

  const [learners, institution] = await Promise.all([
    trpc.classes.myLearners.query(),
    trpc.classes.myInstitution.query(),
  ]);

  // The switcher's selection is a URL parameter rather than state, so a card's links can carry
  // it and a refresh does not silently swap which child is on screen.
  const requested = url.searchParams.get('learner');
  const active = learners.find(l => l.id === requested) ?? learners[0] ?? null;

  const cards = active ? await trpc.classes.learnerHome.query({ learnerId: active.id }) : [];

  return data({ user, learners, active, cards, isTeacher: Boolean(institution) });
}

export async function action({ request }: ActionFunctionArgs) {
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

  return redirect(`/?learner=${encodeURIComponent(learnerId)}&marked=1`);
}

export default function StudentHome() {
  const { user, learners, active, cards, isTeacher } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  if (learners.length === 0) {
    return (
      <Chrome title="Rasika Classes" isTeacher={isTeacher} headerRight={<SignOutButton />}>
        <EmptyState title="No classes yet">
          {isTeacher
            ? 'You teach here. Add your first student from the Students tab.'
            : `Nothing has been shared with ${user.email} yet. When your teacher adds you, it will appear here.`}
        </EmptyState>
      </Chrome>
    );
  }

  return (
    <Chrome title="Rasika Classes" isTeacher={isTeacher} headerRight={<SignOutButton />}>
      <div className="space-y-4">
        <PageTitle>{active ? active.name : 'My classes'}</PageTitle>

        {/* Shown only for a parent managing more than one child. An adult student with one
            `self` row never sees a switcher at all. */}
        {learners.length > 1 ? (
          <Form method="get" className="space-y-1.5">
            <label htmlFor="learner" className="block text-sm font-medium">
              Showing
            </label>
            <Select
              id="learner"
              name="learner"
              defaultValue={active?.id}
              onChange={event => event.currentTarget.form?.requestSubmit()}
            >
              {learners.map(learner => (
                <option key={learner.id} value={learner.id}>
                  {learner.name}
                </option>
              ))}
            </Select>
            <noscript>
              <Button type="submit" variant="outline">
                Show
              </Button>
            </noscript>
          </Form>
        ) : null}

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
