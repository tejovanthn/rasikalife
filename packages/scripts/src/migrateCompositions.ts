import { CompositionEntity } from '@rasika/core/domain/composition/entity';
import { Resource } from 'sst';

async function migrateCompositions() {
  process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;

  console.log('Starting composition migration to populate GSI4 and GSI5 fields...');

  // Scan all compositions
  const result = await CompositionEntity.scan.go();
  const compositions = result.data || [];

  console.log(`Found ${compositions.length} compositions to migrate`);

  let migrated = 0;

  for (const composition of compositions) {
    try {
      // Update the composition to populate GSI fields
      // ElectroDB will automatically populate GSI fields based on the index templates when we update
      await CompositionEntity.update({
        id: composition.id,
      })
        .set({
          // Re-set title to ensure GSI4 and GSI5 are populated with correct values
          title: composition.title,
        })
        .go();

      console.log(`✅ Migrated: ${composition.title}`);
      migrated++;

      // Progress indicator
      if (migrated % 100 === 0) {
        console.log(`📊 Progress: ${migrated}/${compositions.length} compositions processed`);
      }
    } catch (error) {
      console.error(`❌ Failed to migrate composition "${composition.title}":`, error);
    }
  }

  console.log('\n🎉 Migration complete!');
  console.log(`✅ Migrated: ${migrated} compositions`);
}

migrateCompositions().catch(console.error);
