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
  Field,
  Input,
  PageTitle,
  SectionTitle,
  Select,
  Textarea,
  buttonVariants,
} from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import {
  Form,
  Link,
  data,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';
import { Chrome, SignOutButton } from '~/components/chrome';
import { ScreenshotField } from '~/components/screenshot-field';
import { createServerClient } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { pageMeta } from '~/lib/meta';

export const meta = () => pageMeta('Class');

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  const trpc = await createServerClient(request);
  const programId = params.programId as string;

  const [institution, roster] = await Promise.all([
    trpc.classes.myInstitution.query(),
    trpc.classes.roster.query({ programId }),
  ]);
  if (!institution) {
    throw new Response('Not found', { status: 404 });
  }

  const programs = await trpc.classes.programs.query({
    institutionId: institution.id,
    includeArchived: true,
  });
  const program = programs.find(p => p.id === programId);
  if (!program) {
    throw new Response('Not found', { status: 404 });
  }

  return data({ institution, program, roster });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUser(request);
  const programId = params.programId as string;
  const formData = await request.formData();
  const trpc = await createServerClient(request);
  const intent = String(formData.get('intent') ?? '');

  try {
    if (intent === 'add-learner') {
      const email = String(formData.get('email') ?? '').trim();
      await trpc.classes.addLearner.mutate({
        programId,
        firstName: String(formData.get('firstName') ?? '').trim(),
        lastInitial: String(formData.get('lastInitial') ?? '').trim() || undefined,
        isMinor: formData.get('isMinor') === 'on',
        email: email || undefined,
        relation: formData.get('isMinor') === 'on' ? 'guardian' : 'self',
      });
      return redirect(`/teaching/${programId}`);
    }

    if (intent === 'grant-pack') {
      const delta = Number(formData.get('delta'));
      const reason = String(formData.get('reason') ?? '').trim();
      const screenshotKey = String(formData.get('screenshotKey') ?? '').trim();
      if (!Number.isInteger(delta) || delta === 0) {
        return data({ error: 'Enter a whole number of classes.' }, { status: 400 });
      }
      await trpc.classes.grantPack.mutate({
        programId,
        learnerId: String(formData.get('learnerId') ?? ''),
        delta,
        reason: reason || undefined,
        screenshotKey: screenshotKey || undefined,
      });
      return redirect(`/teaching/${programId}`);
    }

    if (intent === 'group-session') {
      const result = await trpc.classes.markGroupSession.mutate({
        programId,
        notes: String(formData.get('notes') ?? '').trim() || undefined,
      });
      return redirect(`/teaching/${programId}?marked=${result.sessions.length}`);
    }
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : 'Something went wrong' },
      { status: 400 }
    );
  }

  return data({ error: 'Unknown action' }, { status: 400 });
}

export default function ProgramRoster() {
  const { institution, program, roster } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === 'submitting';

  return (
    <Chrome isTeacher headerRight={<SignOutButton />}>
      <div className="space-y-6">
        <div>
          <Link to="/teaching" className="text-sm text-primary underline">
            ← All classes
          </Link>
          <PageTitle className="mt-2">{programDisplayTitle(program)}</PageTitle>
          <p className="text-sm text-muted-foreground">
            {roster.length} {roster.length === 1 ? 'student' : 'students'}
          </p>
        </div>

        {actionData && 'error' in actionData && actionData.error ? (
          <p className="text-sm text-destructive" role="alert">
            {actionData.error}
          </p>
        ) : null}

        {program.isGroup ? (
          <details className="rounded-lg border border-border p-4">
            <summary className="min-h-tap cursor-pointer font-medium">
              Mark today's class for everyone
            </summary>
            <Form method="post" className="mt-4 space-y-4">
              <input type="hidden" name="intent" value="group-session" />
              <Field
                label="What you covered"
                htmlFor="notes"
                hint="Optional here. You will be asked for it again when you confirm."
              >
                <Textarea id="notes" name="notes" rows={3} />
              </Field>
              <Button type="submit" size="wide" pending={pending}>
                Mark for all {roster.filter(r => r.status === 'active').length} students
              </Button>
            </Form>
          </details>
        ) : null}

        <section className="space-y-3">
          <SectionTitle>Students</SectionTitle>
          {roster.length === 0 ? (
            <EmptyState title="Nobody on this class yet">
              Add a student below. They get access when they sign in with the email you give.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {roster.map(enrollment => (
                <li key={enrollment.learnerId}>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-base">{enrollment.learnerName}</CardTitle>
                        {enrollment.status === 'ended' ? <Badge>Left</Badge> : null}
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
                    <CardContent className="space-y-3 pt-0">
                      <Link
                        to={`/learners/${enrollment.learnerId}/${program.id}`}
                        className={buttonVariants({ variant: 'outline' })}
                      >
                        History
                      </Link>

                      <details className="rounded-md border border-border p-3">
                        <summary className="min-h-tap cursor-pointer text-sm font-medium">
                          Record a payment
                        </summary>
                        <Form method="post" className="mt-3 space-y-3">
                          <input type="hidden" name="intent" value="grant-pack" />
                          <input type="hidden" name="learnerId" value={enrollment.learnerId} />

                          <Field
                            label="Classes"
                            htmlFor={`delta-${enrollment.learnerId}`}
                            hint="A negative number corrects a mistake, and then a reason is required."
                          >
                            <Input
                              id={`delta-${enrollment.learnerId}`}
                              name="delta"
                              type="number"
                              inputMode="numeric"
                              defaultValue={program.defaultPackSize ?? 8}
                            />
                          </Field>

                          <Field label="Note" htmlFor={`reason-${enrollment.learnerId}`}>
                            <Input
                              id={`reason-${enrollment.learnerId}`}
                              name="reason"
                              placeholder="e.g. paid by UPI"
                            />
                          </Field>

                          <ScreenshotField institutionId={institution.id} />

                          <Button type="submit" size="wide" pending={pending}>
                            Record
                          </Button>
                        </Form>
                      </details>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <details className="rounded-lg border border-border p-4">
          <summary className="min-h-tap cursor-pointer font-medium">Add a student</summary>
          <Form method="post" className="mt-4 space-y-4">
            <input type="hidden" name="intent" value="add-learner" />

            <Field label="First name" htmlFor="firstName">
              <Input id="firstName" name="firstName" required maxLength={80} />
            </Field>

            <Field
              label="Last initial"
              htmlFor="lastInitial"
              hint="Only if you teach two students with the same first name."
            >
              <Input id="lastInitial" name="lastInitial" maxLength={4} />
            </Field>

            <Field
              label="Email to share with"
              htmlFor="email"
              hint="A parent's address for a child. They get access when they next sign in."
            >
              <Input id="email" name="email" type="email" inputMode="email" autoComplete="off" />
            </Field>

            {/* No date of birth anywhere. This is a policy flag the guru sets, not a fact the
                product derives — collecting a birthday would put a child's data in scope. */}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isMinor" className="size-5" defaultChecked />
              Under 18 (a parent keeps access)
            </label>

            <Button type="submit" size="wide" pending={pending}>
              Add student
            </Button>
          </Form>
        </details>
      </div>
    </Chrome>
  );
}
