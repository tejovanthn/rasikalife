# SSP compositions -> rasika.life: gap analysis

Read-only. Nothing edited in either repo. Numbers come from `python3 -I` over the four run dirs
(`run-2026-10-27-055202`, Vols 1-4) and from `data/sources/shivkumar/prod-composition.csv`
(a prod export of 8,555 compositions, dated 11 Oct 2026).

## 1. Profile of the SSP data

820 composition records (Vol 1: 392, Vol 2: 206, Vol 3: 151, Vol 4: 71; Vol 5 has none, only
`compositions_mentioned.jsonl`).

Two very different populations:

| Population | Where | Count | Notes |
|---|---|---|---|
| Lakshana examples inside raga sections | Vols 1-3 | 749 | Titles are generic: gita 164, sancari 187, tana 40, tanam 1, gitam 1 (393 total). Plus 356 named records, mostly kirtanas. |
| Appendix compositions | Vol 4 (A = ragamalikas, B = kirtanas/varnams/padams) | 71 | All have real titles. |

Generic-titled: **393 of 820 (48%)** have a title that is only the form word ("gita", "sancari").
Named: 427 records, 416 distinct titles. 421 distinct `name_canonical` overall.

By form (top): kirtana 317, sancari 189, gita 165, tana 40, tana varnam 27, ragamalika 14,
padam 12, cauka varnam 12, daru 6, svarajati 5, dravida padam 3, prabandham 3, sulādi 3 (two
spellings: sūḷādi 2, śūḷādi 1), plus ~25 one-off forms (see section 6).

Resolution:
- raga: `raga_name_iast` 804/820; `raga_id` resolved 749 (57 unresolved, excluding ragamalikas). 970 `composition_in_raga` edges, 815 compositions have at least one. Of those edges, 41 resolved by `match_table`, 28 by `alias`, the rest by exact match.
- tala: field filled on 774 (46 null). **No `composition_in_tala` relationship exists** (0). Tala is only a string on the record.
- composer: `composed_by` edge on 816 (4 none). Skeleton `composer_skeleton` 812. By composer: Subbarama Dikshita 224, Muttusvami Dikshita 220, Venkatamakhi 209, Krsnasvami Ayya 18, Ramasvami Dikshita 17, Kumara Ettappa 9, Balusvami 6, "Purvikas" (the ancients) 5, Syama Sastri 5, Tyagaraja 4, and a long tail of ~40 more. Vol 1-3 are almost all Venkatamakhi (gitas, tanas) and Subbarama Dikshita (sancaris), i.e. the book's own examples.
- `lyrics_by` 3, `names_patron` 1, `praises` 1, `composition_about_deity` 1, `composition_honours` 1, `performed_like` 1. `dedicated_to` 0. `deity_or_subject` filled on 3.
- `attribution_notes` on 65 records (composer conflicts, etc.). `review.jsonl` has more.

Ragamalikas: 14 with form "ragamalika" plus taranga (1), ragatalamalika (1), raganga ragamalika (1) = **17 records, all Vol 4**.
They carry **325 `composition_in_raga_segment` edges** (order + segment label in `attributes.segment`).
**11 segments are `raga:unknown`** (A.3: 2, A.4: 1, A.6: 1, A.8: 2, A.9: 1, A.10: 1, A.15: 1, A.16: 2). 314 resolve to a raga id, but those ids are from the Vol 1-3 raga set (`raga_ssp-2008-english-vol-N_...`), so they only become rasika.life ragas after the raga import has run and a name map exists.
Largest: A.15 raganga ragamalika 72 segments (the 72 melas), A.12 ragatalamalika 61, A.3 44, A.8 32, A.16 20.
Known weak segments (STATE.md): A.4, A.5, A.6, A.8, A.9 have null or weak ones; A.8 "closing chain" orders 17-32 may not be real segments; A.9 `performed_like` A.5 is an inference to drop.

Sancaris: 189 records, all Subbarama Dikshita's, all titled "sancari", one per raga-section example. **Recommendation: do not import them as compositions.** A sancari is a phrase-sequence exemplifying one raga (lakshana illustration); nobody searches for one, there is no title to match, and 189 pages titled "sancari" would be thin duplicates. Same for the 164 gitas and 40 tanas: they ARE real teaching pieces (gitas are sung, e.g. "Kamalajadala"), but the extracted record has no title, just the form name. See owner decision 1.

Title shape: `name_canonical` is IAST NFC with macrons and dots (ā ī ū ē ō ṅ ñ ṇ ṭ ḍ ś ṣ ṃ ṅ ḷ ṛ ḥ), words separated by spaces, lowercase. Character census: ā 759, ī 326, ñ 202, ē 159, ś 141, ṇ 71, ō 64, ṃ 57, ṣ 50, ṅ 39, ṭ 35, ū 28, ḷ 21, ṛ 17, ḍ 11, ḥ 5. Use of ē/ō (long e/o) is SSP's Telugu-reading; ours is ITRANS Dravidian `E`/`O`, a direct match. Two titles carry curly quotes (prabandham "khabay").
Also messy: tala strings include "tāḷa", "tāḷam", "tāla" (skeleton known bug), "miśr jāti ēka", "dhruva rūpaka a tāḷa", "tripuṭa a tāḷa".

## 2. Does the book contain the notation? Is it extracted?

**No. Only metadata and `facts` sentences were extracted.** Checked:
- Vol 4 composition section JSON keys: `form, title_iast, tala, composer, raga_name_iast, raga_name_as_printed, pdf_pages, printed_pages, ragamalika_ragas, deity_or_subject, facts, attribution_notes, editor_notes, entity_records, relationship_records, extraction_self_assessment`. No notation, sahitya or lyrics key in any of the 262 section files (grep over all keys: zero hits).
- `facts` describe structure only ("pallavi has three lines; anupallavi has three lines", "flat signs on nishada").
- `skeleton.json` (Vol 4): 71 compositions with `pdf_page`, `printed_page`, `section_pdf_range` (e.g. A.1 is PDF pages 10-18). So page ranges per composition are known.
- `page-text-dump.json` holds the raw PDF text layer for Vol 4 (326 pages). Looked at pp. ~191-192: the notation comes out as one token per line ("/N N", "∴", "˙s", "tā pā dhiṃ tya ja", "|", "∥::"). The layout (which syllable sits under which svara) is lost. Not usable as `notation` text.
- Vols 1-3 compositions are embedded in raga sections; their notation is on the lakshana pages and was never extracted.

**What extracting notation would take.** Notation is the main body of SSP (about 98% of pages in Vol 4). It must be read from the page images (the PDF has no usable column layout), as the 1963 Tamil edition is for ragas. Needs a new extraction spec in rasika-books (`book-ssp-notation`) producing, per composition and per part (pallavi/anupallavi/muktayi svaram/caranam/caranam svaram n), the sahitya syllables aligned with svara lines and tala marks. Sign vocabulary is large: dot-above and dot-below octave marks, jhanta (doubled), kampita/gamaka signs (the page text shows `✓`, `♮`, `⌢`, `⌣`, `∵`, `∴`, `⋎`, `\`, `/`), dal segno, fermata, prathama/dwitiya kalam bars (`|`, `∥`). Output to a fixed-width text that preserves columns. Cost: Vol 4 only (71 comps, 326 pages) is about 5 batches of agent work; Vols 1-3 examples add a lot more and are of the unnamed forms. This is the largest item in the whole plan and is XL on its own. Without it the SSP import is metadata + citations only.

Where it lives: rasika.life `composition.notation` (preformatted text, never transliterated, max 100k chars, shown in a scrolling `<pre>`). That field is a single string, so one SSP notation and, say, a Shivkumar notation cannot both be stored (planAttach writes notation only where none exists). See owner decision 4.

**Licence.** The 2008 English edition (Music Academy translation) is educational and personal use only. Rule from owner: never copy or reword. The 1904 svara notation itself is public domain (Subbarama Dikshitar d. 1906), but the 2008 edition's translations, headings, English sentences and editorial notes are not. So:
- Store: title in IAST->ITRANS, form, tala (as a fact), raga/composer links (facts). Do not store the extractor's `facts` sentences or `editor_notes` as description text.
- Notation text transcribed from the 1904 pages (svaras + sahitya syllables) is defensible as public domain. But the 2008 re-typesetting (ordering, signs, layout) is a new typographical edition. Needs owner call on whether to transcribe from the 2008 PDF or from the 1904 Telugu original (archive scan). Safest: read the 1904 plate, if one is available, otherwise treat as owner risk. The licence field on `source` exists (`licence`, max 300) to record this.
- Citations: cite "SSP (Music Academy 2008 trans.), Vol 4, p. 1427" as a locator only.

## 3. Adapter, and what `SourceRecord` needs

Yes, use the pipeline: new adapter `packages/scripts/src/sources/ssp.ts` (SourceAdapter: name `ssp`, romanisation `itrans` after conversion, `fetch` is a no-op that copies/validates the JSONL from `~/codes/rasika-books/extractions/...`, `load` reads them). Register in `sources/index.ts`. Shared match/review/apply/undo then come free.

Current `SourceRecord` fields: `key, title, raga?, tala?, composer?, compositionType?: 'kriti'|'varnam'|'other', sources: string[], notation?, lyrics[], scale?, note?, romanisation?`.

Gaps for SSP:

| Need | Gap | Fix |
|---|---|---|
| Form (gita, tana varnam, sulādi, padam, daru, prabandham, ...) | `compositionType` union is 3 values; `CreateCompositionSchema` enum is `kriti, varnam, tillana, javali, padam, keertanam, other` | Widen both (see section 6). Keep SSP's own word in `tags` too (`gita`, `sulādi`). |
| Citation: book + page | `sources` is `z.array(z.string().url())` and `mergeSources`/`sourceKey` assume URLs | Add `citations` to composition (same `CitationSchema` as raga: `{field?, sourceSlug, locator, ...}`) and a `citations?` on `SourceRecord`. Do not fake a URL. Import the source sheet first (`ssp-2008-english-vol-4` etc. as `source` rows, kind `book`, `licence` text). |
| Ragamalika segments | `raga?: string` single | `ragas?: Array<{order:number; name?:string; unknown?:boolean; label?:string}>`. See section 4. |
| Lyricist vs composer | `composer?: string` only | `lyricist?: string` (and a `credit` note). See section 5. |
| Patron, deity | none | `patron?`, `deity?` as strings; stored in `tags`/`description`? See section 5. |
| Page range | none | in `citations.locator` ("p. 1427-1430"). |
| Review-note | `note` exists | Carry `review.jsonl` flags (composer conflict, weak segments) here. |
| Key | URL used by others | Use the extractor id `comp_ssp-2008-english-vol-4_B.6_anantabalakrsnam`. Stable. |
| Skipping | none | The adapter itself drops sancaris (and, by decision, gitas/tanas that have no title). |

Matching code changes (`source-match` in `sourceImport.ts`, `match.ts`): the matcher is shaped around a single raga and a single tala; for ragamalikas match on title + composer only and ignore raga (a ragamalika's `ragas` in our DB is a list; you can use "any one agrees"). `foldKey` assumes ASCII, so the adapter must convert first.

## 4. Ragamalika today, and what is missing

Today:
- `CompositionRaga` junction: `pk=COMPOSITION#id, sk=RAGA#ragaId`, `gsi1=byRaga`. **No order, no segment, no label, no repeat** (same raga twice in one ragamalika collapses to one row; since sk includes ragaId, it cannot be stored twice).
- `Composition.ragas` is a denormalized list of `{id, name}` (a list so order is preserved, but there is nothing saying what it means).
- `lyricsV1[].ragaName` exists per lyric section (`{type, order, text, number?, ragaName?}`). This is the only place a segment is tied to a raga, and it needs the sahitya text.
- 6 of 8,555 prod compositions have more than one raga (e.g. "amudanukku amudUTTum yamunai"); so the shape is exercised only trivially. karnatik.com ragamalika pages are rare in the corpus.
- `CompositionTala` is the same junction shape.

Missing for SSP's 17 ragamalikas / 325 segments:
1. An ordered segment list on the composition: `segments: [{order, ragaId?, ragaName, label ('pallavi', 'caranam (closing return)', 'cittasvaram'), unknown?: boolean, confidence?}]`. Preferred as an attribute on the composition (a list, rule 9 not an issue because not an index), not a junction; nothing queries "ragamalikas where raga X is segment 4".
2. Keep the junction for "which compositions use raga X" (page on raga lists them). Write one `CompositionRaga` row per DISTINCT resolved raga; skip `raga:unknown`.
3. An unknown segment: `ragaId` absent, `ragaName` absent, `unknown: true`. Page renders "raga not identified" for it. 11 segments. Do NOT create a placeholder `Raga` named "unknown" (it would be indexed by search and linked to).
4. 72-mela ragamalika (A.15): 72 segments. Keep, but the page should render it as a table or collapse, not 72 raga chips.
5. Tala: ragatalamalika (A.12, 61 segments) changes tala per segment. SSP has `tala` as one string for the record; segment-level tala is not extracted. Store as a note or leave empty.
6. Lyrics `ragaName` is a single string; with segments you would drop it in favour of `segments`.

## 5. Credit split: composer vs lyricist

Composition fields: `composerId` (required) and `composer {id, name}` (required). No lyricist, no patron, no deity, no dhatu/matu fields. `Composition.tags` is free text and not indexed. `description` free text (5000).

Extractor data: `lyrics_by` 3 edges (A.15 ī kanakāṃbari → Kṛṣṇa Kavi; Vol 3 65.0.9 parikkanni → Nārāyaṇasvāmi Ayyar; Vol 1 22.10.4 emantayanara → Meraṭṭūr Vēṅkaṭarāma Śāstri, "believed"), STATE.md notes B.7, B.8, B.10 where the page splits dhātu (tune) and mātu (words) but only the skeleton person is in `composed_by`: the section file has the right split; merge should prefer it. `names_patron` 1 (B.11 kanakāṅgi → Sarabhoji). `composition_honours` 1, `composition_about_deity` 1. Only 3 records have `deity_or_subject` filled, and none of the edges use `dedicated_to`.

Gaps and cheap handling:
- **Lyricist**: add optional `lyricist: EntityRef` (or `lyricistId`) to the composition. Small. In the CSV, a `lyricist` column resolved by name like `composer`. Until then, put "Words: X" in nothing; do not hide it in `description` (a claim about credit should be a field). Low volume (about 6 records with a split), so a tag is not worth it; owner can decide to wait.
- Rule for `composerId`: `dhātu` person is `composer`; `mātu` person is `lyricist`. Where the skeleton disagrees with the heading, the heading wins and flag it (STATE.md rule).
- **Collective composers**: "Prācīnās"/"Pūrvikās"/"Prācīna" (the ancients) 6 records. Our convention: an artist named `Unknown` for no composer (CLAUDE.md, bhajans). "Ancients" is not unknown; either map to `Unknown` + a `note`, or add an artist "Ancient composers (Prācīnas)". Owner decision.
- **Patron / deity**: not fields. `names_patron` is one edge. Leave in the manifest/`note`; skip until composition pages want it. Do not invent a `patron` field for one record.
- Composer name resolution: 26 Dikshitar-family and tail names. Artist matching uses `bestArtistMatch`/`composerAgrees`; the CSV `composer` column auto-creates artists ("a new name is created on import"). CLAUDE.md says never auto-create an Artist in the bio pipeline; the source pipeline does create (composer in the review CSV `new_*`). For SSP, resolve the 5 big composers by name and put the rest on the review sheet, because a Telugu-era name creates duplicates (Tiruvoṭṭiyūr Vīṇa Kuppayyar appears with two spellings: "Vīṇa"/"Vīna").
- Do not import Vol 5 `lyrics_by` fragments etc.; Vol 5 is biographies and `compositions_mentioned` (see section 8).

## 6. Forms vs COMPOSITION_TYPES

Two enums, both too narrow:
- `CreateCompositionSchema.compositionType`: `kriti, varnam, tillana, javali, padam, keertanam, other`. (Only this one is stored on the composition; in prod all 8,555 rows have it empty.)
- `COMPOSITION_TYPES` in `concert-log-item/composition-types.ts` (setlist item kinds): `varnam, kriti, rtp, thillana, javali, padam, viruttam, thukkada, slokam, tani, other`. Different purpose; do not widen it for SSP.

Suggested mapping (SSP form -> stored `compositionType`, plus `tags` keeps the SSP word):

| SSP form | Count | compositionType | tags |
|---|---|---|---|
| kīrtana | 317 | `keertanam` (or `kriti` for Dikshitar, per owner; our corpus calls Dikshitar pieces kriti - the column is empty today, so decide) | |
| gīta, gītam (+ lakṣaṇa/prayoga variants 5) | 168 | new `gitam` | `lakshana-gita` for the rāgāṅga/prayoga ones |
| tāna varṇam, cauka varṇam, pada varṇam, svarasthāna varṇam | 41 | `varnam` | `tana-varnam`, `chauka-varnam` |
| padam, prācīna padam, drāviḍa padam, pada, svarastāna padam | 19 | `padam` | |
| daru, tillānā daru | 7 | new `daru` (or `other`) | |
| svarajati, jatisvaram | 6 | new `svarajati` | |
| rāgamālikā, rāgatāḷamālikā, rāgāṅga rāgamālikā, taraṅgam | 17 | new `ragamalika` (taranga stays `other` with tag `tarangam`) | |
| prabandham (+ umātilaka, śrīraṅga, lakṣya, kaivāra, dēśīya "khabay"/"kapāy") | 9 | new `prabandham` | |
| sūḷādi / śūḷādi | 3 | new `suladi` | |
| tāna, tānam | 41 | not a composition (raga exposition lines, "tana" in the lakshana sense) | skip |
| sañcāri | 189 | not a composition | skip |
| gīta with no title | see below | | |

New enum values needed: `gitam, daru, svarajati, ragamalika, prabandham, suladi` (6). They are also needed in `CompositionType` for any page filter. The CSV `compositionType` column in `columns.ts` must accept them; check `ADMIN_CSV_DOMAINS.composition` validation, and the compositions list filters/search document if they key on type. Not in the sitemap or UI today as far as I saw, so risk is low.

Not in SSP's 820 but in the book: ṭhāya (none in the extraction), cūrṇika (none), lakṣaṇa gīta (1 labelled as such, 5 variants), pallavi, sūḷādi 3. Those named in the brief but absent from the data are not there.

## 7. Tala mapping

SSP's 32 distinct tala strings (counts above) reduce to base names. Our prod `talas` column (from `prod-composition.csv`, top): Adi 4,395, rUpaka 1,033, cApu 797, (blank) 796, aTa 446, jhampa 337, tripuTa 245, Eka 199, dEshaadi 142, aTanta 21, cempat 19, maTya 14, dhruva 8, madhyaadi 8, plus junk (`m`, `given`, `RAgamAlika.`, `sahAnA.`) that `tala-cleanup` is meant to remove.

Mapping needs:
- SSP lists suffixes: "ādi tāḷa" -> `Adi`; "rūpaka tāḷa" -> `rUpaka`; "tripuṭa tāḷa" -> `tripuTa`; "jhaṃpa tāḷa" -> `jhampa`; "aṭa tāḷa" -> `aTa`; "dhruva tāḷa" -> `dhruva`; "ēka tāḷa" -> `Eka`.
- **"maṭhya tāḷa" (143) -> `maTya`.** Note our existing `maTya` has only 14 uses, as it is mostly under `Adi`/`rUpaka` on karnatik.com. SSP "maṭhya" is the tala called "Madhyadi"? No: SSP "maṭhya tāḷa" is Matya (Jhampa-like). `canonicalTala` handles `matya` (the regexp lists `/matya|matya/i` twice; the second was probably meant to be `madhya`) but not "maṭhya" with the aspirate: after IAST->ITRANS the string is `maThya`, and the current regexp `matya` would not hit it. Needs `/ma[tT]h?ya/` and a test.
- **"tiśra jāti ēka tāḷa" (43+4+2 spellings), "miśra jāti ēka tāḷa" (42+1), "khaṇḍa jāti ēka" (5), "caturaśra jāti ēka" (7), "saṅkīrṇa jāti ēka" (1)**: these are Eka tala with a jati. Our table has `Eka` only (and maybe `tishra Eka` etc.; uses unknown without DB). Options: map all to `Eka` and keep the jati as a `tag` or note (loses 100 compositions' tala accuracy: in SSP the jati is the whole point of the Dikshitar tala), or create separate tala records (`tisra jAti Eka`, `miSra jAti Eka`, ...). That is a tala-table decision. `match.ts` `canonicalTala` already maps `\beka` -> `Eka` regardless of jati. Owner decision.
- **"dhruva rūpaka tāḷa" (24+3 "rūpaka dhruva")**: not in `TALA_NAMES` (dhruva regexp would match first -> `dhruva`, wrongly). Needs its own entry before `dhruva`.
- **"ragaṇa maṭhya tāḷa" (14+1 tiṣra jāti ragaṇa maṭhya)**: a Telugu/Dikshitar sancari tala ("raganamatya"); it would mis-map to `maTya`. Needs its own entry before `maTya`.
- "maṭhya cāpu tāḷa" (1), "khaṇḍa cāpu" (1), "miśra cāpu" (1): `cApu` regexp matches `c(h)?a+pu`, so these become `cApu`. Our `cApu` is 797 (the commonly named tala). The qualifier (maTya/khaNDa/miSra cApu) is lost. Probably fine with a tag; flag for owner.
- Spelling variants: "tāḷam" (-m), "tāla" (skeleton bug), "miśr jāti", "a tāḷa" suffix. Normalise: strip `tāḷa|tāḷam|tāla|tālam|a tāḷa$`, then look up. The IAST `ḷ` is the Tamil/Telugu-reading ळ; Sanscript IAST->ITRANS maps `ḷ` to `L` (sometimes `LLi` for vocalic l). A direct text replace of "tāḷa" before converting avoids it.
- Missing: 46 compositions have no tala (null); leave blank.
- Where the DB stores tala by name: `talaIds` on create, resolved with `resolveName` / `canonicalTala` in the source pipeline; unknown names are created (so they should be pre-mapped, or the "tala-cleanup" problem repeats).

Estimated: map table of about 12 entries; tests for each of the 32 strings.

## 8. Match estimate against what we already hold

A local prod export exists: `/Users/tejovanthn/codes/rasikalife/data/sources/shivkumar/prod-composition.csv` (8,555 rows, 11 Oct 2026; it is 3 weeks old and misses compositions added by the later carnatic-circle import and the 18 Oct shivkumar batch of 24). Columns: id, title, composer, language, ragas, talas, compositionType, ..., lyricsV1. Composers: Purandara Daasar 1,092, Suddhananda Bharati 1,060, Tyagaraja 707, Papanasam Sivan 610, **Muttuswami Dikshitar 518**, etc. Only 0 rows have `notation`, and `compositionType` is blank for all.

Crude fold match (strip diacritics, lowercase, drop spaces, fold `ee/oo/au/h/y/w/c/z/doubles` like `foldKey`), SSP title vs our title, named records only (427):
- **136 of 427 (32%) already exist by exact fold** (kirtana 131, tana varnam 2, prachina padam 1, tarangam 1, ragamalika 1). By volume: Vol 1: 61, Vol 2: 39, Vol 3: 29, Vol 4: 7.
- About **117 more** are prefix-style near matches (one title contains the other) that need human review: this is the `foldKey` + `isNearMatch` path of `source-match`.
- Vol 4: only 7 of 71 exist. This is the expected result: Vol 4 is the Dikshitar-school appendix of rare pieces (ragamalikas, prabandhams, Ettayapuram court works), so these are mostly new records (64 of 71).
- Examples of a clean match: avyājakaruṇākaṭākṣi (ours: avyAja karuNAkaTAkSi, Dikshitar, salangaNaTa), bālagōpāla pālayāśu mām (bhairavi), cidaṃbara naṭarājam. The raga name in ours is not always the SSP raga (SSP "īśamaṇīhari" vs karnatik) so raga agreement is a weaker signal than for Shivkumar; use title + composer, and show raga disagreement as a note.
- Gitas/tanas/sancaris: the DB has a few gitas titled by first line (e.g. "pArvatI janani (gItam)", "mInAkSi jayakAmAkSi (gItam)"); an untitled SSP "gita" in raga X cannot match any of them. If untitled gitas are to come in at all, they need a title: SSP prints the sahitya first line, which is exactly what has not been extracted (it needs the notation read, section 2).

Run-time estimate for the real figure:
1. `pnpm cli source-fetch --source ssp` (copies the JSONL, no AWS).
2. `pnpm cli source-match --source ssp --out data/sources/ssp/match.csv` against prod (read-only; needs `sst shell`, owner allows prod reads). Expect: 140-250 attach rows, 150-250 create rows, 400 skipped (sancari/tana/untitled gita).
3. Owner reviews the sheet. Then `source-csv`, `source-apply --dry-run`.

Vol 5 `compositions_mentioned.jsonl`: not run. Composition mentions in biographies (a title in a bio) should not become records; at most they feed `keyCompositionIds` evidence and citations. Skip.

## 9. IAST -> ITRANS

Core has what is needed:
- `packages/core/src/utils/transliteration.ts`: `transliterate(text, to)`, `fromItrans`, `SOURCE_SCHEME = 'itrans_dravidian'`, uses `@indic-transliteration/sanscript`. Direction is ITRANS -> others (display). The reverse is not wrapped.
- `packages/core/src/domain/composition/carnatic-circle.ts`: `readRomanisation(text)` (detects iso vs itrans vs plain) and `isoToItrans(text)` which does `Sanscript.t(iso, 'iso', 'itrans_dravidian')` after fixes for ṛ/ṃ/ṝ/l̤. This is the right model: SSP's IAST (ṛ, ṃ, ṅ, ñ, ṭ, ḍ, ṇ, ś, ṣ, ē, ō, ḷ) is nearly ISO 15919. **Use `Sanscript.t(text, 'iast', 'itrans_dravidian')` or reuse `isoToItrans`. Test both** on the real titles because:
  - IAST uses `ṃ` for anusvara and `ṁ` is ISO; SSP uses `ṃ`. `isoToItrans` already normalises it.
  - SSP uses `ē`/`ō` (long e/o), which plain IAST does not have. sanscript's `iast` scheme lacks them; `iso` has them. `itrans_dravidian` maps `E`/`O`. So `iso` as the source scheme is the correct choice; that is what carnatic-circle does.
  - `ḷ` appears in tala strings and a few titles; ISO reads it as retroflex L, ours is `L`. Fine.
  - SSP quirks seen: "lakṣaṇa" etc. with ṣ -> `Sh`? in ITRANS `Sh` is ष (S?). In `itrans_dravidian`, ṣ -> `Sh`. Our store uses `S` for ś? Check against the real store: Dikshitar title in prod is `avyAja karuNAkaTAkSi` (`kS`, `S` = ṣ, `sh` = ś, `shrI`). So ITRANS here uses `sh`/`S`. The sanscript output for ṣ is `Sh`? The existing carnatic-circle import passed through the same call, so consistency with the store was already settled; but verify with a diff test on the 136 matched titles (should fold-equal ours).
  - Do NOT lowercase the output: capitals carry retroflex meaning. IAST is already lowercase; the converter produces the capitals.
  - The prod store has a mix of "near-ITRANS" (`bAlakrSNam`, `shankaranArAyaNam`) from karnatik.com. Matching goes through `foldKey`, which removes case, so this is fine for matching; new records store the sanscript output.
- Titles with ragas/composers also need the names converted: raga names to match `ragaExactKey` (diacritics stripped), composer names `composerAgrees`.
- Edge: Telugu-style `kk`, double `cc` etc. are fine.
- Unit test: a table of 30 real titles with expected ITRANS (hand-checked), plus a round trip `fromItrans(iso->itrans(x), 'iast')` equal to input NFC for the same.

## 10. Build list

Sizes: S (<0.5 day), M (about 1 day), L (2-3 days), XL (a week or more).

Metadata-only import (no notation):

1. **S** `packages/core/src/domain/composition/ssp.ts` (new, pure): `readSspCompositions(runs)`: parse JSONL + sections, apply decisions (drop sancari, tana, untitled gita unless decided), build `SspComposition[]` with `title` (IAST), `form`, `tala`, `composer`, `lyricist`, `ragas/segments`, `citation`, `flags`. Tests: fixtures from 6 real records (kirtana, tana varnam, ragamalika with an unknown segment, record with dhatu/matu split, a Prachina composer, a record with `tala: null`).
2. **S** `iast->itrans` helper (`sspToItrans`, reusing `isoToItrans`) + 30-title test.
3. **S** Tala map: extend `canonicalTala` / `TALA_NAMES` in `match.ts` for maṭhya/ragaṇa maṭhya/dhruva rūpaka/jāti-Eka/cāpu, or a SSP-specific `sspTala` in `ssp.ts`, with the tala-table decision applied. Tests: all 32 strings.
4. **M** Schema: `compositionType` enum + 6 values (`schema.ts`, `entity.ts` comment, `client.ts`, `columns.ts` CSV validation, search document if it reads the type); `lyricist` attribute (`entity.ts`, `schema.ts`, CSV column + prepare hook in `bulk-data.ts`, `toCompositionWithRelations`); `citations` list on composition (reuse `CitationSchema` from `raga/sourced.ts`; show on composition page as "Sources"; mind that `sourcesOf` stays URLs). Tests: schema, CSV round-trip, `toCompositionWithRelations` keeps the new fields (the mapper has dropped fields before).
5. **M** Ragamalika segments: `segments` attribute on composition (`order, ragaId?, ragaName?, label?, unknown?`), write path (`createComposition`/`updateComposition`), junction write only for distinct resolved ragas, `getRankedCompositionsByRaga` unaffected. Composition page: ordered list with "raga not identified" for unknown. Tests: unknown segment, repeated raga (one junction row, two segments), A.15 with 72.
6. **M** `SourceRecord` additions: `form?`, `ragas?` (segments), `lyricist?`, `citations?`, `tags?`; `source-import.ts` `planAttach` to merge `citations` (by `sourceSlug+locator`, like links), manifest records added citations; `source-undo` removes only those. Update `sourceImport.ts` CSV columns (`new_lyricist`, `new_segments` JSON, `new_citations` JSON, `new_form`). Tests: `source-import.test.ts` cases for citation merge, undo that keeps a person's edit.
7. **M** `packages/scripts/src/sources/ssp.ts` adapter + registration in `sources/index.ts`; `data/sources/ssp/` gitignored folder; fetch copies from `~/codes/rasika-books/extractions` by path (flag `--books-dir`). Tests live in core (`ssp.test.ts`), since `packages/scripts` has no vitest.
8. **S** Source rows: the `source` CSV sheet for `ssp-2008-english-vol-1..4` (slug, title, citation, kind book, licence "educational/personal use; pagination and facts only"), imported before the compositions (the raga import already refuses citations to unknown slugs; add the same refusal for composition).
9. **M** Match run: `source-match --source ssp` against prod (read-only), review sheet columns `suggestion/decision/match_id`. Owner time: about 250 rows. Then `source-csv`, `source-apply --dry-run`, apply, reindex, `clear-page-cache`.
10. **S** Docs: add an SSP paragraph to CLAUDE.md "Composition sources" (the new fields, forms, sancari rule), `docs/` plan note, and `STATE.md` next step.

Optional / separate:

11. **XL** Notation extraction in rasika-books (`book-ssp-notation` agent spec, per-part sahitya+svara alignment from page images), then a `notation` field writer: each composition's notation would be a long preformatted string (<=100k). Needs a text format spec and a validator (`validatePhrase` exists for raga phrases, not compositions). Also needs the `notation` string to carry a source label (since one field holds one string; two notations collide).
12. **M** Segment-level tala for ragatalamalika (A.12) if wanted: not extracted today.
13. **S** Respelling readers over new SSP compositions: they have no lyrics, so nothing to respell; title-only checks via `checkRespelling` not needed.

## 11. Owner decisions

1. **Sancaris, tanas, untitled gitas**: skip all three (my recommendation: skip sancaris and tanas; they are raga-lakshana illustrations, 189+41 records with no title). Untitled gitas (164): skip until notation/first line are extracted, or import as "Lakshana gita - <raga>" (a synthetic title that claims nothing the book does not hold)? Gitas are sung and have first lines in the book; without extraction we cannot name them.
2. **Kirtana vs kriti for Dikshitar pieces**: `compositionType` is empty for all 8,555 existing rows. Pick one for SSP's 317 and whether to back-fill.
3. **Composition `citations` field** (page-level cites) vs only `sources` URLs. Recommended: add `citations`, same shape as raga.
4. **Notation**: extract or not? If yes, from the 2008 PDF or the 1904 plates (licence), and one notation string per composition or a list with source labels? Also whether to store it publicly given the 2008 edition's terms.
5. **Lyricist field**: add (about 6 records now, more if the dhatu/matu pages in Vol 4 are re-read) or skip and keep the split in the manifest note?
6. **Collective composers** ("Prācīnās", "Pūrvikās"): use `Unknown`, or create an "Ancient composers" artist?
7. **Jati talas**: keep jati on `Eka` (new tala records `tisra jati Eka`, `misra jati Eka`, `khanda jati Eka`...) or fold to plain `Eka` with a tag? Same for `cApu` variants and `ragaNa maTya`.
8. **New form values** (`gitam, daru, svarajati, ragamalika, prabandham, suladi`): accept all six?
9. **Ragamalika unknown segments** (11): store as `unknown: true` segments with "raga not identified" shown, or skip the segment list until the 11 are settled by a musician? STATE.md already decides "import with raga as unknown"; confirm the page shows it.
10. **Ragamalika order of the weak ones** (A.4, A.5, A.6, A.8, A.9, A.16): import with `confidence` flag only, or hold those 6 until a musician checks? And drop the A.9 `performed_like`.
11. **Composer conflicts** (heading vs bookmark, e.g. PDF 310 "rāma rāma"): heading wins, record the conflict in `note`, per STATE.md. Confirm.
12. **Vol 5 `compositions_mentioned`**: skip as records?
13. **Auto-create composers**: allowed for the 40-name tail via the review CSV, or only the five major composers and the rest to review?

## Files referred to

- `/Users/tejovanthn/codes/rasika-books/extractions/ssp-2008-english-vol-{1..4}/run-2026-10-27-055202/entities/{compositions,relationships}.jsonl`, `sections/`, `skeleton.json`, `page-text-dump.json`
- `/Users/tejovanthn/codes/rasika-books/STATE.md`
- `/Users/tejovanthn/codes/rasikalife/packages/core/src/domain/composition/{schema,entity,source-import,match,carnatic-circle}.ts`
- `/Users/tejovanthn/codes/rasikalife/packages/core/src/domain/composition_raga/entity.ts`
- `/Users/tejovanthn/codes/rasikalife/packages/core/src/domain/concert-log-item/composition-types.ts`
- `/Users/tejovanthn/codes/rasikalife/packages/core/src/utils/transliteration.ts`
- `/Users/tejovanthn/codes/rasikalife/packages/core/src/domain/source/schema.ts`, `raga/schema.ts` (`citations`)
- `/Users/tejovanthn/codes/rasikalife/packages/scripts/src/sources/{carnatic-circle,index,types}.ts`
- `/Users/tejovanthn/codes/rasikalife/data/sources/shivkumar/prod-composition.csv`
