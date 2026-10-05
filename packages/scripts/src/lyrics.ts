import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AdminData } from '@rasika/core';
import { toCsv } from '@rasika/core/admin/csv';
import {
  LYRICS_LANGUAGES,
  type LyricLine,
  type WordFix,
  applyWordFixes,
  canonicalLanguage,
  checkRespelling,
  cleanCompositionTitle,
  looksTamil,
  normalizeLyricsText,
  retargetTamil,
} from '@rasika/core/domain/composition/lyrics-normalize';

/**
 * Lyrics and title respelling, in the same three steps as `research-batches`: packets out, a
 * reader in the middle, and an ingest that refuses whatever fails validation. Nothing here
 * writes to the database; the ingest produces an ordinary admin CSV for `admin-csv-import`.
 *
 * The rules in `lyrics-normalize.ts` fix what is mechanical. They cannot fix what the source
 * got wrong inconsistently — `purAnamu` for `purANamu`, `porAmai` for `poRAmai`, a Telugu
 * kriti labelled Tamil — so each composition also goes past a reader. The packet carries the
 * text *after* the rules, so the reader starts from the better version, and the ingest
 * checks every result against the text *stored now*, so the reader can respell a word and
 * cannot replace one.
 *
 * Readers return word fixes rather than whole sections. The pilot returned sections, and at
 * ~105k tokens a batch the corpus would not fit in one session; most of that was copying out
 * text that had not changed. `sections` is still read, so the pilot results stay usable.
 */

const BRIEF = [
  'You are correcting the romanised spelling of Carnatic song lyrics and titles. The site renders each into Devanagari, Tamil, Telugu and Kannada script from this spelling, so a wrong letter here is a wrong letter in every script.',
  'The spelling scheme is ITRANS with Dravidian extensions (sanscript `itrans_dravidian`). Vowels: a A i I u U R^i (ṛ) e E (short and long e) ai o O (short and long o) au. Consonants: k kh g gh ~N | c ch j jh ~n | T Th D Dh N | t th d dh n | p ph b bh m | y r l v | sh (ś) S (ṣ) s h | L (ḷ) zh (ழ) R (ற) n2 (ன). Conjuncts: kS (क्ष), j~n (ज्ञ).',
  'The text you get has already been through mechanical rules (ṛ as R^i, ~N and ~n before velars and palatals, n2 in Tamil, long E/O in Sanskrit) and the title has had scraped link text removed. Your job is what rules cannot do: the source did not follow its own scheme consistently, and the title often uses a second, looser spelling (aa, ee, shree, kshh) for the same words as the pallavi.',
  'FIX: long vs short vowels (purAnamu → purANamu, kirtana → kIrtana), retroflex vs dental (T/t, D/d, N/n, L/l), ற vs ர (R vs r) and ழ vs ள (zh vs L) in Tamil, aspirates (b/bh, d/dh), sibilants (sh/S/s), ṛ written wrongly (shR^iti → shruti where the word is shruti), j~n for ज्ञ (jnAna → j~nAna), plain misspellings of a word you are sure of, a word split or joined wrongly (caraNAm bhOja → caraNAmbhOja), `ei`/`ai` in Tamil where `ey`/`ay` is meant (sheidanai → sheydan2ai, vAi → vAy), and `gh` in a Tamil word where plain `g` is meant (pughai → pugai).',
  'TAMIL ற்ற before i or I: write `R_Ri` / `R_RI` (muTrilum → muR_Rilum), because `RRi` reads as vocalic ṛ. `_` is a silent separator and never shows on the page. Elsewhere `RR` is fine (maTra → maRRa).',
  'TAMIL n: ந (plain n) only at the start of a word and before t/th/d; every other n in a Tamil word is n2 (ன). Telugu, Kannada, Sanskrit and Malayalam never use n2.',
  'Sanskrit and Hindi have no short e or o: always E and O there. Telugu, Kannada, Tamil and Malayalam do have short e and o — keep them short where the word has them.',
  'Keep `s` and `sh` for Tamil ச; do NOT respell them as `c`. The default page view is plain roman text and that is what people search for — `seydanai` must not become `ceydanai`.',
  'NEVER change a word into a different word, never add or remove a word, never reorder, never translate. Leave swara notation (ga ga pa ri sa ..., S R2 G3 ...), bracketed notes like (madhyamakAla) or (endarO), and any English untouched. In the title, keep a bracketed qualifier such as (varNam) or (bhajan) — it tells two pieces apart — but you may respell the words inside it. A validator compares your result with the stored text word by word and throws away anything that changed more than spelling.',
  `LANGUAGE: \`stored_language\` is often wrong — about 2,000 pieces are labelled Tamil by default, including Annamacharya (Telugu) and Swati Tirunal (mostly Sanskrit). Report the real language of the lyrics as one of: ${LYRICS_LANGUAGES.join(', ')}. Manipravalam is a mix of Sanskrit and Tamil or Malayalam. When you change the language, do NOT add or remove n2 yourself — that is redone automatically for the new language; write your fixes against the text exactly as you see it. Likewise never add n2 by hand to a Tamil piece where rules_detected_tamil is false: it is added automatically once you confirm (or correct to) Tamil. A record that changes only its language or title carries an empty or absent fixes list. KannaDa and Kannada are the same; report Kannada.`,
  'OUTPUT: write `<batch>.result.json` as {"batch": "<batch>", "records": [...]}. Include a record ONLY if something must change. Each record: {"id": "...", "language": "<only if different from stored_language>", "title": "<the whole corrected title, only if it changes>", "fixes": [{"order": <section order>, "from": "<word(s)>", "to": "<word(s)>"}], "notes": "<optional, short>"}. `from` is one or more WHOLE words exactly as they stand in that section (split on spaces; a hyphenated word like OTTip-paghaiyai is one word, so give it whole), and every occurrence in the section is replaced. Do not copy out unchanged text. If you are unsure of a word, leave it and say so in notes — a correct but unfixed word costs nothing, a wrong fix is published in five scripts.',
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
  title?: string;
  fixes?: Array<WordFix & { order: number }>;
  /** The pilot's format: whole corrected sections. */
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

const SANSKRIT_LIKE = /^(sanskrit|sankrit|hindi)/i;

/** Whether the rules treat this stored composition as Tamil. */
function rulesTamil(c: StoredComposition): boolean {
  return (
    !SANSKRIT_LIKE.test(c.language ?? '') &&
    looksTamil((c.lyricsV1 ?? []).map(l => l.text).join('\n'))
  );
}

/** What the rules alone make of a stored composition — the text a packet carries. */
function rulesVersion(c: StoredComposition) {
  const tamil = rulesTamil(c);
  const opts = { language: c.language, tamil };
  return {
    tamil,
    title: normalizeLyricsText(cleanCompositionTitle(c.title), opts),
    lyrics: (c.lyricsV1 ?? []).map(l => ({ ...l, text: normalizeLyricsText(l.text, opts) })),
  };
}

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
      const rules = rulesVersion(c);
      return {
        id: c.id,
        title: rules.title,
        composer: c.composer?.name ?? '',
        stored_language: c.language ?? '',
        rules_detected_tamil: rules.tamil,
        lyrics: rules.lyrics.map(l => ({ order: l.order, type: l.type, text: l.text })),
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

      // The reader corrected the packet's text. If the stored record has moved since the
      // packet was cut, that is no longer the text on the record: keep the rules, drop the
      // reading. Packets cut before titles were cleaned carry the raw title, so the title is
      // compared only when the packet's is already clean.
      const rules = rulesVersion(current);
      const lyricsMatch = current.lyricsV1.every(
        (l, i) => record.lyrics.find(p => p.order === l.order)?.text === rules.lyrics[i]?.text
      );
      const reading = lyricsMatch ? result : undefined;
      if (result && !lyricsMatch) refuse('*', 'stored lyrics changed since the packet was written');

      let language = current.language
        ? (canonicalLanguage(current.language) ?? current.language)
        : undefined;
      if (reading?.language) {
        const canonical = canonicalLanguage(reading.language);
        if (canonical) language = canonical;
        else refuse('*', `unknown language "${reading.language}"`);
      }
      // Once a reader has been through the batch, the language is no longer a guess: readers
      // relabel what is not Tamil, so a Tamil label that survives is a confirmed one — and a
      // short or Sanskrit-heavy Tamil piece the text score missed gets its ன here.
      const tamil = lyricsMatch
        ? language === 'Tamil' || (language === 'Manipravalam' && rules.tamil)
        : rules.tamil;
      const retarget = (text: string) =>
        tamil === rules.tamil ? text : retargetTamil(text, tamil);
      // The Sanskrit vowel rule follows a corrected label too. It only ever adds length.
      const relabel = (text: string) =>
        SANSKRIT_LIKE.test(language ?? '') && !SANSKRIT_LIKE.test(current.language ?? '')
          ? normalizeLyricsText(text, { language, tamil: false })
          : text;

      const lyrics = current.lyricsV1.map((l, i) => {
        const base = rules.lyrics[i]?.text ?? l.text;
        let proposed: string | undefined = reading?.sections?.find(s => s.order === l.order)?.text;
        const fixes = reading?.fixes?.filter(f => f.order === l.order) ?? [];
        if (proposed === undefined && fixes.length > 0) {
          const applied = applyWordFixes(base, fixes);
          for (const miss of applied.unmatched) {
            refuse(String(l.order), `fix matched no whole word: "${miss.from}" → "${miss.to}"`);
          }
          proposed = applied.text;
        }
        const fallback = relabel(retarget(base));
        if (proposed === undefined || proposed === base) return { ...l, text: fallback };
        const final = relabel(retarget(proposed));
        const verdict = checkRespelling(l.text, final);
        if (!verdict.ok) {
          refuse(String(l.order), verdict.reason);
          return { ...l, text: fallback };
        }
        accepted++;
        return { ...l, text: final };
      });

      let title = relabel(retarget(rules.title));
      if (reading?.title && reading.title !== record.title) {
        const proposed = relabel(retarget(cleanCompositionTitle(reading.title)));
        const verdict = checkRespelling(cleanCompositionTitle(current.title), proposed);
        if (verdict.ok) title = proposed;
        else refuse('title', verdict.reason);
      }

      const lyricsChanged = lyrics.some((l, i) => l.text !== current.lyricsV1?.[i]?.text);
      const languageChanged = language !== current.language;
      const titleChanged = title !== current.title && title.length > 0;
      if (!lyricsChanged && !languageChanged && !titleChanged) continue;
      rows.push([
        current.id,
        titleChanged ? title : '',
        languageChanged ? (language ?? '') : '',
        lyricsChanged ? JSON.stringify(lyrics) : '',
      ]);
    }
  }

  writeFileSync(opts.out, toCsv([['id', 'title', 'language', 'lyricsV1'], ...rows]));
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
