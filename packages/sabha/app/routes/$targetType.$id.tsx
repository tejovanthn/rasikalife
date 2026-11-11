import { Badge, PageTitle } from '@rasika/ui';
import type { LoaderFunctionArgs } from 'react-router';
import { Outlet, data, useLoaderData, useLocation } from 'react-router';
import { Shell } from '~/components/shell';
import { createServerClient, errorCode, errorStatus } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { activeTab, dashboardTabs, isTargetType } from '~/lib/sabha';
import type { DashboardRole } from '~/lib/sabha';

export const meta = ({ data: loaded }: { data?: { overview?: { target: { name: string } } } }) =>
  pageMeta(loaded?.overview?.target.name);

/**
 * One call for the whole dashboard: `partner.overview` is also the access check, since it is a
 * `partnerProcedure`. A person who does not manage this organiser or venue gets a 403 here, and
 * so does every tab below, because each tab's own tRPC call is gated the same way. The layout
 * loader does not re-run when you move between tabs, so the overview is read once per visit.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  const { targetType, id } = params;
  if (!isTargetType(targetType) || !id) throw data(null, { status: 404 });

  const trpc = await createServerClient(request);
  try {
    const [overview, mine] = await Promise.all([
      trpc.partner.overview.query({ targetType, targetId: id }),
      trpc.partner.mine.query(),
    ]);
    return { targetType, targetId: id, overview, mine };
  } catch (error) {
    if (errorCode(error) === 'PARTNER_FORBIDDEN' || errorStatus(error) === 403) {
      throw data(null, { status: 403 });
    }
    if (errorStatus(error) === 404) throw data(null, { status: 404 });
    throw error;
  }
}

export default function Dashboard() {
  const { targetType, targetId, overview, mine } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const tabs = dashboardTabs(targetType, targetId);
  const role = overview.role as DashboardRole;

  return (
    <Shell
      switcher={mine}
      current={{ targetType, targetId }}
      tabs={tabs}
      activeTab={activeTab(tabs, pathname)}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <PageTitle>{overview.target.name}</PageTitle>
        <Badge>{SABHA_EXTRA_COPY.typeLabel[targetType]}</Badge>
        {overview.target.verifiedAt ? (
          <Badge tone="success" title={SABHA_COPY.verifiedTooltip(overview.target.name)}>
            {SABHA_COPY.verified}
          </Badge>
        ) : null}
        {role === 'moderator' ? (
          <Badge tone="warning">{SABHA_EXTRA_COPY.roleLabel.moderator}</Badge>
        ) : null}
      </div>
      <Outlet />
    </Shell>
  );
}
