import { Badge, EmptyState, PageTitle } from '@rasika/ui';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, redirect, useLoaderData } from 'react-router';
import { Shell } from '~/components/shell';
import { createServerClient } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { dashboardPath, isTargetType } from '~/lib/sabha';

export const meta = () => pageMeta();

/**
 * The resolver. No dashboard: pending invites go to `/invite`, otherwise the No access copy. Exactly one: straight into it. Several: a
 * list to pick from (the header switcher then moves between them). The server decides, so there
 * is no flash of the wrong screen.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const trpc = await createServerClient(request);
  const mine = await trpc.partner.mine.query();
  const first = mine[0];
  // No dashboard yet but an invite waiting: the invite page is where it is accepted (decision 20).
  if (mine.length === 0) {
    const { pending, expired } = await trpc.partner.pendingInvites.query();
    if (pending.length > 0 || expired.length > 0) throw redirect('/invite');
  }
  if (mine.length === 1 && first && isTargetType(first.targetType)) {
    throw redirect(dashboardPath(first.targetType, first.targetId));
  }
  return { mine };
}

export default function Home() {
  const { mine } = useLoaderData<typeof loader>();

  if (mine.length === 0) {
    return (
      <Shell>
        <EmptyState title={SABHA_COPY.noAccess} />
      </Shell>
    );
  }

  return (
    <Shell switcher={mine}>
      <PageTitle className="mb-4">{SABHA_EXTRA_COPY.chooseHeading}</PageTitle>
      <ul className="space-y-2">
        {mine.map(item =>
          isTargetType(item.targetType) ? (
            <li key={`${item.targetType}:${item.targetId}`}>
              <Link
                to={dashboardPath(item.targetType, item.targetId)}
                className="flex min-h-tap items-center justify-between gap-3 rounded-lg border border-border p-4 no-underline hover:bg-accent"
              >
                <span className="font-medium">{item.targetName}</span>
                <span className="flex items-center gap-2">
                  <Badge>{SABHA_EXTRA_COPY.typeLabel[item.targetType]}</Badge>
                  <Badge tone="neutral">{SABHA_EXTRA_COPY.roleLabel[item.role]}</Badge>
                </span>
              </Link>
            </li>
          ) : null
        )}
      </ul>
    </Shell>
  );
}
