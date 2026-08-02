import { creditBalanceLabel } from '@rasika/core/domain/class-enrollment/client';
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
  PageTitle,
  SectionTitle,
  Textarea,
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

  // `institutionId` is deliberately absent: the router derives it from the program, because a
  // wrong one cancels the transaction in a way that reads as "already confirmed".
  const ref = {
    programId,
    learnerId,
    sessionDate: String(formData.get('sessionDate') ?? ''),
    id: String(formData.get('sessionId') ?? ''),
  };
  const institutionId = String(formData.get('institutionId') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();

  if (!ref.sessionDate || !ref.id) {
    return data({ error: 'Something was missing. Try again.' }, { status: 400 });
  }

  try {
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
          <PageTitle className="mt-2">
            {programDisplayTitle({
              title: enrollment.programTitle,
              type: enrollment.programType,
            })}
          </PageTitle>
          <p className="text-sm text-muted-foreground">
            {enrollment.learnerName} · {creditBalanceLabel(enrollment.creditsRemaining)}
          </p>
        </div>

        {actionData && 'error' in actionData && actionData.error ? (
          <p className="text-sm text-destructive" role="alert">
            {actionData.error}
          </p>
        ) : null}

        <section className="space-y-3">
          <SectionTitle>Classes</SectionTitle>
          {sessions.length === 0 ? (
            <EmptyState title="No classes recorded yet">
              When a class is marked, it appears here with whatever your teacher noted.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {sessions.map(session => (
                <li key={session.id}>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle as="h3" className="text-base">
                          {formatSessionDate(session)}
                        </CardTitle>
                        <Badge tone={SESSION_STATUS_TONES[session.status]}>
                          {SESSION_STATUS_LABELS[session.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {modeLabel(session.mode)}
                        {/* The absolute date, where the review queue gives the relative one.
                            There the rows are scanned and "in 6 days" triages; here one class is
                            being read, and the date is what somebody plans around. */}
                        {session.status === 'pending' && session.autoConfirmAt ? (
                          <>
                            {' · '}
                            <LocalTime fallback="confirms automatically in a few days">
                              {() => autoConfirmOnLabel(session.autoConfirmAt)}
                            </LocalTime>
                          </>
                        ) : null}
                      </p>
                    </CardHeader>
                    {/* The notes are the point of the whole product — what the learner still
                        reads two years later — so they are body text, not a tooltip. */}
                    {session.notes ? (
                      <CardContent className="pt-0 text-sm">{session.notes}</CardContent>
                    ) : null}

                    {/*
                      Only for a teacher, and only while there is something to settle. A
                      confirmed class is terminal, so a control that reopened it would be
                      offering to rewrite a ledger entry rather than to make one.

                      `<details>` rather than three buttons on every row: the guru's default
                      action here is still to do nothing, exactly as in the review queue, and a
                      history page that shouts at her about every class is one she reads less.
                    */}
                    {isTeacher && session.status === 'pending' ? (
                      <CardContent className="pt-0">
                        <details className="rounded-md border border-border p-3">
                          <summary className="min-h-tap cursor-pointer text-sm font-medium">
                            Confirm or dispute
                          </summary>
                          <Form method="post" className="mt-3 space-y-3">
                            <input type="hidden" name="sessionId" value={session.id} />
                            <input type="hidden" name="sessionDate" value={session.sessionDate} />
                            <input
                              type="hidden"
                              name="institutionId"
                              value={enrollment.institutionId}
                            />

                            <Field
                              label="What you covered"
                              htmlFor={`notes-${session.id}`}
                              hint="Optional. Your student reads this later."
                            >
                              <Textarea id={`notes-${session.id}`} name="notes" rows={3} />
                            </Field>

                            <Button
                              type="submit"
                              name="intent"
                              value="confirm"
                              size="wide"
                              pending={pending}
                              pendingLabel="Confirming…"
                            >
                              Confirm
                            </Button>

                            {/* As prominent as confirm, because confirm is the thing that
                                happens by itself. The only reason to open this is to stop it. */}
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
                      </CardContent>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <SectionTitle>Payments</SectionTitle>
          {packs.length === 0 ? (
            <EmptyState title="No packs yet">
              Classes bought in advance show up here, with the screenshot where there is one.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {packs.map(pack => (
                <li key={pack.id}>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle as="h3" className="text-base">
                          {pack.delta > 0 ? `+${pack.delta}` : pack.delta}{' '}
                          {Math.abs(pack.delta) === 1 ? 'class' : 'classes'}
                        </CardTitle>
                        <span className="text-sm text-muted-foreground">
                          <LocalTime fallback={formatInstantStable(pack.createdAt)}>
                            {() => formatInstant(pack.createdAt)}
                          </LocalTime>
                        </span>
                      </div>
                      {/* A correction always carries its reason. That is the whole argument for
                          an append-only ledger: "why do I have seven credits" stays answerable. */}
                      {pack.reason ? (
                        <p className="text-sm text-muted-foreground">{pack.reason}</p>
                      ) : null}
                    </CardHeader>
                    {pack.screenshotKey ? (
                      <CardContent className="pt-0">
                        <ScreenshotLink
                          programId={programId}
                          learnerId={learnerId}
                          packId={pack.id}
                        />
                      </CardContent>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Chrome>
  );
}
