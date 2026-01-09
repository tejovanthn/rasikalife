import { readFileSync } from 'node:fs';
import { CompositionRepository } from '@rasika/core';
import { RagaRepository } from '@rasika/core';
import { TalaRepository } from '@rasika/core';
import { ArtistRepository } from '@rasika/core';
import { Tradition, AttributionType, AttributionConfidence } from '@rasika/core';

interface JsonComposition {
  title: string;
  canonicalTitle?: string;
  alternativeTitles?: string[];
  language?: string;
  tradition?: string;
  lyrics?: Array<{
    type: 'pallavi' | 'anupallavi' | 'caraNam' | 'lyrics';
    order: number;
    text: string;
  }>;
  meaning?: string | null;
  notation?: string | null;
  sourceAttribution?: string;
  ragaNames?: any;
  talaNames?: any;
  composerNames?: any;
  editorId?: string;
  additionalInfo?: string | null;
  ragaDetails?: any;
  talaDetails?: any;
  metadata?: any;
}

const DATA_FILE_PATH =
  process.env.COMPOSITION_DATA_FILE ||
  '/Users/tejovanthn/codes/rasikalife/data/full-normalized.json';

async function getEntityByName(type: 'raga' | 'tala' | 'artist', name: string) {
  switch (type) {
    case 'raga':
      return await RagaRepository.getByName(name);
    case 'tala':
      return await TalaRepository.getByName(name);
    case 'artist':
      const searchResult = await ArtistRepository.searchByName(name, 1);
      return (
        searchResult.items.find((item: any) => item.name.toLowerCase() === name.toLowerCase()) ||
        null
      );
  }
  return null;
}

async function createEntity(type: 'raga' | 'tala' | 'artist', name: string) {
  switch (type) {
    case 'raga': {
      return await RagaRepository.create({
        name: name.trim(),
        tradition: Tradition.CARNATIC,
        editorId: 'system-import',
      });
    }
    case 'tala': {
      return await TalaRepository.create({
        name: name.trim(),
        tradition: Tradition.CARNATIC,
        aksharas: 8,
        editorId: 'system-import',
      });
    }
    case 'artist': {
      return await ArtistRepository.create({
        name: name.trim(),
        artistType: 'composer',
        traditions: [Tradition.CARNATIC],
        instruments: [],
        editorId: 'system-import',
      });
    }
  }
  return null;
}

async function resolveReferences(names: any, type: 'raga' | 'tala' | 'artist'): Promise<string[]> {
  const ids: string[] = [];

  if (!Array.isArray(names)) {
    return ids;
  }

  for (const name of names) {
    if (!name || typeof name !== 'string' || name.trim() === '') continue;

    try {
      let entity = await getEntityByName(type, name.trim());
      if (!entity) {
        entity = await createEntity(type, name.trim());
        console.log(`Created ${type}: ${name}`);
      }
      if (entity) {
        ids.push(entity.id);
      }
    } catch (error) {
      console.error(
        `Failed to resolve ${type} "${name}":`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return ids;
}

async function importComposition(jsonItem: JsonComposition): Promise<void> {
  // Resolve references
  const [ragaIds, talaIds, composerIds] = await Promise.all([
    resolveReferences(jsonItem.ragaNames, 'raga'),
    resolveReferences(jsonItem.talaNames, 'tala'),
    resolveReferences(jsonItem.composerNames, 'artist'),
  ]);

  try {
    // Create composition
    const composition = await CompositionRepository.create({
      title: jsonItem.title,
      canonicalTitle: jsonItem.canonicalTitle || undefined,
      alternativeTitles: jsonItem.alternativeTitles || [],
      language: jsonItem.language || 'Sanskrit',
      tradition: Tradition.CARNATIC,
      structuredVerses: jsonItem.lyrics,
      meaning: jsonItem.meaning || undefined,
      notation: jsonItem.notation || undefined,
      sourceAttribution: jsonItem.sourceAttribution || '',
      ragaIds: ragaIds.length > 0 ? ragaIds : undefined,
      talaIds: talaIds.length > 0 ? talaIds : undefined,
      additionalInfo: jsonItem.additionalInfo || undefined,
      metadata: jsonItem.metadata,
      editorId: 'system-import',
    });

    // Create attributions sequentially
    for (const composerId of composerIds) {
      await CompositionRepository.createAttribution({
        compositionId: composition.id,
        artistId: composerId,
        attributionType: AttributionType.PRIMARY,
        confidence: AttributionConfidence.HIGH,
        source: jsonItem.sourceAttribution || '',
        addedBy: 'system-import',
      });
    }
  } catch (error) {
    console.error(
      `Error importing composition "${jsonItem.title}":`,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function main() {
  try {
    console.log('Starting composition import...');

    const jsonData = readFileSync(DATA_FILE_PATH, 'utf8');
    const compositions: JsonComposition[] = JSON.parse(jsonData);

    console.log(`Found ${compositions.length} compositions to import`);

    // Process sequentially to avoid overwhelming the database
    let imported = 0;
    let failed = 0;

    for (const composition of compositions) {
      try {
        await importComposition(composition);
        imported++;
        if (imported % 100 === 0) {
          console.log(`Imported ${imported}/${compositions.length} compositions`);
        }
      } catch (error) {
        console.error(
          `Failed to import "${composition.title}":`,
          error instanceof Error ? error.message : String(error)
        );
        failed++;
      }
    }

    console.log(`Import complete. Imported: ${imported}, Failed: ${failed}`);
  } catch (error) {
    console.error('Import failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
