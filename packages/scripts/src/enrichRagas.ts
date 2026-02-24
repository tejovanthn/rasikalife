import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface RagaJsonEntry {
  name: string;
  description: string | null;
  tradition: string | null;
  rasa: string | null;
  timeOfDay: string | null;
  season: string | null;
  parentRaga: string | null;
  melaNumber: number | null;
  arohanam: string | null;
  avarohanam: string | null;
  alternateScales: string | null;
}

const VALID_TRADITIONS = ['carnatic', 'hindustani', 'both'] as const;
const VALID_TIMES = ['morning', 'afternoon', 'evening', 'night', 'universal'] as const;

type Tradition = (typeof VALID_TRADITIONS)[number];
type TimeOfDay = (typeof VALID_TIMES)[number];

interface PlannedCreate {
  entry: RagaJsonEntry;
  parentName: string | null; // resolved at apply time
}

interface PlannedUpdate {
  ragaId: string;
  jsonName: string;
  dbName: string;
  update: Record<string, unknown>;
  warnings: string[];
}

function buildEnrichmentFields(entry: RagaJsonEntry): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (entry.description) fields.description = entry.description;
  if (entry.arohanam) fields.arohanam = entry.arohanam;
  if (entry.avarohanam) fields.avarohanam = entry.avarohanam;
  if (entry.rasa) fields.rasa = entry.rasa;
  if (entry.season) fields.season = entry.season;
  if (entry.melaNumber != null) fields.melaNumber = entry.melaNumber;
  if (entry.tradition && (VALID_TRADITIONS as readonly string[]).includes(entry.tradition)) {
    fields.tradition = entry.tradition as Tradition;
  }
  if (entry.timeOfDay && (VALID_TIMES as readonly string[]).includes(entry.timeOfDay)) {
    fields.timeOfDay = entry.timeOfDay as TimeOfDay;
  }
  if (entry.alternateScales) {
    fields.alternateScales = entry.alternateScales
      .split(', ')
      .map((s: string) => s.trim())
      .filter(Boolean);
  }
  return fields;
}

export async function enrichRagas(opts: { dryRun?: boolean } = {}) {
  const { dryRun = false } = opts;

  const Raga = await import('@rasika/core/domain/raga');
  const Search = await import('@rasika/core/domain/search');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.join(__dirname, '../../../data/ragas.json');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ ragas.json not found at: ${filePath}`);
    process.exit(1);
  }

  console.log('📖 Reading ragas.json...');
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const ragas: RagaJsonEntry[] = JSON.parse(rawData);
  console.log(`🎵 Found ${ragas.length} raga entries`);

  console.log('🔍 Loading raga index from search...');
  const { documents } = await Search.getDocuments('raga');
  // name.toLowerCase() → { id, name }
  const ragaByName = new Map(documents.map(d => [d.name.toLowerCase(), d]));
  console.log(`📋 Indexed ${ragaByName.size} ragas\n`);

  const ragasJsonByName = new Map(ragas.map(r => [r.name.toLowerCase(), r]));

  function findInIndex(name: string) {
    return ragaByName.get(name.toLowerCase());
  }

  // Collect creates in dependency order (parents before children)
  const willCreate = new Set<string>(); // lowercase names
  const plannedCreates: PlannedCreate[] = [];

  function collectCreate(name: string): void {
    const key = name.toLowerCase();
    if (ragaByName.has(key) || willCreate.has(key)) return;

    const entry = ragasJsonByName.get(key);
    if (!entry) return;

    willCreate.add(key);

    // Ensure parent is queued first
    if (entry.parentRaga) collectCreate(entry.parentRaga);

    plannedCreates.push({ entry, parentName: entry.parentRaga });
  }

  // --- Pass 1: collect creates and updates ---
  const plannedUpdates: PlannedUpdate[] = [];

  for (const entry of ragas) {
    const doc = findInIndex(entry.name);

    if (!doc) {
      collectCreate(entry.name);
      continue;
    }

    const update = buildEnrichmentFields(entry) as Raga.UpdateRagaInput;
    const warnings: string[] = [];

    if (entry.parentRaga) {
      const parentDoc = findInIndex(entry.parentRaga);
      if (parentDoc) {
        update.parentRaga = { id: parentDoc.id, name: entry.parentRaga };
      } else if (ragasJsonByName.has(entry.parentRaga.toLowerCase())) {
        warnings.push(`parentRaga "${entry.parentRaga}" will be created — ID resolved at apply time`);
      } else {
        warnings.push(`parentRaga not found: "${entry.parentRaga}"`);
      }
    }

    if (Object.keys(update).length > 0) {
      plannedUpdates.push({ ragaId: doc.id, jsonName: entry.name, dbName: doc.name, update, warnings });
    }
  }

  // --- Preview ---
  console.log(`\n📝 Preview: ${plannedCreates.length} to create, ${plannedUpdates.length} to update\n`);

  if (plannedCreates.length > 0) {
    console.log(`✨ Creates (${plannedCreates.length}) — ragas existing before today will be skipped at apply time:`);
    for (const { entry } of plannedCreates) {
      const fields = buildEnrichmentFields(entry);
      console.log(`  ${entry.name}`);
      if (entry.parentRaga) console.log(`    parentRaga: ${entry.parentRaga}`);
      for (const [field, value] of Object.entries(fields)) {
        const display =
          Array.isArray(value) ? `[${(value as string[]).join(' | ')}]`
          : String(value);
        console.log(`    ${field}: ${display}`);
      }
    }
  }

  if (plannedUpdates.length > 0) {
    console.log('\n📝 Updates:');
    for (const { jsonName, dbName, update, warnings } of plannedUpdates) {
      const label = jsonName === dbName ? jsonName : `${jsonName} → ${dbName}`;
      console.log(`  ${label}`);
      for (const [field, value] of Object.entries(update)) {
        const display =
          Array.isArray(value) ? `[${(value as string[]).join(' | ')}]`
          : typeof value === 'object' ? JSON.stringify(value)
          : String(value);
        console.log(`    ${field}: ${display}`);
      }
      for (const w of warnings) {
        console.warn(`    ⚠️  ${w}`);
      }
    }
  }

  if (dryRun) {
    console.log('\n[dry-run] No changes written.');
    return;
  }

  // --- Pass 2: apply creates (parents first, then children) ---
  // Maintain a live id map so child ragas can resolve parent IDs
  const liveIdMap = new Map(documents.map(d => [d.name.toLowerCase(), d.id]));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  console.log('\n⏳ Creating ragas...');
  let created = 0;
  let skippedPreExisting = 0;
  for (const { entry, parentName } of plannedCreates) {
    // Check DB directly — the search index may be stale and miss ragas created before today
    const existing = await Raga.getRagaByName(entry.name);
    if (existing && new Date(existing.createdAt) < todayStart) {
      liveIdMap.set(entry.name.toLowerCase(), existing.id);
      console.log(`⏭️  Pre-existing: "${entry.name}"`);
      skippedPreExisting++;
      continue;
    }

    const createInput: Raga.CreateRagaInput = {
      name: entry.name,
      ...(buildEnrichmentFields(entry) as Omit<Raga.CreateRagaInput, 'name' | 'parentRaga'>),
    };

    if (parentName) {
      const parentId = liveIdMap.get(parentName.toLowerCase());
      if (parentId) {
        createInput.parentRaga = { id: parentId, name: parentName };
      }
    }

    const newRaga = await Raga.createRaga(createInput);
    liveIdMap.set(entry.name.toLowerCase(), newRaga.id);
    console.log(`✨ Created: "${entry.name}"`);
    created++;
  }

  // --- Pass 3: apply updates (parentRaga IDs now include newly created ragas) ---
  console.log('\n⏳ Updating ragas...');
  let updated = 0;
  for (const { ragaId, jsonName, update } of plannedUpdates) {
    // Resolve any parentRaga that was deferred (parent was going to be created)
    const entry = ragasJsonByName.get(jsonName.toLowerCase());
    if (entry?.parentRaga && !update.parentRaga) {
      const parentId = liveIdMap.get(entry.parentRaga.toLowerCase());
      if (parentId) {
        update.parentRaga = { id: parentId, name: entry.parentRaga };
      }
    }

    await Raga.updateRaga(ragaId, update);
    console.log(`✅ Updated: "${jsonName}"`);
    updated++;
  }

  console.log('\n🎉 Enrich ragas complete!');
  console.log(`✨ Created: ${created} ragas`);
  console.log(`✅ Updated: ${updated} ragas`);
  console.log(`⏭️  Pre-existing (skipped): ${skippedPreExisting} ragas`);
}
