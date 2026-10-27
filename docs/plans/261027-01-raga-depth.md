# Raga depth: how a raga moves, with a source for every claim

Status: plan, nothing built. Written 2026-10-27.

## Why

Sonicveda's Ri (`ri.sonicveda.com/raga/bhairavi`) shows what a raga page can be. Its Bhairavi
page says how the raga moves: two key phrases you can play, the jiva and nyasa swaras, the
borrowed note, how it goes up and how it comes down, and the one composition people learn it
from. Each claim has a footnote that names the book and the page.

Our Bhairavi page has the scale, the parent, the mela, a description and six compositions. All
of it is correct, but it stops where the interesting part starts.

## What we have, and what they have

Prod export, 2026-10-27, 1,459 ragas:

| Field | Filled |
|---|---|
| arohanam / avarohanam | 1,278 |
| description | 1,176 |
| melaNumber | 1,198 |
| parentRaga | 1,123 |
| rasa | 90 |
| timeOfDay | 95 |
| alternateScales | 56 |
| season | 11 |
| **a source for any of it** | **0** |

Ri has 201 ragas, and 108 of them match one of ours by name. Its depth is narrow:

| Ri property | Ragas |
|---|---|
| arohanam / avarohanam | 125 |
| bhava (feeling) | 168 |
| time | 138 |
| signature phrase (prose) | 21 |
| prayogas (phrases in swaras) | 18 |
| jiva swaras | 14 |
| ascent / descent prose | 8 / 7 |
| ornaments | 3 |

So the page that looks so good exists for about 20 ragas. The target is that depth for the
ragas people actually reach, and a source on every field for all 1,459.

## Rule: we read their sources, never their data

Ri ships its whole graph in its JavaScript bundle. It is readable, but it is their work. Their
selection, their paraphrase and their notes on each source are what make the site. Copying it
would be stepping on their toes, and it would also break our own rule that nothing reaches the
database unless a person or our validator has checked it against the source.

So we use Ri as a **reading list**. Its bibliography tells us which books cover which ragas.
We go to those books ourselves, extract the facts again, and cite the book, not Ri. A fact such
as "Bhairavi's jiva swaras are R2 G2 M1 N2, SSP vol. I p. 389" belongs to nobody. The sentence
somebody wrote about it does belong to them.

Do not put any Ri `note` or `value` text into a research packet. Workers get the source, not
Ri's reading of it.

### The sources, by what we may do with them

From Ri's bibliography (112 sources). The use count is how many Ri claims cite each source.

| Source | Ri uses | Licence | Our use |
|---|---|---|---|
| **Sangita Sampradaya Pradarshini** (Subbarama Dikshitar, 1904), `ibiblio.org/guruguha/ssp.htm` | 189 | 1904 original: public domain. English edition © 2008, non-commercial terms | **The main source.** It covers every raga in the Dikshitar school, with lakshana, jiva, nyasa, graha and examples. Extract facts and cite page numbers. Do not reproduce the translators' prose. See open question 1. |
| **karnatik.com raga pages** | 218 | no licence stated | Already our source for lyrics and scales. Scale facts only. |
| **Raga Nidhi** (B. Subba Rao, Music Academy, 4 vols.), scans on archive.org | 108 | in copyright | Facts and citations only. It is good for "major raga, used for alapana", for bhashanga, and for a list of compositions per raga. |
| **Raga Pravaham** (Dhandapani & Pattammal, 2007), PDF posted by the family | 107 | in copyright | Scale cross-check only. It is the widest index of janya scales. |
| Wikipedia, "List of Janya ragas" and raga articles | 89+ | CC BY-SA | Facts only. It is the weakest source, so use it only to cross-check. |
| Charulatha Mani, "A Raga's Journey" (The Hindu, 2011–13) | about 25 columns | © The Hindu | Each column names a raga's key phrase in swaras. Cite the phrase. Never quote the prose. |
| Sambamoorthy, *South Indian Music* III and V | 17 | in copyright (d. 1973) | Rasa and theme tables. One author's reading, so attribute it. |
| Ishwar et al., ISMIR 2013; Krishna & Ishwar 2012 | 15 | academic | Motif phrases for about 8 ragas. Good evidence for prayogas. |
| shivkumar.org notations | 9+ | — | **Already in our database** as `notation` on about 420 compositions. Phrases can come from there. |
| S. Rajam, R. Vedavalli (Sruti) | 11 | © Sruti, partly paywalled | Cite only. |

What we hold that Ri does not: the `notation` text from Shivkumar's lessons, 1,459 ragas against
201, logged concert performances, and the event corpus.

## Data model

### `Source`: a bibliography, new domain

Today a composition's `sources` is a list of URLs, and that works because a URL describes
itself. A book page does not. "SSP vol. I p. 389" needs a record for the book plus a locator.

```
source
  id            KSUID, prefix src_
  slug          'ssp-1904', 'raga-nidhi', so packets and CSVs can name it
  title, citation, url?, year?
  licence       free text, shown on the references page
  kind          'book' | 'article' | 'web' | 'paper'
```

There is no index beyond the primary key and a list index. There are about 30 sources and they
are all read at once.

### Raga fields, each one able to carry a citation

New attributes on `raga`, all optional, with no backfill:

| Field | Type | Example (Bhairavi) |
|---|---|---|
| `prayogas` | `{ notation, label? }[]` | `P G2 R2 S N2. R2 S N2. D1. P` |
| `jivaSwaras` | swara tokens | `R2 G2 M1 N2` |
| `nyasaSwaras` | swara tokens | `R2 G2 M1 N2` |
| `grahaSwaras` | swara tokens | `D1` |
| `anyaSwaras` | swara tokens | `D2` (also derivable, see below) |
| `scaleType` | `sampurna \| shadava \| audava \| vakra \| ...` | `sampurna` |
| `isBhashanga` | boolean | true |
| `movement` | short prose | "Going up it moves between Ga and Ri (S G R G)…" |
| `keyCompositionIds` | composition ids | the varnam `viriboni` |
| `citations` | `{ field, sourceId, locator?, note?, tradition? }[]` | `{ field: 'jivaSwaras', sourceId: 'ssp-1904', locator: 'vol. I p. 389' }` |

`citations` is a list on the raga, not a junction. Nothing needs "every raga citing SSP" quickly.
The research report can scan for it. Rule 9 does not apply, because nothing indexes it.

`tradition` on a citation records *whose* reading this is (for example "Dikshitar school"). It
matters most for `timeOfDay` and `rasa`, where schools disagree. Ri says Bhairavi is evening, per
SSP. We say "universal" and give no source. A page that says whose claim it is can show both
claims.

Write rules, following what the codebase already learned:

- A list field is replaced whole. Any form that edits `prayogas` or `citations` merges onto the
  stored rows, as the artist edit route does.
- Clearing a field uses `.remove()` (rule 8).
- Removing a field's value removes its citations too. A citation for a blank field is a claim
  about nothing.

### Derived, not researched

These come from data we already hold, so no worker is spent on them, the same way the 72 mela
scales are computed:

- **`anyaSwaras`**: `foreignNotes(scale, melaNumber)` already exists. It reports and does not
  decide, so the derived value goes to review before it is stored, as a proposal.
- **Relatives**: ragas whose arohanam and avarohanam differ by one or two swaras. Compute this
  on read from the search index. Ri's "comes down like Shankarabharanam, uses Ga₃…" is exactly
  this.
- **Closest Hindustani thaat and Western mode**: a fixed table over pitch classes, and only for
  a scale with seven distinct notes. Label it "closest" and never say "the same raga". Carnatic
  and Hindustani Bhairavi are different ragas, and our description already says so.
- **Composition order**: rank by `performanceCount`, then by how many sources the composition
  has, then by lyrics present. This replaces "the six the index lists first", which today puts
  six Annamacharya songs on Bhairavi.

## Validation (`core/src/admin/research.ts`)

- **Phrase notation.** `validateSwaras` accepts only bare scale tokens, so a phrase needs a
  wider grammar: a lower-octave dot (`N2.`), an upper-octave mark (`S'`), a karvai (`G2:2` or
  `,`), and a phrase may start on any note, so no `S` is required. Write it as
  `validatePhrase`, keep it apart from `validateSwaras`, and **never** run either through
  `fromItrans`.
- **Swara-set fields** may hold only tokens from the raga's own scale, or from its `anyaSwaras`.
  A jiva swara outside the raga is a wrong row, not an interesting fact.
- **Every researched value needs a citation, or it is refused.** This is the main rule and the
  one that makes the result trustworthy. A citation names a `source` slug that exists, and a
  locator (page, section or URL).
- **`movement` and bhava prose** go through `checkProse`. `PUFFERY` refuses "majestic". That is
  correct: Ri's "prayerful and majestic" is a quotation, and a quotation is the source's voice,
  not ours. Mood words that a named source states go into `rasa` with `tradition` set on the
  citation. Our own sentences stay plain.
- `keyCompositionIds` must resolve to compositions in this raga. A name that matches nothing
  waits for a person, as in `source-match`.

## Research, through the existing pipeline

`research-batches --domain raga` → worker → `research-ingest`, as in
`docs/research/raga-enrichment.md`. The changes:

1. Add the new fields to `RESEARCH_FIELDS.raga`, and add the `citations` contract to the packet.
2. Each packet carries the **source list** with slugs and URLs, and one instruction: read the
   source, cite the page, and return no value that has no page.
3. Order: the 72 melakartas, then the busiest janyas by composition count (667 ragas carry a
   composition, and the top 100 cover most traffic), then stop and measure. Ragas outside the
   top 150 get citations for their existing scale and nothing more.
4. **SSP first, as its own pass.** One source, consistent terms (jiva, nyasa, graha) and about
   400 ragas. Other sources add phrases and composition picks.
5. Backfill citations for the **scales we already store**. Most came from karnatik.com, and the
   `source` record says so honestly. A scale that no source confirms is listed for review, not
   removed.

Prayogas from our own data: about 420 compositions hold Shivkumar's notation. A pass can propose
recurring phrases from those notations per raga. A person must confirm each one, because a
phrase repeated in one varnam is not always the raga's phrase.

## The page

Order of sections, in our existing layout (DESIGN.md, the tokens in `globals.css`):

1. **Header**: name, "janya of Natabhairavi · mela 20", bhashanga badge. Footnote markers on
   every fact that has a citation.
2. **Scale**: the arohanam and avarohanam we show now, plus a **12-position swara strip** that
   marks the notes the raga uses, with the borrowed note marked apart. Pure SVG, server
   rendered.
3. **How it moves**: prayogas as swara lines, then jiva, nyasa and graha as marked swaras, then
   `movement`. This section renders only when there is data, never as empty headings.
4. **Learn it from**: `keyCompositionIds` first, then the ranked list.
5. **Relatives**: computed, as above.
6. **Character**: rasa and time, each with whose reading it is ("evening, in the Dikshitar
   school").
7. **References**: numbered, generated from `citations` and `source`. A footnote links here.

Leave out from Ri: the email gate ("Explore more ragas"), the "What if?" note changer (a toy, and
not what a searcher came for) and the raw-graph panel.

### Sound, as a later phase

Ri's "Hear it" plays bare notes. Talapettige already has a tanpura worklet (`useFaustDSP`) and
could play a scale or a prayoga over a drone. But a Carnatic phrase without gamaka is not the
phrase. Ri says so too ("the ornaments are described, not yet played"). Ship it only with a label
that says so, and only after the text sections. It is client-only and must not affect SSR or
the cached page.

### SEO and the thin rule

- `isThinRaga` must count `prayogas`, `movement` and `citations` as content, so a page that
  gains them leaves `noindex` on the next reindex.
- `ragaMetaDescription` may name "characteristic phrases" only when `prayogas` is stored. Same
  rule as everywhere: name what is on the page.
- The JSON-LD `DefinedTerm` gains no new claims. A `citation` property is possible later.

## Phases

| # | What | Size |
|---|---|---|
| 1 | Rank the composition list (no new data) and add computed relatives | small, ship alone |
| 2 | `source` domain, `citations` on raga, citation backfill for stored scales | medium |
| 3 | New raga fields and validators (`validatePhrase`, swara-set checks); admin CSV columns | medium |
| 4 | Page sections 2–7, rendered from whatever is filled | medium |
| 5 | SSP research pass over the 72 + top 100, then other sources for prayogas | research budget |
| 6 | Propose prayogas from Shivkumar notation | small, needs review time |
| 7 | Sound | later, optional |

Phases 1 and 2 are each useful alone. Phase 4 can ship before phase 5 finishes, because every
section renders only when it holds data.

## Open questions for the owner

1. **The SSP English edition is under non-commercial terms.** Rasika.life takes donations and
   has no ads. Citing facts with page numbers is safe whatever the answer is. Quoting the
   translation is not. Should we also ask the translators (P. P. Narayanaswami, Vidya Jayaraman)
   for permission?
2. **Contact Sonicveda?** We take nothing of theirs, but our pages will look alike in depth. A
   short note to Kurinji Studios is a courtesy. It could also lead to linking to each other: they
   have 201 deep ragas, we have 1,459 ragas plus the concert data.
3. **Which school is the default** for jiva and nyasa when sources disagree? The plan says show
   both and name each. That needs a person to approve it, because it makes the page longer.
