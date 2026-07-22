import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./composition/entity', () => ({
  CompositionEntity: { query: { byComposer: vi.fn() } },
}));

vi.mock('./composition_raga/entity', () => ({
  CompositionRagaEntity: { query: { byRaga: vi.fn() }, get: vi.fn(), create: vi.fn() },
}));

vi.mock('./composition_tala/entity', () => ({
  CompositionTalaEntity: { query: { byTala: vi.fn() }, get: vi.fn(), create: vi.fn() },
}));

vi.mock('./event/entity', () => ({
  EventEntity: { query: { byVenue: vi.fn(), byOrganiser: vi.fn() }, get: vi.fn() },
}));

vi.mock('./award/entity', () => ({
  AwardEntity: { query: { list: vi.fn() } },
}));

vi.mock('./event-artist/entity', () => ({
  EventArtistEntity: {
    query: { primary: vi.fn(), byArtist: vi.fn() },
    get: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('./artist-award/entity', () => ({
  ArtistAwardEntity: {
    query: { primary: vi.fn() },
    get: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('./artist/entity', () => ({
  ArtistEntity: { scan: { go: vi.fn() } },
}));

vi.mock('./concert-log-item/entity', () => ({
  ConcertLogItemEntity: {
    query: { byEvent: vi.fn(), byComposition: vi.fn(), byRaga: vi.fn() },
    delete: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

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

import { dynamoClient } from '../db/client';
import { ArtistAwardEntity } from './artist-award/entity';
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
    ArtistEntity.scan.go = vi.fn().mockResolvedValue({ data: [], cursor: null });
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
      expect(updates[0].Key).toEqual({ pk: 'COMPOSITION#comp1', sk: '#METADATA' });
      expect(updates[0].ExpressionAttributeValues[':name']).toBe('New Name');
      expect(updates[1].Key).toEqual({ pk: 'COMPOSITION#comp2', sk: '#METADATA' });
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
                  pk: 'COMPOSITION#comp1',
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
      expect(updates[0].Key).toEqual({ pk: 'COMPOSITION#comp1', sk: '#METADATA' });
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
          return { Responses: { RasikaLifeTable: [{ pk: 'COMPOSITION#comp1' }] } };
        }
        return {};
      });

      await cascade.cascadeRagaNameUpdate('raga1', 'New Name');

      expect(commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand')).toHaveLength(0);
    });
  });

  describe('cascadeVenueNameUpdate', () => {
    it('updates the denormalized venue name on every event at the venue', async () => {
      EventEntity.query.byVenue = pagedQuery([{ data: [{ id: 'event1' }], cursor: null }]);

      await cascade.cascadeVenueNameUpdate('venue1', 'New Venue');

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates).toHaveLength(1);
      expect(updates[0].Key).toEqual({ pk: 'EVENT#event1', sk: '#METADATA' });
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
      expect(updates[0].Key).toEqual({ pk: 'AWARD#award1', sk: '#METADATA' });
      expect(updates[0].ExpressionAttributeValues[':issuingOrganisationName']).toBe('New Org');
      expect(updates[1].Key).toEqual({ pk: 'EVENT#event1', sk: '#METADATA' });
      expect(updates[1].ExpressionAttributeValues[':organiserName']).toBe('New Org');
    });
  });

  describe('cascadeEventMetadataToArtists', () => {
    it('propagates the new title and start time onto every EventArtist row', async () => {
      ConcertLogItemEntity; // no-op reference to keep imports linted
      EventArtistEntity.query.primary = pagedQuery([
        { data: [{ eventId: 'event1', artistId: 'artist1' }], cursor: null },
      ]);

      await cascade.cascadeEventMetadataToArtists(
        'event1',
        'New Title',
        '2026-02-01T00:00:00.000Z'
      );

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates).toHaveLength(1);
      expect(updates[0].Key).toEqual({ pk: 'EVENT#event1', sk: 'ARTIST#artist1' });
      expect(updates[0].ExpressionAttributeValues[':eventTitle']).toBe('New Title');
      expect(updates[0].ExpressionAttributeValues[':gsi1sk']).toBe('2026-02-01T00:00:00.000Z');
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
              RasikaLifeTable: [{ pk: 'COMPOSITION#comp1', talas: [{ id: 'tala1', name: 'Old' }] }],
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
      expect(deletes[0].Key).toEqual({ pk: 'EVENT#event1', sk: 'ARTIST#loser' });

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates[0].Key).toEqual({ pk: 'COMPOSITION#comp1', sk: '#METADATA' });
      expect(updates[0].ExpressionAttributeValues[':composerId']).toBe('canonical');
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
        expect.objectContaining({ Key: { pk: 'ARTIST#loser', sk: 'AWARD#award1' } })
      );
      expect(deletes).toContainEqual(
        expect.objectContaining({ Key: { pk: 'ARTIST#loser', sk: 'AWARD#award2' } })
      );
    });

    it('rewrites gurus[] entries pointing at the loser on other artists', async () => {
      EventArtistEntity.query.byArtist = pagedQuery([{ data: [], cursor: null }]);
      CompositionEntity.query.byComposer = pagedQuery([{ data: [], cursor: null }]);
      ArtistEntity.scan.go = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'student1',
            gurus: [
              { id: 'loser', name: 'Old Name' },
              { id: 'other', name: 'Unrelated' },
            ],
          },
          { id: 'student2', gurus: [{ id: 'other', name: 'Unrelated' }] },
        ],
        cursor: null,
      });

      await cascade.cascadeArtistMerge('loser', 'canonical', 'Canonical Name');

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      const guruUpdate = updates.find((u: any) => u.Key.pk === 'ARTIST#student1');
      expect(guruUpdate.Key).toEqual({ pk: 'ARTIST#student1', sk: '#METADATA' });
      expect(guruUpdate.ExpressionAttributeValues[':gurus']).toEqual([
        { id: 'canonical', name: 'Canonical Name' },
        { id: 'other', name: 'Unrelated' },
      ]);
      expect(updates.some((u: any) => u.Key.pk === 'ARTIST#student2')).toBe(false);
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

      await cascade.cascadeArtistNameUpdate('artist1', 'New Name');

      expect(EventArtistEntity.query.byArtist).toHaveBeenCalledWith({ artistId: 'artist1' });
      expect(ArtistAwardEntity.query.primary).toHaveBeenCalledWith({ artistId: 'artist1' });

      const updates = commandsSentTo(vi.mocked(dynamoClient.send), 'UpdateCommand');
      expect(updates).toHaveLength(3);

      const eventArtistUpdates = updates.filter((u: any) => u.Key.pk.startsWith('EVENT#'));
      expect(eventArtistUpdates).toHaveLength(2);
      expect(eventArtistUpdates[0].Key).toEqual({ pk: 'EVENT#event1', sk: 'ARTIST#artist1' });
      expect(eventArtistUpdates[0].ExpressionAttributeValues[':artistName']).toBe('New Name');

      const awardUpdate = updates.find((u: any) => u.Key.pk === 'ARTIST#artist1');
      expect(awardUpdate.Key).toEqual({ pk: 'ARTIST#artist1', sk: 'AWARD#award1' });
      expect(awardUpdate.ExpressionAttributeValues[':artistName']).toBe('New Name');
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
        ':gsi4pk': 'VENUE#canonicalVenue',
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
        ':gsi5pk': 'ORGANISER#canonicalOrg',
      });
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
                { pk: 'COMPOSITION#comp1', ragas: [{ id: 'loserRaga', name: 'Old' }] },
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
      expect(deletes[0].Key).toEqual({ pk: 'COMPOSITION#comp1', sk: 'RAGA#loserRaga' });
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
                  pk: 'COMPOSITION#comp1',
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
                { pk: 'COMPOSITION#comp1', talas: [{ id: 'loserTala', name: 'Old' }] },
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
      expect(deletes[0].Key).toEqual({ pk: 'CONCERT_LOG_ITEMS#user1#event1', sk: 'ITEM#0000' });
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
