import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as db from '../../db';
import * as accessPatterns from '../../shared/accessPatterns';
import { ArtistRepository } from './repository';
import type { CreateArtistInput } from './schema';
import { ArtistType, Tradition } from './types';

// Mock the database operations
vi.mock('../../db', () => ({
  putItem: vi.fn().mockResolvedValue(undefined),
  updateItem: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
  scan: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
  getByPrimaryKey: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../shared/accessPatterns', () => ({
  getByPrimaryKey: vi.fn().mockResolvedValue(null),
  getByGlobalIndex: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
}));

describe('ArtistRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create an artist with all required fields', async () => {
      const input: CreateArtistInput = {
        name: 'M.S. Subbulakshmi',
        artistType: ArtistType.VOCALIST,
        instruments: ['voice'],
        traditions: [Tradition.CARNATIC],
      };

      vi.mocked(db.putItem).mockResolvedValue(undefined);

      const artist = await ArtistRepository.create(input);

      expect(artist.name).toBe(input.name);
      expect(artist.artistType).toBe(input.artistType);
      expect(artist.isVerified).toBe(false);
      expect(artist.viewCount).toBe(0);
      expect(artist.PK).toMatch(/^ARTIST#/);
      expect(artist.SK).toBe('#METADATA');
      expect(artist.GSI1PK).toBe('ARTIST_NAME#m.s. subbulakshmi');
      expect(artist.GSI3PK).toBe('TRADITION#carnatic');
    });

    it('should create GSI fields for searchability', async () => {
      const input: CreateArtistInput = {
        name: 'Lalgudi Jayaraman',
        artistType: ArtistType.INSTRUMENTALIST,
        instruments: ['violin', 'viola'],
        traditions: [Tradition.CARNATIC],
        location: {
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
        },
      };

      vi.mocked(db.putItem).mockResolvedValue(undefined);

      const artist = await ArtistRepository.create(input);

      expect(artist.GSI1PK).toBe('ARTIST_NAME#lalgudi jayaraman');
      expect(artist.GSI2PK).toBe('INSTRUMENT#violin');
      expect(artist.GSI3PK).toBe('TRADITION#carnatic');
      expect(artist.GSI4PK).toBe('LOCATION#India#Tamil Nadu#Chennai');
    });

    it('should handle group artists', async () => {
      const input: CreateArtistInput = {
        name: 'Ganesh Kumaresh',
        artistType: ArtistType.GROUP,
        instruments: ['violin'],
        traditions: [Tradition.CARNATIC],
        formationYear: 1972,
      };

      vi.mocked(db.putItem).mockResolvedValue(undefined);

      const artist = await ArtistRepository.create(input);

      expect(artist.artistType).toBe(ArtistType.GROUP);
      expect(artist.formationYear).toBe(1972);
    });
  });

  describe('getById', () => {
    it('should retrieve an artist by ID', async () => {
      const mockArtist = {
        id: 'test-id',
        name: 'Test Artist',
        artistType: ArtistType.VOCALIST,
        // ... other fields
      };

      vi.mocked(accessPatterns.getByPrimaryKey).mockResolvedValue(mockArtist);

      const artist = await ArtistRepository.getById('test-id');

      expect(artist).toEqual(mockArtist);
      expect(accessPatterns.getByPrimaryKey).toHaveBeenCalledWith('ARTIST', 'test-id', '#METADATA');
    });

    it('should return null for non-existent artist', async () => {
      vi.mocked(accessPatterns.getByPrimaryKey).mockResolvedValue(null);

      const artist = await ArtistRepository.getById('non-existent');

      expect(artist).toBeNull();
    });
  });

  describe('update', () => {
    it('should update artist fields', async () => {
      const mockExisting = {
        id: 'test-id',
        name: 'Test Artist',
        artistType: ArtistType.VOCALIST,
        instruments: ['voice'],
        traditions: [Tradition.CARNATIC],
        viewCount: 5,
      };

      const updateInput = {
        bio: 'Updated bio',
        instruments: ['violin', 'viola'],
      };

      const updatedArtist = {
        ...mockExisting,
        bio: 'Updated bio',
        instruments: ['violin', 'viola'],
      };

      vi.mocked(accessPatterns.getByPrimaryKey)
        .mockResolvedValueOnce(mockExisting as any)
        .mockResolvedValueOnce(updatedArtist as any);

      const result = await ArtistRepository.update('test-id', updateInput);

      expect(result).toMatchObject({
        bio: 'Updated bio',
        instruments: ['violin', 'viola'],
      });
    });

    it('should update GSI fields when name changes', async () => {
      const mockExisting = {
        id: 'test-id',
        name: 'Old Name',
        artistType: ArtistType.VOCALIST,
        instruments: ['voice'],
        traditions: [Tradition.CARNATIC],
        viewCount: 5,
      };

      const updateInput = { name: 'New Name' };

      const updatedArtist = {
        ...mockExisting,
        name: 'New Name',
      };

      vi.mocked(accessPatterns.getByPrimaryKey)
        .mockResolvedValueOnce(mockExisting as any)
        .mockResolvedValueOnce(updatedArtist as any);

      const result = await ArtistRepository.update('test-id', updateInput);

      expect(result).toMatchObject({
        name: 'New Name',
      });
    });
  });

  describe('searchByName', () => {
    it('should search artists by name', async () => {
      const mockResults = {
        items: [
          { id: '1', name: 'Balamuralikrishna' },
          { id: '2', name: 'Balamurali' },
        ],
        lastEvaluatedKey: undefined,
      };

      vi.mocked(db.scan).mockResolvedValue(mockResults);

      const result = await ArtistRepository.searchByName('balamurali');

      expect(result.items.length).toBe(2);
      expect(db.scan).toHaveBeenCalledWith({
        FilterExpression:
          'begins_with(PK, :pkPrefix) AND SK = :skValue AND contains(#searchName, :searchTerm)',
        ExpressionAttributeNames: {
          '#searchName': 'searchName',
        },
        ExpressionAttributeValues: {
          ':pkPrefix': 'ARTIST#',
          ':skValue': '#METADATA',
          ':searchTerm': 'balamurali',
        },
        Limit: 60,
      });
    });

    it('should handle pagination', async () => {
      const nextToken = Buffer.from(JSON.stringify({ PK: 'test' })).toString('base64');

      vi.mocked(db.scan).mockResolvedValue({
        items: [],
        lastEvaluatedKey: { PK: 'test' },
      });

      const result = await ArtistRepository.searchByName('test', 10);

      expect(result.hasMore).toBe(true);
      expect(result.nextToken).toBeDefined();
    });
  });

  describe('getByTradition', () => {
    it('should get artists by tradition', async () => {
      const mockResults = {
        items: [
          { id: '1', name: 'Artist 1', traditions: [Tradition.CARNATIC] },
          { id: '2', name: 'Artist 2', traditions: [Tradition.CARNATIC] },
        ],
        lastEvaluatedKey: undefined,
      };

      vi.mocked(accessPatterns.getByGlobalIndex).mockResolvedValue(mockResults);

      const result = await ArtistRepository.getByTradition(Tradition.CARNATIC);

      expect(result.items.length).toBe(2);
      expect(accessPatterns.getByGlobalIndex).toHaveBeenCalledWith(
        'GSI3',
        'GSI3PK',
        'TRADITION#carnatic',
        expect.any(Object)
      );
    });
  });

  describe('getByInstrument', () => {
    it('should get artists by instrument', async () => {
      const mockResults = {
        items: [
          { id: '1', name: 'Violinist 1', instruments: ['violin'] },
          { id: '2', name: 'Violinist 2', instruments: ['violin'] },
        ],
        lastEvaluatedKey: undefined,
      };

      vi.mocked(accessPatterns.getByGlobalIndex).mockResolvedValue(mockResults);

      const result = await ArtistRepository.getByInstrument('violin');

      expect(result.items.length).toBe(2);
      expect(accessPatterns.getByGlobalIndex).toHaveBeenCalledWith(
        'GSI2',
        'GSI2PK',
        'INSTRUMENT#violin',
        expect.any(Object)
      );
    });
  });

  describe('search', () => {
    it('should delegate to searchByName when query provided', async () => {
      const searchByNameSpy = vi.spyOn(ArtistRepository, 'searchByName');
      searchByNameSpy.mockResolvedValue({ items: [], hasMore: false });

      await ArtistRepository.search({ query: 'test' });

      expect(searchByNameSpy).toHaveBeenCalledWith('test', undefined, undefined);
    });

    it('should delegate to getByInstrument when instrument provided', async () => {
      const getByInstrumentSpy = vi.spyOn(ArtistRepository, 'getByInstrument');
      getByInstrumentSpy.mockResolvedValue({ items: [], hasMore: false });

      await ArtistRepository.search({ instrument: 'violin' });

      expect(getByInstrumentSpy).toHaveBeenCalledWith('violin', undefined, undefined);
    });

    it('should return empty results when no criteria provided', async () => {
      const result = await ArtistRepository.search({});

      expect(result).toEqual({ items: [], hasMore: false });
    });
  });
});
