import { Resource } from 'sst';

async function main() {
  process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;

  const { Artist } = await import('@rasika/core');

  const sampleArtists = [
    {
      name: 'M.S. Subbulakshmi',
      artistType: 'Vocalist',
      bio: 'Legendary Carnatic vocalist and recipient of Bharat Ratna',
      instruments: ['Vocal'],
      traditions: ['carnatic'],
      isVerified: true,
      viewCount: 1000,
    },
    {
      name: 'Vidya Subramanian',
      artistType: 'Vocalist',
      bio: 'Renowned Carnatic vocalist with over 20 years of experience',
      instruments: ['Vocal'],
      traditions: ['carnatic'],
      isVerified: true,
      viewCount: 800,
    },
    {
      name: 'T.M. Krishna',
      artistType: 'Vocalist',
      bio: 'Contemporary Carnatic vocalist and social activist',
      instruments: ['Vocal'],
      traditions: ['carnatic'],
      isVerified: true,
      viewCount: 600,
    },
    {
      name: 'Aruna Sairam',
      artistType: 'Vocalist',
      bio: 'Acclaimed Carnatic vocalist known for her soulful renditions',
      instruments: ['Vocal'],
      traditions: ['carnatic'],
      isVerified: true,
      viewCount: 500,
    },
    {
      name: 'Sanjay Subrahmanyan',
      artistType: 'Vocalist',
      bio: 'Versatile Carnatic vocalist and teacher',
      instruments: ['Vocal'],
      traditions: ['carnatic'],
      isVerified: true,
      viewCount: 400,
    },
    {
      name: 'Neyveli Santhanagopalan',
      artistType: 'Instrumentalist',
      bio: 'Master mridangam artist and guru',
      instruments: ['Mridangam'],
      traditions: ['carnatic'],
      isVerified: true,
      viewCount: 350,
    },
    {
      name: 'K.V. Narayanaswamy',
      artistType: 'Vocalist',
      bio: 'Legendary Carnatic vocalist and composer',
      instruments: ['Vocal'],
      traditions: ['carnatic'],
      isVerified: true,
      viewCount: 300,
    },
    {
      name: 'Semmangudi Srinivasa Iyer',
      artistType: 'Vocalist',
      bio: 'Pioneer of modern Carnatic music',
      instruments: ['Vocal'],
      traditions: ['carnatic'],
      isVerified: true,
      viewCount: 250,
    },
  ];

  console.log('Seeding database with sample artists...');

  for (const artistData of sampleArtists) {
    try {
      const artist = await Artist.createArtist(artistData);
      console.log(`✅ Created artist: ${artist.name}`);
    } catch (error) {
      console.error(`❌ Failed to create artist ${artistData.name}:`, error);
    }
  }

  console.log('Seeding complete!');
}

main().catch(console.error);
