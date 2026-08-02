import { creditBalanceLabel } from '@rasika/core/domain/class-enrollment/client';
import { programDisplayTitle } from '@rasika/core/domain/class-program/client';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageTitle,
  SectionTitle,
} from '@rasika/ui';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, data, useLoaderData } from 'react-router';
import { Chrome, SignOutButton } from '~/components/chrome';
import { ScreenshotLink } from '~/components/screenshot-link';
import { createServerClient } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import {
  SESSION_STATUS_LABELS,
  SESSION_STATUS_TONES,
  autoConfirmLabel,
  formatInstant,
  formatSessionDate,
  modeLabel,
} from '~/lib/format';
import { pageMeta } from '~/lib/meta';

export const meta = () => pageMeta('History');

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
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
  });
}

export default function LearnerLedger() {
  const { card, sessions, packs, learnerId, programId, isTeacher, isLearner } =
    useLoaderData<typeof loader>();
  const { enrollment } = card;

  return (
    <Chrome isTeacher={isTeacher} isLearner={isLearner} headerRight={<SignOutButton />}>
      <div className="space-y-6">
        <div>
          <Link
            to={`/home?learner=${encodeURIComponent(learnerId)}`}
            className="text-sm text-primary underline"
          >
            ← Back
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
                        <CardTitle className="text-base">{formatSessionDate(session)}</CardTitle>
                        <Badge tone={SESSION_STATUS_TONES[session.status]}>
                          {SESSION_STATUS_LABELS[session.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {modeLabel(session.mode)}
                        {session.status === 'pending' && session.autoConfirmAt
                          ? ` · ${autoConfirmLabel(session.autoConfirmAt)}`
                          : ''}
                      </p>
                    </CardHeader>
                    {/* The notes are the point of the whole product — what the learner still
                        reads two years later — so they are body text, not a tooltip. */}
                    {session.notes ? (
                      <CardContent className="pt-0 text-sm">{session.notes}</CardContent>
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
                        <CardTitle className="text-base">
                          {pack.delta > 0 ? `+${pack.delta}` : pack.delta}{' '}
                          {Math.abs(pack.delta) === 1 ? 'class' : 'classes'}
                        </CardTitle>
                        <span className="text-sm text-muted-foreground">
                          {formatInstant(pack.createdAt)}
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
