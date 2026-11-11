import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  VenueQrEntity: { get: vi.fn(), patch: vi.fn(), query: { byVenue: vi.fn(), byStatus: vi.fn() } },
  QrScanDayEntity: { update: vi.fn(), query: { primary: vi.fn() } },
}));
vi.mock('../follow/target', () => ({ resolveFollowTarget: vi.fn() }));
vi.mock('../venue-space', () => ({ getSpace: vi.fn() }));
vi.mock('../event', () => ({ listEventsByVenue: vi.fn() }));
vi.mock('../change-history/service', () => ({
  computeDiff: vi.fn(),
  createChangeHistory: vi.fn(),
}));

import { listEventsByVenue } from '../event';
import { resolveFollowTarget } from '../follow/target';
import { getSpace } from '../venue-space';
import { QrScanDayEntity, VenueQrEntity } from './entity';
import { resolveScan } from './scan';

const get = (row: unknown) =>
  vi
    .mocked(VenueQrEntity.get)
    .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: row }) } as never);

function countScans() {
  const patch = { add: vi.fn(), set: vi.fn(), go: vi.fn().mockResolvedValue({}) };
  patch.add.mockReturnValue(patch);
  patch.set.mockReturnValue(patch);
  vi.mocked(VenueQrEntity.patch).mockReturnValue(patch as never);
  const day = { add: vi.fn(), go: vi.fn().mockResolvedValue({}) };
  day.add.mockReturnValue(day);
  vi.mocked(QrScanDayEntity.update).mockReturnValue(day as never);
  return { patch, day };
}

const NOW = new Date('2026-11-16T12:00:00Z'); // 17:30 IST
const event = (id: string, start: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: id,
  startDateTime: start,
  status: 'approved',
  timezone: 'Asia/Kolkata',
  ...extra,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('resolveScan', () => {
  it('an unknown code is not found and counts nothing', async () => {
    get(null);
    const { patch } = countScans();
    expect(await resolveScan('ABCDEFGH', NOW)).toEqual({ state: 'not-found' });
    expect(patch.add).not.toHaveBeenCalled();
  });

  it('an unassigned code is counted and reveals nothing else', async () => {
    get({ code: 'ABCDEFGH', status: 'unassigned' });
    const { patch } = countScans();
    expect(await resolveScan('ABCDEFGH', NOW)).toEqual({ state: 'unassigned', code: 'ABCDEFGH' });
    expect(patch.add).toHaveBeenCalledWith({ scanCount: 1 });
  });

  it('a retired code is still counted, then returns its venue for the redirect', async () => {
    get({ code: 'ABCDEFGH', status: 'retired', venueId: 'v1' });
    const { patch } = countScans();
    vi.mocked(resolveFollowTarget).mockResolvedValue({ type: 'venue', id: 'v1', name: 'Hall' });
    expect(await resolveScan('ABCDEFGH', NOW)).toEqual({
      state: 'retired',
      venue: { id: 'v1', name: 'Hall' },
    });
    expect(patch.add).toHaveBeenCalledWith({ scanCount: 1 });
  });

  it('follows a merged venue to the canonical record', async () => {
    get({ code: 'ABCDEFGH', status: 'active', venueId: 'old', label: 'Main entrance' });
    countScans();
    vi.mocked(resolveFollowTarget).mockResolvedValue({ type: 'venue', id: 'new', name: 'Hall' });
    vi.mocked(listEventsByVenue).mockResolvedValue({ items: [], hasMore: false });
    const r = await resolveScan('ABCDEFGH', NOW);
    expect(resolveFollowTarget).toHaveBeenCalledWith('venue', 'old');
    expect(listEventsByVenue).toHaveBeenCalledWith('new', expect.anything());
    expect(r).toMatchObject({ state: 'active', venue: { id: 'new' }, label: 'Main entrance' });
  });

  it('records no scan when count is false, and one when it is not', async () => {
    get({ code: 'ABCDEFGH', status: 'active', venueId: 'v1' });
    const { patch, day } = countScans();
    vi.mocked(resolveFollowTarget).mockResolvedValue({ type: 'venue', id: 'v1', name: 'Hall' });
    vi.mocked(listEventsByVenue).mockResolvedValue({ items: [], hasMore: false });

    await resolveScan('ABCDEFGH', NOW, { count: false });
    expect(patch.go).not.toHaveBeenCalled();
    expect(day.go).not.toHaveBeenCalled();

    await resolveScan('ABCDEFGH', NOW);
    expect(patch.go).toHaveBeenCalled();
  });

  it('a scan failure never fails the page', async () => {
    get({ code: 'ABCDEFGH', status: 'active', venueId: 'v1' });
    const patch = { add: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), go: vi.fn() };
    patch.go.mockRejectedValue(new Error('throttled'));
    vi.mocked(VenueQrEntity.patch).mockReturnValue(patch as never);
    vi.mocked(resolveFollowTarget).mockResolvedValue({ type: 'venue', id: 'v1', name: 'Hall' });
    vi.mocked(listEventsByVenue).mockResolvedValue({ items: [], hasMore: false });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await resolveScan('ABCDEFGH', NOW)).state).toBe('active');
  });

  it('applies the code space and trims events to the view', async () => {
    get({ code: 'ABCDEFGH', status: 'active', venueId: 'v1', spaceId: 's1' });
    countScans();
    vi.mocked(resolveFollowTarget).mockResolvedValue({ type: 'venue', id: 'v1', name: 'Hall' });
    vi.mocked(getSpace).mockResolvedValue({ spaceId: 's1', name: 'Main hall' } as never);
    vi.mocked(listEventsByVenue).mockResolvedValue({
      items: [
        event('main', '2026-11-16T18:00:00+05:30', { spaceId: 's1', createdBy: 'secret' }),
        event('mini', '2026-11-16T18:00:00+05:30', { spaceId: 's2' }),
      ],
      hasMore: false,
    } as never);
    const r = await resolveScan('ABCDEFGH', NOW);
    expect(r).toMatchObject({
      state: 'active',
      space: { id: 's1', name: 'Main hall' },
      outcome: { state: 'live', event: { id: 'main' } },
    });
    if (r.state === 'active' && r.outcome.state === 'live') {
      expect(r.outcome.event).not.toHaveProperty('createdBy');
    }
  });

  it('merges the day-range and the upcoming reads without duplicates', async () => {
    get({ code: 'ABCDEFGH', status: 'active', venueId: 'v1' });
    countScans();
    vi.mocked(resolveFollowTarget).mockResolvedValue({ type: 'venue', id: 'v1', name: 'Hall' });
    const same = event('x', '2026-11-20T18:00:00+05:30', { organiserId: 'o1', organiserName: 'O' });
    vi.mocked(listEventsByVenue).mockResolvedValue({ items: [same], hasMore: false } as never);
    const r = await resolveScan('ABCDEFGH', NOW);
    expect(r).toMatchObject({
      outcome: { state: 'venue', upcoming: [{ id: 'x' }], organisers: [{ id: 'o1' }] },
    });
  });
});
