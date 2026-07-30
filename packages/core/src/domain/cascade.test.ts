import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./composition/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./composition/entity')>();
  return {
    CompositionEntity: {
      // Real conversions so keyOf derives the true (lowercased) key. Everything
      // else is mocked; deriving keys for real is what makes the key assertions
      // meaningful rather than a restatement of the test's own literals.
      conversions: actual.CompositionEntity.conversions,
      query: { byComposer: vi.fn() },
    },
  };
});

vi.mock('./composition_raga/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./composition_raga/entity')>();
  return {
    CompositionRagaEntity: {
      // Real conversions so keyOf derives the true (lowercased) key. Everything
      // else is mocked; deriving keys for real is what makes the key assertions
      // meaningful rather than a restatement of the test's own literals.
      conversions: actual.CompositionRagaEntity.conversions,
      query: { byRaga: vi.fn() },
      get: vi.fn(),
      create: vi.fn(),
    },
  };
});

vi.mock('./composition_tala/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./composition_tala/entity')>();
  return {
    CompositionTalaEntity: {
      // Real conversions so keyOf derives the true (lowercased) key. Everything
      // else is mocked; deriving keys for real is what makes the key assertions
      // meaningful rather than a restatement of the test's own literals.
      conversions: actual.CompositionTalaEntity.conversions,
      query: { byTala: vi.fn() },
      get: vi.fn(),
      create: vi.fn(),
    },
  };
});

vi.mock('./event/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./event/entity')>();
  return {
    EventEntity: {
      // Real conversions so keyOf derives the true (lowercased) key. Everything
      // else is mocked; deriving keys for real is what makes the key assertions
      // meaningful rather than a restatement of the test's own literals.
      conversions: actual.EventEntity.conversions,
      query: { byVenue: vi.fn(), byOrganiser: vi.fn() },
      get: vi.fn(),
    },
  };
});

vi.mock('./award/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./award/entity')>();
  return {
    AwardEntity: {
      // Real conversions so keyOf derives the true (lowercased) key. Everything
      // else is mocked; deriving keys for real is what makes the key assertions
      // meaningful rather than a restatement of the test's own literals.
      conversions: actual.AwardEntity.conversions,
      query: { list: vi.fn() },
    },
  };
});

vi.mock('./event-artist/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./event-artist/entity')>();
  return {
    EventArtistEntity: {
      // Real conversions so keyOf derives the true (lowercased) key. Everything
      // else is mocked; deriving keys for real is what makes the key assertions
      // meaningful rather than a restatement of the test's own literals.
      conversions: actual.EventArtistEntity.conversions,
      query: { primary: vi.fn(), byArtist: vi.fn() },
      get: vi.fn(),
      upsert: vi.fn(),
      patch: vi.fn(),
    },
  };
});

vi.mock('./artist-award/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./artist-award/entity')>();
  return {
    ArtistAwardEntity: {
      // Real conversions so keyOf derives the true (lowercased) key. Everything
      // else is mocked; deriving keys for real is what makes the key assertions
      // meaningful rather than a restatement of the test's own literals.
      conversions: actual.ArtistAwardEntity.conversions,
      query: { primary: vi.fn() },
      get: vi.fn(),
      upsert: vi.fn(),
    },
  };
});

vi.mock('./artist/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./artist/entity')>();
  return {
    ArtistEntity: {
      // Real conversions so keyOf derives the true (lowercased) key. Everything
      // else is mocked; deriving keys for real is what makes the key assertions
      // meaningful rather than a restatement of the test's own literals.
      conversions: actual.ArtistEntity.conversions,
      query: { list: vi.fn() },
    },
  };
});

vi.mock('./artist-membership/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./artist-membership/entity')>();
  return {
    ArtistMembershipEntity: {
      // Real conversions so keyOf derives the true (lowercased) key. Everything
      // else is mocked; deriving keys for real is what makes the key assertions
      // meaningful rather than a restatement of the test's own literals.
      conversions: actual.ArtistMembershipEntity.conversions,
      query: { primary: vi.fn(), byMember: vi.fn() },
      get: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock('./artist-affiliation/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./artist-affiliation/entity')>();
  return {
    ArtistAffiliationEntity: {
      // Real conversions so keyOf derives the true (lowercased) key. Everything
      // else is mocked; deriving keys for real is what makes the key assertions
      // meaningful rather than a restatement of the test's own literals.
      conversions: actual.ArtistAffiliationEntity.conversions,
      query: { primary: vi.fn(), byOrganiser: vi.fn() },
      get: vi.fn(),
      upsert: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock('./artist-media/entity', () => ({
  ArtistMediaEntity: {
    query: { primary: vi.fn() },
    upsert: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('./artist-photo/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./artist-photo/entity')>();
  return {
    ArtistPhotoEntity: {
      // Real conversions so keyOf derives the true (lowercased) key. Everything
      // else is mocked; deriving keys for real is what makes the key assertions
      // meaningful rather than a restatement of the test's own literals.
      conversions: actual.ArtistPhotoEntity.conversions,
      query: { primary: vi.fn() },
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock('./artist-claim/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./artist-claim/entity')>();
  return {
    ArtistClaimEntity: {
      conversions: actual.ArtistClaimEntity.conversions,
      query: { primary: vi.fn() },
      get: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock('./concert-log-item/entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./concert-log-item/entity')>();
  return {
    ConcertLogItemEntity: {
      // Real conversions so keyOf derives the true (lowercased) key. Everything
      // else is mocked; deriving keys for real is what makes the key assertions
      // meaningful rather than a restatement of the test's own literals.
      conversions: actual.ConcertLogItemEntity.conversions,
      query: { byEvent: vi.fn(), byComposition: vi.fn(), byRaga: vi.fn() },
      delete: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
    },
  };
});

vi.mock('./event-setlist', () => ({
  deleteAllEventSetlistRows: vi.fn(),
  getEventSetlist: vi.fn(),
  recomputeEventSetlist: vi.fn(),
}));

vi.mock('./event-setlist/entity', () => ({
  EventSetlistEntity: { patch: vi.fn() },
}));

vi.mock('./composition', () => ({
  adjustPerformanceCount: vi.fn(),
}));

vi.mock('./raga', () => ({
  adjustPerformanceCount: vi.fn(),
}));

vi.mock('./concert-log-item', () => ({
  deleteAllUserSetlistItems: vi.fn(),
}));

vi.mock('./concert-log/entity', () => ({
  ConcertLogEntity: { query: { byUserDate: vi.fn() } },
}));

// The claim block recomputes the canonical's badge after moving rows; that path is covered by
// artist-claim's own tests, so here it only needs to not hit DynamoDB.
vi.mock('./artist-claim', () => ({
  recomputeArtistClaimStatus: vi.fn(),
}));

import { dynamoClient } from '../db/client';
import { keysOfEntity } from '../db/keys';
import { ArtistAffiliationEntity } from './artist-affiliation/entity';
import { ArtistAwardEntity } from './artist-award/entity';
import { ArtistClaimEntity } from './artist-claim/entity';
import { ArtistMediaEntity } from './artist-media/entity';
import { ArtistMembershipEntity } from './artist-membership/entity';
import { ArtistPhotoEntity } from './artist-photo/entity';
import { ArtistEntity } from './artist/entity';
import { AwardEntity } from './award/entity';
import * as cascade from './cascade';
import { adjustPerformanceCount as adjustCompositionCount } from './composition';
import { CompositionEntity } from './composition/entity';
import { CompositionRagaEntity } from './composition_raga/entity';
import { CompositionTalaEntity } from './composition_tala/entity';
import { deleteAllUserSetlistItems } from './concert-log-item';
import { ConcertLogItemEntity } from './concert-log-item/entity';
import { ConcertLogEntity } from './concert-log/entity';
import { EventArtistEntity } from './event-artist/entity';
import { deleteAllEventSetlistRows, getEventSetlist, recomputeEventSetlist } from './event-setlist';
import { EventSetlistEntity } from './event-setlist/entity';
import { EventEntity } from './event/entity';
import { adjustPerformanceCount as adjustRagaCount } from './raga';

/** Builds a `.query.xxx(args)` mock that yields the given pages in sequence, one per `.go()` call. */
function pagedQuery(pages: Array<{ data: unknown[]; cursor: string | null }>) {
  const go = vi.fn();
  for (const page of pages) go.mockResolvedValueOnce(page);
  return vi.fn().mockReturnValue({ go });
}

function commandsSentTo(mock: ReturnType<typeof vi.fn>, name: string) {
  return mock.mock.calls
    .map(([command]) => command)
    .filter((c: any) => c.constructor.name === name);
}

describe('cascade', () => {
  beforeEach(() => {
    vi.mocked(dynamoClient.send).mockReset();
    vi.mocked(dynamoClient.send).mockResolvedValue({});
    // Default to "nothing found" for the artist-merge sweeps every test doesn't care about.
    ArtistAwardEntity.query.primary = pagedQuery([{ data: [], cursor: null }]);
    ArtistAwardEntity.get = vi
      .fn()
      .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [] }) });
    ArtistAwardEntity.upsert = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
    ArtistEntity.query.list = pagedQuery([{ data: [], cursor: null }]);
    ArtistMembershipEntity.query.primary = pagedQuery([{ data: [], cursor: null }]);
    ArtistMembershipEntity.query.byMember = pagedQuery([{ data: [], cursor: null }]);
    ArtistMembershipEntity.get = vi
      .fn()
      .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [] }) });
    ArtistMembershipEntity.upsert = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
    ArtistMembershipEntity.patch = vi
      .fn()
      .mockReturnValue({ set: vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) }) });
    ArtistPhotoEntity.query.primary = pagedQuery([{ data: [], cursor: null }]);
    ArtistPhotoEntity.upsert = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
    ArtistPhotoEntity.delete = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
    ArtistMediaEntity.query.primary = pagedQuery([{ data: [], cursor: null }]);
    ArtistMediaEntity.upsert = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
    ArtistMediaEntity.delete = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
    ArtistMembershipEntity.delete = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
    ArtistClaimEntity.query.primary = pagedQuery([{ data: [], cursor: null }]);
    ArtistClaimEntity.get = vi
      .fn()
      .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [] }) });
    ArtistClaimEntity.upsert = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
    ArtistClaimEntity.delete = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
    ArtistAffiliationEntity.query.primary = pagedQuery([{ data: [], cursor: null }]);
    ArtistAffiliationEntity.query.byOrganiser = pagedQuery([{ data: [], cursor: null }]);
    ArtistAffiliationEntity.get = vi
      .fn()
      .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [] }) });
    ArtistAffiliationEntity.upsert = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
    ArtistAffiliationEntity.patch = vi
      .fn()
      .mockReturnValue({ set: vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) }) });
    ArtistAffiliationEntity.delete = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
  });

  describe('cascadeComposerNameUpdate', () => {
    it('updates every composition by the composer across pages', async () => {
      CompositionEntity.query.byComposer = pagedQuery([
        { data: [{ id: 'comp1' }], cursor: 'cursor1' },
        { data: [{ id: 'comp2' }], cursor: null },
      ]);

      await cascade.cascadeComposerNameUpdate('artist1', 'New Name');

      expect(CompositionEntity.query.byComposer).toHaveBeenCalledWith({ composerId: 'artist1' });
      expect(CompositionEntity.query.byComposer).toHaveBeenCalledTimes(2);

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates).toHaveLength(2);
      expect(updates[0].Key).toEqual({ pk: 'composition#comp1', sk: '#metadata' });
      expect(updates[0].ExpressionAttributeValues[':name']).toBe('New Name');
      expect(updates[1].Key).toEqual({ pk: 'composition#comp2', sk: '#metadata' });
    });

    it('does nothing when the composer has no compositions', async () => {
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);

      await cascade.cascadeComposerNameUpdate('artist1', 'New Name');

      expect(dynamoClient.send).not.toHaveBeenCalled();
    });
  });

  describe('cascadeRagaNameUpdate', () => {
    it('renames the raga inside each composition that references it', async () => {
      CompositionRagaEntity.query.byRaga = pagedQuery([
        { data: [{ compositionId: 'comp1' }], cursor: null },
      ]);
      vi.mocked(dynamoClient.send).mockImplementation(async (command: any) => {
        if (command.constructor.name === 'BatchGetCommand') {
          return {
            Responses: {
              RasikaLifeTable: [
                {
                  id: 'comp1',
                  pk: 'composition#comp1',
                  ragas: [
                    { id: 'raga1', name: 'Old Name' },
                    { id: 'raga2', name: 'Untouched' },
                  ],
                },
              ],
            },
          };
        }
        return {};
      });

      await cascade.cascadeRagaNameUpdate('raga1', 'New Name');

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates).toHaveLength(1);
      expect(updates[0].Key).toEqual({ pk: 'composition#comp1', sk: '#metadata' });
      expect(updates[0].ExpressionAttributeValues[':ragas']).toEqual([
        { id: 'raga1', name: 'New Name' },
        { id: 'raga2', name: 'Untouched' },
      ]);
    });

    it('skips the page entirely when no compositions reference the raga', async () => {
      CompositionRagaEntity.query.byRaga = pagedQuery([{ data: [], cursor: null }]);

      await cascade.cascadeRagaNameUpdate('raga1', 'New Name');

      expect(dynamoClient.send).not.toHaveBeenCalled();
    });

    it('skips a composition that has no ragas array', async () => {
      CompositionRagaEntity.query.byRaga = pagedQuery([
        { data: [{ compositionId: 'comp1' }], cursor: null },
      ]);
      vi.mocked(dynamoClient.send).mockImplementation(async (command: any) => {
        if (command.constructor.name === 'BatchGetCommand') {
          return { Responses: { RasikaLifeTable: [{ id: 'comp1', pk: 'composition#comp1' }] } };
        }
        return {};
      });

      await cascade.cascadeRagaNameUpdate('raga1', 'New Name');

      expect(commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand')).toHaveLength(0);
    });

    it('keys compositions by their mixed-case id, not the lowercased pk', async () => {
      // The junction carries the mixed-case id ('Comp1'); ElectroDB stores the pk
      // lowercased ('composition#comp1'). Keying the batch-get map by the stripped pk
      // would never match the junction's compositionId, so the rename would silently
      // skip the composition — the exact bug this guards.
      CompositionRagaEntity.query.byRaga = pagedQuery([
        { data: [{ compositionId: 'Comp1' }], cursor: null },
      ]);
      vi.mocked(dynamoClient.send).mockImplementation(async (command: any) => {
        if (command.constructor.name === 'BatchGetCommand') {
          return {
            Responses: {
              RasikaLifeTable: [
                { id: 'Comp1', pk: 'composition#comp1', ragas: [{ id: 'raga1', name: 'Old' }] },
              ],
            },
          };
        }
        return {};
      });

      await cascade.cascadeRagaNameUpdate('raga1', 'New Name');

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates).toHaveLength(1);
      expect(updates[0].ExpressionAttributeValues[':ragas']).toEqual([
        { id: 'raga1', name: 'New Name' },
      ]);
    });
  });

  describe('cascadeVenueNameUpdate', () => {
    it('updates the denormalized venue name on every event at the venue', async () => {
      EventEntity.query.byVenue = pagedQuery([{ data: [{ id: 'event1' }], cursor: null }]);

      await cascade.cascadeVenueNameUpdate('venue1', 'New Venue');

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates).toHaveLength(1);
      expect(updates[0].Key).toEqual({ pk: 'event#event1', sk: '#metadata' });
      expect(updates[0].ExpressionAttributeValues[':venueName']).toBe('New Venue');
    });
  });

  describe('cascadeOrganiserNameUpdate', () => {
    it('updates both awards issued by, and events organised by, the organiser', async () => {
      const awardGo = vi.fn().mockResolvedValue({ data: [{ id: 'award1' }] });
      AwardEntity.query.list = vi
        .fn()
        .mockReturnValue({ where: vi.fn().mockReturnValue({ go: awardGo }) });
      EventEntity.query.byOrganiser = pagedQuery([{ data: [{ id: 'event1' }], cursor: null }]);

      await cascade.cascadeOrganiserNameUpdate('org1', 'New Org');

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates).toHaveLength(2);
      expect(updates[0].Key).toEqual({ pk: 'award#award1', sk: '#metadata' });
      expect(updates[0].ExpressionAttributeValues[':issuingOrganisationName']).toBe('New Org');
      expect(updates[1].Key).toEqual({ pk: 'event#event1', sk: '#metadata' });
      expect(updates[1].ExpressionAttributeValues[':organiserName']).toBe('New Org');
    });

    it('refreshes the denormalized organisationName on affiliation rows', async () => {
      AwardEntity.query.list = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [] }) }),
      });
      EventEntity.query.byOrganiser = pagedQuery([{ data: [], cursor: null }]);
      ArtistAffiliationEntity.query.byOrganiser = pagedQuery([
        { data: [{ artistId: 'artist1' }], cursor: null },
      ]);

      await cascade.cascadeOrganiserNameUpdate('org1', 'New Org');

      expect(ArtistAffiliationEntity.patch).toHaveBeenCalledWith({
        artistId: 'artist1',
        organiserId: 'org1',
      });
      const setMock = vi.mocked(ArtistAffiliationEntity.patch).mock.results[0].value.set;
      expect(setMock).toHaveBeenCalledWith({ organisationName: 'New Org' });
    });
  });

  describe('cascadeEventMetadataToArtists', () => {
    it('propagates the new title and start time onto every EventArtist row', async () => {
      ConcertLogItemEntity; // no-op reference to keep imports linted
      EventArtistEntity.query.primary = pagedQuery([
        { data: [{ eventId: 'event1', artistId: 'artist1' }], cursor: null },
      ]);
      const setSpy = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
      EventArtistEntity.patch = vi.fn().mockReturnValue({ set: setSpy }) as never;

      await cascade.cascadeEventMetadataToArtists(
        'event1',
        'New Title',
        '2026-02-01T00:00:00.000Z'
      );

      expect(EventArtistEntity.patch).toHaveBeenCalledWith({
        eventId: 'event1',
        artistId: 'artist1',
      });
      expect(setSpy).toHaveBeenCalledWith({
        eventTitle: 'New Title',
        eventStartDateTime: '2026-02-01T00:00:00.000Z',
      });
      // The write must go through ElectroDB, which recomputes the GSI sort key from the
      // composite. A raw UpdateCommand here is the bug this replaced.
      expect(commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand')).toHaveLength(0);
    });

    it('derives a templated byArtist sort key, not the bare timestamp', () => {
      // Why the cascade above must not hand-write gsi1sk. The real key is prefixed; the
      // old code wrote the raw ISO string. Since '2' (0x32) sorts above '$' (0x24), such a
      // row compares greater than every correctly-keyed one, so listEventsByArtist's
      // `.gt(now)` / `.lt(now)` split read an edited past concert as upcoming, for good.
      const keys = keysOfEntity(EventArtistEntity as never, {
        eventId: 'event1',
        artistId: 'artist1',
        eventStartDateTime: '2026-02-01T00:00:00.000Z',
      });
      expect(keys.gsi1sk).toBe('$eventartist_1#eventstartdatetime_2026-02-01t00:00:00.000z');
      expect(keys.gsi1sk).not.toBe('2026-02-01T00:00:00.000Z');
    });
  });

  describe('cascadeTalaNameUpdate', () => {
    it('renames the tala inside each composition that references it', async () => {
      CompositionTalaEntity.query.byTala = pagedQuery([
        { data: [{ compositionId: 'comp1' }], cursor: null },
      ]);
      vi.mocked(dynamoClient.send).mockImplementation(async (command: any) => {
        if (command.constructor.name === 'BatchGetCommand') {
          return {
            Responses: {
              RasikaLifeTable: [
                { id: 'comp1', pk: 'composition#comp1', talas: [{ id: 'tala1', name: 'Old' }] },
              ],
            },
          };
        }
        return {};
      });

      await cascade.cascadeTalaNameUpdate('tala1', 'New Tala');

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates[0].ExpressionAttributeValues[':talas']).toEqual([
        { id: 'tala1', name: 'New Tala' },
      ]);
    });
  });

  describe('cascadeArtistMerge', () => {
    it('migrates affiliation rows onto the canonical artist with its name', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistAffiliationEntity.query.primary = pagedQuery([
        {
          data: [
            {
              organiserId: 'org1',
              organisationName: 'Trayag Natyalaya',
              role: 'founder',
              startYear: 2017,
              isCurrent: true,
              source: 'bio-extraction',
            },
          ],
          cursor: null,
        },
      ]);

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      expect(ArtistAffiliationEntity.upsert).toHaveBeenCalledWith({
        artistId: 'canonical',
        artistName: 'Canonical Name',
        organiserId: 'org1',
        organisationName: 'Trayag Natyalaya',
        role: 'founder',
        discipline: undefined,
        startYear: 2017,
        endYear: undefined,
        isCurrent: true,
        source: 'bio-extraction',
      });
      const deletes = commandsSentTo(vi.mocked(dynamoClient.send), 'DeleteCommand');
      expect(deletes.some((d: any) => d.Key.sk === 'organiser#org1')).toBe(true);
    });

    it('drops the loser affiliation when the canonical already holds that role', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistAffiliationEntity.query.primary = pagedQuery([
        { data: [{ organiserId: 'org1', organisationName: 'Trayag Natyalaya' }], cursor: null },
      ]);
      ArtistAffiliationEntity.get = vi
        .fn()
        .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [{ organiserId: 'org1' }] }) });

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      expect(ArtistAffiliationEntity.upsert).not.toHaveBeenCalled();
    });

    it('preserves isFeatured and featureRank when migrating an EventArtist row', async () => {
      // Featured status is curated by a moderator; a merge must not reset it.
      EventArtistEntity.query.byArtist = pagedQuery([
        {
          data: [
            {
              eventId: 'event1',
              artistId: 'loser',
              eventTitle: 'Title',
              eventStartDateTime: '2026-01-01T00:00:00.000Z',
              role: 'performer',
              isFeatured: true,
              featureRank: 2,
            },
          ],
          cursor: null,
        },
      ]);
      EventArtistEntity.get = vi
        .fn()
        .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [] }) });
      EventArtistEntity.upsert = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      expect(EventArtistEntity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ isFeatured: true, featureRank: 2 })
      );
    });

    it('migrates EventArtist rows and re-attributes compositions to the canonical artist', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([
        {
          data: [
            {
              eventId: 'event1',
              artistId: 'loser',
              eventTitle: 'Title',
              eventStartDateTime: '2026-01-01T00:00:00.000Z',
              role: 'performer',
            },
          ],
          cursor: null,
        },
      ]);
      EventArtistEntity.get = vi
        .fn()
        .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [] }) });
      EventArtistEntity.upsert = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
      CompositionEntity.query.byComposer = pagedQuery([{ data: [{ id: 'comp1' }], cursor: null }]);

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      expect(EventArtistEntity.get).toHaveBeenCalledWith([
        { eventId: 'event1', artistId: 'canonical' },
      ]);
      expect(EventArtistEntity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'event1',
          artistId: 'canonical',
          artistName: 'Canonical Name',
        })
      );

      const deletes = commandsSentTo(vi.mocked(dynamoClient.send), 'DeleteCommand');
      expect(deletes[0].Key).toEqual({ pk: 'event#event1', sk: 'artist#loser' });

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates[0].Key).toEqual({ pk: 'composition#comp1', sk: '#metadata' });
      expect(updates[0].ExpressionAttributeValues[':composerId']).toBe('canonical');
    });

    it('aborts the merge when the existence check returns unprocessed keys', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([
        {
          data: [
            {
              eventId: 'event1',
              artistId: 'loser',
              eventTitle: 'Title',
              eventStartDateTime: '2026-01-01T00:00:00.000Z',
              role: 'performer',
            },
          ],
          cursor: null,
        },
      ]);
      // A throttled batch read returns keys under `unprocessed`; treating those as
      // "does not exist" would upsert over a curated canonical row, so abort instead.
      EventArtistEntity.get = vi.fn().mockReturnValue({
        go: vi.fn().mockResolvedValue({
          data: [],
          unprocessed: [{ eventId: 'event1', artistId: 'canonical' }],
        }),
      });

      await expect(
        cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name')
      ).rejects.toThrow(/unprocessed/);
    });

    it('does not create a duplicate EventArtist row when the canonical artist is already on the event', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([
        {
          data: [
            { eventId: 'event1', artistId: 'loser', eventTitle: 'T', eventStartDateTime: 'D' },
          ],
          cursor: null,
        },
      ]);
      EventArtistEntity.get = vi
        .fn()
        .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [{ eventId: 'event1' }] }) });
      EventArtistEntity.upsert = vi.fn();
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      expect(EventArtistEntity.upsert).not.toHaveBeenCalled();
      expect(commandsSentTo(vi.mocked(dynamoClient.send), 'DeleteCommand')).toHaveLength(1);
    });

    it('migrates ArtistAward rows to the canonical artist, skipping one it already holds', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistAwardEntity.query.primary = pagedQuery([
        {
          data: [
            { awardId: 'award1', awardName: 'Award One', year: 2020 },
            { awardId: 'award2', awardName: 'Award Two', year: 2021 },
          ],
          cursor: null,
        },
      ]);
      ArtistAwardEntity.get = vi
        .fn()
        .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [{ awardId: 'award2' }] }) });
      ArtistAwardEntity.upsert = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      expect(ArtistAwardEntity.get).toHaveBeenCalledWith([
        { artistId: 'canonical', awardId: 'award1' },
        { artistId: 'canonical', awardId: 'award2' },
      ]);
      expect(ArtistAwardEntity.upsert).toHaveBeenCalledTimes(1);
      expect(ArtistAwardEntity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          artistId: 'canonical',
          artistName: 'Canonical Name',
          awardId: 'award1',
          awardName: 'Award One',
        })
      );

      const deletes = commandsSentTo(vi.mocked(dynamoClient.send), 'DeleteCommand');
      expect(deletes).toContainEqual(
        expect.objectContaining({ Key: { pk: 'artist#loser', sk: 'award#award1' } })
      );
      expect(deletes).toContainEqual(
        expect.objectContaining({ Key: { pk: 'artist#loser', sk: 'award#award2' } })
      );
    });

    it('rewrites gurus[] entries pointing at the loser on other artists', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistEntity.query.list = pagedQuery([
        {
          data: [
            {
              id: 'student1',
              gurus: [
                // The years and discipline §4.6 widened the guru element with. A merge
                // repoints the guru; it says nothing about when this artist studied under
                // them, so rebuilding the entry as a bare {id, name} destroyed data no
                // sweep could restore.
                {
                  id: 'loser',
                  name: 'Old Name',
                  fromYear: 1998,
                  toYear: 2004,
                  discipline: 'vocal',
                },
                { id: 'other', name: 'Unrelated' },
              ],
            },
            { id: 'student2', gurus: [{ id: 'other', name: 'Unrelated' }] },
          ],
          cursor: null,
        },
      ]);

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      const guruUpdate = updates.find((u: any) => u.Key.pk === 'artist#student1');
      expect(guruUpdate.Key).toEqual({ pk: 'artist#student1', sk: '#metadata' });
      expect(guruUpdate.ExpressionAttributeValues[':gurus']).toEqual([
        {
          id: 'canonical',
          name: 'Canonical Name',
          fromYear: 1998,
          toYear: 2004,
          discipline: 'vocal',
        },
        { id: 'other', name: 'Unrelated' },
      ]);
      expect(updates.some((u: any) => u.Key.pk === 'artist#student2')).toBe(false);
    });

    it('moves loser-as-group ArtistMembership rows to the canonical, preserving role and rank', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistMembershipEntity.query.primary = pagedQuery([
        {
          data: [
            {
              groupId: 'loser',
              memberId: 'member1',
              memberName: 'Member One',
              role: 'vocalist',
              rank: 1,
            },
          ],
          cursor: null,
        },
      ]);

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      expect(ArtistMembershipEntity.get).toHaveBeenCalledWith([
        { groupId: 'canonical', memberId: 'member1' },
      ]);
      expect(ArtistMembershipEntity.upsert).toHaveBeenCalledWith({
        groupId: 'canonical',
        groupName: 'Canonical Name',
        memberId: 'member1',
        memberName: 'Member One',
        role: 'vocalist',
        rank: 1,
      });

      const deletes = commandsSentTo(vi.mocked(dynamoClient.send), 'DeleteCommand');
      expect(deletes).toContainEqual(
        expect.objectContaining({ Key: { pk: 'group#loser', sk: 'member#member1' } })
      );
    });

    it('moves loser-as-member ArtistMembership rows to the canonical, updating memberName', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistMembershipEntity.query.byMember = pagedQuery([
        { data: [{ groupId: 'group1', groupName: 'Group One', memberId: 'loser' }], cursor: null },
      ]);

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      expect(ArtistMembershipEntity.get).toHaveBeenCalledWith([
        { groupId: 'group1', memberId: 'canonical' },
      ]);
      expect(ArtistMembershipEntity.upsert).toHaveBeenCalledWith({
        groupId: 'group1',
        groupName: 'Group One',
        memberId: 'canonical',
        memberName: 'Canonical Name',
        role: undefined,
        rank: undefined,
      });

      const deletes = commandsSentTo(vi.mocked(dynamoClient.send), 'DeleteCommand');
      expect(deletes).toContainEqual(
        expect.objectContaining({ Key: { pk: 'group#group1', sk: 'member#loser' } })
      );
    });

    it('does not create a duplicate ArtistMembership row when the canonical is already linked', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistMembershipEntity.query.primary = pagedQuery([
        {
          data: [{ groupId: 'loser', memberId: 'member1', memberName: 'Member One' }],
          cursor: null,
        },
      ]);
      ArtistMembershipEntity.get = vi
        .fn()
        .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [{ memberId: 'member1' }] }) });

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      expect(ArtistMembershipEntity.upsert).not.toHaveBeenCalled();
      const deletes = commandsSentTo(vi.mocked(dynamoClient.send), 'DeleteCommand');
      expect(deletes).toContainEqual(
        expect.objectContaining({ Key: { pk: 'group#loser', sk: 'member#member1' } })
      );
    });

    it('drops rather than writes a row that would make the canonical its own member', async () => {
      // Merging a duplicate of Ganesh into Ganesh Kumaresh: the loser's membership in
      // the "Ganesh Kumaresh" group would rewrite to groupId === memberId === canonical.
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistMembershipEntity.query.byMember = pagedQuery([
        {
          data: [{ groupId: 'canonical', groupName: 'Ganesh Kumaresh', memberId: 'loser' }],
          cursor: null,
        },
      ]);

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      expect(ArtistMembershipEntity.upsert).not.toHaveBeenCalled();
      expect(ArtistMembershipEntity.get).not.toHaveBeenCalled();
      const deletes = commandsSentTo(vi.mocked(dynamoClient.send), 'DeleteCommand');
      expect(deletes).toContainEqual(
        expect.objectContaining({ Key: { pk: 'group#canonical', sk: 'member#loser' } })
      );
    });

    it('moves photos to the canonical artist, preserving order, featured, caption and credit', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistPhotoEntity.query.primary = pagedQuery([
        {
          data: [
            {
              id: 'photo1',
              imageUrl: 'https://example.com/photo1.jpg',
              uploadId: 'upload1',
              caption: 'On stage',
              credit: 'Jane Doe',
              order: 2,
              featured: true,
              createdBy: 'user1',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          cursor: null,
        },
      ]);

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      expect(ArtistPhotoEntity.query.primary).toHaveBeenCalledWith({ artistId: 'loser' });
      expect(ArtistPhotoEntity.upsert).toHaveBeenCalledWith({
        id: 'photo1',
        artistId: 'canonical',
        imageUrl: 'https://example.com/photo1.jpg',
        uploadId: 'upload1',
        caption: 'On stage',
        credit: 'Jane Doe',
        order: 2,
        featured: true,
        createdBy: 'user1',
        createdAt: '2025-01-01T00:00:00.000Z',
      });

      // Assert on the entity call, not a raw command shape. ElectroDB lowercases key
      // values, so a hand-built key would match nothing while DeleteItem still reported
      // success — a raw-command assertion cannot tell the two apart.
      expect(ArtistPhotoEntity.delete).toHaveBeenCalledWith({ artistId: 'loser', id: 'photo1' });

      // Write the canonical copy before deleting the loser's, so a crash between the two
      // leaves a recoverable duplicate rather than stranding the photo in neither partition.
      const upsertOrder = vi.mocked(ArtistPhotoEntity.upsert).mock.invocationCallOrder[0];
      const deleteOrder = vi.mocked(ArtistPhotoEntity.delete).mock.invocationCallOrder[0];
      expect(upsertOrder).toBeLessThan(deleteOrder);
    });

    // §11.3 wants a test per reference type, because merge has silently corrupted data twice.
    it('moves media coverage to the canonical artist, upserting before deleting', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistMediaEntity.query.primary = pagedQuery([
        {
          data: [
            {
              id: 'media-1',
              title: 'A recital of rare grace',
              url: 'https://thehindu.com/x',
              mediaType: 'review',
              outlet: 'The Hindu',
              publishedOn: '2026-01-30',
              createdBy: 'user-1',
              createdAt: '2026-02-01T00:00:00.000Z',
            },
          ],
          cursor: null,
        },
      ]);

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      // Every field carries across: coverage that lost its outlet or its date in a merge
      // would be unrecoverable, since the original row is deleted straight after.
      expect(ArtistMediaEntity.upsert).toHaveBeenCalledWith({
        id: 'media-1',
        artistId: 'canonical',
        title: 'A recital of rare grace',
        url: 'https://thehindu.com/x',
        mediaType: 'review',
        outlet: 'The Hindu',
        publishedOn: '2026-01-30',
        imageUrl: undefined,
        uploadId: undefined,
        createdBy: 'user-1',
        createdAt: '2026-02-01T00:00:00.000Z',
      });
      expect(ArtistMediaEntity.delete).toHaveBeenCalledWith({
        artistId: 'loser',
        id: 'media-1',
      });
    });

    it('moves both claim and invite rows to the canonical artist', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistClaimEntity.query.primary = pagedQuery([
        {
          data: [
            {
              kind: 'claim',
              subject: 'user1',
              artistName: 'Loser Name',
              userId: 'user1',
              userName: 'A Claimant',
              status: 'verified',
              moderatorNote: 'Replied from the address on her site',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
            {
              kind: 'invite',
              subject: 'a@b.com',
              artistName: 'Loser Name',
              email: 'a@b.com',
              status: 'invited',
              createdAt: '2026-01-02T00:00:00.000Z',
            },
          ],
          cursor: null,
        },
      ]);
      ArtistClaimEntity.get = vi.fn().mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: [] }),
      });

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      // The status and its audit trail must survive the move — a verified claim silently
      // arriving as pending would make the artist re-prove themselves.
      expect(ArtistClaimEntity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          artistId: 'canonical',
          artistName: 'Canonical Name',
          kind: 'claim',
          subject: 'user1',
          status: 'verified',
          moderatorNote: 'Replied from the address on her site',
        })
      );
      expect(ArtistClaimEntity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'invite', subject: 'a@b.com', status: 'invited' })
      );
      expect(ArtistClaimEntity.delete).toHaveBeenCalledWith({
        artistId: 'loser',
        kind: 'claim',
        subject: 'user1',
      });

      // The badge recompute re-reads the partition with a Query, which is eventually
      // consistent — it can return the canonical exactly as it was before the upserts above.
      // Handing it the rows we just wrote is what stops a merge carrying the only verified
      // claim from computing 'unclaimed' and stripping verifiedAt. Invites are excluded
      // because a pre-authorization nobody has acted on holds the badge at nothing.
      const { recomputeArtistClaimStatus } = await import('./artist-claim');
      expect(recomputeArtistClaimStatus).toHaveBeenCalledWith('canonical', [
        { userId: 'user1', status: 'verified' },
      ]);
    });

    function loserClaim(status: string) {
      ArtistClaimEntity.query.primary = pagedQuery([
        {
          data: [
            {
              kind: 'claim',
              subject: 'user1',
              artistName: 'Loser Name',
              userId: 'user1',
              status,
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          cursor: null,
        },
      ]);
    }

    function canonicalClaim(status: string) {
      ArtistClaimEntity.get = vi.fn().mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: [{ kind: 'claim', subject: 'user1', status }] }),
      });
    }

    // Resolved by status precedence, not by "canonical always wins". Overwriting a verified
    // canonical row with the loser's pending one would make the claimant re-prove themselves.
    it('keeps the canonical row when it holds the stronger decision', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      loserClaim('pending');
      canonicalClaim('verified');

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      expect(ArtistClaimEntity.upsert).not.toHaveBeenCalled();
      // Still removed from the loser, or the merge leaves the row stranded.
      expect(ArtistClaimEntity.delete).toHaveBeenCalledWith({
        artistId: 'loser',
        kind: 'claim',
        subject: 'user1',
      });
    });

    // The inverse, which "canonical always wins" got silently wrong: the claimant loses
    // management of their own profile with no log and no trace.
    it('carries the loser row over when it holds the stronger decision', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      loserClaim('verified');
      canonicalClaim('rejected');

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      expect(ArtistClaimEntity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ artistId: 'canonical', subject: 'user1', status: 'verified' })
      );
    });

    it('refuses to guess when the duplicate check returns unprocessed keys', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistClaimEntity.query.primary = pagedQuery([
        {
          data: [
            {
              kind: 'claim',
              subject: 'user1',
              artistName: 'Loser Name',
              userId: 'user1',
              status: 'pending',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          cursor: null,
        },
      ]);
      ArtistClaimEntity.get = vi.fn().mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: [], unprocessed: [{ kind: 'claim' }] }),
      });

      // An unprocessed key read as "no duplicate" would overwrite a canonical claim.
      await expect(
        cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name')
      ).rejects.toThrow(/unprocessed keys/);
      expect(ArtistClaimEntity.upsert).not.toHaveBeenCalled();
    });
  });

  describe('cascadeArtistDeleteToMemberships', () => {
    it('removes membership rows in both directions', async () => {
      ArtistMembershipEntity.query.primary = pagedQuery([
        { data: [{ memberId: 'member1' }], cursor: null },
      ]);
      ArtistMembershipEntity.query.byMember = pagedQuery([
        { data: [{ groupId: 'group1' }], cursor: null },
      ]);

      await cascade.cascadeArtistDeleteToMemberships('artist1');

      expect(ArtistMembershipEntity.delete).toHaveBeenCalledWith({
        groupId: 'artist1',
        memberId: 'member1',
      });
      expect(ArtistMembershipEntity.delete).toHaveBeenCalledWith({
        groupId: 'group1',
        memberId: 'artist1',
      });
    });

    it('deletes nothing when the artist has no memberships', async () => {
      ArtistMembershipEntity.query.primary = pagedQuery([{ data: [], cursor: null }]);
      ArtistMembershipEntity.query.byMember = pagedQuery([{ data: [], cursor: null }]);

      await cascade.cascadeArtistDeleteToMemberships('artist1');

      expect(ArtistMembershipEntity.delete).not.toHaveBeenCalled();
    });
  });

  describe('cascadeArtistNameUpdate', () => {
    it('updates artistName on every EventArtist and ArtistAward row for the artist', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([
        { data: [{ eventId: 'event1' }, { eventId: 'event2' }], cursor: null },
      ]);
      ArtistAwardEntity.query.primary = pagedQuery([
        { data: [{ awardId: 'award1' }], cursor: null },
      ]);
      // Renaming an artist also renames them as a composer — see cascadeArtistNameUpdate.
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);

      await cascade.cascadeArtistNameUpdate('artist1', 'New Name');

      expect(EventArtistEntity.query.byArtist).toHaveBeenCalledWith({ artistId: 'artist1' });
      expect(ArtistAwardEntity.query.primary).toHaveBeenCalledWith({ artistId: 'artist1' });
      expect(CompositionEntity.query.byComposer).toHaveBeenCalledWith({ composerId: 'artist1' });

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates).toHaveLength(3);

      const eventArtistUpdates = updates.filter((u: any) => u.Key.pk.startsWith('event#'));
      expect(eventArtistUpdates).toHaveLength(2);
      expect(eventArtistUpdates[0].Key).toEqual({ pk: 'event#event1', sk: 'artist#artist1' });
      expect(eventArtistUpdates[0].ExpressionAttributeValues[':artistName']).toBe('New Name');

      const awardUpdate = updates.find((u: any) => u.Key.pk === 'artist#artist1');
      expect(awardUpdate.Key).toEqual({ pk: 'artist#artist1', sk: 'award#award1' });
      expect(awardUpdate.ExpressionAttributeValues[':artistName']).toBe('New Name');
    });

    it('refreshes the denormalized groupName and memberName on membership rows', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      ArtistAwardEntity.query.primary = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      // The renamed artist is the group on one row and a member on another.
      ArtistMembershipEntity.query.primary = pagedQuery([
        { data: [{ memberId: 'member1' }], cursor: null },
      ]);
      ArtistMembershipEntity.query.byMember = pagedQuery([
        { data: [{ groupId: 'group1' }], cursor: null },
      ]);

      await cascade.cascadeArtistNameUpdate('artist1', 'New Name');

      expect(ArtistMembershipEntity.patch).toHaveBeenCalledWith({
        groupId: 'artist1',
        memberId: 'member1',
      });
      expect(ArtistMembershipEntity.patch).toHaveBeenCalledWith({
        groupId: 'group1',
        memberId: 'artist1',
      });
      const setMock = vi.mocked(ArtistMembershipEntity.patch).mock.results[0].value.set;
      expect(setMock).toHaveBeenCalledWith({ groupName: 'New Name' });
      expect(setMock).toHaveBeenCalledWith({ memberName: 'New Name' });
    });

    // Without this, an Organiser page's "artists affiliated" listing shows the old name for
    // good — the row holds a copy and there is no sweep that would ever correct it.
    it('refreshes the denormalized artistName on affiliation rows', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      ArtistAwardEntity.query.primary = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistAffiliationEntity.query.primary = pagedQuery([
        { data: [{ organiserId: 'org1' }, { organiserId: 'org2' }], cursor: null },
      ]);

      await cascade.cascadeArtistNameUpdate('artist1', 'New Name');

      expect(ArtistAffiliationEntity.patch).toHaveBeenCalledWith({
        artistId: 'artist1',
        organiserId: 'org1',
      });
      expect(ArtistAffiliationEntity.patch).toHaveBeenCalledWith({
        artistId: 'artist1',
        organiserId: 'org2',
      });
      const setMock = vi.mocked(ArtistAffiliationEntity.patch).mock.results[0].value.set;
      expect(setMock).toHaveBeenCalledWith({ artistName: 'New Name' });
    });
  });

  // ArtistAffiliation is the first junction whose far side is an Organiser, so there was no
  // organiser-delete cascade to extend. Without this a deleted organisation keeps rendering in
  // an artist's Affiliations section, linked, and JSON-LD publishes it as a live Organization.
  describe('cascadeOrganiserDeleteToAffiliations', () => {
    it('removes every affiliation row for the organisation', async () => {
      ArtistAffiliationEntity.query.byOrganiser = pagedQuery([
        { data: [{ artistId: 'artist1' }, { artistId: 'artist2' }], cursor: null },
      ]);

      await cascade.cascadeOrganiserDeleteToAffiliations('org1');

      expect(ArtistAffiliationEntity.delete).toHaveBeenCalledWith({
        artistId: 'artist1',
        organiserId: 'org1',
      });
      expect(ArtistAffiliationEntity.delete).toHaveBeenCalledWith({
        artistId: 'artist2',
        organiserId: 'org1',
      });
    });

    it('deletes nothing when the organisation has no affiliated artists', async () => {
      ArtistAffiliationEntity.query.byOrganiser = pagedQuery([{ data: [], cursor: null }]);

      await cascade.cascadeOrganiserDeleteToAffiliations('org1');

      expect(ArtistAffiliationEntity.delete).not.toHaveBeenCalled();
    });
  });

  describe('cascadeArtistDeleteToAffiliations', () => {
    // getOrganiserArtists is a single-query junction read that does not check the artist's
    // deletedAt, so a deleted artist would linger on an institution page unless the edge goes.
    it('removes every affiliation row for the artist', async () => {
      ArtistAffiliationEntity.query.primary = pagedQuery([
        { data: [{ organiserId: 'org1' }, { organiserId: 'org2' }], cursor: null },
      ]);

      await cascade.cascadeArtistDeleteToAffiliations('artist1');

      expect(ArtistAffiliationEntity.delete).toHaveBeenCalledWith({
        artistId: 'artist1',
        organiserId: 'org1',
      });
      expect(ArtistAffiliationEntity.delete).toHaveBeenCalledWith({
        artistId: 'artist1',
        organiserId: 'org2',
      });
    });

    it('deletes nothing when the artist has no affiliations', async () => {
      ArtistAffiliationEntity.query.primary = pagedQuery([{ data: [], cursor: null }]);

      await cascade.cascadeArtistDeleteToAffiliations('artist1');

      expect(ArtistAffiliationEntity.delete).not.toHaveBeenCalled();
    });
  });

  describe('cascadeVenueMerge', () => {
    it('repoints every event at the loser venue to the canonical venue', async () => {
      EventEntity.query.byVenue = pagedQuery([{ data: [{ id: 'event1' }], cursor: null }]);

      await cascade.cascadeVenueMerge('loserVenue', 'canonicalVenue', 'Canonical');

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates[0].ExpressionAttributeValues).toMatchObject({
        ':venueId': 'canonicalVenue',
        ':venueName': 'Canonical',
        ':gsi4pk': 'venue#canonicalvenue',
      });
    });
  });

  describe('cascadeOrganiserMerge', () => {
    it('repoints every event at the loser organiser to the canonical organiser', async () => {
      EventEntity.query.byOrganiser = pagedQuery([{ data: [{ id: 'event1' }], cursor: null }]);

      await cascade.cascadeOrganiserMerge('loserOrg', 'canonicalOrg', 'Canonical');

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates[0].ExpressionAttributeValues).toMatchObject({
        ':organiserId': 'canonicalOrg',
        ':organiserName': 'Canonical',
        ':gsi5pk': 'organiser#canonicalorg',
      });
    });

    // organiserId is the sort key, so the row cannot be patched in place — it is rewritten
    // under the canonical key and the loser's copy deleted.
    it('moves affiliation rows onto the canonical organiser', async () => {
      EventEntity.query.byOrganiser = pagedQuery([{ data: [], cursor: null }]);
      ArtistAffiliationEntity.query.byOrganiser = pagedQuery([
        {
          data: [{ artistId: 'artist1', artistName: 'Yagnika', role: 'faculty', isCurrent: true }],
          cursor: null,
        },
      ]);

      await cascade.cascadeOrganiserMerge('loserOrg', 'canonicalOrg', 'Canonical');

      expect(ArtistAffiliationEntity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          artistId: 'artist1',
          artistName: 'Yagnika',
          organiserId: 'canonicalOrg',
          organisationName: 'Canonical',
          role: 'faculty',
          isCurrent: true,
        })
      );
      const deletes = commandsSentTo(vi.mocked(dynamoClient.send), 'DeleteCommand');
      expect(deletes[0].Key).toEqual({ pk: 'artist#artist1', sk: 'organiser#loserorg' });
    });

    it('keeps the existing row when the artist already holds a role at the canonical', async () => {
      EventEntity.query.byOrganiser = pagedQuery([{ data: [], cursor: null }]);
      ArtistAffiliationEntity.query.byOrganiser = pagedQuery([
        { data: [{ artistId: 'artist1', artistName: 'Yagnika' }], cursor: null },
      ]);
      ArtistAffiliationEntity.get = vi
        .fn()
        .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [{ artistId: 'artist1' }] }) });

      await cascade.cascadeOrganiserMerge('loserOrg', 'canonicalOrg', 'Canonical');

      expect(ArtistAffiliationEntity.upsert).not.toHaveBeenCalled();
      const deletes = commandsSentTo(vi.mocked(dynamoClient.send), 'DeleteCommand');
      expect(deletes).toHaveLength(1);
    });
  });

  describe('cascadeRagaMerge', () => {
    it('replaces the raga junction and denormalized ragas array with the canonical raga', async () => {
      CompositionRagaEntity.query.byRaga = pagedQuery([
        { data: [{ compositionId: 'comp1' }], cursor: null },
      ]);
      CompositionRagaEntity.get = vi
        .fn()
        .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [] }) });
      CompositionRagaEntity.create = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
      vi.mocked(dynamoClient.send).mockImplementation(async (command: any) => {
        if (command.constructor.name === 'BatchGetCommand') {
          return {
            Responses: {
              RasikaLifeTable: [
                { id: 'comp1', pk: 'composition#comp1', ragas: [{ id: 'loserRaga', name: 'Old' }] },
              ],
            },
          };
        }
        return {};
      });

      await cascade.cascadeRagaMerge('loserRaga', 'canonicalRaga', 'Canonical Raga');

      expect(CompositionRagaEntity.create).toHaveBeenCalledWith({
        compositionId: 'comp1',
        ragaId: 'canonicalRaga',
      });
      const deletes = commandsSentTo(vi.mocked(dynamoClient.send), 'DeleteCommand');
      expect(deletes[0].Key).toEqual({ pk: 'composition#comp1', sk: 'raga#loserraga' });
      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates[0].ExpressionAttributeValues[':ragas']).toEqual([
        { id: 'canonicalRaga', name: 'Canonical Raga' },
      ]);
    });

    it('does not create a duplicate raga junction when the canonical raga is already linked', async () => {
      CompositionRagaEntity.query.byRaga = pagedQuery([
        { data: [{ compositionId: 'comp1' }], cursor: null },
      ]);
      CompositionRagaEntity.get = vi
        .fn()
        .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [{ compositionId: 'comp1' }] }) });
      CompositionRagaEntity.create = vi.fn();
      vi.mocked(dynamoClient.send).mockImplementation(async (command: any) => {
        if (command.constructor.name === 'BatchGetCommand') {
          return {
            Responses: {
              RasikaLifeTable: [
                {
                  id: 'comp1',
                  pk: 'composition#comp1',
                  ragas: [
                    { id: 'loserRaga', name: 'Old' },
                    { id: 'canonicalRaga', name: 'Stale' },
                  ],
                },
              ],
            },
          };
        }
        return {};
      });

      await cascade.cascadeRagaMerge('loserRaga', 'canonicalRaga', 'Canonical Raga');

      expect(CompositionRagaEntity.create).not.toHaveBeenCalled();
      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates[0].ExpressionAttributeValues[':ragas']).toEqual([
        { id: 'canonicalRaga', name: 'Canonical Raga' },
      ]);
    });
  });

  describe('cascadeTalaMerge', () => {
    it('replaces the tala junction and denormalized talas array with the canonical tala', async () => {
      CompositionTalaEntity.query.byTala = pagedQuery([
        { data: [{ compositionId: 'comp1' }], cursor: null },
      ]);
      CompositionTalaEntity.get = vi
        .fn()
        .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: [] }) });
      CompositionTalaEntity.create = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
      vi.mocked(dynamoClient.send).mockImplementation(async (command: any) => {
        if (command.constructor.name === 'BatchGetCommand') {
          return {
            Responses: {
              RasikaLifeTable: [
                { id: 'comp1', pk: 'composition#comp1', talas: [{ id: 'loserTala', name: 'Old' }] },
              ],
            },
          };
        }
        return {};
      });

      await cascade.cascadeTalaMerge('loserTala', 'canonicalTala', 'Canonical Tala');

      expect(CompositionTalaEntity.create).toHaveBeenCalledWith({
        compositionId: 'comp1',
        talaId: 'canonicalTala',
      });
    });
  });

  describe('cascadeEventMerge', () => {
    it('preserves isFeatured and featureRank when migrating an artist to the canonical event', () => {
      EventArtistEntity.query.primary = vi
        .fn()
        .mockReturnValueOnce({ go: vi.fn().mockResolvedValue({ data: [], cursor: null }) })
        .mockReturnValueOnce({
          go: vi.fn().mockResolvedValue({
            data: [
              {
                eventId: 'loserEvent',
                artistId: 'new',
                artistName: 'New Artist',
                isFeatured: true,
                featureRank: 3,
              },
            ],
            cursor: null,
          }),
        });
      EventEntity.get = vi.fn().mockReturnValue({
        go: vi.fn().mockResolvedValue({
          data: { title: 'Canonical', startDateTime: '2026-01-01T00:00:00.000Z' },
        }),
      });
      EventArtistEntity.upsert = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });

      return cascade.cascadeEventMerge('loserEvent', 'canonicalEvent').then(() => {
        expect(EventArtistEntity.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ isFeatured: true, featureRank: 3 })
        );
      });
    });

    it('migrates artists from the loser event to the canonical event, skipping duplicates', async () => {
      EventArtistEntity.query.primary = vi
        .fn()
        .mockReturnValueOnce({
          go: vi.fn().mockResolvedValue({ data: [{ artistId: 'existing' }], cursor: null }),
        })
        .mockReturnValueOnce({
          go: vi.fn().mockResolvedValue({
            data: [
              { eventId: 'loserEvent', artistId: 'existing', artistName: 'Existing' },
              { eventId: 'loserEvent', artistId: 'new', artistName: 'New Artist' },
            ],
            cursor: null,
          }),
        });
      EventEntity.get = vi.fn().mockReturnValue({
        go: vi.fn().mockResolvedValue({
          data: { title: 'Canonical', startDateTime: '2026-01-01T00:00:00.000Z' },
        }),
      });
      EventArtistEntity.upsert = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });

      await cascade.cascadeEventMerge('loserEvent', 'canonicalEvent');

      expect(EventArtistEntity.upsert).toHaveBeenCalledTimes(1);
      expect(EventArtistEntity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'canonicalEvent',
          artistId: 'new',
          artistName: 'New Artist',
        })
      );
      const deletes = commandsSentTo(vi.mocked(dynamoClient.send), 'DeleteCommand');
      expect(deletes).toHaveLength(2);
    });
  });

  describe('cascadeEventDeleteToSetlist', () => {
    it('deletes every ConcertLogItem for the event and clears the setlist', async () => {
      ConcertLogItemEntity.query.byEvent = pagedQuery([
        { data: [{ userId: 'user1', orderStr: '0000' }], cursor: null },
      ]);
      ConcertLogItemEntity.delete = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });

      await cascade.cascadeEventDeleteToSetlist('event1');

      expect(ConcertLogItemEntity.delete).toHaveBeenCalledWith({
        userId: 'user1',
        eventId: 'event1',
        orderStr: '0000',
      });
      expect(deleteAllEventSetlistRows).toHaveBeenCalledWith('event1');
    });
  });

  describe('cascadeEventHardDeleteToSetlist', () => {
    it('decrements composition/raga counters and hard-deletes the setlist rows', async () => {
      vi.mocked(getEventSetlist).mockResolvedValue([
        { compositionId: 'comp1', ragaId: 'raga1' },
        { compositionId: 'comp1', ragaId: 'raga2' },
      ] as any);
      ConcertLogItemEntity.query.byEvent = pagedQuery([
        { data: [{ userId: 'user1', orderStr: '0000' }], cursor: null },
      ]);

      await cascade.cascadeEventHardDeleteToSetlist('event1');

      expect(adjustCompositionCount).toHaveBeenCalledWith('comp1', -1);
      expect(adjustCompositionCount).toHaveBeenCalledTimes(1);
      expect(adjustRagaCount).toHaveBeenCalledWith('raga1', -1);
      expect(adjustRagaCount).toHaveBeenCalledWith('raga2', -1);

      const deletes = commandsSentTo(vi.mocked(dynamoClient.send), 'DeleteCommand');
      expect(deletes[0].Key).toEqual({ pk: 'concert_log_items#user1#event1', sk: 'item#0000' });
      expect(deleteAllEventSetlistRows).toHaveBeenCalledWith('event1');
    });
  });

  describe('cascadeCompositionDeleteToSetlistItems', () => {
    it('strips the composition link from every logged item and recomputes affected events', async () => {
      const item = {
        userId: 'user1',
        eventId: 'event1',
        orderStr: '0000',
        order: 0,
        compositionTitle: 'Title',
        ragaId: 'raga1',
        ragaName: 'Raga',
        talaId: 'tala1',
        talaName: 'Tala',
        compositionType: 'kriti',
        isHighlight: false,
        eventStartDateTime: '2026-01-01T00:00:00.000Z',
      };
      ConcertLogItemEntity.query.byComposition = pagedQuery([{ data: [item], cursor: null }]);
      ConcertLogItemEntity.delete = vi.fn().mockReturnValue({
        params: vi
          .fn()
          .mockReturnValue({ Key: { pk: 'x', sk: 'y' }, TableName: 'RasikaLifeTable' }),
      });
      ConcertLogItemEntity.put = vi.fn().mockReturnValue({
        params: vi
          .fn()
          .mockReturnValue({ Item: { pk: 'x', sk: 'y' }, TableName: 'RasikaLifeTable' }),
      });

      await cascade.cascadeCompositionDeleteToSetlistItems('comp1');

      expect(ConcertLogItemEntity.put).toHaveBeenCalledWith(
        expect.not.objectContaining({ compositionId: expect.anything() })
      );
      const transacts = commandsSentTo(vi.mocked(dynamoClient.send), 'TransactWriteCommand');
      expect(transacts).toHaveLength(1);
      expect(recomputeEventSetlist).toHaveBeenCalledWith('event1');
    });
  });

  describe('cascadeCompositionMergeToSetlistItems', () => {
    it('repoints logged items from the loser composition to the canonical composition', async () => {
      ConcertLogItemEntity.query.byComposition = pagedQuery([
        { data: [{ userId: 'user1', eventId: 'event1', orderStr: '0000' }], cursor: null },
      ]);
      const set = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
      ConcertLogItemEntity.patch = vi.fn().mockReturnValue({ set });

      await cascade.cascadeCompositionMergeToSetlistItems('fromComp', 'toComp');

      expect(ConcertLogItemEntity.patch).toHaveBeenCalledWith({
        userId: 'user1',
        eventId: 'event1',
        orderStr: '0000',
      });
      expect(set).toHaveBeenCalledWith({ compositionId: 'toComp' });
      expect(recomputeEventSetlist).toHaveBeenCalledWith('event1');
    });
  });

  describe('cascadeRagaMergeToSetlistItems', () => {
    it('repoints logged items and verified setlist rows from the loser raga to the canonical raga', async () => {
      ConcertLogItemEntity.query.byRaga = pagedQuery([
        { data: [{ userId: 'user1', eventId: 'event1', orderStr: '0000' }], cursor: null },
      ]);
      const itemSet = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
      ConcertLogItemEntity.patch = vi.fn().mockReturnValue({ set: itemSet });
      vi.mocked(getEventSetlist).mockResolvedValue([
        { orderStr: '0000', ragaId: 'fromRaga' },
        { orderStr: '0001', ragaId: 'otherRaga' },
      ] as any);
      const setlistSet = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
      EventSetlistEntity.patch = vi.fn().mockReturnValue({ set: setlistSet });

      await cascade.cascadeRagaMergeToSetlistItems('fromRaga', 'toRaga', 'To Raga');

      expect(itemSet).toHaveBeenCalledWith({ ragaId: 'toRaga', ragaName: 'To Raga' });
      expect(EventSetlistEntity.patch).toHaveBeenCalledWith({
        eventId: 'event1',
        orderStr: '0000',
      });
      expect(EventSetlistEntity.patch).toHaveBeenCalledTimes(1);
      expect(setlistSet).toHaveBeenCalledWith({ ragaId: 'toRaga', ragaName: 'To Raga' });
      expect(recomputeEventSetlist).toHaveBeenCalledWith('event1');
    });
  });

  describe('cascadeUserDeleteToSetlistItems', () => {
    it('clears the user setlist items from every event they logged and recomputes each', async () => {
      ConcertLogEntity.query.byUserDate = pagedQuery([
        { data: [{ eventId: 'event1' }], cursor: null },
      ]);

      await cascade.cascadeUserDeleteToSetlistItems('user1');

      expect(deleteAllUserSetlistItems).toHaveBeenCalledWith('user1', 'event1');
      expect(recomputeEventSetlist).toHaveBeenCalledWith('event1');
    });
  });

  describe('cascadeEventMergeToSetlist', () => {
    it('moves every logged item from the loser event to the canonical event', async () => {
      const item = { userId: 'user1', eventId: 'fromEvent', orderStr: '0000' };
      ConcertLogItemEntity.query.byEvent = pagedQuery([{ data: [item], cursor: null }]);
      ConcertLogItemEntity.delete = vi.fn().mockReturnValue({
        params: vi
          .fn()
          .mockReturnValue({ Key: { pk: 'x', sk: 'y' }, TableName: 'RasikaLifeTable' }),
      });
      ConcertLogItemEntity.put = vi.fn().mockReturnValue({
        params: vi.fn().mockReturnValue({
          Item: { pk: 'x', sk: 'y', eventId: 'toEvent' },
          TableName: 'RasikaLifeTable',
        }),
      });

      await cascade.cascadeEventMergeToSetlist('fromEvent', 'toEvent');

      expect(ConcertLogItemEntity.put).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'toEvent' })
      );
      expect(commandsSentTo(vi.mocked(dynamoClient.send), 'TransactWriteCommand')).toHaveLength(1);
      expect(deleteAllEventSetlistRows).toHaveBeenCalledWith('fromEvent');
      expect(recomputeEventSetlist).toHaveBeenCalledWith('toEvent');
    });
  });
});
