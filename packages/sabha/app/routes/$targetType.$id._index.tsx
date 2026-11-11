import { SectionTitle } from '@rasika/ui';
import { useDashboard } from '~/components/dashboard-context';
import { Stat } from '~/components/shell';
import { SABHA_COPY, SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { trendPolyline } from '~/lib/sabha';

export const meta = () => pageMeta(SABHA_COPY.tabs.overview);

const WIDTH = 520;
const HEIGHT = 120;

/** Overview: the four cards of the Copy tab and the 30 day follower line. Read-only. */
export default function Overview() {
  const { overview } = useDashboard();
  const { followers, trend, scansThisWeek, upcomingConcerts } = overview;
  const first = trend[0]?.total ?? 0;
  const last = trend[trend.length - 1]?.total ?? 0;

  return (
    <>
      <dl className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={SABHA_COPY.overviewCards.followers} value={followers.total} />
        <Stat label={SABHA_COPY.overviewCards.newThisMonth} value={followers.newThisMonth} />
        <Stat label={SABHA_COPY.overviewCards.scansThisWeek} value={scansThisWeek} />
        <Stat label={SABHA_COPY.overviewCards.upcomingConcerts} value={upcomingConcerts} />
      </dl>

      <SectionTitle>{SABHA_EXTRA_COPY.trendHeading}</SectionTitle>
      <figure className="mt-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={SABHA_EXTRA_COPY.trendSummary(first, last)}
          className="h-auto w-full max-w-xl rounded-lg border border-border bg-card"
        >
          <polyline
            points={trendPolyline(trend, WIDTH, HEIGHT, 8)}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        <figcaption className="mt-2 text-sm text-muted-foreground">
          {SABHA_EXTRA_COPY.trendSummary(first, last)}
        </figcaption>
      </figure>
    </>
  );
}
