import { describe, expect, it } from 'vitest';
import { SABHA_COPY, SABHA_EXTRA_COPY } from './copy';
import {
  activeTab,
  buildProfileChanges,
  canEditProfile,
  canRevokeMember,
  canWithdrawInvite,
  codesBySpace,
  dashboardPath,
  dashboardTabs,
  eventFormDateTime,
  expiryLabel,
  inviteOutcome,
  isOwner,
  isTargetType,
  mainSiteUrl,
  pendingInviteCount,
  profileFields,
  readEventForm,
  readSpaceForm,
  trendPolyline,
} from './sabha';

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe('copy', () => {
  it('is verbatim from the Copy tab', () => {
    expect(SABHA_COPY.switcherLabel).toBe('Managing');
    expect(SABHA_COPY.noAccess).toBe(
      "You don't manage any sabha or venue yet. Ask the rasika.life team for an invite."
    );
    expect(SABHA_COPY.inviteMismatch('sec@example.org')).toBe(
      'This invite was sent to sec@example.org. Sign in with that Google account to accept it.'
    );
    expect(SABHA_COPY.verified).toBe('Verified');
    expect(SABHA_COPY.verifiedTooltip('Narada Gana Sabha')).toBe(
      'Managed by Narada Gana Sabha on rasika.life'
    );
    expect(Object.values(SABHA_COPY.overviewCards)).toEqual([
      'Followers',
      'New this month',
      'Scans this week',
      'Upcoming concerts',
    ]);
    expect(Object.values(SABHA_COPY.followersScreen)).toEqual([
      'Total followers',
      'Sharing details with you',
      'Stopped sharing this month',
    ]);
    expect(SABHA_COPY.profileSaved).toBe('Changes saved.');
    expect(SABHA_COPY.export.download).toBe('Download CSV');
    expect(SABHA_COPY.export.viewerOnly).toBe('Only owners can download followers.');
    expect(SABHA_COPY.export.notice('Narada Gana Sabha')).toBe(
      'This file has personal details that followers chose to share with Narada Gana Sabha. Use it only for event notices. Delete older exports when you download this one. WhatsApp numbers marked Unverified have not been confirmed yet.'
    );
    expect(SABHA_COPY.addConcert.submitPublish).toBe('Publish concert');
    expect(SABHA_COPY.addConcert.publishedAt('Hall')).toBe("Published. It's now on Hall's page.");
  });

  it('has no em dash in any string', () => {
    const all = JSON.stringify([
      SABHA_COPY.noAccess,
      SABHA_COPY.export.notice('x'),
      ...Object.values(SABHA_EXTRA_COPY).map(v =>
        typeof v === 'function' ? (v as (...args: unknown[]) => string)(1, 2) : v
      ),
    ]);
    expect(all).not.toContain(String.fromCharCode(0x2014));
  });
});

describe('access rules', () => {
  it('lets only an owner of a verified target edit the profile', () => {
    expect(canEditProfile('owner', '2026-11-01')).toBe(true);
    expect(canEditProfile('owner', undefined)).toBe(false);
    expect(canEditProfile('viewer', '2026-11-01')).toBe(false);
    expect(canEditProfile('moderator', '2026-11-01')).toBe(false);
    expect(isOwner('owner')).toBe(true);
    expect(isOwner('moderator')).toBe(false);
  });

  it('checks the target type', () => {
    expect(isTargetType('organiser')).toBe(true);
    expect(isTargetType('venue')).toBe(true);
    expect(isTargetType('artist')).toBe(false);
  });
});

describe('tabs', () => {
  it('gives an organiser no Spaces tab and a venue all seven', () => {
    expect(dashboardTabs('organiser', 'o1').map(t => t.label)).toEqual([
      'Overview',
      'Profile',
      'Events',
      'QR codes',
      'Followers',
      'Export',
      'Team',
    ]);
    expect(dashboardTabs('venue', 'v1').map(t => t.label)).toEqual([
      'Overview',
      'Profile',
      'Events',
      'Spaces',
      'QR codes',
      'Followers',
      'Export',
      'Team',
    ]);
  });

  it('finds the active tab from the path, including nested ones', () => {
    const tabs = dashboardTabs('organiser', 'o1');
    expect(activeTab(tabs, '/organiser/o1')).toBe('overview');
    expect(activeTab(tabs, '/organiser/o1/')).toBe('overview');
    expect(activeTab(tabs, '/organiser/o1/events')).toBe('events');
    expect(activeTab(tabs, '/organiser/o1/events/new')).toBe('events');
    expect(activeTab(tabs, '/organiser/o1/export')).toBe('export');
    expect(activeTab(tabs, '/organiser/o1/team')).toBe('team');
  });

  it('encodes the id in a path', () => {
    expect(dashboardPath('venue', 'a b', 'spaces')).toBe('/venue/a%20b/spaces');
  });
});

describe('trendPolyline', () => {
  it('runs low to high left to right, with the highest total at the top', () => {
    const points = [
      { date: 'a', newFollowers: 0, total: 1 },
      { date: 'b', newFollowers: 1, total: 2 },
      { date: 'c', newFollowers: 2, total: 4 },
    ];
    expect(trendPolyline(points, 104, 44)).toBe('4.0,40.0 52.0,28.0 100.0,4.0');
  });

  it('draws a flat history as a flat line and an empty one as nothing', () => {
    const flat = [
      { date: 'a', newFollowers: 0, total: 5 },
      { date: 'b', newFollowers: 0, total: 5 },
    ];
    expect(trendPolyline(flat, 100, 40)).toBe('4.0,20.0 96.0,20.0');
    expect(trendPolyline([], 100, 40)).toBe('');
  });
});

describe('event times', () => {
  it('builds the main site origin without a trailing slash', () => {
    expect(mainSiteUrl({})).toBe('https://rasika.life');
    expect(mainSiteUrl({ SITE_URL: 'https://dev.rasika.life/' })).toBe('https://dev.rasika.life');
  });

  it('gives the form its date and time in the event zone', () => {
    expect(eventFormDateTime('2026-11-16T18:30:00+05:30', 'Asia/Kolkata')).toEqual({
      date: '2026-11-16',
      time: '18:30',
    });
    // Stored as UTC, still shown on the hall's clock.
    expect(eventFormDateTime('2026-11-16T13:00:00.000Z', 'Asia/Kolkata')).toEqual({
      date: '2026-11-16',
      time: '18:30',
    });
  });
});

describe('readEventForm', () => {
  const ok = { title: ' Vocal ', date: '2026-12-05', startTime: '18:30', venueId: 'v1' };

  it('reads a complete form and keeps optional fields only when filled', () => {
    expect(readEventForm(form({ ...ok, spaceId: '', artists: 'A, B' }))).toEqual({
      ok: true,
      values: {
        title: 'Vocal',
        date: '2026-12-05',
        startTime: '18:30',
        venueId: 'v1',
        artists: 'A, B',
      },
    });
  });

  it('sends a blank artists field as empty, and leaves a missing one out', () => {
    const blank = readEventForm(form({ ...ok, artists: '' }));
    expect(blank.ok && blank.values.artists).toBe('');
    const missing = readEventForm(form(ok));
    expect(missing.ok && 'artists' in missing.values).toBe(false);
  });

  it('names the first missing field', () => {
    expect(readEventForm(form({ ...ok, title: '' }))).toEqual({ ok: false, error: 'title' });
    expect(readEventForm(form({ ...ok, date: '5/12' }))).toEqual({ ok: false, error: 'date' });
    expect(readEventForm(form({ ...ok, date: '2026-02-31' }))).toEqual({
      ok: false,
      error: 'date',
    });
    expect(readEventForm(form({ ...ok, startTime: '6pm' }))).toEqual({ ok: false, error: 'time' });
    expect(readEventForm(form({ ...ok, venueId: '' }))).toEqual({ ok: false, error: 'venue' });
  });
});

describe('profile form', () => {
  it('lists city for an organiser and seats for a venue', () => {
    const organiser = profileFields('organiser').map(f => f.name);
    const venue = profileFields('venue').map(f => f.name);
    expect(organiser).toContain('city');
    expect(organiser).not.toContain('capacity');
    expect(venue).toContain('capacity');
    expect(venue).not.toContain('city');
  });

  it('sends only what changed, to a value', () => {
    const changes = buildProfileChanges(
      'organiser',
      form({
        name: 'Sabha',
        phone: '222',
        website: '',
        foundedYear: '1950',
      }),
      { name: 'Sabha', phone: '111', website: 'https://x.example', foundedYear: 1950 }
    );
    expect(changes).toEqual({ phone: '222' });
  });

  it('leaves a blank field alone, since the form cannot clear one', () => {
    expect(buildProfileChanges('venue', form({ phone: '' }), { phone: '111' })).toEqual({});
  });

  it('reads numbers as numbers and skips ones that are not', () => {
    expect(buildProfileChanges('venue', form({ capacity: '300' }), {})).toEqual({ capacity: 300 });
    expect(buildProfileChanges('venue', form({ capacity: 'lots' }), {})).toEqual({});
  });

  it('sends the whole address, with untouched parts carried over', () => {
    const changes = buildProfileChanges(
      'venue',
      form({ 'address.street': '1 Main Rd', 'address.city': 'Bengaluru' }),
      { address: { city: 'Bengaluru', postalCode: '560001' } }
    );
    expect(changes).toEqual({
      address: { street: '1 Main Rd', city: 'Bengaluru', postalCode: '560001' },
    });
  });

  it('sends no address when no part changed', () => {
    expect(
      buildProfileChanges('venue', form({ 'address.city': 'Bengaluru' }), {
        address: { city: 'Bengaluru' },
      })
    ).toEqual({});
  });
});

describe('inviteOutcome', () => {
  it('accepts when the signed-in address is the invited one, in any case', () => {
    expect(
      inviteOutcome({ invitedEmail: 'Sec@Example.org ', signedInEmail: 'sec@example.org' })
    ).toBe('accept');
  });

  it('is a mismatch for another address', () => {
    expect(
      inviteOutcome({ invitedEmail: 'sec@example.org', signedInEmail: 'me@example.org' })
    ).toBe('mismatch');
  });

  it('is never a mismatch when the link names no address', () => {
    expect(inviteOutcome({ invitedEmail: null, signedInEmail: 'me@example.org' })).toBe('accept');
    expect(inviteOutcome({ invitedEmail: '', signedInEmail: 'me@example.org' })).toBe('accept');
  });
});

describe('spaces form', () => {
  it('needs a name and sends capacity and notes only when filled', () => {
    expect(readSpaceForm(form({ name: ' Main hall ', capacity: '300', notes: '' }))).toEqual({
      ok: true,
      values: { name: 'Main hall', capacity: 300 },
    });
    expect(readSpaceForm(form({ name: '' }))).toEqual({ ok: false });
  });

  it('refuses a capacity that is not a whole number above zero', () => {
    expect(readSpaceForm(form({ name: 'x', capacity: '0' }))).toEqual({ ok: false });
    expect(readSpaceForm(form({ name: 'x', capacity: '12.5' }))).toEqual({ ok: false });
  });
});

describe('codesBySpace', () => {
  it('groups live codes by hall and leaves retired ones out', () => {
    const grouped = codesBySpace([
      { code: 'A', spaceId: 's1', status: 'active' },
      { code: 'B', spaceId: null, status: 'active' },
      { code: 'C', spaceId: 's1', status: 'retired' },
      { code: 'D', spaceId: 's1', status: 'active' },
    ]);
    expect(grouped.get('s1')?.map(c => c.code)).toEqual(['A', 'D']);
    expect(grouped.get('')?.map(c => c.code)).toEqual(['B']);
  });
});

describe('team', () => {
  const viewer = { userId: 'v1', role: 'viewer' };
  it('lets an owner revoke a viewer, never an owner or themselves', () => {
    expect(canRevokeMember('owner', 'o1', viewer)).toBe(true);
    expect(canRevokeMember('owner', 'o1', { userId: 'o2', role: 'owner' })).toBe(false);
    expect(canRevokeMember('owner', 'v1', viewer)).toBe(false);
  });

  it('shows no change buttons to a viewer or a moderator', () => {
    expect(canRevokeMember('viewer', 'x', viewer)).toBe(false);
    expect(canRevokeMember('moderator', 'x', viewer)).toBe(false);
    expect(canWithdrawInvite('viewer', { role: 'viewer' })).toBe(false);
    expect(canWithdrawInvite('moderator', { role: 'viewer' })).toBe(false);
  });

  it('lets an owner withdraw a viewer invite and leaves owner invites alone', () => {
    expect(canWithdrawInvite('owner', { role: 'viewer' })).toBe(true);
    expect(canWithdrawInvite('owner', { role: 'owner' })).toBe(false);
  });

  it('writes the expiry as a day in India', () => {
    // 20:00 UTC is already the next day in Chennai.
    expect(expiryLabel('2026-11-26T20:00:00.000Z')).toBe('27 Nov 2026');
  });

  it('counts pending invites and treats a missing result as none', () => {
    expect(pendingInviteCount({ pending: [{}, {}] })).toBe(2);
    expect(pendingInviteCount({ pending: [] })).toBe(0);
    expect(pendingInviteCount(null)).toBe(0);
    expect(pendingInviteCount({})).toBe(0);
  });

  it('has the new strings and no em dashes', () => {
    expect(SABHA_EXTRA_COPY.invitesLink(2)).toBe('Invites (2)');
    expect(SABHA_EXTRA_COPY.teamInviteSubmit).toBe('Send invite');
    expect(JSON.stringify(SABHA_EXTRA_COPY)).not.toContain('\u2014');
  });
});
