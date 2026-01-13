import { Resource } from 'sst';
import { CompositionEntity } from '@rasika/core/domain/composition/entity';

async function checkCompositions() {
  process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;

  console.log('Checking for compositions in database...');

  // Scan all compositions
  const result = await CompositionEntity.scan.go({
    limit: 10,
  });

  const compositions = result.data || [];
  console.log(`Found ${compositions.length} compositions`);

  if (compositions.length > 0) {
    compositions.forEach(comp => {
      console.log(`- ${comp.title} by ${comp.composer.name} (${comp.id})`);
    });
  }
}

checkCompositions().catch(console.error);
