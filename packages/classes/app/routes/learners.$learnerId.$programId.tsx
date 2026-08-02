import { creditBalanceLabel } from '@rasika/core/domain/class-enrollment/client';
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
import { LocalTime } from '~/components/local-time';
import { ScreenshotField } from '~/components/screenshot-field';
import { ScreenshotLink } from '~/components/screenshot-link';
import { createServerClient } from '~/lib/api.server';
import { requireUserId } from '~/lib/auth.server';
import {
  SESSION_STATUS_LABELS,
  SESSION_STATUS_TONES,
  autoConfirmOnLabel,
  formatInstant,
  formatInstantStable,
  formatSessionDate,
  formatSessionDateStable,
  modeLabel,
} from '~/lib/format';
import { pageMeta } from '~/lib/meta';

export const meta = () => pageMeta('History');

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  const trpc = await createServerClient(request);
  const learnerId = params.learnerId as string;
  const programId = params.programId as string;

  // Every one of these runs `assertClassAccess` server-side. A guardian who guesses another
  // family's ids gets FORBIDDEN, not a page.
  const [cards, sessions, packs, contexts] = await Promise.all([
    trpc.classes.learnerHome.query({ learnerId }),
    trpc.classes.sessions.query({ programId, learnerId }),
    trpc.classes.packs.query({ programId, learnerId }),
    trpc.classes.getMyContexts.query(),
  ]);

  const card = cards.find(entry => entry.enrollment.programId === programId);
  if (!card) {
    throw new Response('Not found', { status: 404 });
  }

  return data({
    card,
    sessions,
    packs: [...packs].reverse(),
    learnerId,
    programId,
    isTeacher: contexts.teaching.length > 0,
    isLearner: contexts.learners.length > 0,
    /**
     * Whether the viewer follows **this** learner, which is not the same as being a learner
     * somewhere. A guru reaches this page from her roster and has no access row for her student,
     * so sending her "back" to `/home` showed her her own empty learner list — which is correct
     * and useless. It decides where Back goes.
     */
    followsThisLearner: contexts.learners.some(learner => learner.id === learnerId),
  });
}

/**
 * Confirm, absent and dispute, from the history page.
 *
 * The review queue is for triage — a flat list of everything waiting, scanned once a week. This
 * is the other way round: the guru is *looking at one learner*, sees the class she remembers, and
 * has to settle it there rather than hold the row in her head and go hunting for it in a list.
 *
 * Teacher-only, but the check that matters is not here. Every one of these procedures runs
 * `assertTeacher` server-side, so a guardian who posts this form gets FORBIDDEN. Hiding the
 * controls is courtesy; the enforcement is in tRPC.
 */
export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const trpc = await createServerClient(request);

  const learnerId = params.learnerId as string;
  const programId = params.programId as string;
  const intent = String(formData.get('intent') ?? '');

  const institutionId = String(formData.get('institutionId') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();

  try {
    // The guru adding a class the student never marked, and recording a payment. Both used to
    // live a page away — on the roster, which is where she is *not* looking when she has one
    // learner's history open in front of her.
    if (intent === 'add-class') {
      await trpc.classes.markAttended.mutate({
        programId,
        learnerId,
        sessionDate: String(formData.get('sessionDate') ?? '') || undefined,
        notes: notes || undefined,
      });
      return redirect(`/learners/${learnerId}/${programId}`);
    }

    if (intent === 'add-payment') {
      const delta = Number(formData.get('delta'));
      const reason = String(formData.get('reason') ?? '').trim();
      const screenshotKey = String(formData.get('screenshotKey') ?? '').trim();
      if (!Number.isInteger(delta) || delta === 0) {
        return data({ error: 'Enter a whole number of classes.' }, { status: 400 });
      }
      await trpc.classes.grantPack.mutate({
        programId,
        learnerId,
        delta,
        reason: reason || undefined,
        screenshotKey: screenshotKey || undefined,
      });
      return redirect(`/learners/${learnerId}/${programId}`);
    }

    // `institutionId` is deliberately absent from the ref: the router derives it from the
    // program, because a wrong one cancels the transaction in a way that reads as "already
    // confirmed".
    const ref = {
      programId,
      learnerId,
      sessionDate: String(formData.get('sessionDate') ?? ''),
      id: String(formData.get('sessionId') ?? ''),
    };
    if (!ref.sessionDate || !ref.id) {
      return data({ error: 'Something was missing. Try again.' }, { status: 400 });
    }

    if (intent === 'confirm') {
      const [result] = await trpc.classes.confirmSessions.mutate({
        institutionId,
        refs: [ref],
        // Optional, and an empty one leaves the student's own note standing.
        notes: notes || undefined,
      });
      if (result && !result.applied) {
        return data({ error: 'That class had already been settled.' }, { status: 409 });
      }
    } else if (intent === 'absent') {
      await trpc.classes.markAbsent.mutate({ institutionId, ref, notes: notes || undefined });
    } else if (intent === 'dispute') {
      await trpc.classes.disputeSession.mutate({ institutionId, ref, notes: notes || undefined });
    } else {
      return data({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : 'Something went wrong' },
      { status: 400 }
    );
  }

  return redirect(`/learners/${learnerId}/${programId}`);
}

export default function LearnerLedger() {
  const { card, sessions, packs, learnerId, programId, isTeacher, isLearner, followsThisLearner } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === 'submitting';
  const { enrollment } = card;

  return (
    <Chrome isTeacher={isTeacher} isLearner={isLearner} headerRight={<SignOutButton />}>
      <div className="space-y-6">
        <div>
          {/* Back to wherever this page is actually reached from. A guardian arrives from their
              own card; a guru arrives from the program roster and has no access row for the
              learner, so `/home` would show her an empty list of her own children. */}
          <Link
            to={
              followsThisLearner
                ? `/home?learner=${encodeURIComponent(learnerId)}`
                : `/teaching/${programId}`
            }
            className="text-sm text-primary underline"
          >
            {followsThisLearner ? '← Back' : '← Back to the class'}
          </Link>
          <PageTitle className="mt-2">{enrollment.learnerName}</PageTitle>
          <p className="text-sm text-muted-foreground">
            {programDisplayTitle({
              title: enrollment.programTitle,
              type: enrollment.programType,
            })}{' '}
            · {creditBalanceLabel(enrollment.creditsRemaining)}
          </p>
        </div>

        {actionData && 'error' in actionData && actionData.error ? (
          <p className="text-sm text-destructive" role="alert">
            {actionData.error}
          </p>
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle>Classes</SectionTitle>
            {isTeacher ? (
              <a href="#add-class" className={buttonVariants({ variant: 'outline' })}>
                + Add class
              </a>
            ) : null}
          </div>

          {sessions.length === 0 ? (
            <EmptyState title="No classes recorded yet">
              When a class is marked, it appears here with whatever your teacher noted.
            </EmptyState>
          ) : (
            /*
              A table, so a term of classes reads as a term of classes. As cards it was one
              screenful per lesson, which made "when did we last do the varnam" a scroll rather
              than a glance — and the notes are the thing this product exists to keep.
            */
            <TableScroll className="rounded-lg border border-border">
              <Table>
                <caption className="sr-only">
                  Classes for {enrollment.learnerName}, newest first.
                </caption>
                <thead>
                  <Tr>
                    <Th scope="col">Date</Th>
                    <Th scope="col">Type</Th>
                    <Th scope="col">Notes</Th>
                    <Th scope="col" className="text-right">
                      {isTeacher ? 'Actions' : 'Status'}
                    </Th>
                  </Tr>
                </thead>
                <tbody>
                  {sessions.map(session => (
                    <Tr key={session.id}>
                      <Td className="whitespace-nowrap align-top">
                        <LocalTime fallback={formatSessionDateStable(session)}>
                          {() => formatSessionDate(session)}
                        </LocalTime>
                        {session.status === 'pending' && session.autoConfirmAt ? (
                          <span className="block text-xs text-muted-foreground">
                            <LocalTime fallback="confirms automatically soon">
                              {() => autoConfirmOnLabel(session.autoConfirmAt)}
                            </LocalTime>
                          </span>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap align-top text-muted-foreground">
                        {modeLabel(session.mode)}
                      </Td>
                      {/* The widest column and the only one allowed to wrap: the note is the
                          durable value here, not the metadata around it. */}
                      <Td className="w-full align-top">{session.notes || '—'}</Td>
                      <Td className="align-top text-right">
                        {isTeacher && session.status === 'pending' ? (
                          <SettleSession
                            session={session}
                            institutionId={enrollment.institutionId}
                            pending={pending}
                          />
                        ) : (
                          <Badge tone={SESSION_STATUS_TONES[session.status]}>
                            {SESSION_STATUS_LABELS[session.status]}
                          </Badge>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle>Payments</SectionTitle>
            {isTeacher ? (
              <a href="#add-payment" className={buttonVariants({ variant: 'outline' })}>
                + Add payment
              </a>
            ) : null}
          </div>

          {packs.length === 0 ? (
            <EmptyState title="No packs yet">
              Classes bought in advance show up here, with the screenshot where there is one.
            </EmptyState>
          ) : (
            <TableScroll className="rounded-lg border border-border">
              <Table>
                <caption className="sr-only">
                  Payments for {enrollment.learnerName}, newest first.
                </caption>
                <thead>
                  <Tr>
                    <Th scope="col">Date</Th>
                    <Th scope="col" className="text-right">
                      Classes
                    </Th>
                    <Th scope="col">Note</Th>
                    <Th scope="col">Screenshot</Th>
                  </Tr>
                </thead>
                <tbody>
                  {packs.map(pack => (
                    <Tr key={pack.id}>
                      <Td className="whitespace-nowrap align-top text-muted-foreground">
                        <LocalTime fallback={formatInstantStable(pack.createdAt)}>
                          {() => formatInstant(pack.createdAt)}
                        </LocalTime>
                      </Td>
                      <Td className="whitespace-nowrap text-right align-top tabular-nums font-medium">
                        {pack.delta > 0 ? `+${pack.delta}` : pack.delta}
                      </Td>
                      {/* A correction always carries its reason. That is the whole argument for
                          an append-only ledger: "why do I have seven credits" stays answerable. */}
                      <Td className="w-full align-top">{pack.reason || '—'}</Td>
                      <Td className="align-top">
                        {pack.screenshotKey ? (
                          <ScreenshotLink
                            programId={programId}
                            learnerId={learnerId}
                            packId={pack.id}
                          />
                        ) : (
                          '—'
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </section>

        {isTeacher ? (
          <>
            <details className="rounded-lg border border-border p-4">
              <summary className="min-h-tap cursor-pointer font-medium">Add a class</summary>
              {/* Id on the form, not the `<details>` — a fragment aimed at a closed disclosure
                  scrolls to it without opening it. */}
              <Form id="add-class" method="post" className="mt-4 space-y-4">
                <input type="hidden" name="intent" value="add-class" />
                <Field
                  label="Date"
                  htmlFor="add-class-date"
                  hint="Leave blank for today. A class cannot be added before it has happened."
                >
                  <Input id="add-class-date" name="sessionDate" type="date" />
                </Field>
                <Field label="What you covered" htmlFor="add-class-notes" hint="Optional.">
                  <Textarea id="add-class-notes" name="notes" rows={3} />
                </Field>
                <Button type="submit" size="wide" pending={pending}>
                  Add class
                </Button>
              </Form>
            </details>

            <details className="rounded-lg border border-border p-4">
              <summary className="min-h-tap cursor-pointer font-medium">Record a payment</summary>
              <Form id="add-payment" method="post" className="mt-4 space-y-4">
                <input type="hidden" name="intent" value="add-payment" />
                <input type="hidden" name="institutionId" value={enrollment.institutionId} />
                <Field
                  label="Classes"
                  htmlFor="delta"
                  hint="A negative number corrects a mistake, and then a reason is required."
                >
                  <Input
                    id="delta"
                    name="delta"
                    type="number"
                    inputMode="numeric"
                    defaultValue={8}
                  />
                </Field>
                <Field label="Note" htmlFor="reason">
                  <Input id="reason" name="reason" placeholder="e.g. paid by UPI" />
                </Field>
                <ScreenshotField institutionId={enrollment.institutionId} />
                <Button type="submit" size="wide" pending={pending}>
                  Record
                </Button>
              </Form>
            </details>
          </>
        ) : null}
      </div>
    </Chrome>
  );
}

/**
 * The inline settle control, in the Actions column.
 *
 * A disclosure rather than three buttons per row: her default action is still to do nothing —
 * everything here auto-confirms — and a table that shouts on every row is one she reads less.
 */
function SettleSession({
  session,
  institutionId,
  pending,
}: {
  session: { id: string; sessionDate: string };
  institutionId: string;
  pending: boolean;
}) {
  return (
    <details className="text-left">
      <summary className="inline-flex min-h-tap cursor-pointer items-center text-sm text-primary underline">
        Settle
      </summary>
      <Form method="post" className="mt-2 space-y-2">
        <input type="hidden" name="sessionId" value={session.id} />
        <input type="hidden" name="sessionDate" value={session.sessionDate} />
        <input type="hidden" name="institutionId" value={institutionId} />
        <Textarea
          name="notes"
          rows={2}
          aria-label="What you covered"
          placeholder="What you covered (optional)"
        />
        <Button type="submit" name="intent" value="confirm" size="wide" pending={pending}>
          Confirm
        </Button>
        <div className="flex gap-2">
          <Button
            type="submit"
            name="intent"
            value="absent"
            variant="outline"
            className="flex-1"
            pending={pending}
          >
            Did not attend
          </Button>
          <Button
            type="submit"
            name="intent"
            value="dispute"
            variant="destructive"
            className="flex-1"
            pending={pending}
          >
            Did not happen
          </Button>
        </div>
      </Form>
    </details>
  );
}
