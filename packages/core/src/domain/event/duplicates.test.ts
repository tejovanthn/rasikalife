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
