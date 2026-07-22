import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ArtistPhotoEntity: {
    create: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    query: { byArtist: vi.fn() },
  },
}));

vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'photo_generated_id'),
}));

import {
  AddArtistPhotoSchema,
  UpdateArtistPhotoSchema,
  addArtistPhoto,
  deleteArtistPhoto,
  listArtistPhotos,
  updateArtistPhoto,
} from '.';
import { generateId } from '../../utils';
import { ArtistPhotoEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

const validInput = {
  artistId: 'artist-1',
  imageUrl: 'https://cdn.rasika.life/photos/artist-1/photo-1.jpg',
  uploadId: 'upload-1',
  createdBy: 'user-1',
};

describe('artist-photo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateId).mockReturnValue('photo_generated_id');
  });

  describe('addArtistPhoto', () => {
    it('generates an id and defaults order to 0 and featured to false when omitted', async () => {
      const createSpy = vi.fn().mockReturnValue(goResolves({ id: 'photo_generated_id' }));
      vi.mocked(ArtistPhotoEntity.create).mockImplementation(createSpy as never);

      const result = await addArtistPhoto(validInput);

      expect(generateId).toHaveBeenCalled();
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'photo_generated_id',
          artistId: 'artist-1',
          order: 0,
          featured: false,
        })
      );
      expect(result).toEqual({ id: 'photo_generated_id' });
    });

    it('respects an explicit order and featured value', async () => {
      const createSpy = vi.fn().mockReturnValue(goResolves({}));
      vi.mocked(ArtistPhotoEntity.create).mockImplementation(createSpy as never);

      await addArtistPhoto({ ...validInput, order: 5, featured: true });

      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ order: 5, featured: true }));
    });

    it('passes through optional caption and credit', async () => {
      const createSpy = vi.fn().mockReturnValue(goResolves({}));
      vi.mocked(ArtistPhotoEntity.create).mockImplementation(createSpy as never);

      await addArtistPhoto({ ...validInput, caption: 'On stage', credit: 'Jane Doe' });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ caption: 'On stage', credit: 'Jane Doe' })
      );
    });
  });

  describe('sort-key ordering across the ten-photo boundary', () => {
    // This is the regression the design explicitly calls out: a naive `${order}#${id}` sort
    // key sorts "10" before "2" because DynamoDB compares sort keys as strings. Exercise the
    // *real* (unmocked) entity so the assertion covers the actual zero-padding logic in
    // entity.ts, not a re-implementation of it in the test.
    it('zero-pads order so byArtist GSI sort keys compare numerically, not lexicographically', async () => {
      const { ArtistPhotoEntity: RealEntity } =
        await vi.importActual<typeof import('./entity')>('./entity');

      const paramsFor = (order: number, id: string) =>
        RealEntity.create({
          id,
          artistId: 'artist-1',
          imageUrl: 'https://cdn.rasika.life/photos/artist-1/photo.jpg',
          uploadId: 'upload-1',
          order,
          featured: false,
          createdBy: 'user-1',
        }).params() as { Item: Record<string, unknown> };

      const orderTwo = paramsFor(2, 'photo-a');
      const orderTen = paramsFor(10, 'photo-b');

      expect(orderTwo.Item.gsi1sk).toBe('0002#photo-a');
      expect(orderTen.Item.gsi1sk).toBe('0010#photo-b');
      // The regression check: naive string concatenation ("2#..." vs "10#...") would put
      // order 10 first. Zero-padded, order 2 correctly sorts first.
      expect(String(orderTwo.Item.gsi1sk) < String(orderTen.Item.gsi1sk)).toBe(true);
    });
  });

  describe('updateArtistPhoto', () => {
    it('patches by the {artistId, id} composite key', async () => {
      const setSpy = vi.fn().mockReturnValue(goResolves({ id: 'photo-1', caption: 'Updated' }));
      vi.mocked(ArtistPhotoEntity.patch).mockReturnValue({ set: setSpy } as never);

      const result = await updateArtistPhoto('artist-1', 'photo-1', { caption: 'Updated' });

      expect(ArtistPhotoEntity.patch).toHaveBeenCalledWith({
        artistId: 'artist-1',
        id: 'photo-1',
      });
      expect(setSpy).toHaveBeenCalledWith({ caption: 'Updated' });
      expect(result).toEqual({ id: 'photo-1', caption: 'Updated' });
    });

    it('includes order in the patch payload so the GSI sort key is recomputed', async () => {
      const setSpy = vi.fn().mockReturnValue(goResolves({ id: 'photo-1', order: 7 }));
      vi.mocked(ArtistPhotoEntity.patch).mockReturnValue({ set: setSpy } as never);

      await updateArtistPhoto('artist-1', 'photo-1', { order: 7 });

      expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ order: 7 }));
    });

    it('recomputes the real gsi1sk when order changes (watch fires on the real entity)', async () => {
      const { ArtistPhotoEntity: RealEntity } =
        await vi.importActual<typeof import('./entity')>('./entity');

      const params = RealEntity.patch({ artistId: 'artist-1', id: 'photo-1' })
        .set({ order: 12 })
        .params() as {
        UpdateExpression: string;
        ExpressionAttributeValues?: Record<string, unknown>;
      };

      // Assert the GSI key itself moves, not merely that orderStr was recomputed.
      // Reordering is only visible to readers if gsi1sk changes with it.
      expect(params.UpdateExpression).toContain('#gsi1sk');
      const values = Object.values(params.ExpressionAttributeValues ?? {});
      expect(values).toContain('0012');
      expect(values).toContain('0012#photo-1');
    });
  });

  describe('deleteArtistPhoto', () => {
    it('deletes using the {artistId, id} composite key', async () => {
      const deleteSpy = vi.fn().mockReturnValue(goResolves(undefined));
      vi.mocked(ArtistPhotoEntity.delete).mockImplementation(deleteSpy as never);

      await deleteArtistPhoto('artist-1', 'photo-1');

      expect(deleteSpy).toHaveBeenCalledWith({ artistId: 'artist-1', id: 'photo-1' });
    });
  });

  describe('listArtistPhotos', () => {
    it('queries the byArtist GSI in ascending (display) order with a default limit of 20', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [{ id: 'photo-1' }], cursor: undefined });
      vi.mocked(ArtistPhotoEntity.query.byArtist).mockReturnValue({ go: goSpy } as never);

      const result = await listArtistPhotos('artist-1');

      expect(ArtistPhotoEntity.query.byArtist).toHaveBeenCalledWith({ artistId: 'artist-1' });
      expect(goSpy).toHaveBeenCalledWith(
        expect.objectContaining({ order: 'asc', limit: 20, cursor: undefined })
      );
      expect(result).toEqual({ items: [{ id: 'photo-1' }], nextToken: undefined, hasMore: false });
    });

    it('passes through limit and nextToken, and reports hasMore from the cursor', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [{ id: 'photo-2' }], cursor: 'cursor-abc' });
      vi.mocked(ArtistPhotoEntity.query.byArtist).mockReturnValue({ go: goSpy } as never);

      const result = await listArtistPhotos('artist-1', { limit: 5, nextToken: 'cursor-in' });

      expect(goSpy).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5, cursor: 'cursor-in' })
      );
      expect(result).toEqual({
        items: [{ id: 'photo-2' }],
        nextToken: 'cursor-abc',
        hasMore: true,
      });
    });

    it('returns an empty array, not undefined, when there is no data', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: undefined, cursor: undefined });
      vi.mocked(ArtistPhotoEntity.query.byArtist).mockReturnValue({ go: goSpy } as never);

      const result = await listArtistPhotos('artist-1');

      expect(result).toEqual({ items: [], nextToken: undefined, hasMore: false });
    });
  });

  describe('AddArtistPhotoSchema', () => {
    it('accepts valid input', () => {
      expect(() => AddArtistPhotoSchema.parse(validInput)).not.toThrow();
    });

    it('rejects a non-URL imageUrl', () => {
      expect(() => AddArtistPhotoSchema.parse({ ...validInput, imageUrl: 'not-a-url' })).toThrow();
    });

    it('rejects a missing required field', () => {
      const { uploadId, ...rest } = validInput;
      expect(() => AddArtistPhotoSchema.parse(rest)).toThrow();
    });

    it('rejects a negative order', () => {
      expect(() => AddArtistPhotoSchema.parse({ ...validInput, order: -1 })).toThrow();
    });
  });

  describe('UpdateArtistPhotoSchema', () => {
    it('accepts a partial patch', () => {
      expect(() => UpdateArtistPhotoSchema.parse({ featured: true })).not.toThrow();
    });

    it('accepts an empty patch', () => {
      expect(() => UpdateArtistPhotoSchema.parse({})).not.toThrow();
    });
  });
});
