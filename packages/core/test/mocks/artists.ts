import type { Artist } from '../../src/domain/artist/entity';

export const mockArtists: Artist[] = [
  {
    id: 'artist_1',
    name: 'Vidya Subramanian',
    artistType: 'Vocalist',
    bio: 'Renowned Carnatic vocalist with over 20 years of experience',
    instruments: ['Vocal'],
    traditions: ['carnatic'],
    profileImage: 'https://example.com/vidya.jpg',
    isVerified: true,
    viewCount: 1520,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'artist_2',
    name: 'M.S. Subbulakshmi',
    artistType: 'Vocalist',
    bio: 'Legendary Carnatic vocalist and recipient of Bharat Ratna',
    instruments: ['Vocal'],
    traditions: ['carnatic'],
    profileImage: 'https://example.com/mss.jpg',
    isVerified: true,
    viewCount: 8920,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];
