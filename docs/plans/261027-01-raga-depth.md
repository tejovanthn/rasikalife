# Raga depth: how a raga moves, with a source for every claim

Status: plan, nothing built. Written 2026-10-27, revised the same day after the owner's review.

## Why

Sonicveda's Ri (`ri.sonicveda.com/raga/bhairavi`) shows what a raga page can be. Its Bhairavi
page says how the raga moves: two key phrases you can play, the jiva and nyasa swaras, the
borrowed note, how it goes up and how it comes down, and the one composition people learn it
from. Each claim has a footnote that names the book and the page.

Our Bhairavi page has the scale, the parent, the mela, a description and six compositions, and
it stops where the interesting part starts. It also shows "Time of day: Universal", which no
source supports. SSP says evening.

The owner told Sonicveda (on the reel where the site was found) that Rasika.life is building a
similar knowledge base, on 2026-10-27.

## What we have, and what they have

Prod export, 2026-10-27, 1,459 ragas:

| Field | Filled | Source recorded |
|---|---|---|
| arohanam / avarohanam | 1,278 | none |
| description | 1,176 | none (see below) |
| melaNumber | 1,198 | derived, needs none |
| parentRaga | 1,123 | none |
| rasa | 90 | none |
| timeOfDay | 95 | none |
| alternateScales | 56 | none |
| season | 11 | none |

The research workers that wrote most of these returned a `sources` list for every record, and
`research-ingest` threw it away (`ResearchRecord.sources` is read and never written). The batch
results were not kept, so those sources cannot be recovered. **`research-ingest` must keep
sources from now on**, whatever else this plan does.

Ri has 201 ragas, and 108 of them match one of ours by name. Its depth is narrow. Prayogas cover
18 ragas, jiva swaras 14, a signature phrase 21. So its best page exists for about 20 ragas.

## Rule 1: show only what is sourced

A raga fact renders on the page only when it has a citation. No citation means it does not
render. This applies to the reader-facing page, the meta description and the JSON-LD alike,
since all three make the same claim.

Effect today:

- `rasa` (90), `timeOfDay` (95) and `season` (11) disappear at once. Bhairavi's "Universal" goes.
  They come back with the source and the school named ("evening, in the Dikshitar school").
- `melaNumber` is derived from the parent and needs no citation, the same as now.
- `arohanam`, `avarohanam` and `description` are the open question below, because hiding them
  would empty 1,200 pages that rank.

## Rule 2: we read their sources, never their data

Ri ships its whole graph in its JavaScript bundle. It is readable, but it is their work: the
selection, the paraphrase and the notes on each source. We use Ri as a **reading list**. Its
bibliography tells us which books cover which ragas. We go to those books, extract the facts
again, and cite the book, not Ri. No Ri `value` or `note` text goes into a packet or a CSV.

The same rule applies to translations. **We write our own English from the original.** We never
reword a translator's English, because a reworded translation is still built from their work.

## Sources

### Sangita Sampradaya Pradarshini (SSP) is the main source

Subbarama Dikshitar, 1904. For every raga in the Dikshitar school it gives Venkatamakhi's sloka,
the murcchana, then Subbarama Dikshitar's lakshana: graha, jiva and nyasa swaras, phrases with
gamaka marks, which notes take which gamakas, where the borrowed note goes, the time to sing it,
and which compositions show the raga. After that come the gitam, the kritis and the sancari in
full notation. Ri cites it 189 times.

Three editions are in hand:

| Edition | Where | Use |
|---|---|---|
| **1963 Tamil edition** (Music Academy), scan | archive.org `sspradarshini1963…dikshitar`, 280 leaves; covers at least mela 20 (Bhairavi lakshana on pp. 375–377 = leaves 147–149) | **Read this.** No usable text layer (it was OCR'd as English), so each page is read as an image. Tested on Bhairavi: the Tamil and the swara notation are clear. |
| **2008 English edition** (P. P. Narayanaswami, Vidya Jayaraman et al.) | ibiblio.org/guruguha, and the copy the owner found, `~/Downloads/SANGITA SAMPRADAYA PRADARSHINI_VOL 1.pdf` (vol. I, melas 1–24, 664 pp., with a text layer) | **Cross-check only.** Its notice says educational and personal use, not commercial. We use it to confirm a fact we read in the Tamil, and we never copy or reword its text. |
| 1904 Telugu original | not in hand | public domain; the facts in both editions come from it |

The 1963 Tamil edition is still likely in copyright, whatever the archive.org upload says (it
is tagged CC0 by the uploader, which proves nothing). That does not matter for us: we take
facts (which swaras, which phrases, which time) and the swara phrases of the 1904 text, and we
write every sentence ourselves.

#### Run it through rasika-books

`~/codes/rasika-books` already does this job for other books. It extracts facts page by page,
keeps `{book_id, page, confidence}` on every fact, records the book's bibliography and copyright
status (`book-plan.json`), and never takes prose. SSP runs there as a new book. The owner runs
`/book-extract`. That repo's agents need three things for this book:

1. **Vision per page.** The manifest must mark every page `image`, because the text layer is
   noise.
2. **A raga-lakshana schema** beside its generic entities. Per raga: sloka summary (sampurna,
   time), murcchana, `scaleType`, graha, jiva, nyasa, prayogas, gamaka notes, `anyaSwara`
   phrases, and the compositions it names as the way to learn the raga. The notation pages
   that follow (gitam, kriti, sancari) are skipped in this pass, which removes most of the
   book.
3. **A notation table** from SSP's Tamil swaras to ours. ஸ ரி க ம ப த நி → S R G M P D N. A dot
   below means the lower octave, a dot above the upper. The variant comes from the mela (SSP
   names variants by Venkatamakhi's terms: "panchashruti dhaivata" is D2, "kaisiki nishada" is
   N2). Gamaka marks (`x`, `w`, `~`, `/`, `\`) are kept as a separate, raw string for now and are
   not shown.

The English edition (which has a text layer) is the check for each extracted raga. A fact that
the two editions disagree on goes to review.

### Other sources (from Ri's bibliography, 112 entries)

| Source | Ri uses | Licence | Our use |
|---|---|---|---|
| karnatik.com raga pages | 218 | none stated | Already our source for lyrics and many scales. Scale facts only. |
| Raga Nidhi (B. Subba Rao, Music Academy, 4 vols.), archive.org | 108 | in copyright | Facts and citations: "major raga", bhashanga, compositions per raga. A good second book for rasika-books. |
| Raga Pravaham (Dhandapani & Pattammal, 2007), PDF from the family | 107 | in copyright | Scale cross-check. The widest index of janya scales. |
| Wikipedia raga lists and articles | 89+ | CC BY-SA | Cross-check only. |
| Charulatha Mani, "A Raga's Journey" (The Hindu, 2011–13) | about 25 columns | © The Hindu | Each column names a key phrase in swaras. Cite the phrase, never the prose. |
| Sambamoorthy, *South Indian Music* III and V | 17 | in copyright | Rasa tables. One author's reading, so the citation names him. |
| Ishwar et al. ISMIR 2013, Krishna & Ishwar 2012 | 15 | academic | Motif phrases for about 8 ragas. |
| shivkumar.org notations | 9+ | — | Already in our database as `notation` on about 420 compositions. |

## Data model

### `source`: new domain in core, shaped to take rasika-books output

Core has no source domain yet. A composition's `sources` is a list of URLs, which works only
because a URL describes itself. A book page does not.

```
source
  id            KSUID, prefix src_
  slug          = rasika-books book_id ('ssp-1963-tamil', 'ssp-2008-english', 'raga-nidhi')
  title, citation, url?, year?, language
  licence       from book-plan copyright_status, shown on the references list
  kind          'book' | 'article' | 'web' | 'paper'
```

Primary key only, plus a list index. About 30 records, read all at once.

### Citations on raga

```
citations: { field, sourceId, locator, confidence?, tradition?, note? }[]
```

`locator` is the page ("pp. 375–376") or a URL. `confidence` comes straight from rasika-books.
`tradition` says whose reading it is ("Dikshitar school"). This matters most for `timeOfDay` and
`rasa`, where schools differ, and for the scale itself: SSP writes Bhairavi's murcchana with
shuddha dhaivata both ways and allows D2 only in named phrases (see the appendix), which is not
the modern arohanam. The page can show both and name each.

It is a list on the raga, not a junction, because nothing queries "every raga citing SSP" on a
request path. Nothing indexes it, so rule 9 does not apply. A form that edits it merges onto the
stored rows. Removing a field's value removes that field's citations, because a citation for a
blank field claims nothing.

### New raga fields

All optional, no backfill, each rendered only with a citation:

| Field | Type | Bhairavi, from SSP |
|---|---|---|
| `prayogas` | `{ notation, gamaka?, label? }[]` | `P D N2 D N2 S` (one of the D2 phrases) |
| `jivaSwaras` | swara tokens | R G M N (all seven, these most) |
| `nyasaSwaras` | swara tokens | the same |
| `grahaSwaras` | swara tokens | D |
| `anyaSwaras` | swara tokens | D2 |
| `scaleType` | `sampurna \| shadava \| audava \| vakra …` | sampurna |
| `isBhashanga` | boolean | true |
| `movement` | short prose, ours | see the appendix |
| `keyCompositionIds` | composition ids | `viriboni` (Adiyappayya's varnam) |

## Derived, not researched

From data we already hold, so no extraction is spent on them:

- **Relatives**: ragas whose arohanam and avarohanam differ by one or two swaras, computed on
  read from the search index. Their own pages carry the citations.
- **Closest Hindustani thaat and Western mode**: a fixed table over pitch classes, only for a
  seven-note scale, labelled "closest". Shown only once the scale it is computed from has a
  citation.
- **`anyaSwaras` proposals**: `foreignNotes(scale, melaNumber)` exists. It proposes; a source
  confirms.

## Ranking by search volume

There is no raga–concert link yet, so performances cannot rank anything. Search volume can.

**Compositions inside a raga page.** A new `searchVolume` and `searchVolumeCheckedAt` on
composition, filled by `pnpm cli composition-search-volume`:

- Keyword Planner volume (India) for each title, queried in **several romanisations**, keeping
  the highest. Spelling decides the number. On 2026-10-27, "viriboni varnam" gave 210 a month,
  "koluvaiyunnade" 170, "ammamma emamma" 90 and "upacharamu jesevaru" 10. "Chintaya ma" gave 0,
  because people search "chintayama". The variants: the `roman` rendering of the title, the URL
  slug, the title with spaces removed, the title with `aa/ee/oo` folded, and the title plus
  "varnam" or "kriti" by type.
- Search Console impressions on our own composition page break ties and cover titles Keyword
  Planner rounds to zero.
- Refreshed monthly. Volumes move slowly, and Keyword Planner rounds into bands anyway.
- `composition.byRaga` sorts by it, with lyrics present as the next key. A raga has at most a
  few hundred compositions, so the loader reads all of them and sorts in memory, and the page
  is cached for a week.
- `keyCompositionIds` (sourced: "SSP says learn it from Viriboni") still goes first.

**Ragas for research order.** The same command over "<name> raga", using the `roman` name and its
common spellings. On 2026-10-27, "bhairavi raga" gave 12,100 a month (this includes the
Hindustani raga and film songs), "kalyani raga" 1,600, "sankarabharanam raga" 1,600 and "todi
raga" 390. That replaces "composition count" as the order in `raga-enrichment.md`. Also store it
on the raga, because the raga index can use it for "popular".

## Validation (`core/src/admin/research.ts` and the rasika-books import)

- **`validatePhrase`**, apart from `validateSwaras`: lower-octave dot (`N2.`), upper-octave mark
  (`S'`), karvai (`G2:2`, `,`), any starting note, no `S` required. Never through `fromItrans`.
- **Swara sets** may hold only tokens of the raga's scale or its `anyaSwaras`.
- **No value without a citation**, and the citation's `sourceId` must exist. This is the rule the
  rest of the plan depends on.
- **Prose** (`movement`) goes through `checkProse`. `PUFFERY` refuses "majestic", which is
  correct: a mood word that a source states goes into `rasa` with the source named, and our own
  sentences stay plain.
- `keyCompositionIds` must resolve to a composition in this raga. A name that matches nothing
  waits for a person.
- **`research-ingest` keeps `sources`.** Write them as citations with `locator` = the URL.

## The page

Order, in our existing layout (DESIGN.md, tokens in `globals.css`). Each section renders only
when it holds cited data:

1. **Header**: name, "janya of Natabhairavi · mela 20", bhashanga badge, footnote markers.
2. **Scale**: arohanam and avarohanam, plus a 12-position swara strip (server-rendered SVG) with
   the borrowed note marked. Where SSP's murcchana differs from the modern scale, both, named.
3. **How it moves**: prayogas as swara lines, then jiva, nyasa and graha as marked swaras, then
   `movement`.
4. **Learn it from**: `keyCompositionIds`, then compositions by search volume.
5. **Relatives**.
6. **Character**: rasa and time, each with whose reading it is.
7. **References**: numbered, from `citations` and `source`.

Leave out from Ri: the email gate, the "What if?" note changer and the raw-graph panel.

Sound is a later, optional phase. Talapettige's tanpura worklet (`useFaustDSP`) could play a
scale or a prayoga over a drone, labelled "notes only, without gamaka", client-only, never part
of the SSR or the cached page.

SEO: `isThinRaga` counts `prayogas`, `movement` and `citations` as content.
`ragaMetaDescription` names "characteristic phrases" only when `prayogas` is stored and cited.
JSON-LD drops any field that is not cited, by the same rule as the page.

## Phases

| # | What | Notes |
|---|---|---|
| 1 | Search volume on compositions, sorted raga composition lists, relatives on the page | ships alone |
| 2 | `source` domain, `citations`, the show-only-sourced rule, `research-ingest` keeps sources | hides rasa/time/season at once |
| 3 | SSP through rasika-books (owner runs it), then import as fields plus citations | the main data |
| 4 | New raga fields and validators, admin CSV columns | before the import in phase 3 lands |
| 5 | Page sections 2–7 | can ship before phase 3 finishes |
| 6 | Search volume on ragas, then Raga Nidhi and other sources, busiest first | |
| 7 | Prayogas proposed from Shivkumar notation | **deferred by the owner** |
| 8 | Sound | later, optional |

## Open question

**Unsourced scales and descriptions.** Rule 1 hides any fact without a citation, and 1,278
scales and 1,176 descriptions have none, because ingest dropped them. Recommendation: hide
rasa, time and season now (206 values, little traffic). Keep scales and descriptions visible
until the citation backfill in phase 2 checks each one against SSP, karnatik.com or Raga
Pravaham and cites the one that agrees. Hide whatever no source confirms. The owner decides.

## Appendix: Bhairavi from SSP, as the worked example

Read from the 1963 Tamil edition, pp. 375–377 (mela 20, janya 1, bhashanga). Our own English, as
facts. This is the shape one extracted raga should take.

- **Sloka (Venkatamakhi):** sampurna. Sung in the evening. Panchashruti dhaivata (D2) is used
  in some places.
- **Murcchana:** S R G M P D N S / S N D P M G R S, with shuddha dhaivata (D1) both ways.
- **Lakshana (Subbarama Dikshitar):** bhashanga, sampurna, dhaivata graha, suitable for the
  evening.
- **Jiva and nyasa:** all seven swaras, and R, G, M and N most of all.
- **Jiva-swara sancaras:** four groups of phrases in notation, p. 375, for example
  `S/G R/M G` and `N S R G M P`.
- **Gamakas:** in the ascent, an upward slide (jaru) from each swara, nokku in swara groups, and
  sphurita on doubled swaras. In the descent, a downward slide, odukkal, and pratyahata on
  doubled swaras. All are used as the context needs (pp. 375–376).
- **Shades of other swaras:** holding R from S gives a shade of shuddha rishabha, holding M from
  G a shade of antara gandhara, P from M prati madhyama, N from D shuddha nishada, S from N
  kakali nishada. So all twelve positions and all gamakas are heard, and the elders call it a
  great raga (p. 376).
- **Anya swara rule:** a borrowed swara reached from below must not be held (p. 376).
- **Learn it from:** Adiyappayya's varnam "Viriboni", and Muthuswami Dikshitar's kritis as
  played on the veena in that lineage (p. 376).
- **D2 phrases:** `P D N D N S`, `N D N S`, `N S D N S`. Everywhere else the dhaivata is shuddha
  (p. 376).
- **Gitam phrases (Venkatamakhi's lakshya gitam):** `S G G M`, `N S G G M P M G R`,
  `N D N P P N N S`, `P M N D N S`, `P N D N S` (p. 377).
- **History:** the seventh of the 19 older melas, and the 20th mela's bhashanga janya in
  Venkatamakhi's 72, so the gitam is older than Venkatamakhi (p. 377).

The octave of each note in these phrases still has to be checked against the dots in the scan.
The phrases above are written without octave marks.
