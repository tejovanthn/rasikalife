/**
 * Mock entities for testing
 */
import type {
  User,
  Artist,
  Composition,
  Raga,
  Tala,
  Event,
  Venue,
  Thread,
  Reply,
} from '../../src/types';

export const mockUsers: User[] = [
  {
    id: 'user_1',
    username: 'rasikauser',
    email: 'user@example.com',
    displayName: 'Rasika User',
    bio: 'A passionate fan of Carnatic music',
    profileImage: 'https://example.com/profile.jpg',
    roles: ['user'],
    karma: 120,
    isVerified: true,
    preferences: {
      defaultLanguage: 'en',
      preferredTraditions: ['carnatic'],
      favoriteInstruments: ['violin', 'mridangam'],
      favoriteRagas: ['todi', 'kalyani'],
      themeName: 'light',
    },
    notificationSettings: {
      email: {
        newFollower: true,
        upcomingEvents: true,
        artistUpdates: true,
        threadReplies: true,
      },
      push: {
        newFollower: true,
        upcomingEvents: true,
        artistUpdates: false,
        threadReplies: true,
      },
    },
    privacySettings: {
      showEmail: false,
      showActivity: true,
      showFollowing: true,
      allowMessages: true,
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'user_2',
    username: 'artistuser',
    email: 'artist@example.com',
    displayName: 'Artist User',
    bio: 'Carnatic vocalist and performer',
    profileImage: 'https://example.com/artist.jpg',
    roles: ['user', 'artist'],
    karma: 250,
    isVerified: true,
    preferences: {
      defaultLanguage: 'en',
      preferredTraditions: ['carnatic'],
      favoriteInstruments: ['vocal'],
      favoriteRagas: ['bhairavi', 'kalyani'],
      themeName: 'dark',
    },
    notificationSettings: {
      email: {
        newFollower: true,
        upcomingEvents: true,
        artistUpdates: true,
        threadReplies: true,
      },
      push: {
        newFollower: true,
        upcomingEvents: true,
        artistUpdates: true,
        threadReplies: true,
      },
    },
    privacySettings: {
      showEmail: false,
      showActivity: true,
      showFollowing: true,
      allowMessages: true,
    },
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
];

export const mockArtists: Artist[] = [
  {
    id: 'artist_1',
    name: 'Vidya Subramanian',
    bio: 'Carnatic vocalist with 20+ years of experience',
    artistType: 'vocalist',
    instruments: ['vocal'],
    gurus: ['Dr. S. Ramanathan', 'Smt. Suguna Varadachari'],
    lineage: 'Semmangudi Srinivasa Iyer lineage',
    isVerified: true,
    verificationStatus: 'verified',
    viewCount: 5430,
    favoriteCount: 342,
    popularityScore: 87,
    location: {
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
    },
    profileImage: 'https://example.com/artist1.jpg',
    socialLinks: {
      website: 'https://vidyasubramanian.com',
      youtube: 'https://youtube.com/vidyasubramanian',
      instagram: 'https://instagram.com/vidyasubramanian',
    },
    traditions: ['carnatic'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'artist_2',
    name: 'Ramakrishnan Murthy',
    bio: 'Up and coming vocalist in the Carnatic tradition',
    artistType: 'vocalist',
    instruments: ['vocal'],
    gurus: ['R.K. Srikantan', 'Bombay Jayashri'],
    isVerified: true,
    verificationStatus: 'verified',
    viewCount: 3210,
    favoriteCount: 276,
    popularityScore: 74,
    location: {
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
    },
    profileImage: 'https://example.com/artist2.jpg',
    socialLinks: {
      youtube: 'https://youtube.com/ramakrishnanmurthy',
      instagram: 'https://instagram.com/ramakrishnanmurthy',
    },
    traditions: ['carnatic'],
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
];

export const mockCompositions: Composition[] = [
  {
    id: 'composition_1',
    version: 'v1',
    title: 'Vatapi Ganapatim',
    canonicalTitle: 'Vatapi Ganapatim',
    alternativeTitles: ['Vathapi Ganapathim'],
    composer: 'Muthuswami Dikshitar',
    ragas: ['hamsadhwani'],
    talas: ['adi'],
    language: 'Sanskrit',
    verses: 'Vatapi Ganapatim Bhaje Ham...',
    meaning: 'I pray to Lord Ganapati who resides in Vatapi...',
    notation: 'S R G M P D N S...',
    audioSamples: ['https://example.com/audio1.mp3'],
    videoSamples: ['https://example.com/video1.mp4'],
    addedBy: 'user_1',
    editedBy: ['user_1'],
    viewCount: 3450,
    favoriteCount: 256,
    popularityScore: 92,
    sourceAttribution: 'Traditional notation from Dikshitar sampradaya',
    tradition: 'carnatic',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'composition_2',
    version: 'v1',
    title: 'Jagadanandakaraka',
    canonicalTitle: 'Jagadanandakaraka',
    composer: 'Tyagaraja',
    ragas: ['nata'],
    talas: ['adi'],
    language: 'Telugu',
    verses: 'Jagadanandakaraka Jayamanavikrama...',
    meaning: 'Oh The Cause of Joy for the entire universe...',
    notation: 'S R G M P D N S...',
    audioSamples: ['https://example.com/audio2.mp3'],
    videoSamples: ['https://example.com/video2.mp4'],
    addedBy: 'user_1',
    editedBy: ['user_1', 'user_2'],
    viewCount: 2890,
    favoriteCount: 214,
    popularityScore: 88,
    sourceAttribution: 'Traditional notation from Tyagaraja sampradaya',
    tradition: 'carnatic',
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  },
];

export const mockRagas: Raga[] = [
  {
    id: 'raga_1',
    version: 'v1',
    name: 'Todi',
    alternativeNames: ['Hanumattodi'],
    melakarta: 8,
    arohanam: 'S R1 G2 M1 P D1 N2 S',
    avarohanam: 'S N2 D1 P M1 G2 R1 S',
    notes: 'A profound morning raga with distinctive phrases',
    characteristicPhrases: ['PDNS', 'GM1R1S'],
    mood: ['serious', 'devotional'],
    timeOfDay: 'morning',
    history: 'One of the oldest ragas in Carnatic tradition...',
    famousCompositions: ['Dasarathe', 'Koluvaiyunnade'],
    viewCount: 5240,
    editedBy: ['user_1'],
    tradition: 'carnatic',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'raga_2',
    version: 'v1',
    name: 'Kalyani',
    melakarta: 65,
    arohanam: 'S R2 G3 M2 P D2 N3 S',
    avarohanam: 'S N3 D2 P M2 G3 R2 S',
    notes: 'A vibrant evening raga with ascending phrases',
    characteristicPhrases: ['SRGM', 'PDNS'],
    mood: ['joyful', 'romantic'],
    timeOfDay: 'evening',
    history: 'One of the most popular ragas in concerts...',
    famousCompositions: ['Kalyani Alaipayuthe', 'Nidhi Chala Sukhama'],
    viewCount: 6120,
    editedBy: ['user_1', 'user_2'],
    tradition: 'carnatic',
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  },
];

export const mockTalas: Tala[] = [
  {
    id: 'tala_1',
    version: 'v1',
    name: 'Adi',
    alternativeNames: ['Chatusra Jati Triputa'],
    type: 'Sapta',
    aksharas: 8,
    structure: '4 + 2 + 2',
    notation: '| O O O O | O O | O O |',
    examples: ['Vatapi Ganapatim', 'Jagadanandakaraka'],
    viewCount: 4230,
    editedBy: ['user_1'],
    tradition: 'carnatic',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'tala_2',
    version: 'v1',
    name: 'Rupaka',
    type: 'Sapta',
    aksharas: 6,
    structure: '2 + 4',
    notation: '| O | O O O O |',
    examples: ['Narasimha Agaccha', 'Marivere Gati'],
    viewCount: 3150,
    editedBy: ['user_1'],
    tradition: 'carnatic',
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
];

export const mockEvents: Event[] = [
  {
    id: 'event_1',
    title: 'Annual Thyagaraja Aradhana',
    description:
      'Annual celebration of Saint Thyagaraja with performances of the Pancharatna Kritis',
    startDate: '2025-02-01T10:00:00.000Z',
    endDate: '2025-02-01T18:00:00.000Z',
    location: {
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
    },
    venue: 'Music Academy',
    venueId: 'venue_1',
    eventType: 'concert',
    ticketInfo: {
      isPaid: true,
      price: 500,
      currency: 'INR',
      ticketUrl: 'https://example.com/tickets/event1',
    },
    artists: ['artist_1', 'artist_2'],
    ragas: ['todi', 'kalyani', 'bhairavi'],
    compositions: ['composition_1', 'composition_2'],
    organizer: 'Music Academy Chennai',
    organizerId: 'venue_1',
    isVerified: true,
    isFeatured: true,
    image: 'https://example.com/event1.jpg',
    status: 'scheduled',
    isVirtual: false,
    createdAt: '2024-12-15T00:00:00.000Z',
    updatedAt: '2024-12-15T00:00:00.000Z',
  },
  {
    id: 'event_2',
    title: 'Youth Carnatic Festival',
    description: 'Showcasing young talent in the Carnatic music tradition',
    startDate: '2025-03-15T09:00:00.000Z',
    endDate: '2025-03-17T18:00:00.000Z',
    location: {
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
    },
    venue: 'Chowdiah Memorial Hall',
    venueId: 'venue_2',
    eventType: 'festival',
    ticketInfo: {
      isPaid: true,
      price: 300,
      currency: 'INR',
      ticketUrl: 'https://example.com/tickets/event2',
    },
    artists: ['artist_2'],
    organizer: 'Carnatic Youth Association',
    isVerified: true,
    isFeatured: false,
    image: 'https://example.com/event2.jpg',
    status: 'scheduled',
    isVirtual: false,
    seriesId: 'series_1',
    createdAt: '2024-12-20T00:00:00.000Z',
    updatedAt: '2024-12-20T00:00:00.000Z',
  },
];

export const mockVenues: Venue[] = [
  {
    id: 'venue_1',
    name: 'Music Academy',
    address: '168, TTK Road',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    capacity: 1200,
    facilities: ['parking', 'air_conditioning', 'recording'],
    contact: {
      email: 'info@musicacademy.org',
      phone: '+91-44-28112231',
      person: 'Secretary',
    },
    website: 'https://musicacademy.org',
    images: ['https://example.com/venue1.jpg'],
    isVerified: true,
    partnershipStatus: 'premium',
    virtualCapabilities: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'venue_2',
    name: 'Chowdiah Memorial Hall',
    address: '16th Cross, Vyalikaval',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    capacity: 1000,
    facilities: ['parking', 'air_conditioning'],
    contact: {
      email: 'info@chowdiahhall.org',
      phone: '+91-80-23445810',
    },
    website: 'https://chowdiahhall.org',
    images: ['https://example.com/venue2.jpg'],
    isVerified: true,
    partnershipStatus: 'basic',
    virtualCapabilities: false,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
];

export const mockThreads: Thread[] = [
  {
    id: 'thread_1',
    title: 'Identifying a Dikshitar kriti I heard yesterday',
    content:
      'I heard this beautiful composition in Kalyani raga yesterday but couldn\'t catch the name. It started with "Hiranmayeem" if I recall correctly. Can anyone identify it?',
    authorId: 'user_1',
    category: 'identification',
    tags: ['dikshitar', 'kalyani', 'composition-id'],
    status: 'open',
    viewCount: 120,
    replyCount: 2,
    lastReplyAt: '2024-01-02T12:30:00.000Z',
    lastReplyId: 'reply_2',
    isSticky: false,
    isPinned: false,
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-01-02T12:30:00.000Z',
  },
  {
    id: 'thread_2',
    title: 'Best recordings of Pancharatna Kritis?',
    content:
      "I'm looking for recommendations for the best recordings of the Thyagaraja Pancharatna Kritis. Which artists would you recommend for a beginner?",
    authorId: 'user_2',
    category: 'recommendation',
    tags: ['thyagaraja', 'pancharatna', 'recordings'],
    status: 'open',
    viewCount: 85,
    replyCount: 1,
    lastReplyAt: '2024-01-03T14:15:00.000Z',
    lastReplyId: 'reply_3',
    isSticky: false,
    isPinned: false,
    createdAt: '2024-01-03T09:00:00.000Z',
    updatedAt: '2024-01-03T14:15:00.000Z',
  },
];

export const mockReplies: Reply[] = [
  {
    id: 'reply_1',
    threadId: 'thread_1',
    content:
      'That sounds like "Hiranmayeem Lakshmim" in Lalitha raga, not Kalyani. It\'s one of Dikshitar\'s compositions on Goddess Lakshmi.',
    authorId: 'user_2',
    isAccepted: false,
    voteCount: 5,
    createdAt: '2024-01-01T11:30:00.000Z',
    updatedAt: '2024-01-01T11:30:00.000Z',
  },
  {
    id: 'reply_2',
    threadId: 'thread_1',
    content:
      'Actually, you might be thinking of "Hiranmayim" which is indeed in Lalitha raga as the previous reply mentioned. Here\'s a recording link that might help: [example link]',
    authorId: 'user_1',
    parentReplyId: 'reply_1',
    isAccepted: true,
    voteCount: 8,
    createdAt: '2024-01-02T12:30:00.000Z',
    updatedAt: '2024-01-02T12:30:00.000Z',
  },
  {
    id: 'reply_3',
    threadId: 'thread_2',
    content:
      'For Pancharatna Kritis, I would highly recommend the recordings by Maharajapuram Santhanam or M.S. Subbulakshmi. Both offer excellent renditions that are accessible to beginners.',
    authorId: 'user_1',
    isAccepted: false,
    voteCount: 3,
    createdAt: '2024-01-03T14:15:00.000Z',
    updatedAt: '2024-01-03T14:15:00.000Z',
  },
];

/**
 * Convert mock entities to DynamoDB items
 * This helps with setting up test data in the mock DynamoDB
 */
export const convertUserToDynamoItem = (user: User) => ({
  PK: `USER#${user.id}`,
  SK: '#METADATA',
  GSI1PK: `EMAIL#${user.email}`,
  GSI1SK: `USER#${user.id}`,
  GSI2PK: `USERNAME#${user.username}`,
  GSI2SK: `USER#${user.id}`,
  id: user.id,
  username: user.username,
  email: user.email,
  displayName: user.displayName,
  bio: user.bio,
  profileImage: user.profileImage,
  roles: user.roles,
  karma: user.karma,
  isVerified: user.isVerified,
  preferences: user.preferences,
  notificationSettings: user.notificationSettings,
  privacySettings: user.privacySettings,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const convertArtistToDynamoItem = (artist: Artist) => ({
  PK: `ARTIST#${artist.id}`,
  SK: '#METADATA',
  GSI1PK: `ARTIST_NAME#${artist.name}`,
  GSI1SK: `ARTIST#${artist.id}`,
  id: artist.id,
  name: artist.name,
  bio: artist.bio,
  artistType: artist.artistType,
  instruments: artist.instruments,
  gurus: artist.gurus,
  lineage: artist.lineage,
  isVerified: artist.isVerified,
  verificationStatus: artist.verificationStatus,
  viewCount: artist.viewCount,
  favoriteCount: artist.favoriteCount,
  popularityScore: artist.popularityScore,
  location: artist.location,
  profileImage: artist.profileImage,
  socialLinks: artist.socialLinks,
  traditions: artist.traditions,
  createdAt: artist.createdAt,
  updatedAt: artist.updatedAt,
});

export const convertCompositionToDynamoItem = (composition: Composition) => ({
  PK: `COMPOSITION#${composition.id}`,
  SK: `VERSION#${composition.version}`,
  GSI1PK: `RAGA#${composition.ragas[0]}`,
  GSI1SK: `COMPOSITION#${composition.id}`,
  GSI2PK: `COMPOSER#${composition.composer}`,
  GSI2SK: `COMPOSITION#${composition.id}`,
  id: composition.id,
  version: composition.version,
  title: composition.title,
  canonicalTitle: composition.canonicalTitle,
  alternativeTitles: composition.alternativeTitles,
  composer: composition.composer,
  ragas: composition.ragas,
  talas: composition.talas,
  language: composition.language,
  verses: composition.verses,
  meaning: composition.meaning,
  notation: composition.notation,
  audioSamples: composition.audioSamples,
  videoSamples: composition.videoSamples,
  addedBy: composition.addedBy,
  editedBy: composition.editedBy,
  viewCount: composition.viewCount,
  favoriteCount: composition.favoriteCount,
  popularityScore: composition.popularityScore,
  sourceAttribution: composition.sourceAttribution,
  tradition: composition.tradition,
  createdAt: composition.createdAt,
  updatedAt: composition.updatedAt,
});

export const initializeMockDb = () => {
  const { mockDb } = require('./dynamodb');

  // Reset the mock database
  mockDb.reset();

  // Initialize with mock data
  const coreTbl = mockDb.getTable('RasikaTable');

  // Add users
  mockUsers.forEach(user => {
    coreTbl.push(convertUserToDynamoItem(user));
  });

  // Add artists
  mockArtists.forEach(artist => {
    coreTbl.push(convertArtistToDynamoItem(artist));
  });

  // Add compositions
  mockCompositions.forEach(composition => {
    coreTbl.push(convertCompositionToDynamoItem(composition));

    // Add latest version pointer
    coreTbl.push({
      PK: `COMPOSITION#${composition.id}`,
      SK: 'VERSION#LATEST',
      GSI1PK: `RAGA#${composition.ragas[0]}`,
      GSI1SK: `COMPOSITION#${composition.id}`,
      id: composition.id,
      version: composition.version,
    });
  });

  // Add other entities...
  // Similar patterns for ragas, talas, events, etc.

  return coreTbl;
};
