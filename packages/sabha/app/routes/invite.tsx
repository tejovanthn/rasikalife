import { Badge, Button, EmptyState, PageTitle, buttonVariants } from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, Link, data, redirect, useActionData, useLoaderData } from 'react-router';
import { Shell } from '~/components/shell';
import { createServerClient, errorCode, errorMessage } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { dashboardPath, inviteOutcome, isTargetType } from '~/lib/sabha';

export const meta = () => pageMeta();

/**
 * Where the invite email's button lands. It signs the person in (`requireUser` keeps the query,
 * so the invited address survives the round trip) and lists what is waiting for them. Nothing is
 * accepted until they tap "Accept invite" (owner decision 20): signing in never grants access.
 *
 * States, all with Copy strings:
 * - signed in with another address than the link names: the mismatch line, no list;
 * - invites waiting: one row each with its own Accept button;
 * - an invite has expired: said so, with the name;
 * - none: "There is no invite waiting for this account."
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const invited = new URL(request.url).searchParams.get('email');

  const outcome = inviteOutcome({ invitedEmail: invited, signedInEmail: user.email });
  if (outcome === 'mismatch') {
    return data({ invited: invited ?? '', mismatch: true, pending: [], expired: [] });
  }

  const trpc = await createServerClient(request);
  const { pending, expired } = await trpc.partner.pendingInvites.query();
  return data({ invited: invited ?? '', mismatch: false, pending, expired });
}

/** Accepts the one invite that was tapped. A plain form post, so it works without JavaScript. */
export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const targetType = String(form.get('targetType') ?? '');
  const targetId = String(form.get('targetId') ?? '');
  if (!isTargetType(targetType) || !targetId) throw data(null, { status: 400 });

  const trpc = await createServerClient(request);
  try {
    const accepted = await trpc.partner.acceptInvite.mutate({ targetType, targetId });
    return data({ ok: true as const, name: accepted.targetName, targetType, targetId });
  } catch (error) {
    const code = errorCode(error);
    // Expired, or no longer there: the list says which, from the server's own view.
    if (code === 'PARTNER_INVITE_EXPIRED' || code === 'PARTNER_INVITE_NOT_FOUND') {
      throw redirect('/invite');
    }
    if (code === 'PARTNER_INVITE_EMAIL_MISMATCH') {
      const invited = new URL(request.url).searchParams.get('email') ?? '';
      return data(
        { ok: false as const, message: SABHA_COPY.inviteMismatch(invited) },
        { status: 400 }
      );
    }
    return data({ ok: false as const, message: errorMessage(error) }, { status: 400 });
  }
}

export default function Invite() {
  const loaded = useLoaderData<typeof loader>();
  const done = useActionData<typeof action>();

  if (done?.ok) {
    return (
      <Shell>
        <PageTitle className="mb-4">{SABHA_EXTRA_COPY.brand}</PageTitle>
        <p className="max-w-md">{SABHA_EXTRA_COPY.inviteAccepted(done.name)}</p>
        <p className="mt-6">
          <Link
            to={dashboardPath(done.targetType, done.targetId)}
            className={buttonVariants({ variant: 'primary' })}
          >
            {SABHA_EXTRA_COPY.inviteOpen}
          </Link>
        </p>
      </Shell>
    );
  }

  const empty = !loaded.mismatch && loaded.pending.length === 0 && loaded.expired.length === 0;

  return (
    <Shell>
      <PageTitle className="mb-4">{SABHA_EXTRA_COPY.brand}</PageTitle>
      {done && !done.ok ? (
        <p role="alert" className="mb-4 max-w-md">
          {done.message}
        </p>
      ) : null}
      {loaded.mismatch ? (
        <p role="alert" className="max-w-md">
          {SABHA_COPY.inviteMismatch(loaded.invited)}
        </p>
      ) : null}
      {loaded.pending.length > 0 ? (
        <ul className="max-w-md space-y-3">
          {loaded.pending.map(item =>
            isTargetType(item.targetType) ? (
              <li
                key={`${item.targetType}:${item.targetId}`}
                className="space-y-3 rounded-lg border border-border p-4"
              >
                <p className="font-medium">{item.targetName}</p>
                <p className="flex flex-wrap items-center gap-2">
                  <Badge>{SABHA_EXTRA_COPY.typeLabel[item.targetType]}</Badge>
                  <Badge tone="neutral">{SABHA_EXTRA_COPY.roleLabel[item.role]}</Badge>
                  {item.inviterName ? (
                    <span className="text-sm text-muted-foreground">
                      {SABHA_EXTRA_COPY.inviteFrom(item.inviterName)}
                    </span>
                  ) : null}
                </p>
                <Form method="post">
                  <input type="hidden" name="targetType" value={item.targetType} />
                  <input type="hidden" name="targetId" value={item.targetId} />
                  <Button type="submit">{SABHA_EXTRA_COPY.inviteAccept}</Button>
                </Form>
              </li>
            ) : null
          )}
        </ul>
      ) : null}
      {loaded.expired.length > 0 ? (
        <ul className="mt-4 max-w-md space-y-2">
          {loaded.expired.map(item => (
            <li key={`${item.targetType}:${item.targetId}`}>
              {SABHA_EXTRA_COPY.inviteExpired(item.targetName)}
            </li>
          ))}
        </ul>
      ) : null}
      {empty ? <EmptyState title={SABHA_EXTRA_COPY.inviteNothing} /> : null}
      <p className="mt-6">
        <Link to="/" className={buttonVariants({ variant: 'secondary' })}>
          {SABHA_EXTRA_COPY.home}
        </Link>
      </p>
    </Shell>
  );
}
