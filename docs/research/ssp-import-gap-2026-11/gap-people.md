# Gap analysis: SSP people and other entities -> rasika.life

Read-only. No repo file was edited. Profiling scripts are in the scratchpad (p1..p11.py, `python3 -I`).
Data: `~/codes/rasika-books/extractions/ssp-2008-english-vol-{1..5}/run-2026-10-27-055202/`.

## 0. Short answer

- The people data is much thinner than the file counts suggest. About 300 distinct people, not 369. Only 8 people have an absolute birth or death date. Most "dates" are relative ("within the last two hundred years", "Tuḷaja's time").
- rasika.life can take names, gurus, birthplace, instrument and compositions today. It cannot take: any year before 1800 (YearSchema), a death year, family, patrons, a mudra, a source per fact, or the SSP spelling of a name.
- The matcher cannot find our existing records from SSP names (surname must match outright; "Dīkṣita" is not "Dikshitar"). A new SSP-specific match step is the first thing to build. It must only suggest. Never auto-create (CLAUDE.md rule).
- Biggest single risk: the Trinity-level names and the two biggest SSP composers. Subbarāma Dīkṣita (227 composed_by edges in Vols 1-4) and Vēṅkaṭamakhin (209) have no match in our 1,169 artists. They must be created, by a person, before 400+ SSP compositions can link to a composer.

## 1. Profile (python, counts)

### People rows

| Item | Count |
|---|---|
| artists.jsonl rows, Vols 1-5 | 46 + 24 + 17 + 42 + 239 = 368 |
| Distinct people after folding spelling (my fold, not final) | about 300-305 |
| Names in more than one volume (each volume has its own ids, e.g. `vol-1_muttusvami-diksita`, `vol-2_...`) | 26-38 depending on fold |
| Vols 1-4 rows with role composer | 97 of 129 (the rest: `person`, or nothing: Bharata, Mataṅga, etc.) |
| Distinct composers named by `composed_by` in Vols 1-4 | about 78 (about 60-65 after joining spelling variants) |
| ...of these, with a Vol 5 biography | 22 |
| ...of these, no biography anywhere (name only) | 56 |
| composed_by edges taken by three people | Subbarāma Dīkṣita 227, Muttusvāmi Dīkṣita 221, Vēṅkaṭamakhin 209 (of about 780) |

Key finding: Vol 5 spells Muttusvāmi as **Muddusvāmi** Dīkṣita (also "Muddu Vēṅkaṭamakhin" vs "muttu Vēṅkaṭamakhi" in Vol 1). Exact-name joins miss the most important composer. Vēṅkaṭamakhi (Vols 1-4) and Vēṅkaṭamakhin (Vol 5) also differ.

### Vol 5 (239 rows) facts

| Fact | People with it |
|---|---|
| A biography section number (`vc_section`, `section_number`, `biography_section_number`, `vaggeyakara_caritram_*`) | 83 |
| A mudra | 34 |
| Any date key (incl. relative period) | 58 |
| ...of which an absolute year (saka/AD or a printed A.D.) | 8 |
| Birth place or native place or residence | 45 |
| Death place or resting place or death info | 11 |
| Title, office, epithet, honour, degree | 27 |
| A family attribute (father, spouse, child, brother...) | 50 |
| Caste, community, gotra | 51 |
| Instrument | 23 |
| Three or more attribute keys | 123 |
| One attribute key or none | 74 |
| No relationship edge at all | 153 |
| verification_status | all 239 are `pending_self_verification` |

Attribute keys are free text invented by the agents: birth place is `birth_place`, `birthplace`, `native_place`, `native_region`, `family_origin`, `homeland`. Dates come as a string ("śaka 1761 (1839 A.D.)...") or as an object (`{saka, ad, samvatsara, ...}`). The importer needs a fixed key map and a date parser first.

### Not musicians (retype or drop)

| Kind | Count | Examples |
|---|---|---|
| Rulers (role king/ruler/emperor) | 27 | Acyutappa Nāyaka, Raghunātha Nāyaka, Tuḷaja, Śāhāji, Sarabhōji II, Amarasiṃha, the Eṭṭappa rajas |
| Foreign or unnamed rulers | 3 | Edward VII, Queen Victoria, the Navāb who jailed Rāmadāsa |
| Deities, legend, place, institution | 10 | Āñjanēya, Āḻvārs, Kumbhakarṇa, Aśvatara, Śivarāmapuram, the two Śaṅkarācārya maṭha heads |
| Rows with music evidence (mudra, forms, instrument, composer edge) | 97 |

Some rulers are composers or authors and are worth a record (Tuḷaja, Śāhāji, Eṭṭappa, Raghunātha Nāyaka). Most rulers are only patron targets and should not get a page. Rulers with the same name split by section (VC §67/§68/§70/§71, two "Vēṅkaṭēśvara Eṭṭappa") must stay separate, as STATE.md says.

### Possible-same-person review rows

18 rows: Vol 1: 8, Vol 2: 1, Vol 3: 1, Vol 4: 3, Vol 5: 5. Most are spelling variants (Bālasvāmi/Bālusvāmi, Sāraṅgapāṇi/Saāraṅgapāṇi, three Purandaraviṭṭaladāsa spellings, Peddadāsar/Peddadāsari). Four Vol 5 rows are likely different people (Bālayya/Gōpālayya, Ghanam Kṛṣṇayya/Sīnayya, S. Rādhākṛṣṇayya/S. Rāmakṛṣṇayya, the VC §67/§70 and §68/§71 rajas). These two groups need different handling: spelling variants -> one record plus alternateNames; the others stay two records.

### Relationships

Vols 1-4: composed_by ~836, composition_in_raga ~970 (compositions/ragas, not people), janya_of 121, plus disciple_of 2, lyrics_by 3, created_raga 1, ruler_of 1, names_patron 1.
Vol 5 (165): composition_in_raga 40, disciple_of 23, child_of 15, composer_of 10, patron_of 9, composed_by 9, sibling_of 5, composer_used_raga 5, contemporary_of 4, guru_of 2, then about 30 singletons (court_musician_of, minister_of, coined_raga, ...).
Totals for the person-to-person kinds: disciple_of/guru_of/initiated_by about 28 distinct edges; family 27; patron/court 16; 72 Vol 5 edges point at something that is not a person in the artist file; 20 end at "unresolved:".

## 2. Fact-by-fact mapping

Legend: EXISTS = a field takes it now; NEW = needs a field or schema change; DROP.

| SSP fact | rasika.life | Verdict |
|---|---|---|
| Name (IAST: Muttusvāmi Dīkṣita) | `artist.name` is plain Latin, not ITRANS. Stored today as karnatik style: "Muttuswaamee Dikshitar" (518 compositions), "Tyaagaraaja", "Shyaamaa Shaastree". A junk duplicate "Dikshitar" (5 compositions) also exists | EXISTS in entity (`alternateNames`), but NOT in `CreateArtistSchema`, not in the artist CSV columns. NEW: add it to schema + CSV (pipe list). Keep it out of `CLAIMANT_EDITABLE_ARTIST_FIELDS` (schema.ts line 197 warns why) |
| Name variants (name_variants_seen) | `alternateNames` | Same as above |
| Role: composer / vāggēyakāra | Derived. The profile already lists compositions through `composition.byComposer` (route line 116) | EXISTS. No field |
| Instrument (vīṇa) | `artist.instrument`. Note: the weekly `fillArtistInstruments` fills only empty fields and freezes it. SSP-set values are safe | EXISTS |
| Gurus (disciple_of) | `artist.gurus[]` | EXISTS, see section 3 |
| Birth / death year | `birthYear` (YearSchema) | BLOCKED by YearSchema min 1800. No `deathYear` at all. NEW |
| Birth place | `birthPlace` (string) | EXISTS |
| Death place, resting place | none | NEW (`deathPlace`) or drop. Only 11 people. Recommend `deathPlace` with `deathYear` |
| Active years / period | `activeYears` (free string, max 50) | EXISTS and not blocked, since it is text. But `research.ts` line 293 bounds a parsed span by YearSchema; the SSP importer is its own path |
| Relative period ("Tuḷaja's time", "within 200 years") | none | DROP as a field. Keep only in the citation `note` |
| Title (Rao Bahadur, M.A.) | `artist.title` (max 50, honorific) | EXISTS for honorifics. Epithets and sobriquets (ēka santāgrāhi, Inupasanigelu) -> `alternateNames` or drop. Awards entity (8): drop |
| Mudra (guruguha, tyāgarāja...) | none | NEW, small and valuable: `mudra: string`. 34 people. "guruguha" is a likely search. Page can say what the signature is |
| Languages, forms composed, rasa | `specialisations` (free list) | EXISTS but weak. Use `specialisations` for forms ("kīrtana", "varṇa") only if the owner wants; skip language |
| Caste, community, gotra, sutra | none | DROP. Not our domain and a sensitive claim. 51 people. Do not add |
| Family (father, mother, spouse, children, brothers, uncle, grandparent) | none | NEW, see below |
| Patron / court / minister / ruler | `ArtistAffiliation` needs an Organiser (required `organiserId`). A royal court is not an Organiser | NEW as a list, see below. Do not make the court an Organiser |
| Treatises and books an artist wrote (Caturdaṇḍī Prakāśikā, Prācīna Gāna) | `artist.works[]` ("a piece the artist authored"). `year` blocked below 1800, so leave year out | EXISTS. No Treatise domain needed |
| created_raga / coined_raga (1 edge: Rāmasvāmi -> haṃsadhvani) | No raga field for who made it | NEW but tiny. See below |
| composer_used_raga / composer_used_raga_for_form (7) | Derived from composition-raga junctions | DROP |
| compositions_mentioned (60) | Composition needs a composer, can have no lyrics | Link to an existing composition if the title matches; do not create new pages from a mention |
| Anecdotes (`anecdote_facts`, 42) | bio is narrative and derived from fields | DROP for now |

### The year problem (YearSchema)

`packages/core/src/domain/shared/schemas.ts`: `YearSchema = int, min 1800, max 2100`. It is used by artist `birthYear`, `practiceStartYear`, `debutYear`, `arangetramYear`, guru `fromYear/toYear`, credential and work `year`, affiliation years, venue and organiser `foundedYear`, and the bio extractor and research validators (`ExtractedYearSchema`, `research.ts:293`).

People with an absolute date: Rāmasvāmi Dīkṣita b. 1735 d. 1817; Muddusvāmi b. 1775 d. 1835; Śyāmā Śāstri b. 1763 d. 1827; Tyāgarāja (age 77, a time_period row at 1763-1767 range); Subbarāya Śāstri b. 1803 d. 1862; Aṇṇāsvāmi Śāstri b. 1827 d. 1900; Subbarāma Dīkṣita b. 1839. **At least 4 of the 8 fail today**, and these include the Trinity members, the people that rank.

Recommendation: do NOT lower the global YearSchema. Add `HistoricalYearSchema = int, min 1000, max 1920` and use it only for the artist `birthYear` and a new `deathYear` (union: `YearSchema` or historical, so living-artist validation does not change). The extractor and research paths keep the 1800 floor, which stops a model from guessing 1700s for a living person.

Privacy: the owner's research rule (birthYear refused from research, because many artists are children) does not apply to these people. Every person SSP names was alive in or before 1904, so all are dead 100+ years. Make that explicit: an `isHistorical` flag (below), set only by the importer, so the exception is visible in data and not an implicit gap in the validator. Keep `birthYear` on the research refusal list.

Dates need a date object or a note, not a bare year, where SSP gives saka + AD: SSP gives "Śaka 1692 = 1775 A.D." If AD is stored, the citation `note` keeps the saka year. Conversion errors are one-year-off common (real Muttusvāmi birth is 1775; the source says 1775 AD; fine) so quote the source, do not recompute.

### Family: no field

Nothing holds father/brother/spouse. The only person-to-person structures are `gurus[]`, `ArtistMembership` (groups) and derived `collaborators` (shared events).

Options:
1. Junction `ArtistRelation` (like affiliation). Costs: two indexes (by either end), rule 9 forces both required, and cascades for rename/merge/delete (affiliation needed 4 + 2 cascades).
2. List attribute `relations` on the artist, like `gurus`: `{kind, id?, name, note?, source}`. Names go stale on rename, the same trade `gurus` already makes. The importer writes both sides from one edge.

Recommend option 2. The volume is about 27 family + 16 patron edges. Use one list with a closed `kind` enum: father, mother, spouse, son, daughter, brother, sister, grandfather, grandson, uncle, nephew, patron, patronised, court-of. Show it as "Family" and "Patrons" on the profile. JSON-LD (`parent`, `children`, `sibling`, `spouse`) only for id-resolved rows. Phase 2: it is not needed to make the first pages rank.

### Patronage and court

`patron_of` (9), `court_musician_of`, `minister_of`, `ruler_of`, `names_patron`, `performed_at_court_of_region`: 16 edges. The affiliation entity would need an Organiser such as "Tañjāvūr Marāṭhā court". An Organiser here is a body that programmes concerts, the enrichment cron treats it so, and an organiser page with no events is a thin indexable page. Do not use it. Use `relations` rows (`kind: patron`, name-only if the ruler has no record; `court-of` with a region name). Dynasties (5) and regions (37) stay as plain text in the row.

### created_raga

One edge. Our raga entity has `citations` and fields, but no "creator". Cheapest correct step: add raga field `attributedTo` `{artistId?, name}` and add it to `CITABLE_RAGA_FIELDS` so it is shown only with its citation (the raga rule). Ship it only if the owner wants the Hamsadhvani line; otherwise skip. Size S.

### Names: how we store Muttusvāmi Dīkṣita today

Seen in `docs/research/artist-priority-2026-10.csv` (this file looks like the whole corpus, 1,169 rows) and `shivkumar-matches-2026-10.csv`:
- `38avRjwTlwzqwpJFvt4tdOjvmbT` "Muttuswaamee Dikshitar", 518 compositions, searches "muthuswami dikshitar" about 3,600/month.
- `38awpGTfMdTRamQ1Mu1Nt9Qh87Y` "Dikshitar", 5 compositions. A duplicate of the above (its `same_search_as` column points to the first). Also "Appiah Dikshitar", "Ambi Dikshitar" and others.
- Other Trinity members: "Tyaagaraaja" (709), "Shyaamaa Shaastree" (78), "Subbaraaya Shaastree" (13). Subbarāma Dīkṣita and Vēṅkaṭamakhin: no match.

Match result (my port of `foldKey` + word agreement, run against the 1,169 rows):
- Exact fold: 12 true matches (Kṣētrajña, Muttusvāmi Dīkṣita, Purandaradāsa, Vīrabhadrayya, Śyāma Śāstri, Vīṇai Kuppayyar, Tyāgarāja, Bhadrācala Rāmadāsa, Jayadēva, Muttuttāṇḍavar, Nārāyaṇa Tīrtha, Subbarāya Śāstri) and 1 false match (Nannayya -> Nayana).
- Loose word match: 116 hits for 302 names, mostly noise. The bare record "Dikshitar" attracts every Dīkṣita, so it must be merged away (or excluded) before any match.

Why `findArtistMatch` fails here: `artistNameSimilarity` requires the last token to match outright (`dedup.ts`). "Dīkṣita" vs "Dikshitar" and "Śāstri" vs "Shaastree" fail by design, and single-token names ("Tyāgarāja" vs "Tyaagaraaja") fall to a capped edit distance. It does not strip diacritics. So reuse `foldKey`/`composerAgrees` from `domain/composition/match.ts` (already built for exactly this: "Dikshitar" vs "Muttuswaamee Dikshitar") in a new `ssp-people` matcher that writes a review CSV, with the result `id`, score and the matched name. A person writes the decision.

Name policy for new records: `name` = IAST with combining marks stripped ("Subbarama Diksita"? weak for search). Better: the most searched spelling by hand ("Subbarama Dikshitar"), IAST in `alternateNames`. For matched records keep our name, add the SSP spelling to `alternateNames`. This is an owner decision (section 7).

## 3. Gurus

### disciple_of -> `artist.gurus[]`

Edges: 23 (Vol 5) + 1 (Vol 1) + 1 (Vol 4) + `guru_of` 2 (invert them) + `initiated_by` 1 = about 28. All Vol 5 edges name a guru who is also a person in artists.jsonl except 1 ("unnamed saint"). Store on the disciple: `{id? (if we hold the guru's record), name, discipline?, relationship?, source}`.

Which GURU_RELATIONSHIPS value:
- Musical disciple_of: leave it **unset** (unclassified is lineage-grade in the code: `artistMetaDescription` and the profile treat unset as lineage). `primary` would claim "principal teacher", which SSP does not say. Tyāgarāja's teacher Sonṭi Vēṅkaṭaramaṇayya taught "about one year" and is still shown as a guru by SSP. Keep unset, and put the detail in the citation note.
- Non-music gurus: **there is no fitting value.** Muddusvāmi's "disciple_of Cidambaranātha Yōgi" is mantra initiation and philosophy, not music. Śivarāmāśrama / Marudānallūr Svāmi and Kṣētrayya's "unnamed saint" are the same kind. Left unclassified they would print "Disciple of Cidambaranātha Yōgi" in the meta description. Add `spiritual` to `GURU_RELATIONSHIPS` (excluded from `LINEAGE_RELATIONSHIPS` and from "Disciple of" in the description; shown with the muted list). Check the ElectroDB enum, `GURU_RELATIONSHIP_LABELS`, the contract test `bio-contract.test.ts`, and `GURU_RELATIONSHIP_PROSE` in media-kit.
- `jayadeva disciple_of govardhanacarya`, `venkatamakhin -> tanappacarya / yajnanarayana`: musical or scholarly teachers of scholars; keep as unset.
- Do not use `institutional` or `workshop` for any of these.

Per-row source: `source` is the closed enum `CLAIM_SOURCES` (artist-claimed, bio-extraction, sabha-listing, press, iccr). None fits a printed 1904 book. Add `published-source`. A claimant cannot set `source` (setsOwnSource), so this stays a moderator/importer value.

### Do artists have citations?

No. The raga entity has `citations: [{field, sourceSlug, locator, confidence?, tradition?, note?}]` (CitationSchema in `raga/sourced.ts`; field is an enum). The artist entity has no `citations`. The only provenance is `source` (enum) per row on `gurus`, `credentials`, `works`. The `Source` domain exists (slug key; `ssp-1963-tamil` and `ssp-2008-english` rows are in `docs/research/sources-2026-10.csv`). `ssp-2008-english` carries the licence note "Educational and personal use only... never quoted or reworded".

## 4. Non-person entities (Vol 5)

Minimum: add nothing new. Everything either has a home already or is better as text.

| Vol 5 file (count) | Has a domain today? | Verdict |
|---|---|---|
| treatises (8) | no | DROP as entities. Put "authored X" in the author's `works[]`. Saṅgīta Ratnākara / Caturdaṇḍī Prakāśikā have no page |
| publications (41) | no | DROP. Authored ones (Prācīna Gāna, Gītagōvindam) -> author's `works[]` only if the author is kept |
| dynasties (5) | no | DROP. Text in a `relations` note |
| regions (37) | no | DROP. Used only as strings in `birthPlace` / `deathPlace` |
| concepts (40) | no (no glossary) | DROP, except `mudra`, which becomes an artist field. Prabandha and form names are not worth a page |
| deities (22) | no | DROP. Possibly `tags` on a Composition later (free list, unread today). Not now |
| instruments (2) | no | DROP. `artist.instrument` takes "vina" |
| talas (2: Aṭa, Dhruva) | yes (Tala) | No-op. They are already ours (Vols 1-4 tala work) |
| awards (8) | `Award` + `ArtistAward` | DROP. They are titles and sobriquets, not awards given by a body with a year. Honorifics -> `title`; epithets -> `alternateNames` |
| organisers (6) | `Organiser` | DROP. Only "Music Academy, Madras" is a real concert body and we probably hold it already. The rest (a press, a school, a maṭha, a pāṭhaśālā) must not become organiser pages |
| venues (17) | `Venue` | DROP. Temples and tank steps are not concert halls; our Venue is a place for events. Mentioned places are prose |
| time_periods (4), events_historical (2) | no | DROP |
| compositions_mentioned (60) | `Composition` | Match to existing titles by `match.ts`; link the composer; create nothing from a mention |

## 5. Vol 5 lyrics fragments

Total: **5 fragments on 2 pages** (page 14: Kṣētrayya's "vadaraka pove" caraṇam 3 in two pieces and the opening line "śrīpatisutu bāriki..."; page 15: two lines of Jayadēva's 19th aṣṭapadi, in Devanagari). STATE.md's decision was "keep, credited to composer and work". But:
- `lyricsV1` belongs to a Composition and a Composition needs a composer and a page. Five partial lines would create two or three thin composition pages ("Kṣētrayya padam" opening line only).
- They are partial, in several scripts (IAST Telugu, Devanagari). Our lyrics pipeline is ITRANS, and `lyrics-normalize` rules assume that.

Recommendation: do not import them as compositions. Two choices:
- (a) Hold in rasika-books. Cost zero. Recommended.
- (b) If a Kṣētrayya or Jayadēva composition record already exists in our DB, attach as `notation`/`meaning`? No: wrong fields. Skip.
Owner can override STATE.md's "keep"; this is a decision, not a build.

## 6. Do artists need citations? What would a historical profile show?

Yes, a small one. Reasons:
1. "Claim nothing the record does not hold" is satisfied by SSP only if the profile says it is SSP's claim. SSP was written by Subbarāma Dīkṣita, of the Dikshitar family and the Ettayapuram court. Its account of his own lineage, of Rāmasvāmi creating haṃsadhvani, of "divine" episodes (Tyāgarāja given Svarārṇavam by Nārada "per the source") is the author's. A bare line with no source reads as a site fact.
2. The raga side already ships this. Same Source rows, same number-the-references code (`numberReferences` in raga/client). Re-use.
3. Everything imported has a page locator: Vol 5 page and the 1904 section (VC §n). Dropping that loses the way to check it.

Design (no filtering rule, unlike `shownRaga`, because ordinary artist fields are uncited by design):
- `artist.citations: [{field, subject?, sourceSlug, locator, note?, tradition?}]`. `field` is an enum (`CITABLE_ARTIST_FIELDS`: birthYear, deathYear, birthPlace, deathPlace, gurus, relations, mudra, works, activeYears, title). `subject` names the row inside a list field (guru id or name). Max 100.
- Importer rule: **nothing is written without a citation.** Not a display rule.
- Page: a "Sources" block with numbered references and a short "According to the Sangita Sampradaya Pradarshini (1904)" lead on the cited rows. No quotes (licence).
- Do not extend `CLAIMANT_EDITABLE_ARTIST_FIELDS` to `citations` (same reason as `source`).

Licence check (owner): `ssp-2008-english` says "used to check facts read in the Tamil edition, never quoted or reworded". Vol 5 has not been read in the Tamil. Facts are not copyrightable, wording is. The importer must store only our own short field values (a place, a year, a name, a relation), and never `verbatim_quote`, `attributes_consolidated` phrases (they paraphrase the translator's English) or the `naming`/`stylistic_features` style text. Cite the 1904 original as the source of the claim, with the 2008 edition as the copy used. Confirm this with the owner (section 7).

### What the page shows today for Muttusvāmi Dīkṣita if imported

| Block | Today's code | Outcome |
|---|---|---|
| Name | existing "Muttuswaamee Dikshitar" (518 compositions) | unchanged; SSP spelling lost until `alternateNames` is writable |
| Born | `birthYear` + `birthPlace` | "Born 1775, Tiruvārūr" only after the year floor change. Today: blocked, the whole CSV row fails validation |
| Died | none | needs `deathYear` + `deathPlace`: "Died 1835, Eṭṭayapuram" |
| Active years | free text | works now: "1775-1835" |
| Lineage | gurus | "Cidambaranātha Yōgi" unclassified would print "Disciple of ..." (wrong: spiritual). Needs `spiritual` |
| Works composed | `composition.byComposer` (limit 6) | works today; the 518 compositions come from karnatik, not SSP. SSP adds the Vol 1-4 gītas/kṛtis once linked |
| Mudra | none | add field: "guruguha" |
| Family | none | `relations`: father Rāmasvāmi Dīkṣita, brothers Cinnasvāmi, Bālasvāmi, sister Bālāmbā |
| Claim this profile / media kit / "upcoming concerts" | shown to all unclaimed artists | wrong for a person dead since 1835. Needs the `isHistorical` gate |
| JSON-LD | `Person` with no `birthDate`/`deathDate` | add both (strings, ISO year) when present; today `Person` with no death date reads as living |
| Thin pages | no `isThinArtist` rule | 153 of the Vol 5 people have no edge and 74 have 0-1 attributes. These must not each become an indexed page |

### Thin pages

Create an Artist record (by a person) only for: (a) anyone who is `composed_by` target of a composition we hold (about 65), (b) people with a Vol 5 biography section (83, overlapping with (a)), (c) both ends of a kept guru edge. Anyone else stays name-only inside a `gurus` or `relations` row (the `id` is optional). For created-but-sparse records set `unlisted: true`, which already keeps a record out of the index and search. Estimated result: 100-120 new or enriched records, not 300.

## 7. Build list (files, functions, tests, size)

Order matters: M1 first (matching), then the schema items, then the importer. Nothing writes to prod without a dry run first. Prod writes need owner approval (memory rule).

### A. Matching and import tool

| # | Item | Files | Tests | Size |
|---|---|---|---|---|
| A1 | `ssp-people` normaliser in rasika-books: one JSONL per person with fixed keys (`birth`, `death`, `birthPlace`, `deathPlace`, `instrument`, `mudra`, `title`, `relations`, `gurus`, `cites[{page, vcSection}]`); date parser for the saka/AD object and the string forms; joins the five volumes (fold Muttu/Muddu, -n/-a endings); drops the 13 non-people; keeps the 4 same-name pairs apart. Python, in the rasika-books repo | `scripts/ssp_people.py` (new) | unit tests for the date parser and join keys on the 8 dated people | M |
| A2 | `domain/artist/ssp-match.ts`: `sspNameKey`, `matchSspPerson(name, candidates)` reusing `foldKey`/`composerAgrees`; returns candidates with score, never an id decision. Excludes a bare "Dikshitar" and ranks by compositions held | `packages/core/src/domain/artist/ssp-match.ts`, `.test.ts` | Muttusvāmi -> Muttuswaamee; Dīkṣita does not pull every Dikshitar; Nannayya does not match Nayana; the 4 same-name pairs do not collapse | M |
| A3 | `pnpm cli ssp-people-match` (dry; writes review CSV with `decision` column: attach / create / skip) and `ssp-people-apply --file --user [--dry-run]` (writes manifest like `source-apply`; undo) | `packages/scripts/src/sspPeople.ts` | planner function unit-tested in core (`packages/scripts` has no vitest; keep rules in core) | L |
| A4 | Merge the junk "Dikshitar" (and "Appiah/Ambi/Swarna" checks) into the right record with `merge-artists` before A3 runs | existing `pnpm cli merge-artists` | none | S |

### B. Schema changes (core)

| # | Item | Files | Tests | Size |
|---|---|---|---|---|
| B1 | `HistoricalYearSchema` (1000-1920) and use it for `birthYear`; add `deathYear`; add `deathPlace`; `isHistorical`; add to Create schema, entity, `CLEARABLE_ARTIST_FIELDS`, admin CSV columns, `merge-fill`. Keep the extractor and research on `YearSchema` | `shared/schemas.ts`, `artist/schema.ts`, `artist/entity.ts`, `admin/columns.ts`, `artist/merge-fill.ts` | schema.test: 1775 accepted for birthYear, still refused for `practiceStartYear`; research test still refuses `birthYear` | M |
| B2 | `alternateNames` into Create/Update schema + CSV (pipe list) + clearable. Not claimant-editable | same files | CSV round-trip test; claimant patch with `alternateNames` goes to the queue | S |
| B3 | `mudra` string field (+ CSV, clearable) | same files | round-trip | S |
| B4 | `relations` list (`kind` enum, `id?`, `name`, `note?`, `source`) + entity list + CSV JSON cell + merge handling (`mergeArtist` does not copy fields; add to `artistMergeFillPatch`) | `artist/schema.ts`, `entity.ts`, `merge-fill.ts`, `columns.ts` | contract test (importer mapping vs schema) as in `bio-contract.test.ts` | M |
| B5 | `GURU_RELATIONSHIPS` += `spiritual`; `CLAIM_SOURCES` += `published-source`; labels, prose in media-kit, lineage filter | `artist/schema.ts`, `client.ts`, `media-kit.ts`, `artistMetaDescription` | existing lineage tests: `spiritual` is excluded from "Disciple of" | S |
| B6 | `artist.citations` (CitationSchema widened with `subject`), `CITABLE_ARTIST_FIELDS`, `pruneCitations` on clear (same as ragas) | `artist/sourced.ts` (new, browser-safe), `entity.ts`, `schema.ts`, `client.ts` subpath | citation pruned when field cleared; importer rejects a field with no citation | M |
| B7 | Raga `attributedTo` + `CITABLE_RAGA_FIELDS` entry (optional; only if owner agrees) | `raga/schema.ts`, `entity.ts`, `sourced.ts` | cited -> shown; uncited -> hidden | S |

### C. Web

| # | Item | Files | Tests | Size |
|---|---|---|---|---|
| C1 | Profile: Born/Died with place, Mudra, Family, Patrons, Sources block; hide Claim button and media kit when `isHistorical`; no "upcoming concerts" line | `routes/artists.$artistid._index.tsx`, `lib/artist-display.ts` | `artist-display.test`: description for historical person has no "upcoming" text and no "renowned" | M |
| C2 | `structured-data.ts`: `birthDate`, `deathDate`, `birthPlace`, `parent/children/sibling/spouse` only for id-resolved rows; nothing if absent | `lib/structured-data.ts` | round-trip through `serializeJsonLd` | S |
| C3 | `isThinArtist` (noindex) for records with no composition, no event and under two facts; search indexer `noindex` as the raga flow does | `artist/thin.ts`, search transformer, sitemap | same shape as `isThinRaga` tests | M |
| C4 | Share the numbered-reference code from the raga page | `lib/raga-page.ts` -> shared `lib/references.ts` | existing raga-page tests still pass | S |
| C5 | Docs: CLAUDE.md sections "Artist structured sections" and "Researching artists" (research still refuses `birthYear`), a new "SSP people" section; update `docs/` | CLAUDE.md, `docs/research/` | n/a | S |

Sizes: S = under half a day, M = about a day, L = 2-3 days. Total about 2.5 weeks of focused work for everything. The cut-down path (names, gurus, mudra, birth/death, citations only, no `relations`, no raga field, no C3) is about one week: A1-A4, B1, B2, B3, B5, B6, C1, C2.

## 8. Owner decisions needed

1. **Scope.** Only composers and Vol 5 biography people (about 100-120 records), or all ~300? Recommendation: the first, name-only rows stay text.
2. **Rulers and patrons.** Keep only composer-rulers (Tuḷaja, Śāhāji, Eṭṭappa, Raghunātha Nāyaka) as Artist records and show all other patrons as name-only rows? Recommendation: yes.
3. **Year floor.** Is a separate `HistoricalYearSchema` for `birthYear`/`deathYear` right, and `isHistorical` set by the importer only? Alternative: store the year in `activeYears` text and skip schema work (blocks sort and JSON-LD).
4. **Licence.** Confirm the English 2008 text may be the source for Vol 5 facts (names, years, places, relations) with our own words and the 1904 section as the citation, no quotes. The source row says "never quoted or reworded" and that Vols were to be "read in the Tamil". Without a yes, the Vol 5 import stops at A2.
5. **Name policy** for new records: most-searched spelling in `name` ("Subbarama Dikshitar"), IAST in `alternateNames`? And for matched records keep ours? Recommendation: yes to both.
6. **Family and patron list (`relations`)**: in now, or later? Recommendation: later; ship names, gurus, dates, mudra first.
7. **`spiritual` guru value** and `published-source` source value: accept?
8. **Hamsadhvani "created by" field**: build, or leave in prose? Recommendation: build if C-level time is cheap (S), otherwise skip. One edge does not justify a field.
9. **Lyric fragments (5 lines):** hold them in rasika-books (recommended) or override STATE.md's "keep" and make thin composition pages?
10. **Caste, community, gotra** (51 people): drop (recommended). Say if you want them.
11. **Dikshitar duplicate** (`38awpGTf...`, 5 compositions): merge into the Muttuswaamee record now? Prod write; needs your approval.
12. **Subbarāma Dīkṣita and Vēṅkaṭamakhin** records: create them first (by hand), since Vols 1-4 composer links depend on them.
