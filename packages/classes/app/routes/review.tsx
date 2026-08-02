import { programDisplayTitle } from '@rasika/core/domain/class-program/client';
import { BULK_CONFIRM_LIMIT, groupSessions } from '@rasika/core/domain/class-session/client';
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
  Textarea,
} from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import { Chrome, SignOutButton } from '~/components/chrome';
import { createServerClient } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { autoConfirmLabel, formatSessionDate, modeLabel } from '~/lib/format';

type Ref = { programId: string; learnerId: string; sessionDate: string; id: string };

/** `programId|learnerId|sessionDate|id`, because a checkbox carries exactly one string. */
function encodeRef(session: Ref): string {
  return [session.programId, session.learnerId, session.sessionDate, session.id].join('|');
}

function decodeRef(value: string): Ref | null {
  const [programId, learnerId, sessionDate, id] = value.split('|');
  return programId && learnerId && sessionDate && id
    ? { programId, learnerId, sessionDate, id }
    : null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const trpc = await createServerClient(request);

  const institution = await trpc.classes.myInstitution.query();
  if (!institution) {
    throw new Response('Not found', { status: 404 });
  }

  const [pending, programs] = await Promise.all([
    trpc.classes.reviewQueue.query({ institutionId: institution.id }),
    trpc.classes.programs.query({ institutionId: institution.id, includeArchived: true }),
  ]);

  // A twelve-person workshop is twelve rows in the ledger and one row here. Solo classes are
  // groups of one, so they fall out of the same grouping with no special case.
  const groups = groupSessions(pending);
  const titles = Object.fromEntries(programs.map(p => [p.id, programDisplayTitle(p)]));

  return data({ institution, groups, titles });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const formData = await request.formData();
  const trpc = await createServerClient(request);
  const institutionId = String(formData.get('institutionId') ?? '');
  const intent = String(formData.get('intent') ?? '');

  const direct = formData
    .getAll('ref')
    .map(value => decodeRef(String(value)))
    .filter((ref): ref is Ref => ref !== null);

  /**
   * A group is selected by its id and expanded here, not in the browser.
   *
   * One checkbox carries one value, so ticking "this workshop" cannot enumerate its twelve rows
   * client-side without JavaScript. Expanding server-side also means the set acted on is the
   * set that exists *now* — a learner who marked the same class between page load and submit is
   * included rather than quietly skipped.
   */
  const groupIds = formData.getAll('group').map(String).filter(Boolean);
  const expanded = await Promise.all(
    groupIds.map(groupSessionId =>
      trpc.classes.groupSessions.query({ institutionId, groupSessionId })
    )
  );

  const seen = new Set<string>();
  const refs: Ref[] = [];
  for (const ref of [...direct, ...expanded.flat().filter(s => s.status === 'pending')]) {
    const key = encodeRef(ref);
    if (!seen.has(key)) {
      seen.add(key);
      refs.push(ref);
    }
  }

  if (refs.length === 0) {
    return data({ error: 'Nothing selected.' }, { status: 400 });
  }

  try {
    if (intent === 'confirm') {
      const notes = String(formData.get('notes') ?? '').trim();
      if (!notes) {
        return data({ error: 'Add a note about what you covered.' }, { status: 400 });
      }
      const results = await trpc.classes.confirmSessions.mutate({
        institutionId,
        refs: refs.slice(0, BULK_CONFIRM_LIMIT),
        notes,
      });
      // Per-row results, not one boolean. One failure in a selection of fifty must not silently
      // drop the other forty-nine, and she has to be told which ones did not go through.
      const failed = results.filter(result => !result.applied);
      if (failed.length > 0) {
        return data({
          error: `${failed.length} of ${results.length} had already been settled and were left alone.`,
        });
      }
      return redirect('/review');
    }

    if (intent === 'absent' || intent === 'dispute') {
      const notes = String(formData.get('notes') ?? '').trim() || undefined;
      for (const ref of refs.slice(0, BULK_CONFIRM_LIMIT)) {
        if (intent === 'absent') {
          await trpc.classes.markAbsent.mutate({ institutionId, ref, notes });
        } else {
          await trpc.classes.disputeSession.mutate({ institutionId, ref, notes });
        }
      }
      return redirect('/review');
    }
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : 'Something went wrong' },
      { status: 400 }
    );
  }

  return data({ error: 'Unknown action' }, { status: 400 });
}

export default function ReviewQueue() {
  const { institution, groups, titles } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === 'submitting';
  const total = groups.reduce((sum, group) => sum + group.sessions.length, 0);

  return (
    <Chrome title="Review" isTeacher headerRight={<SignOutButton />}>
      <div className="space-y-5">
        <div>
          <PageTitle>Review</PageTitle>
          {/* Saying this out loud is the point. Her default action is to do nothing — she opens
              this to catch mistakes, not to grant permission. */}
          <p className="mt-1 text-sm text-muted-foreground">
            Classes your students marked. Anything you leave alone confirms itself after seven days.
          </p>
        </div>

        {actionData && 'error' in actionData && actionData.error ? (
          <p className="text-sm text-destructive" role="alert">
            {actionData.error}
          </p>
        ) : null}

        {groups.length === 0 ? (
          <EmptyState title="Nothing waiting">
            Everything your students have marked has been settled.
          </EmptyState>
        ) : (
          <Form method="post" className="space-y-4">
            <input type="hidden" name="institutionId" value={institution.id} />

            <ul className="space-y-3">
              {groups.map(group => {
                const first = group.sessions[0];
                if (!first) {
                  return null;
                }
                const isGroup = group.sessions.length > 1;
                const title = titles[first.programId] ?? 'Class';

                return (
                  <li key={group.groupSessionId}>
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            // A group ticks by its id and is expanded server-side; a solo class
                            // carries its own ref. Same form, two names, no JavaScript needed.
                            name={isGroup ? 'group' : 'ref'}
                            value={isGroup ? group.groupSessionId : encodeRef(first)}
                            className="mt-1 size-5 shrink-0"
                            aria-label={
                              isGroup
                                ? `Select all ${group.sessions.length} students, ${title}, ${formatSessionDate(first)}`
                                : `Select ${first.learnerName}, ${formatSessionDate(first)}`
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base">
                              {isGroup ? title : first.learnerName}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {formatSessionDate(first)} · {isGroup ? '' : `${title} · `}
                              {modeLabel(first.mode)} · {autoConfirmLabel(first.autoConfirmAt)}
                            </p>
                          </div>
                          {isGroup ? <Badge tone="primary">{group.sessions.length}</Badge> : null}
                        </div>
                      </CardHeader>

                      {isGroup ? (
                        <CardContent className="pt-0">
                          <details>
                            <summary className="min-h-tap cursor-pointer text-sm text-muted-foreground">
                              Who marked it
                            </summary>
                            {/* Ticking individuals here is how one absentee gets a different
                                answer from the rest of the group. */}
                            <ul className="mt-2 space-y-2">
                              {group.sessions.map(session => (
                                <li key={session.id} className="flex items-center gap-3 text-sm">
                                  <input
                                    type="checkbox"
                                    name="ref"
                                    value={encodeRef(session)}
                                    className="size-5"
                                    aria-label={`Select ${session.learnerName}`}
                                  />
                                  <span>{session.learnerName}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        </CardContent>
                      ) : null}

                      {first.notes ? (
                        <CardContent className="pt-0 text-sm">{first.notes}</CardContent>
                      ) : null}
                    </Card>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-3 rounded-lg border border-border p-4">
              <Field
                label="What you covered"
                htmlFor="notes"
                hint="Required to confirm. Your students read this later."
              >
                <Textarea id="notes" name="notes" rows={3} />
              </Field>

              <Button
                type="submit"
                name="intent"
                value="confirm"
                size="wide"
                pending={pending}
                pendingLabel="Confirming…"
              >
                Confirm selected
              </Button>

              {/* Dispute is as prominent as confirm, because confirm is the thing that happens
                  by itself. The only reason to open this screen is to stop something. */}
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

              {total > BULK_CONFIRM_LIMIT ? (
                <p className="text-sm text-muted-foreground">
                  Up to {BULK_CONFIRM_LIMIT} at a time.
                </p>
              ) : null}
            </div>
          </Form>
        )}
      </div>
    </Chrome>
  );
}
