import { Resource } from 'sst';

async function main() {
  process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;

  const { Artist } = await import('@rasika/core');

  // Get a specific artist
  const artist = await Artist.getArtist('388a3svEZDuxfoEum0UUQhrW7ka');
  console.log('Artist from database:', JSON.stringify(artist, null, 2));

  // List all artists
  const result = await Artist.listArtists({ limit: 10 });
  console.log('Number of artists:', result.items.length);
  if (result.items.length > 0) {
    console.log('First artist:', JSON.stringify(result.items[0], null, 2));
  }
}

main().catch(console.error);
