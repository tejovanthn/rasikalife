/**
 * Pure rules for the dashboard screens: which tabs a person sees, what they may change, the
 * profile form, the trend line and event times. No React, no network, so each is tested in
 * `sabha.test.ts`.
 */
import { isRealDate, isRealTime } from '@rasika/core/domain/venue-qr/client';
import { zonedDateTimeInputValue } from '@rasika/core/shared/timezone';
import { SABHA_COPY } from './copy';

export type TargetType = 'organiser' | 'venue';
export type DashboardRole = 'owner' | 'viewer' | 'moderator';

export function isTargetType(value: string | undefined): value is TargetType {
  return value === 'organiser' || value === 'venue';
}

export function dashboardPath(targetType: TargetType, id: string, tab?: string): string {
  const base = `/${targetType}/${encodeURIComponent(id)}`;
  return tab ? `${base}/${tab}` : base;
}

/** An owner of the target. A moderator is let in to look, never to change. */
export function isOwner(role: DashboardRole): boolean {
  return role === 'owner';
}

/** "Verified owners edit their organiser and venue details directly." */
export function canEditProfile(role: DashboardRole, verifiedAt?: string | null): boolean {
  return role === 'owner' && Boolean(verifiedAt);
}

export type Tab = { key: string; label: string; path: string };

/**
 * The screens of a dashboard, in the Spec's order. Spaces belong to a venue, so an organiser has
 * none. Export is listed for everyone: a viewer reads "Only owners can download followers."
 */
export function dashboardTabs(targetType: TargetType, id: string): Tab[] {
  const tab = (key: keyof typeof SABHA_COPY.tabs, path?: string): Tab => ({
    key,
    label: SABHA_COPY.tabs[key],
    path: dashboardPath(targetType, id, path),
  });
  return [
    tab('overview'),
    tab('profile', 'profile'),
    tab('events', 'events'),
    ...(targetType === 'venue' ? [tab('spaces', 'spaces')] : []),
    tab('codes', 'codes'),
    tab('followers', 'followers'),
    tab('export', 'export'),
  ];
}

/** The tab whose path the URL is on. `/organiser/x` is Overview, `/organiser/x/events/e1` Events. */
export function activeTab(tabs: Tab[], pathname: string): string {
  const clean = pathname.replace(/\/+$/, '');
  const hit = tabs
    .filter(tab => tab.key !== 'overview')
    .find(tab => clean === tab.path || clean.startsWith(`${tab.path}/`));
  return hit?.key ?? 'overview';
}

// ---- Invite -----------------------------------------------------------------------------

/**
 * The invite link carries the address the invite was sent to. If the signed-in Google account
 * has a different address, nothing is accepted and the page says so (Copy: "Invite email
 * mismatch"). A link with no address (someone opened the dashboard directly) is never a
 * mismatch. Emails compare lowercase and trimmed, like the stored invite.
 */
export function inviteOutcome(input: {
  invitedEmail: string | null | undefined;
  signedInEmail: string;
}): 'mismatch' | 'accept' {
  const invited = input.invitedEmail?.trim().toLowerCase();
  if (!invited) return 'accept';
  return invited === input.signedInEmail.trim().toLowerCase() ? 'accept' : 'mismatch';
}

// ---- Trend ------------------------------------------------------------------------------

export type TrendPoint = { date: string; newFollowers: number; total: number };

/**
 * `points` attribute for an SVG polyline of the running total. A flat history is drawn as a flat
 * line in the middle, not as a divide-by-zero.
 */
export function trendPolyline(points: TrendPoint[], width: number, height: number, pad = 4) {
  if (points.length === 0) return '';
  const totals = points.map(p => p.total);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const span = max - min;
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  return points
    .map((point, i) => {
      const x = pad + i * stepX;
      const y =
        span === 0 ? height / 2 : height - pad - ((point.total - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

// ---- Events -----------------------------------------------------------------------------

/** `Sat 16 Nov, 6:00 pm`, in the event's own zone and never the runtime's. */
export function formatEventWhen(iso: string, timezone: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .replace(',', '');
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(/\s?([ap])m/i, (_match, letter: string) => ` ${letter.toLowerCase()}m`);
  return `${day}, ${time}`;
}

/** The two values of the form's Date and Start time inputs, read in the event's own zone. */
export function eventFormDateTime(iso: string, timezone: string): { date: string; time: string } {
  const [date = '', time = ''] = zonedDateTimeInputValue(iso, timezone).split('T');
  return { date, time };
}

export type EventFormValues = {
  title: string;
  date: string;
  startTime: string;
  venueId: string;
  spaceId?: string;
  artists?: string;
  notes?: string;
};

/**
 * Reads the Add/Edit concert form. Returns an error key for the first missing required field, so
 * the page can say which. The venue is required here: an owner's concert is at a hall.
 */
export function readEventForm(
  form: FormData
):
  | { ok: true; values: EventFormValues }
  | { ok: false; error: 'title' | 'date' | 'time' | 'venue' } {
  const text = (name: string) => String(form.get(name) ?? '').trim();
  const title = text('title');
  const date = text('date');
  const startTime = text('startTime');
  const venueId = text('venueId');
  if (!title) return { ok: false, error: 'title' };
  if (!isRealDate(date)) return { ok: false, error: 'date' };
  if (!isRealTime(startTime)) return { ok: false, error: 'time' };
  if (!venueId) return { ok: false, error: 'venue' };
  return {
    ok: true,
    values: {
      title,
      date,
      startTime,
      venueId,
      ...(text('spaceId') ? { spaceId: text('spaceId') } : {}),
      // A blank field is sent as '' (the owner emptied the cast); a missing one leaves it alone.
      ...(form.has('artists') ? { artists: text('artists') } : {}),
      ...(text('notes') ? { notes: text('notes') } : {}),
    },
  };
}

// ---- Profile ----------------------------------------------------------------------------

export type ProfileFieldKind = 'text' | 'textarea' | 'number' | 'email' | 'url' | 'tel' | 'select';
export type ProfileField = { name: string; kind: ProfileFieldKind };

/**
 * What the owner form edits. A subset of `UpdateOrganiserSchema` and `UpdateVenueSchema`
 * (`PartnerOrganiserProfileSchema` and `PartnerVenueProfileSchema` in core). Lists (tags,
 * amenities, social links) and the organiser's venue link are not edited here.
 */
export function profileFields(targetType: TargetType): ProfileField[] {
  const common: ProfileField[] = [
    { name: 'name', kind: 'text' },
    { name: 'description', kind: 'textarea' },
    { name: 'website', kind: 'url' },
    { name: 'phone', kind: 'tel' },
    { name: 'email', kind: 'email' },
    { name: 'foundedYear', kind: 'number' },
  ];
  return targetType === 'organiser'
    ? [
        ...common.slice(0, 2),
        { name: 'organisationType', kind: 'select' },
        { name: 'city', kind: 'text' },
        ...common.slice(2),
      ]
    : [...common, { name: 'capacity', kind: 'number' }, { name: 'nearestTransit', kind: 'text' }];
}

export const ADDRESS_PARTS = ['street', 'city', 'state', 'postalCode', 'country'] as const;

type Address = Partial<Record<(typeof ADDRESS_PARTS)[number], string>>;

/**
 * The patch a profile save sends: only fields the person changed, and only to a value. A blank
 * field is left alone, not cleared: core has no way to blank an optional field from this form
 * (an empty string would fail the website and email checks, and `.set(undefined)` does nothing,
 * rule 8). The address goes as one whole object when any part changed, with the parts that were
 * not touched carried over, so a street is never saved without the city beside it.
 */
export function buildProfileChanges(
  targetType: TargetType,
  form: FormData,
  record: Record<string, unknown>
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const field of profileFields(targetType)) {
    const raw = String(form.get(field.name) ?? '').trim();
    if (!raw) continue;
    const value = field.kind === 'number' ? Number(raw) : raw;
    if (field.kind === 'number' && !Number.isFinite(value)) continue;
    if (value === record[field.name]) continue;
    changes[field.name] = value;
  }

  const stored = (record.address ?? {}) as Address;
  const next: Address = { ...stored };
  let addressChanged = false;
  for (const part of ADDRESS_PARTS) {
    const raw = String(form.get(`address.${part}`) ?? '').trim();
    if (raw && raw !== stored[part]) {
      next[part] = raw;
      addressChanged = true;
    }
  }
  if (addressChanged) changes.address = next;
  return changes;
}

// ---- Spaces and codes -------------------------------------------------------------------

/**
 * Reads the Spaces form. Name is required. Capacity and notes are sent only when filled, since
 * core's update treats a missing value as "leave alone" and v1 has no way to blank one.
 */
export function readSpaceForm(
  form: FormData
): { ok: true; values: { name: string; capacity?: number; notes?: string } } | { ok: false } {
  const name = String(form.get('name') ?? '').trim();
  if (!name) return { ok: false };
  const capacityRaw = String(form.get('capacity') ?? '').trim();
  const capacity = capacityRaw ? Number(capacityRaw) : undefined;
  if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1)) {
    return { ok: false };
  }
  const notes = String(form.get('notes') ?? '').trim();
  return {
    ok: true,
    values: {
      name,
      ...(capacity !== undefined ? { capacity } : {}),
      ...(notes ? { notes } : {}),
    },
  };
}

type CodeRow = { code: string; label?: string | null; spaceId?: string | null; status: string };

/**
 * Live codes grouped by the hall they are placed in. A code with no hall is under `''`. Retired
 * codes are left out: they are no longer placed anywhere.
 */
export function codesBySpace<T extends CodeRow>(codes: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const code of codes) {
    if (code.status === 'retired') continue;
    const key = code.spaceId ?? '';
    out.set(key, [...(out.get(key) ?? []), code]);
  }
  return out;
}
