import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addArtistMedia, deleteArtistMedia, listArtistMedia, updateArtistMedia } from '.';
import { sortArtistMedia } from './sort';

vi.mock('../../utils', () => ({ generateId: vi.fn(() => 'media-1') }));

vi.mock('./entity', () => ({
  ArtistMediaEntity: {
    create: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    query: { primary: vi.fn() },
  },
}));

describe('ArtistMedia', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a row with a generated id under the artist partition', async () => {
    const { ArtistMediaEntity } = await import('./entity');
    vi.mocked(ArtistMediaEntity.create).mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: { id: 'media-1' } }),
      // biome-ignore lint/suspicious/noExplicitAny: entity mock
    } as any);

    await addArtistMedia({
      artistId: 'artist-1',
      title: 'A recital of rare grace',
      url: 'https://thehindu.com/x',
      mediaType: 'review',
      outlet: 'The Hindu',
      publishedOn: '2026-01-30',
      createdBy: 'user-1',
    });

    expect(ArtistMediaEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'media-1',
        artistId: 'artist-1',
        url: 'https://thehindu.com/x',
        mediaType: 'review',
      })
    );
  });

  // Same contract as updateArtistPhoto: '' clears, undefined leaves alone. Storing '' would
  // leave the row claiming an outlet exists and is blank.
  it('removes a field cleared with an empty string rather than storing one', async () => {
    const { ArtistMediaEntity } = await import('./entity');
    const go = vi.fn().mockResolvedValue({ data: {} });
    const remove = vi.fn().mockReturnValue({ go });
    const set = vi.fn().mockReturnValue({ go, remove });
    // biome-ignore lint/suspicious/noExplicitAny: entity mock
    vi.mocked(ArtistMediaEntity.patch).mockReturnValue({ set } as any);

    await updateArtistMedia('artist-1', 'media-1', { outlet: '', title: 'Kept' });

    expect(set).toHaveBeenCalledWith({ title: 'Kept' });
    expect(remove).toHaveBeenCalledWith(['outlet']);
  });

  it('does not call remove when nothing is being cleared', async () => {
    const { ArtistMediaEntity } = await import('./entity');
    const go = vi.fn().mockResolvedValue({ data: {} });
    const remove = vi.fn().mockReturnValue({ go });
    const set = vi.fn().mockReturnValue({ go, remove });
    // biome-ignore lint/suspicious/noExplicitAny: entity mock
    vi.mocked(ArtistMediaEntity.patch).mockReturnValue({ set } as any);

    await updateArtistMedia('artist-1', 'media-1', { title: 'Kept' });

    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes by the artist and media pair', async () => {
    const { ArtistMediaEntity } = await import('./entity');
    vi.mocked(ArtistMediaEntity.delete).mockReturnValue({
      go: vi.fn().mockResolvedValue({}),
      // biome-ignore lint/suspicious/noExplicitAny: entity mock
    } as any);

    await deleteArtistMedia('artist-1', 'media-1');

    expect(ArtistMediaEntity.delete).toHaveBeenCalledWith({
      artistId: 'artist-1',
      id: 'media-1',
    });
  });

  it('lists the whole partition, newest first', async () => {
    const { ArtistMediaEntity } = await import('./entity');
    vi.mocked(ArtistMediaEntity.query.primary).mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: [
          { id: 'a', title: 'Older', publishedOn: '2024-01-01' },
          { id: 'b', title: 'Newer', publishedOn: '2026-01-01' },
        ],
      }),
      // biome-ignore lint/suspicious/noExplicitAny: entity mock
    } as any);

    const result = await listArtistMedia('artist-1');

    expect(ArtistMediaEntity.query.primary).toHaveBeenCalledWith({ artistId: 'artist-1' });
    expect(result.map(m => m.title)).toEqual(['Newer', 'Older']);
  });
});

describe('sortArtistMedia', () => {
  it('puts the newest first', () => {
    const sorted = sortArtistMedia([
      { title: 'B', publishedOn: '2024-05-01' },
      { title: 'A', publishedOn: '2026-05-01' },
    ]);
    expect(sorted.map(m => m.title)).toEqual(['A', 'B']);
  });

  // An undated clipping should not sort as if it were from year zero, nor jumble in among
  // dated ones: it goes to the end, where "we do not know when" belongs.
  it('puts undated items last, whatever their titles', () => {
    const sorted = sortArtistMedia([
      { title: 'Undated' },
      { title: 'Dated', publishedOn: '2020-01-01' },
    ]);
    expect(sorted.map(m => m.title)).toEqual(['Dated', 'Undated']);
  });

  it('breaks ties on title so the order is stable across reads', () => {
    const sorted = sortArtistMedia([
      { title: 'Zebra', publishedOn: '2026-01-01' },
      { title: 'Apple', publishedOn: '2026-01-01' },
    ]);
    expect(sorted.map(m => m.title)).toEqual(['Apple', 'Zebra']);
  });

  it('does not mutate the input', () => {
    const input = [{ title: 'B' }, { title: 'A' }];
    sortArtistMedia(input);
    expect(input.map(m => m.title)).toEqual(['B', 'A']);
  });
});
