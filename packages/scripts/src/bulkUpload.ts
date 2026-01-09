import fs from 'node:fs';
import path from 'node:path';
import { Artist, Composition, Raga, Tala } from '@rasika/core';

interface NormalizedComposition {
  title: string;
  language?: string | null;
  lyrics: Array<{
    type: string;
    order: number;
    text: string;
    number?: number;
    ragaName?: string;
  }>;
  sourceAttribution: string;
  ragaNames: string[];
  talaNames: string[];
  composerNames: string[];
  talaDetails?: {
    aksharas?: number;
    structure?: string | null;
    baseTala?: string;
    gati?: string | null;
    notes?: string | null;
  };
}

// Cache for created entities to avoid duplicate API calls
const artistCache = new Map<string, string>();
const ragaCache = new Map<string, string>();
const talaCache = new Map<string, string>();

async function getOrCreateArtist(name: string): Promise<string> {
  if (artistCache.has(name)) {
    const cached = artistCache.get(name);
    if (cached) return cached;
  }

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
  if (ragaCache.has(name)) {
    const cached = ragaCache.get(name);
    if (cached) return cached;
  }

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
  if (talaCache.has(name)) {
    const cached = talaCache.get(name);
    if (cached) return cached;
  }

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
    // Get or create composer (use first composer name)
    const composerName = comp.composerNames[0];
    if (!composerName) {
      console.warn(`Skipping composition "${comp.title}" - no composer found`);
      return;
    }
    const composerId = await getOrCreateArtist(composerName);

    // Get or create ragas
    const ragaIds = await Promise.all(comp.ragaNames.map(name => getOrCreateRaga(name)));

    // Get or create talas
    const talaIds = await Promise.all(comp.talaNames.map(name => getOrCreateTala(name)));

    // Create composition
    await Composition.createComposition({
      title: comp.title,
      composer: { id: composerId, name: composerName },
      language: comp.language || 'Tamil', // Default to Tamil if not specified
      lyricsV1: comp.lyrics,
      ragaIds,
      talaIds,
    });

    console.log(`✅ Created composition: ${comp.title}`);
  } catch (error) {
    console.error(`❌ Failed to process composition "${comp.title}":`, error);
  }
}

async function main() {
  const filePath = path.join(__dirname, '../../../data/full-normalized.json');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ full-normalized.json not found at: ${filePath}`);
    process.exit(1);
  }

  console.log('📖 Reading full-normalized.json...');
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const compositions: NormalizedComposition[] = JSON.parse(rawData);

  console.log(`🎵 Found ${compositions.length} compositions to process`);

  let processed = 0;
  let skipped = 0;

  for (const comp of compositions) {
    if (!comp.title || !comp.composerNames?.length) {
      console.warn(`⚠️  Skipping invalid composition:`, comp.title || 'Untitled');
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
  console.log(`✅ Processed: ${processed} compositions`);
  console.log(`⚠️  Skipped: ${skipped} compositions`);
  console.log(`👤 Artists created/found: ${artistCache.size}`);
  console.log(`🎼 Ragas created/found: ${ragaCache.size}`);
  console.log(`🥁 Talas created/found: ${talaCache.size}`);
}

main().catch(console.error);
