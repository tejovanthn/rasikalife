import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  VenueQrEntity: {
    get: vi.fn(),
    create: vi.fn(),
    patch: vi.fn(),
    query: { byVenue: vi.fn(), byStatus: vi.fn() },
  },
  QrScanDayEntity: { update: vi.fn(), query: { primary: vi.fn() } },
}));

vi.mock('../follow/target', () => ({ resolveFollowTarget: vi.fn() }));
vi.mock('../venue-space', () => ({ getSpace: vi.fn() }));
vi.mock('../change-history/service', async importOriginal => {
  const actual = await importOriginal<typeof import('../change-history/service')>();
  return { ...actual, createChangeHistory: vi.fn().mockResolvedValue({}) };
});

import {
  assignQr,
  bulkAssignQr,
  generateQrCode,
  getQrStats,
  mintQrCodes,
  reassignQr,
  recordQrFollows,
  recordScan,
  retireQr,
  updateQrLabel,
} from '.';
import { type ApplicationError, ErrorCode } from '../../constants';
import { createChangeHistory } from '../change-history/service';
import { resolveFollowTarget } from '../follow/target';
import { getSpace } from '../venue-space';
import { QR_CODE_ALPHABET, QR_CODE_LENGTH } from './constants';
import { QrScanDayEntity, VenueQrEntity } from './entity';

type Chain = {
  set: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  go: ReturnType<typeof vi.fn>;
};

/** An ElectroDB patch/update chain that records what it was given and resolves to `result`. */
function chain(result: unknown = { data: undefined }): Chain {
  const c = {} as Chain;
  c.set = vi.fn(() => c);
  c.add = vi.fn(() => c);
  c.remove = vi.fn(() => c);
  c.where = vi.fn(() => c);
  c.go = vi.fn().mockResolvedValue(result);
  return c;
}

const UNASSIGNED = {
  code: 'ABCDEFGH',
  batchId: 'b1',
  status: 'unassigned',
  venueRef: 'batch#b1',
  scanCount: 0,
  followCount: 0,
  createdAt: '2026-11-01T00:00:00.000Z',
};
const ACTIVE = {
  ...UNASSIGNED,
  status: 'active',
  venueId: 'v1',
  venueRef: 'v1',
  venueName: 'Hall',
  label: 'Main entrance',
};

function qrIs(item: unknown) {
  vi.mocked(VenueQrEntity.get).mockReturnValue({
    go: vi.fn().mockResolvedValue({ data: item }),
  } as never);
}

const conditionalFailure = Object.assign(new Error('ConditionalCheckFailed'), { code: 4001 });

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return (error as ApplicationError).code;
  }
  return undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveFollowTarget).mockResolvedValue({ type: 'venue', id: 'v1', name: 'Hall' });
  vi.mocked(getSpace).mockResolvedValue({ spaceId: 's1' } as never);
});

describe('generateQrCode', () => {
  it('draws 8 characters from the Crockford alphabet', () => {
    expect(QR_CODE_ALPHABET).not.toMatch(/[ILOU]/);
    for (let i = 0; i < 500; i++) {
      const code = generateQrCode();
      expect(code).toHaveLength(QR_CODE_LENGTH);
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    }
  });

  it('maps the low five bits of each byte, so every symbol is equally likely', () => {
    expect(generateQrCode(() => new Uint8Array(8).fill(0))).toBe('00000000');
    expect(generateQrCode(() => new Uint8Array(8).fill(255))).toBe('ZZZZZZZZ');
    expect(generateQrCode(() => new Uint8Array(8).fill(32))).toBe('00000000');
  });
});

describe('mintQrCodes', () => {
  it('writes each code as a conditional create in unassigned status', async () => {
    vi.mocked(VenueQrEntity.create).mockReturnValue(chain() as never);

    const codes = await mintQrCodes(3, 'b1');

    expect(codes).toHaveLength(3);
    expect(VenueQrEntity.create).toHaveBeenCalledTimes(3);
    expect(VenueQrEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: 'b1', status: 'unassigned', venueRef: 'batch#b1' })
    );
  });

  it('draws a new code when one already exists', async () => {
    const go = vi
      .fn()
      .mockRejectedValueOnce(conditionalFailure)
      .mockRejectedValueOnce(conditionalFailure)
      .mockResolvedValue({});
    vi.mocked(VenueQrEntity.create).mockReturnValue({ go } as never);

    const codes = await mintQrCodes(1, 'b1');

    expect(codes).toHaveLength(1);
    expect(go).toHaveBeenCalledTimes(3);
    const tried = vi.mocked(VenueQrEntity.create).mock.calls.map(([item]) => item.code);
    expect(new Set(tried).size).toBe(3);
  });

  it('gives up with QR_CODE_COLLISION after repeated collisions', async () => {
    vi.mocked(VenueQrEntity.create).mockReturnValue({
      go: vi.fn().mockRejectedValue(conditionalFailure),
    } as never);

    expect(await codeOf(mintQrCodes(1, 'b1'))).toBe(ErrorCode.QR_CODE_COLLISION);
  });

  it('does not retry an unrelated failure', async () => {
    const go = vi.fn().mockRejectedValue(new Error('throttled'));
    vi.mocked(VenueQrEntity.create).mockReturnValue({ go } as never);

    await expect(mintQrCodes(1, 'b1')).rejects.toThrow('throttled');
    expect(go).toHaveBeenCalledTimes(1);
  });
});

describe('assignQr', () => {
  const input = { code: 'ABCDEFGH', venueId: 'v1', label: 'Main entrance', userId: 'mod1' };

  it('binds the code and sets every key composite the index needs (rule 7)', async () => {
    qrIs(UNASSIGNED);
    const patch = chain({ data: ACTIVE });
    vi.mocked(VenueQrEntity.patch).mockReturnValue(patch as never);

    const result = await assignQr(input, new Date('2026-11-12T10:00:00.000Z'));

    expect(result).toEqual(ACTIVE);
    expect(patch.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'active',
        venueId: 'v1',
        venueRef: 'v1',
        venueName: 'Hall',
        label: 'Main entrance',
        assignedBy: 'mod1',
        assignedAt: '2026-11-12T10:00:00.000Z',
        batchId: 'b1',
        createdAt: UNASSIGNED.createdAt,
      })
    );
    expect(patch.where).toHaveBeenCalled();
  });

  it('writes a ChangeHistory entry for venueQr', async () => {
    qrIs(UNASSIGNED);
    vi.mocked(VenueQrEntity.patch).mockReturnValue(chain({ data: ACTIVE }) as never);

    await assignQr(input);

    expect(createChangeHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'venueQr',
        entityId: 'ABCDEFGH',
        userId: 'mod1',
        action: 'update',
        comment: 'assign',
      })
    );
    const diff = vi.mocked(createChangeHistory).mock.calls[0][0].diff as unknown as Array<{
      field: string;
    }>;
    expect(diff.map(d => d.field).sort()).toEqual(['label', 'status', 'venueId', 'venueName']);
  });

  it('refuses an unknown, active or retired code', async () => {
    qrIs(undefined);
    expect(await codeOf(assignQr(input))).toBe(ErrorCode.QR_NOT_FOUND);
    qrIs(ACTIVE);
    expect(await codeOf(assignQr(input))).toBe(ErrorCode.QR_NOT_UNASSIGNED);
    qrIs({ ...ACTIVE, status: 'retired' });
    expect(await codeOf(assignQr(input))).toBe(ErrorCode.QR_RETIRED);
    expect(VenueQrEntity.patch).not.toHaveBeenCalled();
  });

  it('refuses a missing venue or space', async () => {
    qrIs(UNASSIGNED);
    vi.mocked(resolveFollowTarget).mockResolvedValue(null);
    expect(await codeOf(assignQr(input))).toBe(ErrorCode.VENUE_NOT_FOUND);

    vi.mocked(resolveFollowTarget).mockResolvedValue({ type: 'venue', id: 'v1', name: 'Hall' });
    vi.mocked(getSpace).mockResolvedValue(null);
    expect(await codeOf(assignQr({ ...input, spaceId: 'nope' }))).toBe(ErrorCode.SPACE_NOT_FOUND);
  });

  it('binds to the canonical venue when the one given was merged', async () => {
    qrIs(UNASSIGNED);
    vi.mocked(resolveFollowTarget).mockResolvedValue({ type: 'venue', id: 'canon', name: 'Canon' });
    const patch = chain({ data: ACTIVE });
    vi.mocked(VenueQrEntity.patch).mockReturnValue(patch as never);

    await assignQr({ ...input, venueId: 'loser' });

    expect(patch.set).toHaveBeenCalledWith(
      expect.objectContaining({ venueId: 'canon', venueRef: 'canon', venueName: 'Canon' })
    );
  });

  it('reports the real reason when a race loses the conditional write', async () => {
    qrIs(UNASSIGNED);
    const patch = chain();
    patch.go.mockRejectedValue(conditionalFailure);
    vi.mocked(VenueQrEntity.patch).mockReturnValue(patch as never);
    // Between the first read and the refused write, another moderator assigned it.
    vi.mocked(VenueQrEntity.get)
      .mockReturnValueOnce({ go: vi.fn().mockResolvedValue({ data: UNASSIGNED }) } as never)
      .mockReturnValueOnce({ go: vi.fn().mockResolvedValue({ data: ACTIVE }) } as never);

    expect(await codeOf(assignQr(input))).toBe(ErrorCode.QR_NOT_UNASSIGNED);
    expect(createChangeHistory).not.toHaveBeenCalled();
  });
});

describe('bulkAssignQr', () => {
  it('keeps each code its own label', async () => {
    qrIs(UNASSIGNED);
    const patch = chain({ data: ACTIVE });
    vi.mocked(VenueQrEntity.patch).mockReturnValue(patch as never);

    await bulkAssignQr({
      items: [
        { code: 'AAAAAAAA', label: 'Entrance' },
        { code: 'BBBBBBBB', label: 'Register table' },
        { code: 'CCCCCCCC', label: 'Ticket desk' },
      ],
      venueId: 'v1',
      userId: 'mod1',
    });

    const labels = patch.set.mock.calls.map(([fields]) => fields.label);
    expect(labels).toEqual(['Entrance', 'Register table', 'Ticket desk']);
  });

  it('changes nothing when one code cannot be assigned', async () => {
    vi.mocked(VenueQrEntity.get)
      .mockReturnValueOnce({ go: vi.fn().mockResolvedValue({ data: UNASSIGNED }) } as never)
      .mockReturnValueOnce({ go: vi.fn().mockResolvedValue({ data: ACTIVE }) } as never);

    const outcome = await codeOf(
      bulkAssignQr({
        items: [
          { code: 'AAAAAAAA', label: 'Entrance' },
          { code: 'BBBBBBBB', label: 'Desk' },
        ],
        venueId: 'v1',
        userId: 'mod1',
      })
    );

    expect(outcome).toBe(ErrorCode.QR_NOT_UNASSIGNED);
    expect(VenueQrEntity.patch).not.toHaveBeenCalled();
  });
});

describe('updateQrLabel, reassignQr, retireQr', () => {
  it('relabels an active code and audits it', async () => {
    qrIs(ACTIVE);
    const patch = chain({ data: { ...ACTIVE, label: 'Hall 2 door' } });
    vi.mocked(VenueQrEntity.patch).mockReturnValue(patch as never);

    await updateQrLabel({ code: 'ABCDEFGH', label: 'Hall 2 door', userId: 'mod1' });

    expect(patch.set).toHaveBeenCalledWith({ label: 'Hall 2 door' });
    expect(createChangeHistory).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'venueQr', comment: 'label' })
    );
  });

  it('reassigns to another venue, clearing the old space with remove (rule 8)', async () => {
    qrIs({ ...ACTIVE, spaceId: 's1' });
    vi.mocked(resolveFollowTarget).mockResolvedValue({ type: 'venue', id: 'v2', name: 'Other' });
    const patch = chain({ data: { ...ACTIVE, venueId: 'v2' } });
    vi.mocked(VenueQrEntity.patch).mockReturnValue(patch as never);

    await reassignQr({ code: 'ABCDEFGH', venueId: 'v2', label: 'Door', userId: 'mod1' });

    expect(patch.set).toHaveBeenCalledWith(
      expect.objectContaining({
        venueId: 'v2',
        venueRef: 'v2',
        createdAt: UNASSIGNED.createdAt,
      })
    );
    expect(patch.remove).toHaveBeenCalledWith(['spaceId']);
    expect(createChangeHistory).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'reassign' })
    );
  });

  it('retires a code once, keeping its venue for the redirect', async () => {
    qrIs(ACTIVE);
    const patch = chain({ data: { ...ACTIVE, status: 'retired' } });
    vi.mocked(VenueQrEntity.patch).mockReturnValue(patch as never);

    await retireQr({ code: 'ABCDEFGH', userId: 'mod1' }, new Date('2026-11-12T10:00:00.000Z'));

    const fields = patch.set.mock.calls[0][0];
    expect(fields).toEqual({
      status: 'retired',
      retiredAt: '2026-11-12T10:00:00.000Z',
      batchId: 'b1',
    });
    expect(fields).not.toHaveProperty('venueId');
    expect(createChangeHistory).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'retire' })
    );
  });

  it('refuses any change to a retired code', async () => {
    qrIs({ ...ACTIVE, status: 'retired' });
    expect(await codeOf(updateQrLabel({ code: 'ABCDEFGH', label: 'X', userId: 'm' }))).toBe(
      ErrorCode.QR_RETIRED
    );
    expect(
      await codeOf(reassignQr({ code: 'ABCDEFGH', venueId: 'v1', label: 'X', userId: 'm' }))
    ).toBe(ErrorCode.QR_RETIRED);
    expect(await codeOf(retireQr({ code: 'ABCDEFGH', userId: 'm' }))).toBe(ErrorCode.QR_RETIRED);
    expect(VenueQrEntity.patch).not.toHaveBeenCalled();
  });
});

describe('recordScan', () => {
  it('counts the scan on the code and on the day, in the default zone', async () => {
    const codePatch = chain();
    vi.mocked(VenueQrEntity.patch).mockReturnValue(codePatch as never);
    const day = chain();
    vi.mocked(QrScanDayEntity.update).mockReturnValue(day as never);

    // 20:00 UTC on 15 Jan is 01:30 IST on 16 Jan.
    await recordScan('ABCDEFGH', new Date('2025-01-15T20:00:00.000Z'));

    expect(codePatch.add).toHaveBeenCalledWith({ scanCount: 1 });
    expect(codePatch.set).toHaveBeenCalledWith({ lastScannedAt: '2025-01-15T20:00:00.000Z' });
    expect(QrScanDayEntity.update).toHaveBeenCalledWith({ code: 'ABCDEFGH', date: '2025-01-16' });
    expect(day.add).toHaveBeenCalledWith({ scans: 1 });
  });

  it('counts a retired code too: the patch has no status condition', async () => {
    const codePatch = chain();
    vi.mocked(VenueQrEntity.patch).mockReturnValue(codePatch as never);
    vi.mocked(QrScanDayEntity.update).mockReturnValue(chain() as never);

    await recordScan('ABCDEFGH');

    expect(codePatch.where).not.toHaveBeenCalled();
    expect(QrScanDayEntity.update).toHaveBeenCalledTimes(1);
  });

  it('writes no rollup for a code that does not exist', async () => {
    const codePatch = chain();
    codePatch.go.mockRejectedValue(conditionalFailure);
    vi.mocked(VenueQrEntity.patch).mockReturnValue(codePatch as never);

    expect(await codeOf(recordScan('ABCDEFGH'))).toBe(ErrorCode.QR_NOT_FOUND);
    expect(QrScanDayEntity.update).not.toHaveBeenCalled();
  });
});

describe('recordQrFollows', () => {
  it('adds the number of new follows to the code and the day', async () => {
    const codePatch = chain();
    vi.mocked(VenueQrEntity.patch).mockReturnValue(codePatch as never);
    const day = chain();
    vi.mocked(QrScanDayEntity.update).mockReturnValue(day as never);

    await recordQrFollows('ABCDEFGH', 3, new Date('2025-01-15T12:00:00.000Z'));

    expect(codePatch.add).toHaveBeenCalledWith({ followCount: 3 });
    expect(day.add).toHaveBeenCalledWith({ follows: 3 });
  });

  it('does nothing for zero follows', async () => {
    await recordQrFollows('ABCDEFGH', 0);
    expect(VenueQrEntity.patch).not.toHaveBeenCalled();
    expect(QrScanDayEntity.update).not.toHaveBeenCalled();
  });
});

describe('getQrStats', () => {
  it('adds up the last seven days from the rollups', async () => {
    qrIs({ ...ACTIVE, scanCount: 40, followCount: 9 });
    const between = vi.fn().mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: [{ scans: 5 }, { scans: 7 }, { follows: 2 }],
      }),
    });
    vi.mocked(QrScanDayEntity.query.primary).mockReturnValue({ between } as never);

    const stats = await getQrStats('ABCDEFGH', new Date('2025-01-15T12:00:00.000Z'));

    expect(stats).toEqual({ scansTotal: 40, scansLast7Days: 12, follows: 9 });
    expect(between).toHaveBeenCalledWith({ date: '2025-01-09' }, { date: '2025-01-15' });
  });
});
