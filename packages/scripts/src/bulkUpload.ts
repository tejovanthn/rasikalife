import fs from 'node:fs';
import path from 'node:path';
import { Resource } from 'sst';

// Parse command line arguments
// Usage: sst shell tsx src/bulkUpload.ts [--drop|-d] [limit]
// --drop or -d: Drop all existing data before uploading
// limit: Number of compositions to process (default: 1000)
const args = process.argv.slice(2);
const shouldDropData =
  args.includes('--drop') || args.includes('-d') || process.env.DROP_DATA === 'true';
const limitArg = args.find(arg => !arg.startsWith('-') && /^\d+$/.test(arg));
const limit = limitArg ? Number.parseInt(limitArg, 10) : 1000;

interface NormalizedComposition {
  title: string | null;
  language?: string | null;
  lyrics?: Array<{
    type: string;
    order: number;
    text: string;
    number?: number;
    ragaName?: string;
  }> | null;
  sourceAttribution: string;
  ragaNames?: string[] | null;
  talaNames?: string[] | null;
  composerNames?: string[] | null;
  talaDetails?: {
    aksharas?: number;
    structure?: string | null;
    baseTala?: string;
    gati?: string | null;
    notes?: string | null;
  };
}

async function dropAllData() {
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });
  const tableName = Resource.RasikaTable.name;

  console.log('🗑️  Dropping all data from database...');

  // Scan all items
  let itemsToDelete: Array<{ pk: { S: string }; sk: { S: string } }> = [];
  let lastEvaluatedKey: any = undefined;

  do {
    const command = new (await import('@aws-sdk/client-dynamodb')).ScanCommand({
      TableName: tableName,
      ProjectionExpression: 'pk, sk',
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: 1000, // DynamoDB batch delete limit
    });
    const result = await client.send(command);

    itemsToDelete = itemsToDelete.concat(
      result.Items as Array<{ pk: { S: string }; sk: { S: string } }>
    );
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`Found ${itemsToDelete.length} items to delete`);

  // Delete in batches of 25 (DynamoDB batch write limit)
  const batchSize = 25;
  let deleted = 0;

  for (let i = 0; i < itemsToDelete.length; i += batchSize) {
    const batch = itemsToDelete.slice(i, i + batchSize);
    const deleteRequests = batch.map(item => ({
      DeleteRequest: {
        Key: {
          pk: item.pk,
          sk: item.sk,
        },
      },
    }));

    const command = new (await import('@aws-sdk/client-dynamodb')).BatchWriteItemCommand({
      RequestItems: {
        [tableName]: deleteRequests,
      },
    });
    await client.send(command);

    deleted += batch.length;
    console.log(`Deleted ${deleted}/${itemsToDelete.length} items`);
  }

  console.log('✅ All data dropped successfully');
}

async function main() {
  process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;

  const { Artist, Composition, Raga, Tala } = await import('@rasika/core');

  if (shouldDropData) {
    await dropAllData();
  }

  const filePath = path.join(__dirname, '../../../data/full-normalized.json');

  // Cache for created entities to avoid duplicate API calls
  const artistCache = new Map<string, string>();
  const ragaCache = new Map<string, string>();
  const talaCache = new Map<string, string>();

  let existingCount = 0;

  async function getOrCreateArtist(name: string): Promise<string> {
    if (!name || name.trim().length === 0) {
      throw new Error('Invalid artist name');
    }

    const cached = artistCache.get(name);
    if (cached) return cached;

    const existing = await Artist.getArtistByName(name);
    if (existing) {
      artistCache.set(name, existing.id);
      return existing.id;
    }

    const newArtist = await Artist.createArtist({ name });
    artistCache.set(name, newArtist.id);
    return newArtist.id;
  }

  async function getOrCreateRaga(name: string): Promise<string> {
    if (!name || name.trim().length === 0) {
      throw new Error('Invalid raga name');
    }

    const cached = ragaCache.get(name);
    if (cached) return cached;

    const existing = await Raga.getRagaByName(name);
    if (existing) {
      ragaCache.set(name, existing.id);
      return existing.id;
    }

    const newRaga = await Raga.createRaga({ name });
    ragaCache.set(name, newRaga.id);
    return newRaga.id;
  }

  async function getOrCreateTala(name: string): Promise<string> {
    if (!name || name.trim().length === 0) {
      throw new Error('Invalid tala name');
    }

    const cached = talaCache.get(name);
    if (cached) return cached;

    const existing = await Tala.getTalaByName(name);
    if (existing) {
      talaCache.set(name, existing.id);
      return existing.id;
    }

    const newTala = await Tala.createTala({ name });
    talaCache.set(name, newTala.id);
    return newTala.id;
  }

  async function processComposition(comp: NormalizedComposition): Promise<void> {
    try {
      if (!comp.title) {
        console.warn('⚠️  Skipping composition with no title');
        return;
      }

      const composers = comp.composerNames ?? [];
      if (composers.length === 0) {
        console.warn(`Skipping composition "${comp.title}" - no composer found`);
        return;
      }

      const composerName = composers[0];
      if (!composerName) {
        console.warn(`Skipping composition "${comp.title}" - invalid composer name`);
        return;
      }

      const composerId = await getOrCreateArtist(composerName);

      const existingCompositions = await Composition.getCompositionsByComposer(composerId);
      const exists = existingCompositions.some(c => c.title === comp.title);

      if (exists) {
        console.warn(`⏭️  Skipping existing composition: "${comp.title}" by ${composerName}`);
        existingCount++;
        return;
      }

      const ragas = comp.ragaNames ?? [];
      const ragaIds = await Promise.all(ragas.map(name => getOrCreateRaga(name)));

      const talas = comp.talaNames ?? [];
      const talaIds = await Promise.all(talas.map(name => getOrCreateTala(name)));

      await Composition.createComposition({
        title: comp.title,
        composer: { id: composerId, name: composerName },
        language: comp.language ?? 'Tamil',
        lyricsV1: comp.lyrics ?? undefined,
        ragaIds,
        talaIds,
      });

      console.log(`✅ Created composition: ${comp.title}`);
    } catch (error) {
      console.error(`❌ Failed to process composition "${comp.title}":`, error);
    }
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ full-normalized.json not found at: ${filePath}`);
    process.exit(1);
  }

  console.log('📖 Reading full-normalized.json...');
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const allCompositions: NormalizedComposition[] = JSON.parse(rawData);

  // Limit to specified number for testing
  const compositions = allCompositions.slice(0, limit);

  console.log(
    `🎵 Found ${allCompositions.length} total compositions, processing first ${compositions.length} (${shouldDropData ? 'with' : 'without'} data drop)`
  );

  let processed = 0;
  let skipped = 0;

  for (const comp of compositions) {
    if (!comp.title || !comp.composerNames || comp.composerNames.length === 0) {
      console.warn('⚠️  Skipping invalid composition:', comp.title ?? 'Untitled');
      skipped++;
      continue;
    }

    await processComposition(comp);
    processed++;

    // Progress indicator
    if (processed % 100 === 0) {
      console.log(`📊 Progress: ${processed}/${compositions.length} compositions processed`);
    }
  }

  console.log('\n🎉 Bulk upload complete!');
  console.log(`✅ Created: ${processed} compositions`);
  console.log(`⏭️  Existing: ${existingCount} compositions`);
  console.log(`⚠️  Skipped: ${skipped} compositions`);
  console.log(`👤 Artists created/found: ${artistCache.size}`);
  console.log(`🎼 Ragas created/found: ${ragaCache.size}`);
  console.log(`🥁 Talas created/found: ${talaCache.size}`);
}

main().catch(console.error);
