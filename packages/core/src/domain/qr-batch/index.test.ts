import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  QrBatchEntity: {
    create: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    query: { list: vi.fn() },
  },
}));
vi.mock('../venue-qr/mint', () => ({ mintQrCodes: vi.fn() }));

import { createQrBatch, listQrBatches, setBatchPdf } from '.';
import { ErrorCode } from '../../constants';
import { mintQrCodes } from '../venue-qr/mint';
import { QrBatchEntity } from './entity';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(QrBatchEntity.create).mockReturnValue({
    go: vi.fn().mockResolvedValue({ data: { id: 'b1', pdfStatus: 'pending' } }),
  } as never);
  vi.mocked(mintQrCodes).mockResolvedValue(['AAAAAAAA']);
});

describe('createQrBatch', () => {
  it('creates a pending batch, then mints its codes into it', async () => {
    const result = await createQrBatch({
      count: 1,
      format: 'sticker',
      note: 'Dec',
      createdBy: 'm1',
    });

    expect(QrBatchEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'sticker',
        count: 1,
        note: 'Dec',
        pdfStatus: 'pending',
        createdBy: 'm1',
      })
    );
    const batchId = vi.mocked(QrBatchEntity.create).mock.calls[0][0].id;
    expect(mintQrCodes).toHaveBeenCalledWith(1, batchId);
    expect(result.codes).toEqual(['AAAAAAAA']);
  });

  it('accepts exactly 200 and refuses 201 before writing anything', async () => {
    await createQrBatch({ count: 200, format: 'poster', createdBy: 'm1' });
    expect(mintQrCodes).toHaveBeenCalledWith(200, expect.any(String));

    vi.clearAllMocks();
    await expect(
      createQrBatch({ count: 201, format: 'poster', createdBy: 'm1' })
    ).rejects.toMatchObject({ code: ErrorCode.QR_BATCH_LIMIT });
    expect(QrBatchEntity.create).not.toHaveBeenCalled();
    expect(mintQrCodes).not.toHaveBeenCalled();
  });

  it('refuses zero or a fraction', async () => {
    for (const count of [0, -1, 2.5]) {
      await expect(
        createQrBatch({ count, format: 'sticker', createdBy: 'm1' })
      ).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });
    }
  });
});

describe('setBatchPdf', () => {
  function patchChain() {
    const c = {
      set: vi.fn(() => c),
      remove: vi.fn(() => c),
      go: vi.fn().mockResolvedValue({ data: {} }),
    };
    return c;
  }

  it('records the key when the PDF is ready', async () => {
    const patch = patchChain();
    vi.mocked(QrBatchEntity.patch).mockReturnValue(patch as never);

    await setBatchPdf({ id: 'b1', pdfStatus: 'ready', pdfKey: 'qr-batches/b1.pdf' });

    expect(patch.set).toHaveBeenCalledWith({ pdfStatus: 'ready', pdfKey: 'qr-batches/b1.pdf' });
    expect(patch.remove).not.toHaveBeenCalled();
  });

  it('removes the key with remove(), not set(undefined), when a render fails (rule 8)', async () => {
    const patch = patchChain();
    vi.mocked(QrBatchEntity.patch).mockReturnValue(patch as never);

    await setBatchPdf({ id: 'b1', pdfStatus: 'failed' });

    expect(patch.set).toHaveBeenCalledWith({ pdfStatus: 'failed' });
    expect(patch.remove).toHaveBeenCalledWith(['pdfKey']);
  });
});

describe('listQrBatches', () => {
  it('lists newest first', async () => {
    const go = vi.fn().mockResolvedValue({ data: [{ id: 'b2' }], cursor: null });
    vi.mocked(QrBatchEntity.query.list).mockReturnValue({ go } as never);

    const result = await listQrBatches();

    expect(go).toHaveBeenCalledWith(expect.objectContaining({ order: 'desc' }));
    expect(result.items).toEqual([{ id: 'b2' }]);
    expect(result.hasMore).toBe(false);
  });
});
