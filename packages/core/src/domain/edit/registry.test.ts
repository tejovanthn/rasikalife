import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../composition', () => ({
  getComposition: vi.fn(),
  updateComposition: vi.fn(),
  softDeleteComposition: vi.fn(),
  mergeComposition: vi.fn(),
}));
vi.mock('../composition/schema', () => ({ UpdateCompositionSchema: 'composition-schema' }));

vi.mock('../artist', () => ({
  getArtist: vi.fn(),
  updateArtist: vi.fn(),
  softDeleteArtist: vi.fn(),
  mergeArtist: vi.fn(),
}));
vi.mock('../artist/schema', () => ({ UpdateArtistSchema: 'artist-schema' }));

vi.mock('../raga', () => ({
  getRaga: vi.fn(),
  updateRaga: vi.fn(),
  softDeleteRaga: vi.fn(),
  mergeRaga: vi.fn(),
}));
vi.mock('../raga/schema', () => ({ UpdateRagaSchema: 'raga-schema' }));

vi.mock('../tala', () => ({
  getTala: vi.fn(),
  updateTala: vi.fn(),
  softDeleteTala: vi.fn(),
  mergeTala: vi.fn(),
}));
vi.mock('../tala/schema', () => ({ UpdateTalaSchema: 'tala-schema' }));

vi.mock('../venue', () => ({
  getVenue: vi.fn(),
  updateVenue: vi.fn(),
  softDeleteVenue: vi.fn(),
  mergeVenue: vi.fn(),
}));
vi.mock('../venue/schema', () => ({ UpdateVenueSchema: 'venue-schema' }));

vi.mock('../organiser', () => ({
  getOrganiser: vi.fn(),
  updateOrganiser: vi.fn(),
  softDeleteOrganiser: vi.fn(),
  mergeOrganiser: vi.fn(),
}));
vi.mock('../organiser/schema', () => ({ UpdateOrganiserSchema: 'organiser-schema' }));

vi.mock('../event', () => ({
  getEvent: vi.fn(),
  updateApprovedEvent: vi.fn(),
  softDeleteEvent: vi.fn(),
  mergeEvent: vi.fn(),
}));
vi.mock('../event/schema', () => ({ UpdateEventSchema: 'event-schema' }));

vi.mock('../festival', () => ({
  getFestival: vi.fn(),
  updateFestival: vi.fn(),
  deleteFestival: vi.fn(),
}));
vi.mock('../festival/schema', () => ({ UpdateFestivalSchema: 'festival-schema' }));

import { getHandler } from './registry';

describe('getHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['composition', '../composition/schema', 'composition-schema'],
    ['artist', '../artist/schema', 'artist-schema'],
    ['raga', '../raga/schema', 'raga-schema'],
    ['tala', '../tala/schema', 'tala-schema'],
    ['venue', '../venue/schema', 'venue-schema'],
    ['organiser', '../organiser/schema', 'organiser-schema'],
    ['event', '../event/schema', 'event-schema'],
  ] as const)(
    'resolves a handler with get/update/delete/merge + schema for %s',
    async entityType => {
      const handler = await getHandler(entityType);

      expect(typeof handler.getEntity).toBe('function');
      expect(typeof handler.updateEntity).toBe('function');
      expect(typeof handler.deleteEntity).toBe('function');
      expect(typeof handler.mergeEntity).toBe('function');
      expect(handler.updateSchema).toBeDefined();
    }
  );

  it('returns the same cached handler instance on repeated calls for the same entity type', async () => {
    const first = await getHandler('artist');
    const second = await getHandler('artist');

    expect(first).toBe(second);
  });

  it('returns distinct handlers for different entity types', async () => {
    const artistHandler = await getHandler('artist');
    const ragaHandler = await getHandler('raga');

    expect(artistHandler).not.toBe(ragaHandler);
  });

  it('festival handler mergeEntity rejects since festival merge is unsupported', async () => {
    const handler = await getHandler('festival');

    await expect(handler.mergeEntity('loser', 'winner')).rejects.toThrow(
      'Festival merge not supported'
    );
  });

  it('throws for an unknown entity type', async () => {
    // @ts-expect-error deliberately passing an unregistered entity type
    await expect(getHandler('unknown-type')).rejects.toThrow(
      'No handler registered for entity type: unknown-type'
    );
  });
});
