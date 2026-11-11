export type PanelStat = {
  code: string;
  status: 'unassigned' | 'active' | 'retired';
  label?: string;
  scansLast7Days: number;
  scansTotal: number;
  follows: number;
  lastScannedAt?: string;
};

/** Live codes first, retired last; inside each group by label, then code. */
export function sortPanelRows<T extends PanelStat>(rows: T[]): T[] {
  const rank = (status: PanelStat['status']) => (status === 'retired' ? 1 : 0);
  return [...rows].sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      (a.label ?? '').localeCompare(b.label ?? '') ||
      a.code.localeCompare(b.code)
  );
}

const WHEN = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** "12 Nov 2026, 6:00 pm" in IST, or "Never" when the code has not been scanned. */
export function formatLastScanned(iso: string | undefined): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Never';
  return WHEN.format(date)
    .replace(/\bam\b/i, 'am')
    .replace(/\bpm\b/i, 'pm');
}

export type PanelAction = 'label' | 'reassign' | 'retire';

/**
 * Where each action opens: the admin app of the same stage (`adminBase` from `adminOrigin`). The forms live there, so the venue
 * page needs no write path of its own.
 */
export function panelActionUrl(adminBase: string, code: string, action: PanelAction): string {
  if (action === 'retire') return `${adminBase}/qr/${code}/retire`;
  return `${adminBase}/qr/${code}/edit?intent=${action}`;
}

/** Only live codes can be relabelled, reassigned or retired from the panel. */
export function canAct(status: PanelStat['status']): boolean {
  return status === 'active';
}
