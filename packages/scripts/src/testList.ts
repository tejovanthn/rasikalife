import { Resource } from 'sst';
import { Composition } from '@rasika/core';

async function testList() {
  process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;

  console.log('Testing listCompositions function...');

  const result = await Composition.listCompositions({ limit: 5 });
  console.log(`Found ${result.items.length} compositions`);
  console.log('Has more:', result.hasMore);

  if (result.items.length > 0) {
    result.items.forEach(comp => {
      console.log(`- ${comp.title} by ${comp.composer.name}`);
    });
  }
}

testList().catch(console.error);
