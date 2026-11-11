import type { BulkSetFollowInput, FollowTargetType } from '@rasika/core/domain/follow/client';
import type { ScanEventView } from '@rasika/core/domain/venue-qr/client';
import { buildEventCardContent } from '@rasika/core/shared/event-card';
import { roleLabel } from '~/lib/artist-display';

/** Strings from docs/plans/261112-01-venue-qr-follow/copy.md, verbatim. */
export const QR_COPY = {
  notFound: {
    title: "We couldn't find this code",
    body: 'Check the code printed under the QR, or browse upcoming concerts.',
    action: 'See upcoming concerts',
  },
  unassigned: {
    title: "This code isn't active yet",
    body: "It will start working once it's set up at this venue.",
    action: 'See upcoming concerts',
  },
  picker: { title: 'Which concert are you at?' },
  later: { action: 'Add a concert happening here' },
  venue: {
    body: 'Follow to hear about upcoming concerts here.',
    action: 'Add a concert happening here',
    listHeading: 'Coming up here',
  },
  rateLimited: { title: 'Too many scans', body: 'Please wait a minute and try again.' },
  error: {
    title: 'Something went wrong',
    body: 'Please try again in a moment.',
    action: 'Try again',
  },
  inApp: {
    title: 'Open in your browser to continue',
    body: "Google sign-in doesn't work inside this app. Copy the link and open it in Chrome or Safari.",
    button: 'Copy link',
    copied: 'Link copied',
  },
  follow: {
    sectionHeading: 'Get notified about',
    followAll: 'Follow all',
    venueSubtitle: 'Venue',
    organiserSubtitle: 'Organiser',
    artistFallback: 'Artist',
    following: 'Following',
    signedIn: 'Follow',
    signedOut: 'Continue with Google',
    saving: 'Saving',
    footerNote: "We'll send a weekly list and a reminder the day before. Change this any time.",
    footerLink: 'How we use your details',
    nothingSelected: 'Pick at least one to follow.',
    saveFailed: "Couldn't save. Your choices are still here, please try again.",
    signInCancelled: 'Sign-in was cancelled. Tap Continue with Google to finish following.',
    shareHelper:
      'Only the sabha or venue you tick gets these details. You can stop sharing any time from Following.',
  },
  done: {
    title: "You're all set",
    concertBook: 'Add tonight to my concert book',
    concertBookDone: 'Added to your concert book',
    manage: 'Manage what you follow',
  },
  whatsapp: {
    heading: 'Get updates on WhatsApp',
    label: 'WhatsApp number (optional)',
    prefix: '+91',
    placeholder: '98450 12345',
    consent: 'rasika.life may message me on this number about concerts I follow.',
    save: 'Save number',
    dismiss: 'Not now',
    invalid: 'Enter a 10-digit mobile number.',
    consentMissing: 'Tick the box to let us message this number.',
    saved: "Saved. We'll confirm this number before messaging you.",
  },
  add: {
    link: 'Add a concert happening here',
    optionA: 'Upload a poster',
    optionAHelper:
      "We'll read the details from the poster. You can fix anything before submitting.",
    optionB: 'Fill in the details',
    labels: {
      title: 'Title',
      date: 'Date',
      startTime: 'Start time',
      space: 'Space',
      organiser: 'Organiser',
      artists: 'Artists',
      notes: 'Notes',
    },
    submitRegular: 'Submit for review',
    submitOwner: 'Publish concert',
  },
} as const;

export const eyebrow = (venueName: string) => `You're at ${venueName}`;
export const laterTitle = (venueName: string) => `Later today at ${venueName}`;
export const venueModeTitle = (venueName: string) => `Nothing on right now at ${venueName}`;
export const addFormTitle = (venueName: string) => `Add a concert at ${venueName}`;
export const submittedMessage = (venueName: string) =>
  `Thanks. A moderator will review it shortly. Meanwhile you can follow ${venueName}.`;
export const publishedMessage = (venueName: string) =>
  `Published. It's now on ${venueName}'s page.`;
export const shareConsentLabel = (targetName: string) =>
  `Share my name, email and WhatsApp number (if I add one) with ${targetName} so they can send event notices.`;

/** `venue:abc` is how a row is named in a form and in the done page's query string. */
export const rowKey = (type: FollowTargetType, id: string) => `${type}:${id}`;

export function parseRowKey(key: string): { type: FollowTargetType; id: string } | null {
  const i = key.indexOf(':');
  if (i < 0) return null;
  const type = key.slice(0, i);
  const id = key.slice(i + 1);
  if ((type !== 'venue' && type !== 'organiser' && type !== 'artist') || id.length === 0) {
    return null;
  }
  return { type, id };
}

export interface FollowRowModel {
  key: string;
  type: FollowTargetType;
  id: string;
  name: string;
  subtitle: string;
}

const ARTIST_RANK = (role?: string | null): number => {
  const r = (role ?? '').trim().toLowerCase();
  if (r === 'main') return 0;
  if (r === 'accompanist') return 2;
  return 1;
};

/**
 * The rows of the follow screen: venue, organiser, then artists (principal first, then
 * accompanists, stored order kept within each). An artist with no id cannot be followed and is
 * left out. Duplicates by id are dropped.
 */
export function buildFollowRows(input: {
  venue: { id: string; name: string };
  event?: ScanEventView | null;
  /** Venue mode: the organisers of the next upcoming events. */
  organisers?: Array<{ id: string; name: string }>;
}): FollowRowModel[] {
  const rows: FollowRowModel[] = [
    {
      key: rowKey('venue', input.venue.id),
      type: 'venue',
      id: input.venue.id,
      name: input.venue.name,
      subtitle: QR_COPY.follow.venueSubtitle,
    },
  ];
  const organisers = input.event?.organiserId
    ? [{ id: input.event.organiserId, name: input.event.organiserName ?? '' }]
    : (input.organisers ?? []);
  for (const o of organisers) {
    if (!o.name) continue;
    rows.push({
      key: rowKey('organiser', o.id),
      type: 'organiser',
      id: o.id,
      name: o.name,
      subtitle: QR_COPY.follow.organiserSubtitle,
    });
  }
  const artists = (input.event?.artists ?? [])
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => a.id)
    .sort((x, y) => ARTIST_RANK(x.a.role) - ARTIST_RANK(y.a.role) || x.index - y.index);
  const seen = new Set<string>();
  for (const { a } of artists) {
    const id = a.id as string;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({
      key: rowKey('artist', id),
      type: 'artist',
      id,
      name: [a.title, a.name].filter(Boolean).join(' '),
      subtitle: (a.role && roleLabel(a.role)) || QR_COPY.follow.artistFallback,
    });
  }
  return rows;
}

export interface FollowFormValues {
  /** Row keys ticked now. */
  follow: string[];
  /** Row keys whose share box is ticked. */
  share: string[];
  /** Row keys followed before this screen. */
  was: string[];
  /** Row keys shared before this screen. */
  wasShared: string[];
  intent?: string | null;
  rows: string[];
}

export type BuiltSelection =
  | { ok: true; targets: BulkSetFollowInput['targets'] }
  | { ok: false; error: 'nothing-selected' };

/**
 * Turns the form into `follow.bulkSet` targets. Nothing is followed or shared unless ticked.
 * "Follow all" (no JavaScript path) ticks every row but never a share box: consent is its own
 * act. A share choice is sent only for a followed venue or organiser, and only when it changed,
 * so an unchanged earlier consent is not stamped again. A row followed before and now unticked
 * is an unfollow.
 */
export function buildSelection(values: FollowFormValues): BuiltSelection {
  const rows = values.rows.map(parseRowKey).filter((r): r is NonNullable<typeof r> => r !== null);
  const known = new Set(rows.map(r => rowKey(r.type, r.id)));
  const ticked = new Set(
    (values.intent === 'all' ? values.rows : values.follow).filter(k => known.has(k))
  );
  const was = new Set(values.was);
  const wasShared = new Set(values.wasShared);
  const share = new Set(values.share);

  const targets: BulkSetFollowInput['targets'] = [];
  for (const row of rows) {
    const key = rowKey(row.type, row.id);
    if (ticked.has(key)) {
      const canShare = row.type !== 'artist';
      const wantShare = canShare && share.has(key) && values.intent !== 'all';
      if (wantShare && !wasShared.has(key)) {
        targets.push({ type: row.type, id: row.id, follow: true, share: true });
      } else if (canShare && !share.has(key) && wasShared.has(key) && values.intent !== 'all') {
        targets.push({ type: row.type, id: row.id, follow: true, share: false });
      } else {
        targets.push({ type: row.type, id: row.id, follow: true });
      }
    } else if (was.has(key)) {
      targets.push({ type: row.type, id: row.id, follow: false });
    }
  }
  if (targets.length === 0) return { ok: false, error: 'nothing-selected' };
  return { ok: true, targets };
}

/** "You're following {name}." or "You're following {count}: {name1}, {name2} and more." */
export function summaryLine(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `You're following ${names[0]}.`;
  return `You're following ${names.length}: ${names[0]}, ${names[1]} and more.`;
}

/** Whether every row is already followed, so a returning scanner goes straight to the end. */
export function followsEverything(rows: FollowRowModel[], followed: Set<string>): boolean {
  return rows.length > 0 && rows.every(r => followed.has(r.key));
}

/** The title shown for an event: generic titles become the lead artist, then the venue. */
export function scanEventTitle(event: ScanEventView): string {
  return buildEventCardContent({
    title: event.title,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    timezone: event.timezone,
    artForm: event.artForm,
    artists: event.artists?.map(a => ({ title: a.title, name: a.name, role: a.role })),
    venueName: event.venueName,
  }).title;
}

/** WhatsApp: ten digits starting 6 to 9, spaces and a leading +91 or 0 tolerated. */
export function normaliseWhatsapp(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** The admin app lives beside the site: `rasika.life` to `admin.rasika.life`, same for a stage. */
export function adminOrigin(requestUrl: string): string {
  const url = new URL(requestUrl);
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return 'https://admin.rasika.life';
  return `https://admin.${host}`;
}

export const adminAssignUrl = (requestUrl: string, code: string) =>
  `${adminOrigin(requestUrl)}/qr/${code}/assign`;

/** `/q/CODE/done?e=EVENT&t=venue:1,artist:2` */
export function doneHref(code: string, eventId: string | undefined, followed: string[]): string {
  const params = new URLSearchParams();
  if (eventId) params.set('e', eventId);
  if (followed.length) params.set('t', followed.join(','));
  const qs = params.toString();
  return `/q/${code}/done${qs ? `?${qs}` : ''}`;
}

export function parseDoneKeys(t: string | null): string[] {
  return (t ?? '')
    .split(',')
    .filter(k => parseRowKey(k) !== null)
    .slice(0, 20);
}

/** Moderators and admins set up unassigned codes. */
export function isModeratorRole(role: string | null | undefined): boolean {
  return role === 'moderator' || role === 'admin';
}
