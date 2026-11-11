import { EmptyState, PageTitle, buttonVariants } from '@rasika/ui';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, data, redirect, useLoaderData } from 'react-router';
import { Shell } from '~/components/shell';
import { createServerClient } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { dashboardPath, inviteOutcome, isTargetType } from '~/lib/sabha';

export const meta = () => pageMeta();

/**
 * Where the invite email's button lands. It signs the person in (`requireUser` keeps the query,
 * so the invited address survives the round trip) and accepts what is waiting for them.
 *
 * Three ways it can go, all with Copy strings:
 * - signed in with another address: the mismatch line, and nothing is accepted;
 * - an invite has expired: said so, with the name;
 * - accepted: straight into the dashboard.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const invited = new URL(request.url).searchParams.get('email');
  const trpc = await createServerClient(request);

  const outcome = inviteOutcome({ invitedEmail: invited, signedInEmail: user.email });
  if (outcome === 'mismatch') {
    return data({ state: 'mismatch' as const, invited: invited ?? '', expired: [], accepted: [] });
  }

  const { accepted, expired } = await trpc.partner.acceptInvites.mutate();
  const first = accepted[0];
  if (first && isTargetType(first.targetType)) {
    throw redirect(dashboardPath(first.targetType, first.targetId));
  }
  return data({
    state: expired.length > 0 ? ('expired' as const) : ('nothing' as const),
    invited: invited ?? '',
    expired,
    accepted,
  });
}

export default function Invite() {
  const loaded = useLoaderData<typeof loader>();

  return (
    <Shell>
      <PageTitle className="mb-4">{SABHA_EXTRA_COPY.brand}</PageTitle>
      {loaded.state === 'mismatch' ? (
        <p role="alert" className="max-w-md">
          {SABHA_COPY.inviteMismatch(loaded.invited)}
        </p>
      ) : null}
      {loaded.state === 'expired' ? (
        <ul className="max-w-md space-y-2">
          {loaded.expired.map(item => (
            <li key={`${item.targetType}:${item.targetId}`}>
              {SABHA_EXTRA_COPY.inviteExpired(item.targetName ?? item.targetId)}
            </li>
          ))}
        </ul>
      ) : null}
      {loaded.state === 'nothing' ? <EmptyState title={SABHA_EXTRA_COPY.inviteNothing} /> : null}
      <p className="mt-6">
        <Link to="/" className={buttonVariants({ variant: 'secondary' })}>
          {SABHA_EXTRA_COPY.home}
        </Link>
      </p>
    </Shell>
  );
}
