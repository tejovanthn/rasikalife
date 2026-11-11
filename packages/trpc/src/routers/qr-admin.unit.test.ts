import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({
  createQrBatch: vi.fn(),
  getQrBatch: vi.fn(),
  setBatchPdf: vi.fn(),
  listQrBatches: vi.fn(),
  getQrBatchPdfUrl: vi.fn(),
  listQrsInBatch: vi.fn(),
  listQrs: vi.fn(),
  getQr: vi.fn(),
  assignQr: vi.fn(),
  bulkAssignQr: vi.fn(),
  updateQrLabel: vi.fn(),
  reassignQr: vi.fn(),
  retireQr: vi.fn(),
  statsByVenue: vi.fn(),
  listSpaces: vi.fn(),
  createSpace: vi.fn(),
  updateSpace: vi.fn(),
}));
const queue = vi.hoisted(() => ({ enqueueBatchRender: vi.fn() }));

vi.mock('../qr-render-queue', () => queue);
vi.mock('@rasika/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@rasika/core')>();
  return {
    ...actual,
    QrBatch: {
      ...actual.QrBatch,
      createQrBatch: core.createQrBatch,
      getQrBatch: core.getQrBatch,
      setBatchPdf: core.setBatchPdf,
      listQrBatches: core.listQrBatches,
      getQrBatchPdfUrl: core.getQrBatchPdfUrl,
    },
    VenueQr: {
      ...actual.VenueQr,
      listQrsInBatch: core.listQrsInBatch,
      listQrs: core.listQrs,
      getQr: core.getQr,
      assignQr: core.assignQr,
      bulkAssignQr: core.bulkAssignQr,
      updateQrLabel: core.updateQrLabel,
      reassignQr: core.reassignQr,
      retireQr: core.retireQr,
      statsByVenue: core.statsByVenue,
    },
    VenueSpace: {
      ...actual.VenueSpace,
      listSpaces: core.listSpaces,
      createSpace: core.createSpace,
      updateSpace: core.updateSpace,
    },
  };
});
vi.mock('@rasika/core/site-cache', () => ({ invalidateSiteCache: vi.fn() }));

import { ApplicationError, ErrorCode } from '@rasika/core/constants';
import { qrRouter } from './qr';
import { spaceRouter } from './space';

const ctx = (role: string | null) =>
  ({ event: {} as never, user: role ? { id: 'u1', role } : null }) as never;
const moderator = qrRouter.createCaller(ctx('moderator'));
const admin = qrRouter.createCaller(ctx('admin'));
const editor = qrRouter.createCaller(ctx('editor'));
const anon = qrRouter.createCaller(ctx(null));
const spaces = spaceRouter.createCaller(ctx('moderator'));
const spacesEditor = spaceRouter.createCaller(ctx('editor'));

beforeEach(() => {
  for (const fn of [...Object.values(core), ...Object.values(queue)]) fn.mockReset();
});

describe('access', () => {
  it('refuses a signed-out caller and an editor on every moderator procedure', async () => {
    await expect(anon.list({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(editor.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(editor.createBatch({ count: 1, format: 'sticker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(editor.retire({ code: 'ABCDEFGH' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(editor.statsByVenue({ venueId: 'v1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(spacesEditor.list({ venueId: 'v1' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(core.listQrs).not.toHaveBeenCalled();
  });

  it('lets an admin through', async () => {
    core.listQrs.mockResolvedValue({ items: [], hasMore: false });
    await admin.list({});
    expect(core.listQrs).toHaveBeenCalled();
  });
});

describe('createBatch', () => {
  it('mints, queues the render and returns the batch', async () => {
    core.createQrBatch.mockResolvedValue({ batch: { id: 'b1' }, codes: ['A', 'B'] });
    core.getQrBatch.mockResolvedValue({ id: 'b1', pdfStatus: 'pending' });
    const result = await moderator.createBatch({ count: 2, format: 'poster', note: 'Dec' });
    expect(core.createQrBatch).toHaveBeenCalledWith({
      count: 2,
      format: 'poster',
      note: 'Dec',
      createdBy: 'u1',
    });
    expect(queue.enqueueBatchRender).toHaveBeenCalledWith('b1');
    expect(result.codeCount).toBe(2);
  });

  it('marks the batch failed when the queue refuses it', async () => {
    core.createQrBatch.mockResolvedValue({ batch: { id: 'b1' }, codes: ['A'] });
    core.setBatchPdf.mockResolvedValue({ id: 'b1', pdfStatus: 'failed' });
    queue.enqueueBatchRender.mockRejectedValue(new Error('no queue'));
    const result = await moderator.createBatch({ count: 1, format: 'sticker' });
    expect(core.setBatchPdf).toHaveBeenLastCalledWith({ id: 'b1', pdfStatus: 'failed' });
    expect(result.batch.pdfStatus).toBe('failed');
  });

  it('rejects counts outside 1 to 200 before reaching core', async () => {
    await expect(moderator.createBatch({ count: 0, format: 'sticker' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(moderator.createBatch({ count: 201, format: 'sticker' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(core.createQrBatch).not.toHaveBeenCalled();
  });
});

describe('rerenderBatch', () => {
  it('queues a new render for an existing batch', async () => {
    core.getQrBatch.mockResolvedValue({ id: 'b1', pdfStatus: 'failed' });
    await moderator.rerenderBatch({ batchId: 'b1' });
    expect(core.setBatchPdf).toHaveBeenCalledWith({ id: 'b1', pdfStatus: 'pending' });
    expect(queue.enqueueBatchRender).toHaveBeenCalledWith('b1');
  });

  it('is NOT_FOUND for an unknown batch', async () => {
    core.getQrBatch.mockResolvedValue(null);
    await expect(moderator.rerenderBatch({ batchId: 'nope' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('getBatch', () => {
  it('signs a download url only when the pdf is ready', async () => {
    core.getQrBatch.mockResolvedValue({
      id: 'b1',
      pdfStatus: 'ready',
      pdfKey: 'qr-batches/b1.pdf',
    });
    core.listQrsInBatch.mockResolvedValue([{ code: 'AAAAAAAA' }]);
    core.getQrBatchPdfUrl.mockResolvedValue('https://signed');
    const ready = await moderator.getBatch({ batchId: 'b1' });
    expect(ready.downloadUrl).toBe('https://signed');
    expect(core.getQrBatchPdfUrl).toHaveBeenCalledWith('qr-batches/b1.pdf');

    core.getQrBatch.mockResolvedValue({ id: 'b1', pdfStatus: 'pending' });
    const pending = await moderator.getBatch({ batchId: 'b1' });
    expect(pending.downloadUrl).toBeUndefined();
  });
});

describe('code management', () => {
  it('passes the moderator id and input to core', async () => {
    core.assignQr.mockResolvedValue({ code: 'ABCDEFGH' });
    await moderator.assign({ code: 'ABCDEFGH', venueId: 'v1', label: 'Main entrance' });
    expect(core.assignQr).toHaveBeenCalledWith({
      code: 'ABCDEFGH',
      venueId: 'v1',
      label: 'Main entrance',
      userId: 'u1',
    });

    core.bulkAssignQr.mockResolvedValue([]);
    await moderator.bulkAssign({ codes: ['ABCDEFGH'], venueId: 'v1', labelPrefix: 'Entrance' });
    expect(core.bulkAssignQr).toHaveBeenCalledWith(
      expect.objectContaining({ labelPrefix: 'Entrance', userId: 'u1' })
    );

    core.updateQrLabel.mockResolvedValue({});
    await moderator.updateLabel({ code: 'ABCDEFGH', label: 'Door 2' });
    expect(core.updateQrLabel).toHaveBeenCalledWith({
      code: 'ABCDEFGH',
      label: 'Door 2',
      userId: 'u1',
    });

    core.reassignQr.mockResolvedValue({});
    await moderator.reassign({ code: 'ABCDEFGH', venueId: 'v2', label: 'Hall 2' });
    expect(core.reassignQr).toHaveBeenCalledWith(
      expect.objectContaining({ venueId: 'v2', userId: 'u1' })
    );

    core.retireQr.mockResolvedValue({});
    await moderator.retire({ code: 'ABCDEFGH' });
    expect(core.retireQr).toHaveBeenCalledWith({ code: 'ABCDEFGH', userId: 'u1' });
  });

  it('refuses more than 50 codes and a bad code before reaching core', async () => {
    const codes = Array.from({ length: 51 }, () => 'ABCDEFGH');
    await expect(
      moderator.bulkAssign({ codes, venueId: 'v1', labelPrefix: 'Entrance' })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(moderator.retire({ code: 'abc' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(core.bulkAssignQr).not.toHaveBeenCalled();
    expect(core.retireQr).not.toHaveBeenCalled();
  });

  it('maps core refusals: already assigned and retired are CONFLICT, missing is NOT_FOUND', async () => {
    core.assignQr.mockRejectedValueOnce(new ApplicationError(ErrorCode.QR_NOT_UNASSIGNED, 'x'));
    await expect(
      moderator.assign({ code: 'ABCDEFGH', venueId: 'v1', label: 'L' })
    ).rejects.toMatchObject({ code: 'CONFLICT', cause: { code: ErrorCode.QR_NOT_UNASSIGNED } });

    core.retireQr.mockRejectedValueOnce(new ApplicationError(ErrorCode.QR_RETIRED, 'x'));
    await expect(moderator.retire({ code: 'ABCDEFGH' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    core.assignQr.mockRejectedValueOnce(new ApplicationError(ErrorCode.VENUE_NOT_FOUND, 'x'));
    await expect(
      moderator.assign({ code: 'ABCDEFGH', venueId: 'gone', label: 'L' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lists with filters and reads venue stats', async () => {
    core.listQrs.mockResolvedValue({ items: [], hasMore: false });
    await moderator.list({ status: 'active', batchId: 'b1', venueId: 'v1' });
    expect(core.listQrs).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', batchId: 'b1', venueId: 'v1', limit: 50 })
    );
    core.statsByVenue.mockResolvedValue([]);
    await moderator.statsByVenue({ venueId: 'v1' });
    expect(core.statsByVenue).toHaveBeenCalledWith('v1');
  });
});

describe('space', () => {
  it('lists, creates and updates through core', async () => {
    core.listSpaces.mockResolvedValue([]);
    await spaces.list({ venueId: 'v1' });
    expect(core.listSpaces).toHaveBeenCalledWith('v1');

    core.createSpace.mockResolvedValue({});
    await spaces.create({ venueId: 'v1', name: 'Main hall', capacity: 400 });
    expect(core.createSpace).toHaveBeenCalledWith({
      venueId: 'v1',
      name: 'Main hall',
      capacity: 400,
    });

    core.updateSpace.mockResolvedValue({});
    await spaces.update({ venueId: 'v1', spaceId: 's1', name: 'Mini hall' });
    expect(core.updateSpace).toHaveBeenCalledWith({
      venueId: 'v1',
      spaceId: 's1',
      name: 'Mini hall',
    });
  });

  it('rejects an empty name and a non-positive capacity', async () => {
    await expect(spaces.create({ venueId: 'v1', name: '  ' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(spaces.create({ venueId: 'v1', name: 'Hall', capacity: 0 })).rejects.toMatchObject(
      { code: 'BAD_REQUEST' }
    );
    expect(core.createSpace).not.toHaveBeenCalled();
  });
});
