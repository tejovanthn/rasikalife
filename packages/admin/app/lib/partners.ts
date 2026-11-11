/**
 * Pure helpers for the partners pages: finding an organiser or venue by name, and reading the
 * target out of a URL. Tested in `partners.test.ts`.
 */
export type PartnerTargetType = 'organiser' | 'venue';

export type PartnerTarget = {
  targetType: PartnerTargetType;
  id: string;
  name: string;
  city: string | null;
};

export function isTargetType(value: string | undefined): value is PartnerTargetType {
  return value === 'organiser' || value === 'venue';
}

/** `/partners/organiser/<id>`. The id is encoded, since it comes from stored data. */
export function partnerPath(targetType: PartnerTargetType, id: string): string {
  return `/partners/${targetType}/${encodeURIComponent(id)}`;
}

const fold = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();

/**
 * Organisers and venues whose name (or city) holds the query, names that start with it first.
 * An empty query lists nothing: with hundreds of both, a wall of rows is not a search result.
 */
export function searchPartnerTargets(
  targets: PartnerTarget[],
  query: string,
  limit = 40
): PartnerTarget[] {
  const q = fold(query);
  if (!q) return [];
  const scored: Array<{ target: PartnerTarget; rank: number }> = [];
  for (const target of targets) {
    const name = fold(target.name);
    if (name.startsWith(q)) scored.push({ target, rank: 0 });
    else if (name.includes(q)) scored.push({ target, rank: 1 });
    else if (fold(target.city ?? '').includes(q)) scored.push({ target, rank: 2 });
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.target.name.localeCompare(b.target.name))
    .slice(0, limit)
    .map(entry => entry.target);
}

/** `Sat 16 Nov, 6:00 pm` in the event's own zone. */
export function formatEventWhen(iso: string, timezone: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(/\s?([ap])m/i, (_, letter: string) => ` ${letter.toLowerCase()}m`);
  return `${day.replace(',', '')}, ${time}`;
}
