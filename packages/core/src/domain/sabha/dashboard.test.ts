import { describe, expect, it, vi } from 'vitest';
import { parseCsv } from '../../admin/csv';

vi.mock('../../db/client', () => ({ TABLE_NAME: 'T', dynamoClient: { send: vi.fn() } }));

import { exportFollowers } from './dashboard';
import type { ExportDeps } from './dashboard';
import type { ExportUser, FollowerRow } from './rules';

const row = (userId: string, over: Partial<FollowerRow> = {}): FollowerRow => ({
  userId,
  targetType: 'organiser',
  source: 'qr',
  shareWithTarget: true,
  createdAt: '2026-11-16T10:00:00.000Z',
  ...over,
});

function makeDeps(follows: FollowerRow[], users: ExportUser[]) {
  const stored = new Map<string, string>();
  const audits: Array<Record<string, unknown>> = [];
  const order: string[] = [];
  const loadUsers = vi.fn(async (ids: string[]) => {
    order.push('load');
    return new Map(users.filter(u => ids.includes(u.id)).map(u => [u.id, u]));
  });
  const deps: ExportDeps = {
    listFollows: async () => follows,
    loadUsers,
    putObject: async (key, body) => {
      order.push('put');
      stored.set(key, body);
    },
    signUrl: async key => {
      order.push('sign');
      return `https://files.example/${key}?sig=1`;
    },
    audit: async auditRow => {
      order.push('audit');
      audits.push(auditRow);
    },
  };
  return { deps, stored, audits, order, loadUsers };
}

const USERS: ExportUser[] = [
  { id: 'a', name: 'Asha', email: 'a@example.com', whatsappNumber: '9845012345' },
  { id: 'b', name: 'Bala', email: 'b@example.com' },
  { id: 'c', name: 'Chitra', email: 'c@example.com' },
];

describe('exportFollowers', () => {
  const now = new Date('2026-11-20T09:30:00.000Z');

  it('writes only followers who share, with the exact header, and returns a link', async () => {
    const { deps, stored } = makeDeps([row('a'), row('b', { shareWithTarget: false })], USERS);
    const result = await exportFollowers(
      { targetType: 'organiser', targetId: 'o1', userId: 'owner' },
      now,
      deps
    );

    expect(result.rowCount).toBe(1);
    expect(result.key).toBe('exports/organiser/o1/20261120T093000Z.csv');
    expect(result.url).toContain(result.key);
    const rows = parseCsv(stored.get(result.key) ?? '');
    expect(rows[0]?.join(',')).toBe(
      'name,email,whatsapp_number,whatsapp_verified,followed_at,source,followed'
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual([
      'Asha',
      'a@example.com',
      '+919845012345',
      'Unverified',
      '2026-11-16',
      'qr',
      'organiser',
    ]);
    // Bala did not share, so his record is never even read.
    const text = stored.get(result.key) ?? '';
    expect(text).not.toContain('b@example.com');
  });

  it('only loads the users who share', async () => {
    const { deps, loadUsers } = makeDeps(
      [row('a'), row('b', { shareWithTarget: false }), row('c', { shareWithTarget: undefined })],
      USERS
    );
    await exportFollowers({ targetType: 'venue', targetId: 'v1', userId: 'owner' }, now, deps);
    expect(loadUsers).toHaveBeenCalledWith(['a']);
  });

  it('writes an audit row (who, when, how many) before the link is returned', async () => {
    const { deps, audits, order } = makeDeps([row('a'), row('c')], USERS);
    await exportFollowers({ targetType: 'organiser', targetId: 'o1', userId: 'owner' }, now, deps);

    expect(audits).toEqual([
      {
        targetType: 'organiser',
        targetId: 'o1',
        userId: 'owner',
        rowCount: 2,
        key: 'exports/organiser/o1/20261120T093000Z.csv',
        createdAt: '2026-11-20T09:30:00.000Z',
      },
    ]);
    expect(order.indexOf('put')).toBeLessThan(order.indexOf('audit'));
    expect(order.indexOf('audit')).toBeLessThan(order.indexOf('sign'));
  });

  it('exports an empty file with only the header when nobody shares', async () => {
    const { deps, stored, audits } = makeDeps([row('a', { shareWithTarget: false })], USERS);
    const result = await exportFollowers(
      { targetType: 'organiser', targetId: 'o1', userId: 'owner' },
      now,
      deps
    );
    expect(result.rowCount).toBe(0);
    expect(parseCsv(stored.get(result.key) ?? '')).toHaveLength(1);
    expect(audits[0]?.rowCount).toBe(0);
  });
});
