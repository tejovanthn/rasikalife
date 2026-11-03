# Importing Sangita Sampradaya Pradarshini (SSP) from rasika-books

Status: gap analysis only, 2026-11-03. Nothing is built. This is phase 3 of
`261027-01-raga-depth.md`, extended to compositions and people.

Detail, field by field: `docs/research/ssp-import-gap-2026-11/` (`gap-ragas.md`,
`gap-compositions.md`, `gap-people.md`). The three reports were written by Sonnet agents and checked
against the code. Their scratch scripts are gone. Rerun them from the reports if you need them.

## What rasika-books holds

Runs: `~/codes/rasika-books/extractions/ssp-2008-english-vol-{1..5}/run-2026-10-27-055202/`.

| Data | Count | Notes |
|---|---|---|
| Ragas (Vols 1–3) | 191 | śloka, murcchana, lakṣaṇa: graha, jiva, nyasa, prayogas, anya swaras, time |
| Compositions (Vols 1–4) | 820 | 393 have only a form as a title (187 sañcāri, 164 gīta, 40 tāna). 427 have a real title. Metadata only. **No notation was extracted.** |
| Ragamalikas (Vol 4) | 17 | 325 segments, 11 with an unknown raga |
| People (Vols 1–5) | 368 rows, about 300 people | 78 composers. 8 have a full date. About 40 Vol 5 rows are not musicians |
| Vol 5 other entities | treatises, venues, awards, regions… | none needs a domain of its own |
| Review items | 387 phrases with no octave marks, 56 uncertain variants, 59 conflicts between the text and the image, 85 low-confidence skips | |

`data/ssp-name-matches.csv` maps names inside SSP (mudras, spellings) to SSP's own ragas. **It is not a
match to rasika.life.** We must build that match.

## The decision that blocks everything: which edition do we cite

The extraction read the **2008 English edition**. Its licence allows educational and personal use only,
and forbids copying or rewording the text. The raga-depth plan and the Bhairavi example cite the
**1963 Tamil edition**, and the `sources-2026-10.csv` row calls the English edition "cross-check only".

Facts and the 1904 swara phrases are not the translators' work. Their English is. So, whatever the
choice:

- Import structured facts and swara phrases only. Never import `other_facts` (639),
  `historical_notes`, `editor_notes`, `anya_swaras[].rules`, `gamaka_rules`, or `verbatim_quote`.
  These are English sentences from the translators.
- `movement` is either our own template over the structured fields or empty.
- The locator is the **printed** page, not the PDF page.

Options: (a) cite `ssp-2008-english` with the printed page, and change its licence line to "facts and
swara phrases only". (b) Re-read the Tamil edition for every raga before import. That repeats the
whole extraction. Recommendation: (a).

## Rules every import follows

- **Never auto-create** a raga, composition or artist. Each import writes a review CSV, a person
  marks `decision`, and only then does an apply run. This is the `source-*` shape: match, CSV, apply
  with a manifest, undo.
- **A fact from SSP carries a citation.** Ragas have `citations`. Compositions and artists need the
  same list (`CitationSchema` from `raga/sourced.ts`).
- **Hold** `variant_uncertain` (56, until the musicians answer) and `text_vs_image_conflict` (59).
  Show phrases marked `octave_unmarked` with no octave marks, as already decided.
- **SSP never overwrites a stored scale.** The murcchana agrees with our arohanam in only 24 of 170
  matched ragas. It is a second reading, shown with SSP's name on it.

## What to build, in order

Sizes: S under half a day, M about a day, L two or three days.

### Phase A: ragas (the main value; about 1.5 weeks)

1. `domain/raga/ssp.ts`, pure and tested: the time-of-day table, jiva/nyasa choice (`most_ranjaka`,
   else `all`; the rest goes into the citation note), phrase and murcchana cleaning, `scaleType`,
   `citationsFor`, the hold gates. **L**
2. `domain/raga/ssp-match.ts`: exact, variant and mela-number tiers, with conflict flags. A first run
   against prod gave 119 exact, 52 variant and 20 no match. 22 matched janyas have a different mela
   number in prod. `kannaḍa` must not match `kAnaDA`. Needs a reviewed table of the 72 mela names. **M**
3. Schema: `scaleReadings` (a scale with its own source and label) instead of `alternateScales`, which
   is an unlabelled `string[]`; `slokas` (verse, author, source); raise the `prayogas` cap from 20,
   because 14 ragas hold 21–42. Admin CSV columns, `thin.ts`. **M**
4. CLI `ssp-match`, `ssp-csv`, `ssp-apply` (merges citations onto stored rows, writes a manifest),
   `ssp-undo`. Plain `admin-csv-import` replaces `citations` whole and cannot undo, so it is not
   enough. **L**
5. Raga page: "Also written as" for `scaleReadings`, the śloka with its author, a second time-of-day
   reading where the śloka and Subbarama Dikshitar's notes disagree (22 ragas). Only cited fields
   go into JSON-LD. **M**
6. `learn_from` → `keyCompositionIds`. 46 of 51 entries point at SSP's own gītas and sañcāris, so
   only a few resolve. Do it last. **M**
7. Run: the 72 melas first, then janyas by search volume. Dry run, read the refusals, apply,
   reindex.

### Phase B: people, cut down (about 1 week; before compositions, because composer links need them)

1. Matcher `domain/artist/ssp-match.ts` built on `foldKey`/`composerAgrees`. `findArtistMatch`
   needs the surname to match exactly, so "Dīkṣita" never finds "Dikshitar". Writes a review CSV only. **M**
2. Merge the junk "Dikshitar" record (5 compositions) into "Muttuswaamee Dikshitar" (518) first, or
   every Dīkṣita matches it. Create Subbarama Dikshitar and Venkatamakhi by hand: they hold most of
   the composer links and do not exist. **S**
3. `YearSchema` refuses years before 1800, and Muttuswami (1775), Syama Sastri (1763) and Ramaswami
   (1735) fall before that. Add a historical year schema for `birthYear` and a new `deathYear` only,
   plus `deathPlace` and an `isHistorical` flag that only the importer sets. Research still refuses
   `birthYear`. **M**
4. `alternateNames` and `mudra` in the schema and CSV; `spiritual` in `GURU_RELATIONSHIPS`;
   `published-source` in `CLAIM_SOURCES`; `artist.citations`. **M**
5. Profile: born and died, mudra, sources. When `isHistorical` is set, show no claim button, no
   media kit and no "upcoming concerts" line. JSON-LD gets `deathDate`. **M**
6. Importer `ssp-people-match` / `ssp-people-apply`, with a manifest. **L**

Drop: awards, venues, organisers, dynasties, concepts, caste and community. Treatises go into the
author's `works`. Family and patron `relations` wait for a later phase.

### Phase C: compositions, metadata only (about 1 week)

Comes in as a new adapter in the existing `source-*` pipeline (`packages/scripts/src/sources/ssp.ts`).

1. Titles: IAST → ITRANS through the existing `isoToItrans` (carnatic-circle). **S**
2. Six new `compositionType` values: gitam, daru, svarajati, ragamalika, prabandham, suladi. **S**
3. `citations` on composition, merged and undone the way `planAttach` handles links. **M**
4. Ordered ragamalika `segments` on the composition, with an `unknown` flag. The `CompositionRaga`
   junction has no order and drops a repeated raga. **M**
5. `lyricist` (about 6 records split credit between tune and words). **S**
6. Tala map for the SSP names (maṭhya, dhruva rūpaka, jāti Eka, cāpu forms). **S**
7. Skip sañcāris and tānas. An old prod export matches 136 of the 427 titled pieces exactly and
   about 117 more closely. Vol 4 is mostly new (7 of 71 exist).

### Later, optional

- Composition notation. It was never extracted, and the text dump loses the columns. Reading it means
  reading page images. That is a week or more, and the licence question is sharper here.
- Family and patron relations, `isThinArtist`, a raga "created by" field, gamakas, history.

## Owner decisions

The three reports list 39 decisions between them. These are the ones that change what gets built:

1. The edition cited (above). Phase B also needs this answer, because the Vol 5 facts came from the
   English text.
2. `scaleReadings` and `slokas` as new raga fields, and the new `prayogas` cap.
3. "All times" from SSP: store it as `universal` (148 ragas), or store only a named time? Does SSP
   overwrite our uncited values (20 differ)?
4. A historical year schema, or years kept as text.
5. Citations on compositions and artists, the same shape as ragas.
6. The six new composition forms. Untitled gītas: skip them, or title them "Lakshana gita – <raga>"?
7. Jāti Eka talas: separate tala records, or folded into Eka?
8. Scope for people: composers and Vol 5 subjects only (about 100–120), not all 300.

The rest are review calls (each match, each weak ragamalika segment) and can be made in the CSVs.
