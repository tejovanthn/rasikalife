import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  VenueQrEntity: { query: { byVenue: vi.fn(), byStatus: vi.fn() } },
  QrScanDayEntity: { query: { primary: vi.fn() } },
}));
vi.mock('../follow/target', () => ({ resolveFollowTarget: vi.fn() }));
vi.mock('../venue-space', () => ({ getSpace: vi.fn() }));

import { listQrsInBatch, statsByVenue } from '.';
import { getQrBatchPdfUrl, qrBatchPdfKey } from '../qr-batch';
import { QrScanDayEntity, VenueQrEntity } from './entity';

beforeEach(() => vi.clearAllMocks());

describe('listQrsInBatch', () => {
  it('reads every status for the batch and sorts by code', async () => {
    vi.mocked(VenueQrEntity.query.byStatus).mockImplementation(((args: { status: string }) => ({
      go: vi.fn().mockResolvedValue({
        data:
          args.status === 'unassigned'
            ? [{ code: 'CCCCCCCC' }, { code: 'AAAAAAAA' }]
            : args.status === 'active'
              ? [{ code: 'BBBBBBBB' }]
              : [],
      }),
    })) as never);
    const rows = await listQrsInBatch('b1');
    expect(rows.map(r => r.code)).toEqual(['AAAAAAAA', 'BBBBBBBB', 'CCCCCCCC']);
    expect(VenueQrEntity.query.byStatus).toHaveBeenCalledWith({ status: 'retired', batchId: 'b1' });
  });
});

describe('statsByVenue', () => {
  it('sums the last 7 days of rollups and carries the counters', async () => {
    vi.mocked(VenueQrEntity.query.byVenue).mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: [
          {
            code: 'AAAAAAAA',
            status: 'active',
            label: 'Main entrance',
            scanCount: 40,
            followCount: 9,
            lastScannedAt: '2026-11-12T10:00:00.000Z',
          },
          { code: 'BBBBBBBB', status: 'retired' },
        ],
      }),
    } as never);
    vi.mocked(QrScanDayEntity.query.primary).mockReturnValue({
      between: () => ({
        go: vi.fn().mockResolvedValue({ data: [{ scans: 3 }, { scans: 4 }] }),
      }),
    } as never);

    const rows = await statsByVenue('v1', new Date('2026-11-12T10:00:00Z'));
    expect(rows[0]).toMatchObject({
      code: 'AAAAAAAA',
      scansLast7Days: 7,
      scansTotal: 40,
      follows: 9,
      label: 'Main entrance',
    });
    expect(rows[1]).toMatchObject({ code: 'BBBBBBBB', status: 'retired', scansTotal: 0 });
    expect(VenueQrEntity.query.byVenue).toHaveBeenCalledWith({ venueRef: 'v1' });
  });
});

describe('batch pdf', () => {
  it('uses one key per batch and refuses other prefixes', async () => {
    expect(qrBatchPdfKey('abc')).toBe('qr-batches/abc.pdf');
    await expect(getQrBatchPdfUrl('private/classes/x.pdf')).rejects.toThrow(/qr-batches/);
    await expect(getQrBatchPdfUrl('qr-batches/../x.pdf')).rejects.toThrow(/qr-batches/);
  });
});
