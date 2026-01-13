import { Resource } from 'sst';

async function main() {
  process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;

  const { Artist } = await import('@rasika/core');

  try {
    const result = await Artist.listArtists({ limit: 10 });
    console.log('Artists found:', result.items.length);
    if (result.items.length > 0) {
      console.log(
        'Sample artists:',
        result.items.slice(0, 3).map(a => ({ id: a.id, name: a.name }))
      );
    } else {
      console.log('No artists in database');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
