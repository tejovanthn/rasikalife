import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../venue/entity', () => ({ VenueEntity: { get: vi.fn() } }));
vi.mock('../organiser/entity', () => ({ OrganiserEntity: { get: vi.fn() } }));
vi.mock('../artist/entity', () => ({ ArtistEntity: { get: vi.fn() } }));

import { ArtistEntity } from '../artist/entity';
import { OrganiserEntity } from '../organiser/entity';
import { VenueEntity } from '../venue/entity';
import { resolveFollowTarget } from './target';

function rows(table: Record<string, unknown>) {
  return ({ id }: { id: string }) => ({ go: vi.fn().mockResolvedValue({ data: table[id] }) });
}

describe('resolveFollowTarget', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a live target', async () => {
    vi.mocked(VenueEntity.get).mockImplementation(
      rows({ v1: { id: 'v1', name: 'Hall' } }) as never
    );
    expect(await resolveFollowTarget('venue', 'v1')).toEqual({
      type: 'venue',
      id: 'v1',
      name: 'Hall',
    });
  });

  it('follows a merge pointer to the canonical record', async () => {
    vi.mocked(OrganiserEntity.get).mockImplementation(
      rows({
        loser: { id: 'loser', name: 'Old', deletedAt: 'x', mergedIntoId: 'mid' },
        mid: { id: 'mid', name: 'Mid', deletedAt: 'x', mergedIntoId: 'canon' },
        canon: { id: 'canon', name: 'Canon' },
      }) as never
    );
    expect(await resolveFollowTarget('organiser', 'loser')).toEqual({
      type: 'organiser',
      id: 'canon',
      name: 'Canon',
    });
  });

  it('returns null for a missing or soft-deleted target', async () => {
    vi.mocked(ArtistEntity.get).mockImplementation(
      rows({ gone: { id: 'gone', name: 'X', deletedAt: '2026-01-01' } }) as never
    );
    expect(await resolveFollowTarget('artist', 'gone')).toBeNull();
    expect(await resolveFollowTarget('artist', 'never-existed')).toBeNull();
  });

  it('gives up on a merge loop', async () => {
    vi.mocked(VenueEntity.get).mockImplementation(
      rows({
        a: { id: 'a', name: 'A', mergedIntoId: 'b' },
        b: { id: 'b', name: 'B', mergedIntoId: 'a' },
      }) as never
    );
    expect(await resolveFollowTarget('venue', 'a')).toBeNull();
  });
});
