import { describe, expect, it } from 'vitest';
import {
  FOLLOW_COPY,
  followInitials,
  followReturnHref,
  followSecondLine,
  followUrl,
  followerCountLabel,
  followingTabHref,
  followingTabs,
  groupFollows,
  hasPendingFollow,
  optimisticFollow,
  refollowTarget,
  shareLabel,
  signInToFollowHref,
  stopSharingTitle,
  stripFollowParam,
  unfollowLabel,
  unfollowedToast,
  wantsHtml,
} from './follow';
import { safeRedirectPath } from './safe-redirect';

describe('sign-in round trip', () => {
  it('adds the follow parameter and keeps the rest of the query', () => {
    expect(followReturnHref('/venues/hall-abc')).toBe('/venues/hall-abc?follow=1');
    expect(followReturnHref('/events?city=chennai')).toBe('/events?city=chennai&follow=1');
  });

  it('builds a login link whose redirectTo survives the safe-redirect check', () => {
    const href = signInToFollowHref('/artists/x-1');
    expect(href.startsWith('/auth/login?redirectTo=')).toBe(true);
    const back = new URL(href, 'https://rasika.life').searchParams.get('redirectTo');
    expect(safeRedirectPath(back)).toBe('/artists/x-1?follow=1');
  });

  it('reads and strips the parameter', () => {
    expect(hasPendingFollow('https://rasika.life/venues/a?follow=1')).toBe(true);
    expect(hasPendingFollow('https://rasika.life/venues/a?follow=0')).toBe(false);
    expect(hasPendingFollow('https://rasika.life/venues/a')).toBe(false);
    expect(stripFollowParam('https://rasika.life/venues/a?follow=1')).toBe('/venues/a');
    expect(stripFollowParam('https://rasika.life/venues/a?x=2&follow=1')).toBe('/venues/a?x=2');
  });
});

describe('wantsHtml', () => {
  it('is true for a browser form post and false for a script fetch', () => {
    expect(wantsHtml('text/html,application/xhtml+xml,*/*;q=0.8')).toBe(true);
    expect(wantsHtml('*/*')).toBe(false);
    expect(wantsHtml(null)).toBe(false);
  });
});

describe('optimisticFollow', () => {
  it('flips state and count while pending, and changes nothing otherwise', () => {
    expect(optimisticFollow({ isFollowing: false, count: 4 }, true)).toEqual({
      isFollowing: true,
      count: 5,
    });
    expect(optimisticFollow({ isFollowing: true, count: 0 }, true)).toEqual({
      isFollowing: false,
      count: 0,
    });
    expect(optimisticFollow({ isFollowing: true, count: 3 }, false)).toEqual({
      isFollowing: true,
      count: 3,
    });
  });
});

describe('followerCountLabel', () => {
  it('shows nothing for none, and singular for one', () => {
    expect(followerCountLabel(0)).toBeNull();
    expect(followerCountLabel(1)).toBe('1 follower');
    expect(followerCountLabel(12)).toBe('12 followers');
  });
});

const row = (targetType: 'venue' | 'organiser' | 'artist', targetName: string, share = false) => ({
  targetType,
  targetId: `${targetType}-${targetName}`,
  targetName,
  shareWithTarget: share,
  createdAt: '2026-11-01T00:00:00.000Z',
});

describe('groupFollows', () => {
  it('orders groups artists, organisers, venues and sorts by name', () => {
    const groups = groupFollows([
      row('venue', 'Narada Gana Sabha'),
      row('artist', 'Zakir'),
      row('artist', 'Aruna'),
      row('organiser', 'Brahma Gana Sabha'),
    ]);
    expect(groups.map(g => g.heading)).toEqual(['Artists', 'Sabhas and organisers', 'Venues']);
    expect(groups[0]?.rows.map(r => r.targetName)).toEqual(['Aruna', 'Zakir']);
  });

  it('leaves out an empty group and gives each row a page link', () => {
    const groups = groupFollows([row('venue', 'Hall')]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.rows[0]?.url).toMatch(/^\/venues\//);
    expect(groupFollows([])).toEqual([]);
  });

  it('allows sharing for venues and organisers only', () => {
    const [artists, organisers] = groupFollows([row('artist', 'A'), row('organiser', 'O')]);
    expect(artists?.rows[0]?.canShare).toBe(false);
    expect(organisers?.rows[0]?.canShare).toBe(true);
  });
});

describe('refollowTarget', () => {
  it('restores the share choice for a venue and never sends share for an artist', () => {
    expect(refollowTarget(row('venue', 'V', true))).toMatchObject({ follow: true, share: true });
    expect(refollowTarget(row('artist', 'A', false))).not.toHaveProperty('share');
  });
});

describe('copy', () => {
  it('uses the strings from copy.md', () => {
    expect(unfollowedToast('Hall')).toBe('Unfollowed Hall.');
    expect(shareLabel('Hall')).toBe('Share my details with Hall');
    expect(stopSharingTitle('Hall')).toBe('Stop sharing with Hall?');
    expect(FOLLOW_COPY.groups.organiser).toBe('Sabhas and organisers');
  });
});

describe('followInitials', () => {
  it('takes up to two initials', () => {
    expect(followInitials('Narada Gana Sabha')).toBe('NG');
    expect(followInitials('Aruna')).toBe('A');
    expect(followInitials('  the  hall ')).toBe('TH');
    expect(followInitials('(R) Sri')).toBe('RS');
    expect(followInitials('')).toBe('');
  });
});

describe('followSecondLine', () => {
  it('joins the type label and city', () => {
    expect(followSecondLine({ targetType: 'venue', city: 'Chennai' })).toBe('Venue · Chennai');
    expect(followSecondLine({ targetType: 'organiser' })).toBe('Organiser');
    expect(followSecondLine({ targetType: 'organiser', city: '  ' })).toBe('Organiser');
  });

  it('shows an artist instrument, else Artist', () => {
    expect(followSecondLine({ targetType: 'artist', instrument: 'vocal', city: 'Pune' })).toBe(
      'Vocal · Pune'
    );
    expect(followSecondLine({ targetType: 'artist', instrument: null })).toBe('Artist');
    expect(followSecondLine({ targetType: 'artist', city: 'Pune' })).toBe('Artist · Pune');
  });
});

describe('link and label', () => {
  it('builds the entity page link for each type', () => {
    expect(followUrl('venue', 'v1', 'Hall')).toMatch(/^\/venues\/.*v1$/);
    expect(followUrl('organiser', 'o1', 'Sabha')).toMatch(/^\/organisers\/.*o1$/);
    expect(followUrl('artist', 'a1', 'Aruna')).toMatch(/^\/artists\/.*a1$/);
  });

  it('composes the accessible name from Unfollow and the name', () => {
    expect(unfollowLabel('Hall')).toBe('Unfollow Hall');
  });
});

describe('followingTabs', () => {
  const mk = (type: 'artist' | 'organiser' | 'venue', n: number) =>
    groupFollows(
      Array.from({ length: n }, (_, i) => ({
        targetType: type,
        targetId: `${type}${i}`,
        targetName: `Name ${i}`,
        shareWithTarget: false,
        createdAt: '2026-11-01T00:00:00.000Z',
      }))
    );
  const all = [...mk('artist', 2), ...mk('organiser', 1), ...mk('venue', 3)];

  it('labels each tab with its count and picks the requested one', () => {
    const r = followingTabs(all, 'venues');
    expect(r.tabs.map(t => t.label)).toEqual([
      'Artists (2)',
      'Sabhas and organisers (1)',
      'Venues (3)',
    ]);
    expect(r.selected).toBe('venues');
  });

  it('defaults to the first non-empty group', () => {
    expect(followingTabs(all).selected).toBe('artists');
    expect(followingTabs([...mk('organiser', 1), ...mk('venue', 1)], null).selected).toBe(
      'organisers'
    );
  });

  it('falls back when the tab is invalid or has no follows', () => {
    expect(followingTabs(all, 'nope').selected).toBe('artists');
    expect(followingTabs(mk('venue', 1), 'artists').selected).toBe('venues');
  });

  it('returns one tab for a single group and none when empty', () => {
    expect(followingTabs(mk('venue', 1)).tabs).toHaveLength(1);
    expect(followingTabs([])).toEqual({ tabs: [], selected: null });
  });

  it('builds the tab link', () => {
    expect(followingTabHref('venues')).toBe('/me/following?tab=venues');
    expect(followingTabHref(null)).toBe('/me/following');
  });
});
