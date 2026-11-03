# Gap analysis: SSP raga records to rasika.life

Date: 2026-11-03. Read-only. No repo file was edited. Scratch scripts and a prod raga export
(read-only `admin-csv-export`, 1,459 rows) are in the scratchpad dir
`/private/tmp/claude-501/-Users-tejovanthn-codes-rasikalife/336f6ea5-91ce-4622-94da-1ee9ae2ee0b7/scratchpad/`
(`rows.json`, `prod-ragas.csv`, `keys.py`, `n.py`, `m.py`, `m2.py`, `t.ts`).

## 0. Findings that change the plan

1. **`data/ssp-name-matches.csv` does not map SSP ragas to rasika.life.** It maps a name as
   written in SSP text (mudras, other sections) to an SSP section id
   (`raga_ssp-2008-english-vol-N_slug`). 36 rows: approve=yes 25 (19 high, 6 "applied"),
   blank 11 (7 medium, 1 low, 3 none). There is **no SSP-to-rasika.life match table yet.** The
   importer must build one.
2. **My own name match against the prod export** (rasika `ragaExactKey`, then `ragaVariantKey`,
   same code as `dedup.ts`, ported to Python): of 191 SSP records, 119 exact, 52 variant, 20
   none. No multi-hits. But this is unsafe as is:
   - Variant hits include a known wrong one: SSP `kannaḍa` (mela 28) matched `kAnaDA`. STATE.md
     says Kānaḍa is "a different rāga today".
   - Two SSP records share a name (`mukhāri`, `dēvagāndhāri`).
   - Mela records need a mela-number table, not names. Prod has 72 distinct mela numbers, but
     mela 29 has 6 parentless raga rows, mela 17 has 5, mela 56 has 4, and so on. SSP uses
     Venkatamakhi's names (`janatōḍi` for 8, `dhīraśaṅkarābharaṇam` for 29, `harikēdāragauḷa` for
     28, `śāntakalyāṇi` for 65) where prod has `hanumatODi`, `shankarAbharaNa`, `harikAmbhOji`,
     `kalyANi`.
   - Of 94 matched janyas that have a prod mela number, **22 disagree** with SSP's mela (e.g.
     `dhanyāśi` SSP 20, prod 8; `mōhanam` SSP 65, prod 28; `manōhari` SSP 33, prod 22). Some of
     those are wrong name matches, some are real differences of school. Either way they need a
     person. Rule: never import `mela_number` or `parentRaga` (research.ts already refuses
     melaNumber; it is derived from the parent).
3. **The citation source is a decision, and the data pulls the other way from the plan.** The
   plan says Tamil 1963 is primary and English 2008 is "cross-check only, never quoted or
   reworded". The extraction came from the English edition (`book-plan.json`:
   `extraction_policy: facts_only`, "never copy or reword the translators' English").
   `docs/research/bhairavi-ssp-2026-10.csv` cites `ssp-1963-tamil` p. 375; the extraction cites
   the English edition at printed p. 390 (pdf p. 433) for the same facts. Page numbers differ
   between editions, so the locator must go with the slug that was actually read. See section 8.
4. **A lot of the English fields are paraphrase of the translators' text**, which the licence
   forbids. See section 6. This removes `other_facts`, `historical_notes`, `editor_notes`,
   `gamaka_rules.where`, `anya_swaras[].rules`, `sources[].verbatim_quote` from the importable
   set.
5. **`alternateScales` cannot carry an SSP-attributed scale.** It is `string[]`; a citation is
   per field, not per entry. Prod has 56 uncited alternate scales already; one SSP citation on
   the field would claim all of them. And the web page prints the list under the label
   "Alternate" with no source (`carnatic.ragas.$ragaid.tsx` lines 446-450). Needs a new field.
6. **Murcchana almost never equals prod's scale.** For 170 matched records with a murcchana: 24
   identical, 33 same swaras in a different order (SSP's zigzag), 39 same swara universe, 45
   different swaras, 29 prod has no scale. SSP's murcchana is the raga as the book phrases it
   (with vakra repeats like `S' D2 P M1 M1 P M1 G3 R1 S`), not a clean arohanam. It must not
   overwrite `arohanam`/`avarohanam`.
7. **All 191 records are `verification_status: pending_self_verification`.** The review files
   hold 387 `octave_unmarked`, 59 `text_vs_image_conflict`, 55 `variant_uncertain`, 22
   `sloka_vs_vivarana_time_of_day`, 7 `sloka_vs_vivarana_scale_type`, 10 `possible_same_person`,
   3 `unresolved_relationship_end`. The sloka text itself is not among the verified quotes.
   Import needs a gate (section 9).

## 1. Corpus facts

- Records: 191 raga rows (vol 1: 100, vol 2: 47, vol 3: 44; vols 4 and 5 have none).
  `kind`: 72 mela, 116 janya, 3 null. Mela ranges: vol 1 = 1-24, vol 2 = 25-36, vol 3 = 37-72.
- One junk record: `janyam 6 (bhāṣāṅgam) — kānrā (aprasiddha)`, section 22.13, kind null, no
  murcchana, no sloka. Drop it (a parsed heading, not a raga). Also no murcchana: `dīpakam`
  (51.1). No sloka: 7 records (`kamās`, `manōhari`, `dīpakam`, `haṃvīru`, `kumudakriyā`,
  `dēvagāndhāri` 29.17, the junk row).
- Fill counts from the enumerator: lakshana.prayogas non-empty in 124 ragas (1,178 phrases, max
  42 per raga, 14 ragas above 20); jiva set in 74; nyasa in 40; graha in 188; time_of_day in 187
  ("all times" in 148: 60 mela rows, 88 janya); scale_type 187; raga_class 190; anya_swaras 38
  ragas (56 entries); gamaka_rules 31 ragas (77); learn_from 32 ragas (51 entries); other_facts
  639 facts in 189 ragas; historical_notes 69 in 49; editor_notes 24 in 18; sloka 184.

## 2. Field map

Legend: (a) home today, (b) needs a new field or schema change, (c) do not import.

### Top level

| SSP field | Fill | Verdict | Target or reason |
|---|---|---|---|
| `schema_version`, `entity_type`, `extracted`, `merged_provisional_id` | 191 | (c) | Pipeline plumbing. `merged_provisional_id` is the key into the review files. |
| `verification_status` | 191 | (c), but gates | All "pending_self_verification". Import must not run until a verification pass flips it, or the owner waives it. |
| `name_canonical` | 191 | (c) | A match key only. Never rename a rasika.life raga. Never auto-create (dedup rules). |
| `name_variants_seen` | 191 | (c) | Extra match keys only. |
| `section_number` | 191 | (c) | Locator aid; goes in the match report. |
| `kind` | 188 | (c) | Melas matched by number table. Not imported (melakarta status derives from `melaNumber` + no parent). |
| `janya_class` | 190 | (a) in part | `isBhashanga` (bhāṣāṅga/bhashanga true, upāṅga/upanga false). Mixed spellings (49 `upāṅga`, 14 `upanga`, 45 `bhāṣāṅga`, 9 `bhashanga`, 1 `bhāṣānga`). Duplicate of `lakshana.raga_class`; use the lakshana one, check they agree. |
| `mela_number` | 191 | (c) | Derived from parent in rasika.life. 22/94 disagree. Use only to match and to flag. |
| `mela_name_iast` | 191 | (c) | Match aid. |
| `mela_swaras` | 191 | (c) | Check only (scale tokens must lie in this set plus declared anya). |
| `pdf_pages`, `printed_pages` | 191 | (c) | Source for citation locators. |
| `composition_ids` | 189 (749 ids, all unique) | (c) for ragas | SSP-internal composition ids. Belong to a later composition import, not to `keyCompositionIds`. |

### sloka (184 records)

| Field | Fill | Verdict |
|---|---|---|
| `sloka.text_iast` | 184 (max 133 chars) | (b) New field. Confirmed: no `sloka` anywhere in `domain/raga/schema.ts` or `entity.ts`, no CITABLE field, nothing on the page (grep of `sloka`, `murcchana` in web found nothing). |
| `sloka.author` | 182 "Vēṅkaṭamakhi", 1 longer string ("...cited by the editors from the Rāgalakṣaṇamu..."), 2 null with `source_note`/`attributed_to` "editors (ED)" | (b) Goes with the sloka. Two editor-supplied slokas (`amṛtavarṣiṇi`, `yamunā kalyāṇi`, from the Caturdaṇḍīprakāśikā anubandha) cite their own source per the owner decision, not Venkatamakhi in SSP. |
| `sloka.page`, `printed_page` | 184 | (a) via citation locator. |
| `sloka.facts.scale_type` | 133 | (a) `scaleType`, see section 4. 7 vary from the vivarana ("sampurna (ascent without ga, ni)"). |
| `sloka.facts.time_of_day` | 127 | (a) `timeOfDay` with a second citation, see section 4. |
| `sloka.facts.graha` | 123 | (a) `grahaSwaras` only as a cross-check. |
| `sloka.facts.varjya` / `vakra` / `varjya_by_direction` / `varjya_scope` / `varjya_where` / `vakra_where` | 108/52/7/1/1/3 | (c) Derivable from the scale; no field. |
| `sloka.facts.anya_swaras` | 6 | (a) `anyaSwaras` cross-check. |
| `sloka.facts.other` (10), `.notes` (1), `.range` (2), `.alpa` (1), `.cyuta_swaras` (2), `.time_of_day_note` (1) | rare | (c) Prose or too thin. |
| `sloka.notes` (11), `sloka.other_facts`, `sloka.other_sloka_facts` (4), `sloka.source_note` (2), `sloka.attributed_to` (3) | rare | (c) except `source_note`/`attributed_to` which feed the editor-sloka attribution. |

### murcchana (189 records)

| Field | Fill | Verdict |
|---|---|---|
| `arohana`, `avarohana` (tokens) | 189 | (b) New field, see section 4. Not `arohanam`/`avarohanam`. |
| `arohana_raw`, `avarohana_raw` | 189 | (c) SSP glyph strings (`s ♭r m p ♭d S,`). Keep in the extraction; they are the audit trail. |
| `confidence` | 189 (0.8: 113, 0.9: 72, 0.7: 4) | (a) citation `confidence`. |
| `page`, `printed_page` | 189 | (a) citation locator. |
| `jhanta` (9), `arohana_jhanta` (1), `avarohana_jhanta` (1) | 11 | (c) The doubled token is already in the line (`G2 G2`). The list only says which doubles are jhaṇṭa. No home; harmless to drop. |
| `octave_unmarked` | 25 | gate, see section 9. |
| `variant_uncertain` | 4 | gate, see section 9. |
| `notes` | 28 | (c) Extractor prose. |
| `arohana_alternatives` (1), `arohana_alternate` (1), `alternates` (1), `alternate_murcchana` (1), `alternate_murcchanas` (2), `second_murcchana` (1), `gamaka_raw` (1), `arohana_note` (1) | 8 records | (b) if the new scale field is a list: each becomes another reading. Else (c). `ārdradēśī`'s alternate is "Not tokenised": drop. `bhūṣāvati`'s second_murcchana has `|` separators: split on `|` into separate entries. |

### lakshana

| Field | Fill | Verdict | Target |
|---|---|---|---|
| `raga_class` | 190 | (a) in part | `isBhashanga`. Values: mela 72, upanga 63, bhashanga 55, 1 null. `upanga` and `rāgāṅga` have no field. Boolean `isBhashanga` is true/false for janyas, unset for melas. Full class needs a new `ragaClass` if wanted (S, optional). |
| `scale_type` | 187 | (a) | `scaleType` (enum `SCALE_TYPES`). 151 sampurna, 22 shadava, 14 audava, 4 null. |
| `graha_swaras` | 188 | (a) | `grahaSwaras`. 167 `["S"]`; others D1 3, N3 3, R1 3, N2 3, M1 2, P 2, G3 2, D2 1; bare `G` and `N` once each; 3 empty. |
| `jiva_swaras.{all,most_ranjaka}` | 69 / 40 | (a) | `jivaSwaras`. See section 3. |
| `nyasa_swaras.{all,most_ranjaka}` | 40 / 16 | (a) | `nyasaSwaras`. See section 3. |
| `anya_swaras[].swara` | 56 | (a) | `anyaSwaras` (tokens N3 8, D2 8, N2 8, G2 6, G3 5, D1 4, M2 4, R1 3, R2 3, M1 3, N1 2, G1 2). |
| `anya_swaras[].phrases` | 51 | (a) | Become `prayogas` with label "anya-svara prayoga" (the schema has no anya link on a prayoga). |
| `anya_swaras[].name_in_text` | 55 | (c) | A Sanskrit term for the swara (`pañcaśruti dhaivata`); redundant with the token. |
| `anya_swaras[].rules` | 56 | (c) / our own words | English sentences. Into `movement` only as our own plain words (section 6). |
| `anya_swaras[].variant_uncertain` | 7 | gate | |
| `prayogas[]` | 1,178 | (a) | `prayogas`. See section 5. Cap is 20; 14 ragas exceed it. |
| `prayogas[].gamaka_raw` | 659 (max 81 chars) | (a) | `prayogas[].gamaka` (max 200). Kept, not shown. |
| `prayogas[].label` / `group` | 1,178 | (a) in part | `label` only. SSP labels are technical terms (`ranjaka prayoga` 187, `viśēṣa prayoga` 112, `jiva-svara sancara` 109...), not sentences. Map to a closed set of our own labels. `group` (1-12) has no home; drop. |
| `prayogas[].notation_raw` | 1,178 | (c) | Glyph audit trail. |
| `prayogas[].confidence` | 1,178 | (a) | Per-field citation confidence = min over the field's phrases. |
| `prayogas[].page`, `printed_page` | 1,178 | (a) | Locator range for the `prayogas` citation. |
| `prayogas[].podi_swaras` (6), `jhanta` (3), `notation_modernist` (4), `anya_swara` (13), `note`/`notes` (9), `variant_note` (1) | rare | (c) | See section 5. |
| `prayogas[].octave_unmarked` (358) / `variant_uncertain` (45) | | gate | |
| `gamaka_rules[]` (`where`, `gamaka`, `example_raw`) | 77 in 31 ragas | (c) now, (b) later | No gamaka model. Plan phase 7 / "gamakas not shown". `where` is English; `example_raw` is glyphs. Keep in the extraction. |
| `varjya` / `vakra` / `varjya_by_direction` / `varjya_scope` | 110/56/6/1 | (c) | Derivable from the scale. `scaleType='vakra'` exists in our enum but SSP's `scale_type` is a count (sampurna etc.), and `vakra` is a separate attribute. Do not map one to the other. |
| `time_of_day` | 187 | (a) | `timeOfDay`, section 4. |
| `learn_from[]` | 51 in 32 ragas | (a) in part | `keyCompositionIds`, section 7. |
| `other_facts[]` | 639 in 189 | (c) | Section 6. |
| `range` | 1 | (c) | |
| `sources[]` | 1,259 | (a) in part | Gives per-field `page`/`printed_page`/`confidence` for citations. `verbatim_quote` (English text) must **not** go into `note`. |

### Remaining top-level

| Field | Verdict |
|---|---|
| `historical_notes` (69 in 49, 68 attributed to Subbarāma Dīkṣita) | (c) as written, (b) later. Section 6. |
| `editor_notes` (24 in 18) | (c). They are about the book's footnotes and errata. |
| `other_facts` | (c). Section 6. |
| `composition_ids` | (c) here. |

## 3. Jiva and nyasa

Facts: `jiva_swaras` has `all` in 69 records and `most_ranjaka` in 40 (35 have both, 5 only
`most_ranjaka`); 33 records have `all` alone and it is a strict subset of the scale. Nyasa: 16
have `most_ranjaka`, 23 only `all`. In Bhairavi `all` is the full scale (S R2 G2 M1 P D1 N2),
which says nothing; `most_ranjaka` (R2 G2 M1 N2) is the information. Only 2 records (1 jiva, 1
nyasa) have `all` equal to the whole scale with no `most`.

Recommendation, which matches the precedent in `bhairavi-ssp-2026-10.csv`:

- Store `most_ranjaka` when it exists. Else store `all`.
- Skip a set that equals the entire scale when there is no `most_ranjaka` (2 cases): it claims
  nothing.
- Record the other half in the citation `note` (<= 300 chars): "All seven are jiva; these four
  most of all." (exactly as the Bhairavi CSV does). No schema change.
- Nothing is lost that the page can show: it has one marked list per set.
- Alternative if the owner wants both: add `jivaSwarasAll`/`nyasaSwarasAll`. I would not: it
  doubles two fields for one record in six.

Token fit: all 409 sets passed `parseSwaraSet` (bare `D`, `G`, `N` pass; the page's
`resolveVariant` resolves them against the raga's own scale). Two sets carry `N3.` (low-octave
dot); `parseSwaraSet` drops it. `swarasOutsideRaga` should run in the importer against
`mela_swaras` + the declared anya, and send any hit to review.

## 4. Scale, time, class

### timeOfDay

Target enum: `morning | afternoon | evening | night | universal`. SSP gives free text. Values
in lakshana: all times 148 (60 mela, 88 janya), evening 16, early morning 9, morning 2, fourth
quarter of the night 2, first yāma 2, first yāma of the night 2, afternoon 1, fourth quarter of
the day 1, evening dusk 1, second yāma 1, early dawn 1, mid-afternoon 1, null 4.

Proposed mapping (a closed table in core, unit tested, like `venueTypeFromName`; anything not in
the table is held, never defaulted):

- `all times` -> `universal`
- `evening`, `evening dusk`, `end of day`, `last yāma of the day`, `fourth quarter of the day`
  -> `evening`
- `early morning`, `early dawn`, `morning`, `first yāma of the day` -> `morning`
- `afternoon`, `mid-afternoon`, `midday` -> `afternoon`
- `fourth quarter of the night`, `first yāma of the night`, `early part of the night` -> `night`
- `first yāma` (2), `second yāma` (1), `fourth yāma`, `fifth yāma (bāṇa yāma)`: ambiguous (day or
  night?). Hold for the owner. The yāma detail is lost in any case.

Watch: 148 of 187 are `all times`, and the whole point of the "Universal" fix was that
"Universal" for Bhairavi was wrong. Here "all times" is sourced to the book with a tradition,
so it can show as "Time: any time (per Subbarāma Dīkṣita)". But for the 60 melas it is a
blanket Dikshitar rule and says little. Owner decision: import `universal` for melas, or skip
them.

Conflicts: prod holds a `timeOfDay` for 32 of the matched ragas. It is uncited, so hidden today.
Of the 32, 20 differ from SSP's value (e.g. prod evening/morning/afternoon vs SSP "all times";
prod universal vs SSP evening). SSP overwrites on import since it is cited and the prod value
is not; the old value goes into the dry-run report.

Sloka vs vivarana: 126 records have both; 22 disagree (review kind
`sloka_vs_vivarana_time_of_day`; e.g. `madhyamāvati` lakshana afternoon vs sloka evening,
`dhanyāśi` first yāma vs morning, `gaurīvēḷāvaḷi` all times vs morning). Owner decision:
"show both, each named". There is one `timeOfDay` value. Options:
(1) Two citations on the same field with different `tradition` and the other reading in `note`;
the page already supports many citations per field, but it prints only the first `tradition`
(`lib/raga-page.ts` line 98). Small page change (S). Value = vivarana (Subbarāma Dīkṣita).
(2) A `timeOfDayReadings` list. More schema; not worth it for 22 records.
Recommend (1).

### rasa and season

SSP gives neither. Nothing to import. `rasa` stays out. The 36 matched ragas that hold an
uncited `rasa` stay hidden.

### scaleType

SSP values: sampurna 151, shadava 22, audava 14, null 4. All in `SCALE_TYPES`. Also
`sloka.facts.scale_type` has combined forms: `shadava-sampurna` (1, in enum) and 6 strings like
"sampurna (gāndhāra and niṣāda omitted in ārōhaṇa)". For those, derive an ascent-descent value
(`audava-sampurna`, etc., in the enum) from the token counts of the murcchana, and compare to
the lakshana value. Mismatch -> review (7 `sloka_vs_vivarana_scale_type` items already
queued). Recommend: take the lakshana (vivarana) value, derive-and-check against the murcchana.
Add a second citation with the sloka's reading in `note` where it differs.

### isBhashanga and class

`isBhashanga` true for bhāṣāṅga janyas (55 + 1 spelled `bhāṣānga`), false for upāṅga (63), unset
for melas. `rāgāṅga` (agent-added; Bhavānī, stored as "mela") has no field. If the page should
say "upanga" or "ragamga", add `ragaClass: 'upanga' | 'bhashanga' | 'raganga'` (S). The plan only
needs the badge, so (a) is enough.

### Murcchana against arohanam/avarohanam

The plan said: show both, named. Today the only candidate is `alternateScales` (string[],
legacy, shown uncited, rendered as an unlabelled "Alternate" row, no per-entry source). Not
usable: see section 0, item 5. Recommend a new optional list field on raga:

```
scaleReadings: { label: string; arohanam: string; avarohanam: string; sourceSlug: string;
                 locator: string; tradition?: string; note?: string }[]   // max ~4
```

with `label` such as "Subbarāma Dīkṣita's murcchana". It carries its own source (so no
`CITABLE_RAGA_FIELDS` entry or `shownRaga` change is needed beyond adding the name), and the
page prints it as "Also written as" beside the modern scale. Entries from `alternates`,
`alternate_murcchanas` and `second_murcchana` become more readings. Murcchana lines need
cleaning before storage: strip `.` and `'`, split on `|`, and allow a line with no S (5 cases:
`bṛndāvani`, `maṇiraṅgu`, `pāḍi`, `vīravasantam`, `śrī`, whose murcchana opens on R).
Section 5 has the validator results.

## 5. Notation and tokens against the validators

I ran `validatePhrase`, `validateSwaras` and `parseSwaraSet` from the repo through `tsx` over
every real value. (`vitest run src/domain/raga/notation.test.ts` also passes: 13 tests.)

### Prayoga notation (`validatePhrase`)

- 1,171 of 1,178 pass.
- The 7 failures are all "fewer than two notes; not a phrase" (single-token entries such as
  `M1`, `N3.`, `R1`). Drop them (or merge into the raga's anya set, which they usually restate).
- Token shapes in the data: `S`, `S'`, `R1'`, `N2.`, `D1.`, `P.` etc. -- only the plain letter,
  the `'` upper-octave mark and the `.` lower-octave mark. All within the grammar. 145 phrases
  carry `.`, 294 carry `'`. **There are no `:` (karvai) and no `,`/`;` (pause) in the data**:
  SSP prints no duration marks, so karvai/pause support is unused here.
- Jhaṇṭa: the doubled token is already in `notation` (`R2 R2 G3`), so validation passes and the
  page shows a double. The `jhanta` list is lost. Harmless (3 phrases).
- Pōḍi (grace) svaras: 6 phrases (`gauḍipantu` x4, `huśāni` x2). The grace notes are tokens in
  `notation` with `podi_swaras` naming them. Importing them would show a grace note as a full
  note. **Hold these 6 phrases** (the old STATE note asked the same question).
- `notation_modernist`: 4 phrases in `huśāni` where the book's rule and the modernists differ
  (`D2` vs `D1`). `notation` follows the author's rule. Import the author's `notation` only;
  the modernist reading has no field and is exactly the "two readings" case. Hold the 4.
- `variant_note`/`anya_swara`/`note(s)`: extractor commentary. Not imported.
- Ordering: phrases need a stable order. Use SSP page order, then index.
- The extraction's `label` is the book's technical term. `PrayogaSchema.label` is "a short name
  for the phrase, in our words" (max 120). Map to a closed set (see section 2).

### Scales and murcchana (`validateSwaras`)

Run on all murcchana lines (378 lines): 363 pass, 15 fail.

- 10 fail "not swara notation": 4 lines carry a low-octave dot (`N2.`, `P. D2. N3.`) because
  `SWARA_TOKEN = /^[SRGMPDN][123]?['`,]*$/` has no `.`; 4 lines carry `|` (alternate segments in
  `jujāvanti`, `māhūri`, `bhūṣāvati`).
- 5 fail "no S in the line" (murcchanas that start on R or N).
- So a murcchana cannot go through `validateSwaras` unchanged. Normalise first (strip `.`/`'`,
  split `|`) and use a variant that does not demand an S. Do not loosen `validateSwaras` itself:
  it guards the scale people search for.
- `S'` passes. The prod scales never carry octave marks (e.g. `S R1 M1 P D1 S`), so strip them
  for consistency.

### Swara sets (`parseSwaraSet`): 409 of 409 pass.

### What the import should add to the validators

(1) a `validateSchoolScale` for murcchana lines; (2) reuse `validatePhrase` for prayogas,
dropping single-token ones; (3) run `swarasOutsideRaga(set, scale, anya)` and
`resolveVariant` per raga; (4) reject `M3` and any `variant_uncertain` token (section 9).

## 6. Prose fields and the licence

The English edition's licence: "educational and personal use only", `facts_only`, "never copy or
reword the translators' English" (book-plan copyright_status; `sources-2026-10.csv` repeats it).
The Tamil edition is treated as in copyright too. The 1904 original (Telugu/Sanskrit) is public
domain. So the importable material is: facts (which swara, which phrase), the notation, and the
Sanskrit verse.

| Field | Content | Verdict |
|---|---|---|
| `sloka.text_iast` | The Sanskrit verse, IAST. The verse is public domain (Venkatamakhi, 17th c.). The IAST rendering is a transliteration, not a creative text. Two are editor-supplied (not SSP 1904). | Import verbatim (owner decision), after a verification pass on the text itself: it is not covered by the 4,807/4,907 quote check, and review notes say some text layers are garbled (`mārgadēśi`: "gata ḥ", "sṃṛtā"). Attribute to Venkatamakhi, cite SSP 1904 via the edition read. For the 2 editor-supplied ones, attribute to the Caturdaṇḍīprakāśikā and cite the editors' footnote. |
| `gamaka_rules[].where`, `.gamaka`, `.example_raw` | `where`: paraphrase; `gamaka`: a Tamil/Sanskrit term; `example_raw`: glyphs | Do not import now. Terms are facts but there is nowhere to put them. |
| `anya_swaras[].rules` | English sentences ("Vīṇā players sound the niṣāda as śuddha niṣāda in some places, for colour.") | Do not import. The facts (which swara, which phrases) land in `anyaSwaras` and `prayogas`. A "touched, not held" rule can go into our own `movement`. |
| `other_facts[]` (639, avg 82 chars) | Mixed. A sample of 14: structural remarks about the printed scale ("The printed mūrcchana ārōhaṇa is zigzag: s r g s p m p n d n S."), legends ("auspicious... sung at the end of a performance"), where the raga sits in the book ("Tanukīrti closes the first cakra"), mnemonics ("Kaṭapayādi and mnemonic labels"), disagreements with Venkatamakhi. | Do not import as text. Mine as a worklist for `movement`, written by us from the structured fields (jiva/nyasa/graha/anya/prayogas), not from these sentences. "Classed as a ghana rāga" has no field. |
| `historical_notes[]` (69) | Statements of lineage and attribution, all marked "Subbarāma Dīkṣita" ("seventh of the nineteen mēḷas of the earlier masters", "followers of the old tradition count it as bhāṣāṅga") | Facts worth having, no field today. Do not import the sentences. Candidate later: structured `olderMelaRank` etc. Needs an owner decision on whether the page has a "History" section at all. |
| `editor_notes[]` (24) | The editors' footnotes and errata | Do not import. About the edition, not the raga. |
| `sources[].verbatim_quote` (1,259) | English translators' words | Do not import. Use only `page`/`printed_page`/`confidence`. |
| `sloka.notes`, `murcchana.notes`, `prayogas[].note(s)` | Extractor commentary | Do not import. |

`movement` is `checkProse`-validated, max 1000 chars, "our own plain words, never a source's
sentences". The importer cannot generate it from SSP's English. Either write a template from the
structured fields (a sentence builder like `artistMetaDescription`: "Any of its seven notes can
carry a phrase... Ri, Ga, Ma and Ni most of all. Dha is D2 only in three phrases.") or leave it
empty. Recommend a deterministic builder over jiva/nyasa/anya (S/M), not a model. It is the one
place where free text can be defended as ours, because every clause is generated from a
cited field. It then cites the same locators as those fields.

## 7. learn_from to keyCompositionIds

`keyCompositionIds` takes rasika.life composition ids (max 5), "must resolve to a composition
in this raga" (plan). `learn_from` has 51 entries in 32 ragas:

- 46 have `composition_id` (all are SSP-internal ids, `comp_ssp-2008-english-vol-1_...`).
  Those compositions are SSP's own sections in vol 1-3's `compositions.jsonl` (392 in vol 1 alone):
  the book's own gītas, tānas, sañcāris and kīrtanas printed after the lakshana. They are not
  rasika.life compositions.
- Form breakdown: gīta 25, kīrtana 7, sañcāri 7, tāna 5, tāna varṇa 1 (Bhairavi's Viriboni),
  śūḷādi 1, lakṣya prabandham 1, null 4. 35 name a composer, 16 name none.
- Many are form-only ("gīta", "tāna", "sañcāri", "the lakṣyas that follow..."): a generic
  gīta/sañcāri, not a piece anyone can look up. These can never resolve. (A "form-only" drop
  was already done once: review kind `learn_from_dropped_form_only`.)
- Only named, composed pieces can resolve: e.g. `viribōṇi` (Adiyappa, varnam, Bhairavi),
  `himācalakumārīm` (Muttusvāmi Dīkṣita, Jhaṅkārabhramari).

Resolution rule: normalise the title (`fromItrans`/`looseKey` from `match.ts`) and the composer,
look in rasika.life for a composition with that title **in this raga** (junction
`CompositionRaga`), accept an exact or `foldKey` match; ambiguous or none -> report row, no id.
Never create a composition. Expect few: single digits to low tens of resolutions. The
importer reports unresolved names in a CSV; the owner can add the id by hand. Where nothing
resolves, `keyCompositionIds` stays empty and the page falls back to ranked compositions.
Do not store the SSP gītas as `keyCompositionIds`.

## 8. Citations

- **Slug.** `ssp-2008-english` exists in `sources-2026-10.csv` (not yet confirmed imported to
  prod: the prod export shows 0 raga citations). The extraction was read from this edition, so
  the honest citation is `ssp-2008-english` with an English-edition page. Citing
  `ssp-1963-tamil` for facts read from English would be false. Owner decision (section 11).
  A third option that follows the plan literally: re-read the Tamil scan, which is much more
  work and is a separate project; use English as the stop-gap.
- **Licence line in the source row** ("Used to check facts read in the Tamil edition, never
  quoted or reworded") is wrong once the English edition is the reading source. It needs an
  edit if the owner chooses English as primary.
- **Locator.** Use the printed page: `p. 390` or `pp. 390-391` (min-max of the field's source
  pages). Every `sources[]` entry carries both `page` (pdf page, 433 for Bhairavi) and
  `printed_page` (390). A reader with the book looks at the printed number, and the Bhairavi
  example already uses printed numbers. Do not put pdf pages in the locator. Keep the pdf page in
  the report only. Format: `p. 390` (one page), `pp. 390-391` (range), as in the Bhairavi CSV.
- **Field -> citation.** One citation per imported field, built from the `sources[]` entries with
  that `field` name (raga_class, scale_type, graha_swaras, time_of_day, jiva_swaras,
  nyasa_swaras, prayogas, anya_swaras, learn_from). Map: `raga_class`->`isBhashanga`;
  `graha_swaras`->`grahaSwaras`; `jiva_swaras`->`jivaSwaras`; `anya_swaras`->`anyaSwaras`;
  `learn_from`->`keyCompositionIds`; `prayogas`->`prayogas`; `scale_type`->`scaleType`;
  `time_of_day`->`timeOfDay`. `movement` cites the union of the fields it is built from.
  `sources[]` has 11 fields per raga at most, but 12 imported fields x up to 2 readings keeps
  each raga under the 100-citation cap by far.
- **Confidence.** `sources[].confidence` where present; else the murcchana or phrase confidence;
  take the minimum over a field's phrases.
- **Tradition.** "Dikshitar school" for lakshana facts (matches the Bhairavi CSV). For a
  sloka-only fact: "Venkatamakhi (sloka)".
- **Note** <= 300 chars, our own words only (e.g. the jiva "all seven, these four most of all"
  note).
- `citations` replaces the whole list on update. The importer must merge onto stored rows
  (CLAUDE.md rule on list attributes): keep other sources' citations, replace only
  `ssp-2008-english` ones for the fields it writes.
- `assertSourcesExist` refuses a citation to a missing source, so import `sources-2026-10.csv`
  first (domain `source`).

## 9. Gating: unmarked octaves and uncertain variants

### Unmarked octaves (`octave_unmarked`)

- 358 of 1,178 phrases in 84 ragas; 32 ragas have every phrase unmarked. 25 murcchanas.
- 21 of the 358 unmarked phrases still carry an octave mark. These come from the "murcchana's
  top S" inference, or are mixed.
- Owner decision (handoff table): show without octave marks, no inference except the
  murcchana's top S.
- Importer rule: for an `octave_unmarked` phrase, strip every `'` and `.` before validation and
  storage. For murcchana lines strip them anyway (section 5). Store the other (marked) phrases
  with their marks, since `validatePhrase` accepts them.
- A phrase with no octave marks that contains a leap past the tonic octave reads wrong;
  not checkable here; fine for display.

### Uncertain variants (`variant_uncertain`)

- 56 in the data: 45 flagged phrases (44 in prayogas + 1 `variant_note`), 4 murcchanas, 7 anya
  entries. 22 ragas affected: `aṭhāṇā`, `bhairavam`, `bhairavi`, `bilahari`, `ghaṇṭā`,
  `gōpikāvasantam`, `haṃvīru`, `huśāni`, `jujāvanti`, `kannaḍa`, `mukhāri`, `mādhavamanōhari`,
  `mārgadēśi`, `māñji`, `nīlāṃbari`, `rudrapriyā`, `rāmakali`, `saurāṣṭram`, `sāvēri`,
  `vasanta`, `āhiri`, `ānandabhairavi`. Musicians vet these in the claude.ai artifact named in
  STATE.md.
- A wrong variant (`D1` for `D2`) would put a wrong note on a public page about a real raga,
  the same class of error as a wrong arohanam. Rule: **hold, never import, an item flagged
  `variant_uncertain` until the vetted answer is in.** Held items go to a `held.csv` with the
  reason, so they are reachable.
- Procedure: the musicians' answers come back as a CSV (`path`, `decision`: keep / replace
  with token / drop). The importer reads it and applies it. Until then the 22 ragas import
  every other field.
- 19 of the 44 flagged phrases are also `octave_unmarked`; hold wins.
- `text_vs_image_conflict` (59): the extractor saw the text layer and the page image disagree.
  Same rule: hold the item until a person resolves it. (These were not in the task brief; they
  are in `review.jsonl`.)
- Whole-record gate: `verification_status` is `pending_self_verification` on all 191. The
  verification pass (`ssp_verify.py`) covers quotes only (4,807 of 4,907 on the cited page).
  Decide: waive it for the first import (start with the 72 melas, as ordered) or run a
  second-agent check of notation first.

## 10. What the importer should be

Compare:

- `research-ingest` (`mergeResearch`, `citeFill`): per-field validators, CSV out, refusal
  report, **writes only empty cells**, cites web URLs. Wrong fit in two ways: SSP must overwrite
  uncited legacy values (timeOfDay), and its citations carry book pages and traditions, not URLs.
  But its shape (validators in core, dry run, refusal report, ordinary admin CSV) is the right
  one, and `mergeResearch` is reusable for the "fill if empty" fields.
- `source-*` pipeline (CLAUDE.md "Composition sources"): adapter -> `SourceRecord` -> match ->
  human `decision` CSV -> `source-apply` (plans against the record as it stands, writes a
  manifest) -> `source-undo`. This matches the SSP need almost exactly: a source outside the
  repo, name matching that needs a person, a reviewable CSV, and an undo. It fits ragas as a
  `domain: 'raga'` flavour of the same four verbs.

**Recommendation: a new `ssp-import` command family in `packages/scripts`, built like `source-*`,
not like `research-ingest`**, with the logic in `packages/core/src/domain/raga/ssp.ts`
(browser-safe, unit-tested; `packages/scripts` has no vitest) and the glue in
`packages/scripts/src/sspImport.ts`:

1. `ssp-match --dir <ragas.jsonl dirs> --out ssp-matches.csv`
   Reads the three `ragas.jsonl`, the prod raga list (via `AdminData.listAllForDomain('raga')`),
   builds one row per SSP raga: SSP section, prod candidate id/name, tier (exact / variant /
   mela-number / none), conflicts (mela number differs, scale contradicts, duplicate SSP name),
   and a `decision` column (`attach` / `skip` / `create`). Melas are matched by number plus a
   reviewed name table. **Never creates a raga**; `create` is only an instruction for the owner
   to follow later via the ordinary path. Pre-fill `attach` only for exact-name + mela-agree +
   scale-compatible rows.
2. `ssp-csv --matches reviewed.csv --held vetted.csv --out raga-ssp.csv --report refused.csv`
   Builds the admin raga CSV (columns `id` + `timeOfDay, scaleType, isBhashanga, jivaSwaras,
   nyasaSwaras, grahaSwaras, anyaSwaras, prayogas, movement, keyCompositionIds, scaleReadings,
   slokas, citations`), applying section 2's map, the validators, the holds, and a refusal report
   with a reason per dropped item. It does not touch `arohanam`, `avarohanam`, `melaNumber`,
   `parentRaga`, `description`, `rasa`, `season`.
3. `ssp-apply --file raga-ssp.csv --user <id> [--dry-run]` and `ssp-undo --manifest <file>`
   Use a planner like `planAttach`: read the stored raga as it is at run time, merge citations
   onto the stored list, write a manifest of before-values, so an undo restores them. Plain
   `admin-csv-import` is not enough: it replaces `citations` and list fields whole (an
   `update` `.set` on a list), and has no undo.

   If the owner prefers fewer parts, `ssp-csv` alone + `admin-csv-import` works for the first
   run on the 72 melas where the raga rows have no stored citations; but the merge-on-citations
   point is a correctness issue for everything after.

Why core, not scripts: the mappings (time table, set selection, prayoga label map, phrase
normalisation, held-item rules, citation builder) are the rules and are the easy part to get
wrong. Same reason `dedup.ts` and `research.ts` live in core.

Order (matches owner order, 72 melas first): import `sources` sheet, run `ssp-match`, review,
`ssp-csv` for melas, dry run, apply, reindex (`pnpm cli reindex`; this also clears the page
cache), then janyas by `data/ssp-janya-ranking.json`.

## 11. Build list

Sizes: S under half a day, M about a day, L multiple days.

| # | Item | Files | Tests | Size |
|---|---|---|---|---|
| 1 | Schema: `scaleReadings` (list of `{label, arohanam, avarohanam, sourceSlug, locator, tradition?, note?}`), `slokas` (`{text, author, sourceSlug, locator, note?}`, max 1-2) on raga: entity, `CreateRagaSchema`, admin columns (JSON), `bulk-data`, CITABLE or self-sourced; keep `shownRaga` consistent | `domain/raga/{schema,entity,client}.ts`, `admin/columns.ts`, `admin/bulk-data.ts`, `domain/raga/sourced.ts`, `domain/raga/thin.ts` (count the new fields as content) | schema accepts/rejects; CSV round trip; `columns.test.ts` sync | M |
| 2 | Raise the `prayogas` cap from 20 (14 ragas hold 21-42) or pick the best 20 per raga by rule; cite the choice | `schema.ts` (+ page truncation "show first 8") | schema test | S |
| 3 | `domain/raga/ssp.ts`: `sspTimeOfDay(text)` closed table (held for ambiguous), `pickJivaNyasa(set)`, `cleanPhrase(raw, {octaveUnmarked})`, `cleanSchoolScale(line)` (strip marks, split `|`, no-S allowed), `prayogaLabel(raw)`, `scaleTypeFrom(lakshana, sloka, tokens)`, `citationsFor(record)` with printed-page ranges, `movementFrom(record)` | new file in `packages/core/src/domain/raga/` + subpath export in `package.json` | table-driven tests with the real values above (Bhairavi, Āhiri, Huśāni podi, Sāraṅga jhanta, a murcchana with `|`, a no-S murcchana) | L |
| 4 | Gates: `heldItems(record, vetted)` (variant_uncertain, text_vs_image_conflict, podi, modernist, single-token phrases); `swarasOutsideRaga` check per set | in `ssp.ts` | each rule tested on a real sample | M |
| 5 | `sspMatch(sspRecords, prodRagas, overrides)`: exact/variant/mela-number tiers, conflict flags (mela differs, scale contradicts, duplicate SSP name, junk heading), reviewed mela name table | `domain/raga/ssp-match.ts` | `kannaḍa`!=`kAnaDA`, `mukhāri` twice, mela 29 with six parentless rows, mela mismatch | M |
| 6 | `learn_from` resolver: normalise title + composer, resolve within the raga's junction rows, report unresolved | `ssp.ts` + `packages/scripts` | resolved (`viribōṇi`), form-only dropped, ambiguous held | M |
| 7 | CLI: `ssp-match`, `ssp-csv`, `ssp-apply` (merge citations, manifest), `ssp-undo` | `packages/scripts/src/sspImport.ts`, `cli.ts` | manual dry run on prod (read), check manifest | L |
| 8 | Page: render `scaleReadings` ("Also written as", named), `slokas` (verse, author, source), second time-of-day reading, print each citation's tradition | `routes/carnatic.ragas.$ragaid.tsx`, `lib/raga-page.ts`, `lib/structured-data.ts` (only cited fields), `lib/raga-description.ts` | `raga-page.test.ts`, structured-data round trip | M |
| 9 | Fix `sources-2026-10.csv` row `ssp-2008-english` licence text once the slug decision is taken; import the sources sheet to prod | `docs/research/sources-2026-10.csv` | `assertSourcesExist` | S |
| 10 | Run: melas first (72), dry run, review the refusal report, apply, reindex, spot-check 5 pages, then janyas by search volume | n/a | | M |
| 11 | Docs: CLAUDE.md section for `ssp-*`, plan phase 3 status, STATE.md next step | `CLAUDE.md`, `docs/plans/261027-01-raga-depth.md` | | S |
| 12 | Optional: `ragaClass` (upanga/bhashanga/raganga) | schema + page | | S |
| 13 | Optional later: structured `history` (older mela rank) and gamaka model | | | L, not now |

Suggested order: 3, 4, 5 (pure functions first); 1, 2; 7; 8 in parallel; 6 (late, small yield);
10.

## 12. Owner decisions needed

1. **Citation source.** Cite `ssp-2008-english` (what was read), or re-read the Tamil
   edition first? If English: change its licence line, and accept that English page numbers go
   on the public references list.
2. **Match review.** The 20 unmatched, 52 variant-only and 22 mela-disagreement rows need a
   person. Specifically: `kannaḍa` vs `kAnaDA`; the mela name table (SSP name -> rasika id for
   72 melas, given prod's messy mela rows); never auto-create a raga from SSP.
3. **`all times`.** Import `universal` for the 60 melas and 88 janyas, or only where SSP names
   an actual time? And whether SSP's value overwrites the 20 differing, uncited prod values.
4. **Ambiguous yāma values** (first yāma, second yāma, fourth yāma, fifth yāma): hold, or map?
5. **Sloka vs vivarana** (22 time, 7 scale): value = vivarana, sloka reading in a second
   citation note. OK?
6. **New scale field** (`scaleReadings`) instead of `alternateScales`, and where it prints.
7. **Slokas.** Publish the verse verbatim after a verification pass, with two editor-supplied
   ones attributed to the Caturdaṇḍīprakāśikā. A verification pass on `text_iast` first?
8. **Jiva and nyasa**: store `most_ranjaka` and put "all seven" in the citation note (my
   recommendation), or add an `all` field.
9. **Prayoga cap** (20 -> 50?) or rule-based selection; and whether the 6 pōḍi phrases and the
   4 modernist phrases stay out (my recommendation: yes, hold).
10. **Prose.** Confirm that `other_facts`, `historical_notes`, `editor_notes`, `rules`,
    `gamaka_rules.where`, and `verbatim_quote` are not imported, and that `movement` is built by
    a deterministic template from structured fields (or left empty).
11. **History and gamakas**: is there a future "History" section or gamaka model? If yes, the
    fields are kept in the extraction and not lost.
12. **Gate.** Waive `pending_self_verification` for the first (mela) import, or run a
    notation re-check first? Hold `variant_uncertain` (56) and `text_vs_image_conflict` (59)
    until answered.
13. **`ragaClass`** (upanga, raganga) as a field, or `isBhashanga` only.
14. **`learn_from`**: accept that only a handful will resolve to rasika.life compositions, and
    that SSP's own gītas and sañcāris are not `keyCompositionIds`.
