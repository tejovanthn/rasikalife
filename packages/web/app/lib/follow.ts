import type { FollowTargetType } from '@rasika/core/domain/follow/client';
import { artistTagline } from '~/lib/artist-display';
import { generateArtistUrl, generateOrganiserUrl, generateVenueUrl } from '~/lib/url-slug';

/**
 * Pure helpers for the Follow button and `/me/following`. Strings come from
 * `docs/plans/261112-01-venue-qr-follow/copy.md`.
 */

export const FOLLOW_PARAM = 'follow';
export const FOLLOW_ACTION = '/api/follow';

export const FOLLOW_COPY = {
  follow: 'Follow',
  following: 'Following',
  unfollow: 'Unfollow',
  undo: 'Undo',
  pageTitle: 'Following',
  empty:
    "You're not following anyone yet. Scan a code at a concert, or tap Follow on any artist, sabha or venue page.",
  stopSharingBody:
    "They won't get your details in future exports. Copies they've already downloaded stay with them.",
  stopSharing: 'Stop sharing',
  cancel: 'Cancel',
  // Type labels for the second line of a `/me/following` row (Copy, typeLabel).
  typeLabel: {
    artist: 'Artist',
    organiser: 'Organiser',
    venue: 'Venue',
  },
  groups: {
    artist: 'Artists',
    organiser: 'Sabhas and organisers',
    venue: 'Venues',
  },
} as const;

export const unfollowedToast = (name: string) => `Unfollowed ${name}.`;
export const shareLabel = (name: string) => `Share my details with ${name}`;
/** Accessible name of the row's Following button: "Unfollow" then the name. */
export const unfollowLabel = (name: string) => `${FOLLOW_COPY.unfollow} ${name}`;
export const stopSharingTitle = (name: string) => `Stop sharing with ${name}?`;

/**
 * The count line under a Follow button on venue, organiser and artist pages (Copy, 12 Nov).
 */
export function followerCountLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? '1 follower' : `${count} followers`;
}

/** `/venues/x-ID` becomes `/venues/x-ID?follow=1`; the page's own query is kept. */
export function followReturnHref(path: string): string {
  const url = new URL(path, 'https://rasika.life');
  url.searchParams.set(FOLLOW_PARAM, '1');
  return `${url.pathname}${url.search}`;
}

/** Where a signed-out reader's Follow tap goes: Google sign-in, then back with `?follow=1`. */
export function signInToFollowHref(path: string): string {
  return `/auth/login?redirectTo=${encodeURIComponent(followReturnHref(path))}`;
}

export function hasPendingFollow(url: URL | string): boolean {
  const u = typeof url === 'string' ? new URL(url, 'https://rasika.life') : url;
  return u.searchParams.get(FOLLOW_PARAM) === '1';
}

/** The same page without the follow parameter, as a path, so a reload or share cannot repeat it. */
export function stripFollowParam(url: URL | string): string {
  const u = new URL(typeof url === 'string' ? url : url.toString(), 'https://rasika.life');
  u.searchParams.delete(FOLLOW_PARAM);
  return `${u.pathname}${u.search}`;
}

/** A browser form post wants a redirect; a script's fetch wants data. */
export function wantsHtml(accept: string | null): boolean {
  return (accept ?? '').toLowerCase().includes('text/html');
}

/** What the button shows while the toggle is in flight. */
export function optimisticFollow(
  state: { isFollowing: boolean; count: number },
  pending: boolean
): { isFollowing: boolean; count: number } {
  if (!pending) return state;
  return state.isFollowing
    ? { isFollowing: false, count: Math.max(0, state.count - 1) }
    : { isFollowing: true, count: state.count + 1 };
}

export type MyFollow = {
  targetType: FollowTargetType;
  targetId: string;
  targetName: string;
  shareWithTarget: boolean;
  createdAt: string;
  imageUrl?: string | null;
  city?: string | null;
  instrument?: string | null;
};

export type FollowRow = MyFollow & { url: string; canShare: boolean };

export type FollowGroup = {
  type: FollowTargetType;
  heading: string;
  rows: FollowRow[];
};

const GROUP_ORDER: FollowTargetType[] = ['artist', 'organiser', 'venue'];

export function followUrl(type: FollowTargetType, id: string, name: string): string {
  if (type === 'artist') return generateArtistUrl(name, id);
  if (type === 'organiser') return generateOrganiserUrl(name, id);
  return generateVenueUrl(name, id);
}

/** Up to two initials for the avatar fallback: first letters of the first two words. */
export function followInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .map(w => w.replace(/^[^\p{L}\p{N}]+/u, ''))
    .filter(Boolean);
  return words
    .slice(0, 2)
    .map(w => Array.from(w)[0]?.toLocaleUpperCase() ?? '')
    .join('');
}

/**
 * The muted line under a name: "Venue · Chennai", "Organiser", "Vocal · Chennai". An artist shows
 * the instrument when set, else "Artist". The city is added only when known.
 */
export function followSecondLine(
  row: Pick<MyFollow, 'targetType' | 'instrument' | 'city'>
): string {
  const type =
    row.targetType === 'artist'
      ? (artistTagline({ instrument: row.instrument }) ?? FOLLOW_COPY.typeLabel.artist)
      : FOLLOW_COPY.typeLabel[row.targetType];
  return [type, row.city?.trim() || null].filter(Boolean).join(' · ');
}

/**
 * Groups follows as Artists, Sabhas and organisers, Venues (in that order), each by name.
 * An empty group is left out. Only a venue or an organiser can be shared with.
 */
export function groupFollows(follows: MyFollow[]): FollowGroup[] {
  return GROUP_ORDER.map(type => ({
    type,
    heading: FOLLOW_COPY.groups[type],
    rows: follows
      .filter(f => f.targetType === type)
      .map(f => ({
        ...f,
        url: followUrl(f.targetType, f.targetId, f.targetName),
        canShare: f.targetType !== 'artist',
      }))
      .sort((a, b) => a.targetName.localeCompare(b.targetName)),
  })).filter(group => group.rows.length > 0);
}

/**
 * The follow call that undoes an unfollow. A share choice is restored with it; an artist never
 * carries `share`, which core refuses.
 */
export function refollowTarget(row: Pick<MyFollow, 'targetType' | 'targetId' | 'shareWithTarget'>) {
  const base = { type: row.targetType, id: row.targetId, follow: true as const };
  return row.targetType === 'artist' ? base : { ...base, share: row.shareWithTarget };
}
