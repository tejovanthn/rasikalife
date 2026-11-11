import { useDashboard } from '~/components/dashboard-context';
import { Stat } from '~/components/shell';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';

export const meta = () => pageMeta(SABHA_COPY.tabs.followers);

/**
 * Counts only: total, new this month, sharing with this target, and how many stopped sharing
 * this month. A withdrawal reaches a sabha as a number, never a name and never a notification.
 */
export default function Followers() {
  const { overview } = useDashboard();
  const { followers } = overview;

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={SABHA_COPY.followersScreen.total} value={followers.total} />
        <Stat label={SABHA_COPY.overviewCards.newThisMonth} value={followers.newThisMonth} />
        <Stat label={SABHA_COPY.followersScreen.sharing} value={followers.sharing} />
        <Stat
          label={SABHA_COPY.followersScreen.stoppedSharing}
          value={followers.stoppedSharingThisMonth}
        />
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">{SABHA_EXTRA_COPY.followersNote}</p>
    </>
  );
}
