import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AdminData } from '@rasika/core';
import { toCsv } from '@rasika/core/admin/csv';
import {
  LYRICS_LANGUAGES,
  type LyricLine,
  canonicalLanguage,
  checkRespelling,
  looksTamil,
  normalizeLyricsText,
} from '@rasika/core/domain/composition/lyrics-normalize';

/**
 * Lyrics respelling, in the same three steps as `research-batches`: packets out, a worker in
 * the middle, and an ingest that refuses whatever fails validation. Nothing here writes to
 * the database; the ingest produces an ordinary admin CSV for `admin-csv-import`.
 *
 * The rules in `lyrics-normalize.ts` fix what is mechanical. They cannot fix what the source
 * got wrong inconsistently — `purAnamu` for `purANamu`, `porAmai` for `poRAmai`, a Telugu
 * kriti labelled Tamil — so each composition also goes past a reader. The packet carries the
 * text *after* the rules, so the reader starts from the better version, and the ingest
 * checks every returned section against the text *stored now*, so the reader can respell a
 * word and cannot replace one.
 */

const BRIEF = [
  'You are correcting the romanised spelling of Carnatic song lyrics. The site renders each lyric into Devanagari, Tamil, Telugu and Kannada script from this spelling, so a wrong letter here is a wrong letter in every script.',
  'The spelling scheme is ITRANS with Dravidian extensions (sanscript `itrans_dravidian`). Vowels: a A i I u U R^i (ṛ) e E (short and long e) ai o O (short and long o) au. Consonants: k kh g gh ~N | c ch j jh ~n | T Th D Dh N | t th d dh n | p ph b bh m | y r l v | sh (ś) S (ṣ) s h | L (ḷ) zh (ழ) R (ற) n2 (ன). Conjuncts: kS (क्ष), j~n (ज्ञ).',
  'The text you get has already been through mechanical rules (ṛ as R^i, ~N and ~n before velars and palatals, n2 in Tamil, long E/O in Sanskrit). Your job is what rules cannot do: the source did not follow its own scheme consistently.',
  'FIX: long vs short vowels (purAnamu → purANamu, kirtana → kIrtana), retroflex vs dental (T/t, D/d, N/n, L/l), ற vs ர (R vs r) and ழ vs ள (zh vs L) in Tamil, aspirates (b/bh, d/dh), sibilants (sh/S/s), plain misspellings of a word you are sure of, a word split or joined wrongly (caraNAm bhOja → caraNAmbhOja), and `ei` in Tamil where `ey` is meant (sheidanai → seydan2ai).',
  'TAMIL n: ந (plain n) only at the start of a word and before t/th/d; every other n in a Tamil word is n2 (ன). Telugu, Kannada, Sanskrit and Malayalam never use n2.',
  'Sanskrit and Hindi have no short e or o: always E and O there. Telugu, Kannada, Tamil and Malayalam do have short e and o — keep them short where the word has them.',
  'Keep `s` and `sh` for Tamil ச; do NOT respell them as `c`. The default page view is plain roman text and that is what people search for — `seydanai` must not become `ceydanai`.',
  'NEVER change a word into a different word, never add or remove a word, never reorder, never translate. Keep every line break: a section must come back with exactly the same number of lines. Leave swara notation lines (ga ga pa ri sa ..., S R2 G3 ...), bracketed notes like (madhyamakAla) or (endarO), and any English untouched. A validator compares your text with the stored text word by word and throws away any section that changed more than spelling.',
  `LANGUAGE: \`stored_language\` is often wrong — about 2,000 pieces are labelled Tamil by default, including Annamacharya (Telugu) and Swati Tirunal (mostly Sanskrit). Report the real language of the lyrics as one of: ${LYRICS_LANGUAGES.join(', ')}. Manipravalam is a mix of Sanskrit and Tamil or Malayalam. If you change the language, return EVERY section, because the Tamil n2 rule was applied based on the old guess and you must add or remove n2 accordingly.`,
  'OUTPUT: write `<batch>.result.json` as {"batch": "<batch>", "records": [...]}. Include a record ONLY if something must change. Each record: {"id": "...", "language": "<only if different from stored_language>", "sections": [{"order": <n>, "text": "<the whole corrected section>"}], "notes": "<optional, short: anything you were unsure of>"}. Return a section only if you changed it, and return it whole. If you are unsure of a word, leave it as it is and say so in notes — a correct but unfixed word costs nothing, a wrong fix is published in five scripts.',
];

interface PacketRecord {
  id: string;
  title: string;
  composer: string;
  stored_language: string;
  rules_detected_tamil: boolean;
  lyrics: Array<{ order: number; type: string; text: string }>;
}

interface Packet {
  batch: string;
  brief: string[];
  records: PacketRecord[];
}

interface ResultRecord {
  id: string;
  language?: string;
  sections?: Array<{ order: number; text: string }>;
  notes?: string;
}

interface StoredComposition {
  id: string;
  title: string;
  language?: string;
  composer?: { name?: string };
  lyricsV1?: LyricLine[];
  deletedAt?: string;
}

async function loadCompositions(): Promise<StoredComposition[]> {
  const rows = (await AdminData.listAllForDomain('composition')) as unknown as StoredComposition[];
  return rows
    .filter(c => !c.deletedAt && (c.lyricsV1?.length ?? 0) > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The text a section gets from the rules alone, given what we believe the language to be. */
function rulesText(text: string, language: string | undefined, tamil: boolean): string {
  return normalizeLyricsText(text, { language, tamil });
}

function isTamil(lyrics: LyricLine[]): boolean {
  return looksTamil(lyrics.map(l => l.text).join('\n'));
}

const SANSKRIT_LIKE = /^(sanskrit|sankrit|hindi)/i;

export async function writeLyricsBatches(opts: {
  outDir: string;
  size: number;
  limit?: number;
}): Promise<void> {
  mkdirSync(opts.outDir, { recursive: true });
  let compositions = await loadCompositions();
  if (opts.limit) compositions = compositions.slice(0, opts.limit);

  let written = 0;
  for (let start = 0; start < compositions.length; start += opts.size) {
    const batch = `lyrics-${String(start / opts.size + 1).padStart(3, '0')}`;
    const records = compositions.slice(start, start + opts.size).map(c => {
      const lyrics = c.lyricsV1 ?? [];
      const tamil = !SANSKRIT_LIKE.test(c.language ?? '') && isTamil(lyrics);
      return {
        id: c.id,
        title: c.title,
        composer: c.composer?.name ?? '',
        stored_language: c.language ?? '',
        rules_detected_tamil: tamil,
        lyrics: lyrics.map(l => ({
          order: l.order,
          type: l.type,
          text: rulesText(l.text, c.language, tamil),
        })),
      };
    });
    const packet: Packet = { batch, brief: BRIEF, records };
    writeFileSync(join(opts.outDir, `${batch}.json`), JSON.stringify(packet, null, 1));
    written++;
  }
  console.log(`📦 ${written} packets, ${compositions.length} compositions, in ${opts.outDir}`);
}

type Refusal = { id: string; title: string; order: string; reason: string; notes: string };

export async function ingestLyrics(opts: {
  dir: string;
  out: string;
  report?: string;
}): Promise<void> {
  const stored = new Map((await loadCompositions()).map(c => [c.id, c]));
  const packets = readdirSync(opts.dir).filter(f => /^lyrics-\d+\.json$/.test(f));

  const rows: string[][] = [];
  const refusals: Refusal[] = [];
  let missingResults = 0;
  let accepted = 0;

  for (const file of packets.sort()) {
    const packet = JSON.parse(readFileSync(join(opts.dir, file), 'utf-8')) as Packet;
    const resultPath = join(opts.dir, file.replace(/\.json$/, '.result.json'));
    let results: ResultRecord[];
    try {
      results = (JSON.parse(readFileSync(resultPath, 'utf-8')) as { records: ResultRecord[] })
        .records;
    } catch {
      // A missing or truncated result means the batch was not read. Applying the rules alone
      // to it would be a partial run reported as a whole one, so the batch is skipped.
      console.warn(`⚠️  ${packet.batch}: no readable result, skipped`);
      missingResults++;
      continue;
    }
    const byId = new Map(results.map(r => [r.id, r]));

    for (const record of packet.records) {
      const current = stored.get(record.id);
      if (!current?.lyricsV1) continue;
      const result = byId.get(record.id);
      const refuse = (order: string, reason: string) =>
        refusals.push({
          id: record.id,
          title: current.title,
          order,
          reason,
          notes: result?.notes ?? '',
        });

      // The stored text moved since the packet was cut: the reader corrected a version that
      // is no longer there. Keep the rules, drop the reading.
      const tamilNow = !SANSKRIT_LIKE.test(current.language ?? '') && isTamil(current.lyricsV1);
      const unchanged = current.lyricsV1.every(
        l =>
          record.lyrics.find(p => p.order === l.order)?.text ===
          rulesText(l.text, current.language, tamilNow)
      );
      const reading = unchanged ? result : undefined;
      if (result && !unchanged) refuse('*', 'stored lyrics changed since the packet was written');

      let language = current.language;
      if (reading?.language) {
        const canonical = canonicalLanguage(reading.language);
        if (canonical) language = canonical;
        else refuse('*', `unknown language "${reading.language}"`);
      }
      language = language ? (canonicalLanguage(language) ?? language) : language;
      // A reader who corrected the language also decided Tamil, and the rules follow them.
      const tamil = reading?.language
        ? language === 'Tamil' || (language === 'Manipravalam' && tamilNow)
        : tamilNow;

      const lyrics = current.lyricsV1.map(l => {
        const fallback = rulesText(l.text, language, tamil);
        const proposed = reading?.sections?.find(s => s.order === l.order)?.text;
        if (proposed === undefined) return { ...l, text: fallback };
        const verdict = checkRespelling(l.text, proposed);
        if (!verdict.ok) {
          refuse(String(l.order), verdict.reason);
          return { ...l, text: fallback };
        }
        accepted++;
        return { ...l, text: proposed };
      });

      const lyricsChanged = lyrics.some((l, i) => l.text !== current.lyricsV1?.[i]?.text);
      const languageChanged = language !== current.language;
      if (!lyricsChanged && !languageChanged) continue;
      rows.push([
        current.id,
        languageChanged ? (language ?? '') : '',
        lyricsChanged ? JSON.stringify(lyrics) : '',
      ]);
    }
  }

  writeFileSync(opts.out, toCsv([['id', 'language', 'lyricsV1'], ...rows]));
  console.log(
    `✍️  ${rows.length} compositions to update, ${accepted} sections accepted from readers, ${refusals.length} refused → ${opts.out}`
  );
  if (missingResults) console.log(`   ${missingResults} batches had no result and were skipped`);
  if (opts.report) {
    writeFileSync(
      opts.report,
      toCsv([
        ['id', 'title', 'order', 'reason', 'notes'],
        ...refusals.map(r => [r.id, r.title, r.order, r.reason, r.notes]),
      ])
    );
    console.log(`   refusals → ${opts.report}`);
  }
}
