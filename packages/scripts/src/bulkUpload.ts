import fs from 'node:fs';
import path from 'node:path';
import { Resource } from 'sst';

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

async function main() {
  process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;

  const { Artist, Composition, Raga, Tala } = await import('@rasika/core');

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

  // Limit to first 1000 for testing
  const compositions = allCompositions.slice(0, 1000);

  console.log(
    `🎵 Found ${allCompositions.length} total compositions, processing first ${compositions.length}`
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
