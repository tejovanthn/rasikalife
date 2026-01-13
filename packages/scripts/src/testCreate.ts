import { Resource } from 'sst';

async function main() {
  process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;

  const { Artist } = await import('@rasika/core');

  const testArtist = {
    name: 'Test Artist',
  };

  console.log('Creating test artist...');
  const created = await Artist.createArtist(testArtist);
  console.log('Created:', created);

  const result = await Artist.listArtists({ limit: 50 });
  console.log('Artists found after creation:', result.items.length);
  console.log(
    'All artists:',
    result.items.map(a => ({ id: a.id, name: a.name }))
  );
}

main().catch(console.error);
