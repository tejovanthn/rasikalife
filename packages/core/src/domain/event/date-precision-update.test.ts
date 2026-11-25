import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  EventEntity: { get: vi.fn(), update: vi.fn(), patch: vi.fn() },
}));
vi.mock('../event-artist/entity', () => ({ EventArtistEntity: {} }));
vi.mock('../cascade', () => ({
  cascadeEventMerge: vi.fn(),
  cascadeEventMergeToSetlist: vi.fn(),
  cascadeEventMetadataToArtists: vi.fn(),
}));

import { updateApprovedEvent } from '.';
import { cascadeEventMetadataToArtists } from '../cascade';
import { yearOnlyStart } from './date-precision';
import { EventEntity } from './entity';

const set = vi.fn();
const remove = vi.fn();

function stored(event: Record<string, unknown>) {
  vi.mocked(EventEntity.get).mockReturnValue({
    go: vi.fn().mockResolvedValue({ data: { id: 'e1', title: 'T', ...event } }),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  const go = vi.fn().mockResolvedValue({ data: { id: 'e1' } });
  set.mockReturnValue({ go });
  remove.mockReturnValue({ go });
  vi.mocked(EventEntity.update).mockReturnValue({ set } as never);
  vi.mocked(EventEntity.patch).mockReturnValue({ remove } as never);
});

describe('updateApprovedEvent and the date precision', () => {
  it('turns an exact event year-only: placeholder start, no end, cast rows told', async () => {
    stored({
      startDateTime: '2019-08-14T17:45:00+05:30',
      endDateTime: '2019-08-14T20:00:00+05:30',
    });
    await updateApprovedEvent('e1', { datePrecision: 'year' });
    expect(set).toHaveBeenCalledWith({
      startDateTime: yearOnlyStart(2019),
      datePrecision: 'year',
    });
    expect(remove).toHaveBeenCalledWith(['endDateTime']);
    expect(cascadeEventMetadataToArtists).toHaveBeenCalledWith(
      'e1',
      'T',
      yearOnlyStart(2019),
      'year'
    );
  });

  it('turns a year-only event exact when a real date arrives on its own', async () => {
    stored({ startDateTime: yearOnlyStart(2019), datePrecision: 'year' });
    const startDateTime = '2019-08-14T17:45:00+05:30';
    await updateApprovedEvent('e1', { startDateTime });
    expect(set).toHaveBeenCalledWith({ startDateTime, datePrecision: 'exact' });
    expect(cascadeEventMetadataToArtists).toHaveBeenCalledWith('e1', 'T', startDateTime, 'exact');
  });

  it('leaves an ordinary edit of an exact event as it was', async () => {
    stored({ startDateTime: '2026-08-14T17:45:00+05:30' });
    await updateApprovedEvent('e1', { description: 'New' });
    expect(set).toHaveBeenCalledWith({ description: 'New' });
    expect(cascadeEventMetadataToArtists).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
