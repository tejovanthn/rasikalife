import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../admin/csv';
import {
  EXPORT_HEADER,
  buildExportRows,
  buildFollowersCsv,
  changedProfileFields,
  exportKey,
  followerStats,
  followerTrend,
  istMonth,
  neutralizeCell,
  splitEventsByTime,
} from './rules';
import type { ExportUser, FollowerRow } from './rules';

const follow = (userId: string, over: Partial<FollowerRow> = {}): FollowerRow => ({
  userId,
  targetType: 'organiser',
  source: 'qr',
  shareWithTarget: false,
  createdAt: '2026-11-05T10:00:00.000Z',
  ...over,
});

const NOW = new Date('2026-11-20T10:00:00.000Z');

describe('followerStats', () => {
  it('counts total, new this month, sharing and stopped sharing this month', () => {
    const stats = followerStats(
      [
        follow('a', { shareWithTarget: true }),
        follow('b', { createdAt: '2026-10-05T10:00:00.000Z' }),
        follow('c', { shareWithdrawnAt: '2026-11-10T10:00:00.000Z' }),
        follow('d', { shareWithdrawnAt: '2026-10-28T10:00:00.000Z' }),
      ],
      NOW
    );
    expect(stats).toEqual({
      total: 4,
      newThisMonth: 3,
      sharing: 1,
      stoppedSharingThisMonth: 1,
    });
  });

  it('reads the month in IST: 20:00 UTC on the 30th is already December in India', () => {
    expect(istMonth('2026-11-30T20:00:00.000Z')).toBe('2026-12');
    const stats = followerStats(
      [follow('a', { createdAt: '2026-11-30T20:00:00.000Z' })],
      new Date('2026-12-02T00:00:00.000Z')
    );
    expect(stats.newThisMonth).toBe(1);
  });

  it('does not count a follower who shares again as stopped', () => {
    // Re-granting removes shareWithdrawnAt, so the row carries none.
    const stats = followerStats([follow('a', { shareWithTarget: true })], NOW);
    expect(stats.stoppedSharingThisMonth).toBe(0);
    expect(stats.sharing).toBe(1);
  });
});

describe('followerTrend', () => {
  it('returns 30 days, oldest first, with a running total that includes earlier followers', () => {
    const points = followerTrend(
      [
        follow('old', { createdAt: '2026-01-01T10:00:00.000Z' }),
        follow('a', { createdAt: '2026-11-19T10:00:00.000Z' }),
        follow('b', { createdAt: '2026-11-19T11:00:00.000Z' }),
        follow('c', { createdAt: '2026-11-20T04:00:00.000Z' }),
      ],
      NOW
    );
    expect(points).toHaveLength(30);
    expect(points[0]).toEqual({ date: '2026-10-22', newFollowers: 0, total: 1 });
    expect(points[28]).toEqual({ date: '2026-11-19', newFollowers: 2, total: 3 });
    expect(points[29]).toEqual({ date: '2026-11-20', newFollowers: 1, total: 4 });
  });
});

describe('export rows and file', () => {
  const users = new Map<string, ExportUser>([
    [
      'a',
      {
        id: 'a',
        name: 'Asha Rao',
        email: 'asha@example.com',
        whatsappNumber: '9845012345',
        whatsappVerifiedAt: '2026-11-02T00:00:00.000Z',
      },
    ],
    [
      'b',
      {
        id: 'b',
        name: 'Bala',
        email: 'bala@example.com',
        whatsappNumber: '9845012346',
      },
    ],
    ['c', { id: 'c', name: 'Chitra', email: 'chitra@example.com' }],
    ['d', { id: 'd', name: '=HYPERLINK("http://x")', email: 'd@example.com' }],
  ]);

  it('has the exact header row', () => {
    expect(EXPORT_HEADER.join(',')).toBe(
      'name,email,whatsapp_number,whatsapp_verified,followed_at,source,followed'
    );
    expect(buildFollowersCsv([]).split('\r\n')[0]).toBe(
      'name,email,whatsapp_number,whatsapp_verified,followed_at,source,followed'
    );
  });

  it('includes only followers who share, with Yes, Unverified or blank', () => {
    const rows = buildExportRows(
      [
        follow('a', { shareWithTarget: true, createdAt: '2026-11-16T10:00:00.000Z' }),
        follow('b', { shareWithTarget: true, source: 'web' }),
        follow('c', { shareWithTarget: true }),
        follow('d', { shareWithTarget: false }),
        follow('gone', { shareWithTarget: true }),
      ],
      users,
      'organiser'
    );
    expect(rows.map(r => r[0])).toEqual(['Bala', 'Chitra', 'Asha Rao']);
    const byName = Object.fromEntries(rows.map(r => [r[0], r]));
    expect(byName['Asha Rao']).toEqual([
      'Asha Rao',
      'asha@example.com',
      '+919845012345',
      'Yes',
      '2026-11-16',
      'qr',
      'organiser',
    ]);
    expect(byName.Bala?.[3]).toBe('Unverified');
    expect(byName.Bala?.[5]).toBe('web');
    expect(byName.Chitra?.[2]).toBe('');
    expect(byName.Chitra?.[3]).toBe('');
  });

  it('dates the follow in IST', () => {
    const [row] = buildExportRows(
      [follow('a', { shareWithTarget: true, createdAt: '2026-11-16T20:00:00.000Z' })],
      users,
      'venue'
    );
    expect(row?.[4]).toBe('2026-11-17');
    expect(row?.[6]).toBe('venue');
  });

  it('keeps a spreadsheet from running a name as a formula', () => {
    expect(neutralizeCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(neutralizeCell('@x')).toBe("'@x");
    expect(neutralizeCell('Asha')).toBe('Asha');
    const csv = buildFollowersCsv(
      buildExportRows([follow('d', { shareWithTarget: true })], users, 'organiser')
    );
    expect(parseCsv(csv)[1]?.[0]).toBe('\'=HYPERLINK("http://x")');
  });

  it('keys the file under exports/{targetType}/{targetId}/', () => {
    expect(exportKey('organiser', 'o1', new Date('2026-11-16T09:30:05.123Z'))).toBe(
      'exports/organiser/o1/20261116T093005Z.csv'
    );
  });
});

describe('changedProfileFields', () => {
  it('lists only fields whose value changed, comparing objects by content', () => {
    const { before, after } = changedProfileFields(
      { phone: '1', website: 'https://a.example', address: { city: 'Bengaluru' } },
      { phone: '2', website: 'https://a.example', address: { city: 'Bengaluru' }, email: 'a@b.in' }
    );
    expect(after).toEqual({ phone: '2', email: 'a@b.in' });
    expect(before).toEqual({ phone: '1', email: undefined });
  });

  it('ignores undefined input values', () => {
    expect(changedProfileFields({}, { phone: undefined }).after).toEqual({});
  });
});

describe('splitEventsByTime', () => {
  it('compares instants, not strings, and keeps a running concert upcoming', () => {
    const events = [
      { id: 'past', startDateTime: '2026-11-19T18:00:00+05:30' },
      // 15:30 UTC is after 10:00 UTC "now"; as a string it sorts before the +05:30 ones.
      { id: 'later', startDateTime: '2026-11-20T18:00:00+05:30' },
      { id: 'running', startDateTime: '2026-11-20T14:00:00+05:30' },
      { id: 'soon', startDateTime: '2026-11-20T16:00:00+05:30' },
    ];
    const { upcoming, past } = splitEventsByTime(events, NOW);
    expect(upcoming.map(e => e.id)).toEqual(['running', 'soon', 'later']);
    expect(past.map(e => e.id)).toEqual(['past']);
  });
});
