import { creditBalanceLabel, isLowBalance } from '@rasika/core/domain/class-enrollment/client';
import { programDisplayTitle } from '@rasika/core/domain/class-program/client';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageTitle,
  SectionTitle,
  Table,
  TableScroll,
  Td,
  Textarea,
  Th,
  Tr,
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
import { FormDialog } from '~/components/form-dialog';
import { LocalTime } from '~/components/local-time';
import { createServerClient } from '~/lib/api.server';
import { requireUserId } from '~/lib/auth.server';
import { formatDayShort, formatDayShortStable } from '~/lib/format';
import { pageMeta } from '~/lib/meta';

export const meta = () => pageMeta('Class');

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  const trpc = await createServerClient(request);
  const programId = params.programId as string;

  // `getMyContexts`, not `myInstitution`. The latter is `listInstitutionsByOwner`, so a
  // co-teacher — who owns nothing — got a 404 on every program they teach, which is the exact
  // case the `classTeacher` junction was introduced to serve.
  //
  // And one program by id rather than the institution's entire list, archived included, filtered
  // down to the one the URL already names.
  const [contexts, program, roster] = await Promise.all([
    trpc.classes.getMyContexts.query(),
    trpc.classes.program.query({ programId }),
    trpc.classes.roster.query({ programId }),
  ]);

  if (!program) {
    throw new Response('Not found', { status: 404 });
  }

  const institution = { id: program.institutionId };
  return data({ contexts, institution, program, roster });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserId(request);
  const programId = params.programId as string;
  const formData = await request.formData();
  const trpc = await createServerClient(request);
  const intent = String(formData.get('intent') ?? '');

  try {
    if (intent === 'add-learner') {
      const email = String(formData.get('email') ?? '').trim();
      if (!email) {
        return data(
          { error: 'An email is needed so they can see their classes.' },
          { status: 400 }
        );
      }
      await trpc.classes.addLearner.mutate({
        programId,
        firstName: String(formData.get('firstName') ?? '').trim(),
        lastInitial: String(formData.get('lastInitial') ?? '').trim() || undefined,
        isMinor: formData.get('isMinor') === 'on',
        email,
        relation: formData.get('isMinor') === 'on' ? 'guardian' : 'self',
      });
      return redirect(`/teaching/${programId}`);
    }

    // The guru recording a class the student forgot to mark. Confirmed on the spot — she is the
    // one recording it, so there is nobody left to ask.
    if (intent === 'mark-class') {
      await trpc.classes.markClassForLearner.mutate({
        programId,
        learnerId: String(formData.get('learnerId') ?? ''),
        sessionDate: String(formData.get('sessionDate') ?? '') || undefined,
        notes: String(formData.get('notes') ?? '').trim() || undefined,
      });
      return redirect(`/teaching/${programId}`);
    }

    if (intent === 'archive') {
      await trpc.classes.archiveProgram.mutate({
        programId,
        archived: formData.get('archived') === '1',
      });
      return redirect(formData.get('archived') === '1' ? '/teaching' : `/teaching/${programId}`);
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
  const { contexts, program, roster } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === 'submitting';
  const active = roster.filter(row => row.status === 'active');

  return (
    <Chrome isTeacher isLearner={contexts.learners.length > 0} headerRight={<SignOutButton />}>
      <div className="space-y-6">
        <div>
          <Link to="/teaching" className="text-sm text-primary underline">
            ← All classes
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <PageTitle>{programDisplayTitle(program)}</PageTitle>
              <p className="text-sm text-muted-foreground">
                {program.type === 'workshop' ? 'Workshop' : 'Weekly'} ·{' '}
                {program.defaultMode === 'online' ? 'Online' : 'In person'} ·{' '}
                {program.skipPolicy === 'burn'
                  ? 'missed classes are counted'
                  : 'missed classes are not counted'}
              </p>
            </div>
            {/* Archiving belongs to the class, not to a row in a list of classes. */}
            <Form method="post">
              <input type="hidden" name="intent" value="archive" />
              <input type="hidden" name="archived" value={program.archivedAt ? '0' : '1'} />
              <Button type="submit" variant="ghost">
                {program.archivedAt ? 'Unarchive' : 'Archive'}
              </Button>
            </Form>
          </div>
        </div>

        {actionData && 'error' in actionData && actionData.error ? (
          <p className="text-sm text-destructive" role="alert">
            {actionData.error}
          </p>
        ) : null}

        {program.isGroup ? (
          <FormDialog
            trigger="Mark today's class"
            triggerVariant="primary"
            title="Mark today's class"
            description={`This marks it for all ${active.length} students on the class. Anyone who missed it, you can mark absent afterwards.`}
          >
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="group-session" />
              <Field label="What you covered" htmlFor="notes" hint="Optional.">
                <Textarea id="notes" name="notes" rows={3} />
              </Field>
              <Button type="submit" size="wide" pending={pending}>
                Mark for all {active.length} students
              </Button>
            </Form>
          </FormDialog>
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle>Students</SectionTitle>
            <FormDialog
              trigger="+ Add student"
              title="Add a student"
              description="They get access when they sign in with the email you give."
            >
              <Form method="post" className="space-y-4">
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
                  hint="A parent's address for a child. They get access when they sign in with it."
                >
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    required
                  />
                </Field>

                {/* No date of birth anywhere. This is a policy flag the guru sets, not a fact the
                    product derives — collecting a birthday would put a child's data in scope. */}
                <label className="flex min-h-tap items-center gap-3 text-sm">
                  <input type="checkbox" name="isMinor" className="size-6" defaultChecked />
                  Under 18 (a parent keeps access)
                </label>

                <Button type="submit" size="wide" pending={pending}>
                  Add student
                </Button>
              </Form>
            </FormDialog>
          </div>

          {roster.length === 0 ? (
            <EmptyState title="Nobody on this class yet">
              Add a student below. They get access when they sign in with the email you give.
            </EmptyState>
          ) : (
            /*
              A table, because the guru is comparing rows: who has run out, who has not paid, who
              has not been in for a fortnight. Cards put one learner per screenful and made every
              one of those questions a scroll.

              `TableScroll` is what keeps a wide table from scrolling the document sideways — on
              iOS that drags the whole app shell, not just the table.
            */
            <TableScroll className="rounded-lg border border-border">
              <Table>
                <caption className="sr-only">
                  Students on {programDisplayTitle(program)}. Each row opens that student's history.
                </caption>
                <thead>
                  <Tr>
                    <Th scope="col">Name</Th>
                    <Th scope="col">Last class</Th>
                    <Th scope="col">Last paid</Th>
                    {/* "Left" meant remaining here and departed on the badge below — the same
                        word for opposite things, in a table read by scanning. */}
                    <Th scope="col" className="text-right">
                      Classes left
                    </Th>
                    {/* Only on a one-to-one: a group class is marked for everyone at once from
                        the button by the title, and a per-row control there would invite the guru
                        to mark twelve people one at a time. */}
                    {program.isGroup ? null : (
                      <Th scope="col" className="text-right">
                        <span className="sr-only">Record a class</span>
                      </Th>
                    )}
                  </Tr>
                </thead>
                <tbody>
                  {roster.map(enrollment => (
                    <Tr key={enrollment.learnerId} className="hover:bg-accent/40">
                      <Td>
                        {/*
                          The link is on the name rather than the row. A whole `<tr>` cannot be an
                          anchor without either nesting one per cell — which reads as four links to
                          a screen reader — or faking it with JavaScript, which kills middle-click
                          and copy-link. One clear target, padded to a real tap size.
                        */}
                        <Link
                          to={`/learners/${enrollment.learnerId}/${program.id}`}
                          className="flex min-h-tap items-center whitespace-nowrap font-medium text-primary underline"
                        >
                          {enrollment.learnerName}
                        </Link>
                        {/* `Ended`, matching `ENROLLMENT_STATUSES`. */}
                        {enrollment.status === 'ended' ? (
                          <Badge className="ml-2">Ended</Badge>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {enrollment.lastSessionDate ? (
                          <LocalTime fallback={formatDayShortStable(enrollment.lastSessionDate)}>
                            {() => formatDayShort(enrollment.lastSessionDate as string)}
                          </LocalTime>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {enrollment.lastPaidAt ? (
                          <LocalTime
                            fallback={formatDayShortStable(enrollment.lastPaidAt.slice(0, 10))}
                          >
                            {() => formatDayShort((enrollment.lastPaidAt as string).slice(0, 10))}
                          </LocalTime>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td
                        className={`text-right tabular-nums ${
                          isLowBalance(enrollment.creditsRemaining)
                            ? 'font-medium text-destructive'
                            : ''
                        }`}
                      >
                        {/* The number, with the words only where they change meaning — a
                            negative balance is "over", not minus three. */}
                        {enrollment.creditsRemaining < 0
                          ? creditBalanceLabel(enrollment.creditsRemaining)
                          : enrollment.creditsRemaining}
                      </Td>
                      {program.isGroup ? null : (
                        <Td className="text-right">
                          {enrollment.status === 'active' && !program.archivedAt ? (
                            <FormDialog
                              trigger="Mark class"
                              triggerVariant="ghost"
                              title={`Record a class for ${enrollment.learnerName}`}
                              description="For when they forget to. It is confirmed on the spot — you are the one recording it."
                            >
                              <Form method="post" className="space-y-4">
                                <input type="hidden" name="intent" value="mark-class" />
                                <input
                                  type="hidden"
                                  name="learnerId"
                                  value={enrollment.learnerId}
                                />
                                <Field
                                  label="Date"
                                  htmlFor={`mark-date-${enrollment.learnerId}`}
                                  hint="Leave blank for today."
                                >
                                  <Input
                                    id={`mark-date-${enrollment.learnerId}`}
                                    name="sessionDate"
                                    type="date"
                                  />
                                </Field>
                                <Field
                                  label="What you covered"
                                  htmlFor={`mark-notes-${enrollment.learnerId}`}
                                  hint="Optional."
                                >
                                  <Textarea
                                    id={`mark-notes-${enrollment.learnerId}`}
                                    name="notes"
                                    rows={3}
                                  />
                                </Field>
                                <Button type="submit" size="wide" pending={pending}>
                                  Record class
                                </Button>
                              </Form>
                            </FormDialog>
                          ) : null}
                        </Td>
                      )}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </section>
      </div>
    </Chrome>
  );
}
