import { describe, expect, it } from 'vitest';
import { duplicateSearchRange, nearDuplicates } from './duplicates';

const row = (id: string, startDateTime: string, extra: Record<string, string> = {}) => ({
  id,
  startDateTime,
  status: 'approved',
  ...extra,
});

describe('nearDuplicates', () => {
  const target = { startDateTime: '2026-11-01T18:00:00+05:30' };

  it('finds a concert within three hours, compared as instants across offsets', () => {
    // 12:30Z is 18:00 IST: the same concert stored in UTC.
    const found = nearDuplicates([row('a', '2026-11-01T12:30:00Z')], target);
    expect(found.map(c => c.id)).toEqual(['a']);
  });

  it('leaves out a concert more than three hours away', () => {
    expect(nearDuplicates([row('a', '2026-11-01T21:30:00+05:30')], target)).toEqual([]);
  });

  it('counts approved and submitted events only', () => {
    const found = nearDuplicates(
      [
        row('a', '2026-11-01T18:00:00+05:30', { status: 'submitted' }),
        row('b', '2026-11-01T18:00:00+05:30', { status: 'draft' }),
        row('c', '2026-11-01T18:00:00+05:30', { status: 'rejected' }),
      ],
      target
    );
    expect(found.map(c => c.id)).toEqual(['a']);
  });

  it('skips merged, deleted and excluded rows', () => {
    const found = nearDuplicates(
      [
        row('a', '2026-11-01T18:00:00+05:30', { mergedIntoId: 'z' }),
        row('b', '2026-11-01T18:00:00+05:30', { deletedAt: '2026-10-01T00:00:00Z' }),
        row('self', '2026-11-01T18:00:00+05:30'),
      ],
      { ...target, excludeIds: ['self'] }
    );
    expect(found).toEqual([]);
  });

  it('orders the closest first', () => {
    const found = nearDuplicates(
      [row('far', '2026-11-01T20:00:00+05:30'), row('near', '2026-11-01T18:30:00+05:30')],
      target
    );
    expect(found.map(c => c.id)).toEqual(['near', 'far']);
  });

  it('returns nothing for an unreadable time', () => {
    expect(nearDuplicates([row('a', '2026-11-01T18:00:00+05:30')], { startDateTime: '' })).toEqual(
      []
    );
  });
});

describe('duplicateSearchRange', () => {
  it('reads whole days either side, so no offset falls outside', () => {
    expect(duplicateSearchRange('2026-11-01T01:00:00+05:30')).toEqual({
      from: '2026-10-30',
      to: '2026-11-02',
    });
  });

  it('refuses an unreadable time', () => {
    expect(duplicateSearchRange('soon')).toBeNull();
  });
});

describe('the byVenue range on the real entity', () => {
  it('reads a few whole days of one venue, never an open range', async () => {
    const { EventEntity } = await import('./entity');
    const range = duplicateSearchRange('2026-11-01T18:00:00+05:30');
    if (!range) throw new Error('no range');
    const params = EventEntity.query
      .byVenue({ venueId: 'v1' })
      .between({ startDateTime: range.from }, { startDateTime: range.to })
      .params() as {
      KeyConditionExpression: string;
      ExpressionAttributeValues: Record<string, string>;
    };
    expect(params.KeyConditionExpression).toContain('BETWEEN');
    expect(params.ExpressionAttributeValues[':pk']).toBe('venue#v1');
    expect(params.ExpressionAttributeValues[':sk1']).toBe('$event_1#startdatetime_2026-10-31');
    // ElectroDB widens the upper key and filters on the raw attribute instead, so a concert
    // on the morning of `to` is outside: the window is `from` up to the start of `to`.
    expect(params.ExpressionAttributeValues[':startDateTime0']).toBe('2026-11-03');
  });
});

import { chowdiahFirst, chowdiahSecond } from './__fixtures__/chowdiah-pair';
import { findLikelyDuplicates } from './duplicates';

describe('findLikelyDuplicates', () => {
  const base = {
    id: 'new',
    venueId: 'v1',
    startDateTime: '2026-11-01T18:00:00+05:30',
    title: 'Vocal concert',
    artists: [{ name: 'Sri T. M. Krishna' }],
  };
  const other = (extra: Record<string, unknown> = {}) => ({
    id: 'old',
    venueId: 'v1',
    status: 'approved',
    startDateTime: '2026-11-01T18:10:00+05:30',
    title: 'Evening',
    artists: [{ name: 'T M Krishna' }],
    ...extra,
  });

  it('matches a shared billed artist by normalised name', () => {
    expect(findLikelyDuplicates([other()], base).map(c => c.id)).toEqual(['old']);
  });
  it('matches a shared artist by id', () => {
    const found = findLikelyDuplicates([other({ artists: [{ id: 'a1', name: 'Someone Else' }] })], {
      ...base,
      artists: [{ id: 'a1', name: 'X Y' }],
    });
    expect(found).toHaveLength(1);
  });
  it('matches when one title holds the other main artist', () => {
    const found = findLikelyDuplicates(
      [other({ artists: [{ name: 'Ranjani Gayatri' }], title: 'Duo' })],
      { ...base, title: 'Concert by Ranjani Gayatri', artists: [{ name: 'Other Person' }] }
    );
    expect(found).toHaveLength(1);
  });
  it('matches when either side names no artist', () => {
    expect(findLikelyDuplicates([other({ artists: [] })], base)).toHaveLength(1);
    expect(findLikelyDuplicates([other()], { ...base, artists: [] })).toHaveLength(1);
  });
  it('does not match two different casts in one hall', () => {
    const found = findLikelyDuplicates(
      [other({ artists: [{ name: 'Unrelated Artist' }], title: 'Different' })],
      base
    );
    expect(found).toEqual([]);
  });
  it('needs the same venue and a start within 30 minutes', () => {
    expect(findLikelyDuplicates([other({ venueId: 'v2' })], base)).toEqual([]);
    expect(
      findLikelyDuplicates([other({ startDateTime: '2026-11-01T18:45:00+05:30' })], base)
    ).toEqual([]);
    expect(
      findLikelyDuplicates([other({ startDateTime: '2026-11-01T18:30:00+05:30' })], base)
    ).toHaveLength(1);
  });
  it('skips itself, merged, deleted, draft rows and acknowledged ids (either side)', () => {
    const rows = [
      other({ id: 'new' }),
      other({ id: 'm', mergedIntoId: 'z' }),
      other({ id: 'd', deletedAt: '2026-01-01' }),
      other({ id: 'dr', status: 'draft' }),
      other({ id: 'ack' }),
      other({ id: 'theirs', notDuplicateOf: ['new'] }),
    ];
    expect(findLikelyDuplicates(rows, { ...base, notDuplicateOf: ['ack'] })).toEqual([]);
  });

  it('flags the Chowdiah pair, both ways round', () => {
    const asTarget = (e: typeof chowdiahSecond) => ({ ...e, notDuplicateOf: undefined });
    expect(findLikelyDuplicates([chowdiahFirst], asTarget(chowdiahSecond))).toHaveLength(1);
    expect(findLikelyDuplicates([chowdiahSecond], asTarget(chowdiahFirst as never))).toHaveLength(
      1
    );
  });
  it('stops asking once the second event holds the acknowledgement', () => {
    expect(
      findLikelyDuplicates([chowdiahFirst], {
        ...chowdiahSecond,
        notDuplicateOf: [chowdiahFirst.id],
      })
    ).toEqual([]);
  });
});
