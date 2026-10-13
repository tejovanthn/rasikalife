# Filling the artist corpus with an outside agent

The same three-step shape as `raga-enrichment.md` — cut batches, delegate the fetching, validate
everything on the way back — with one difference that changes the whole design.

**A raga's name is its subject. A person's is not.** Handed `kalyANi`, a worker can only be
researching Kalyani. Handed `Hariharan`, it comes back with the playback singer's biography,
correctly sourced and about the wrong man — this corpus's Hariharan is an instructor with eight
events. The same trap sits under `Arjun Kumar`, `Shashank`, `S. Krishna` and most of the list. So
every artist record in a packet carries a **`context` block** built from the database, and the
brief's first rule is to settle identity against it before spending a lookup.

| step | who | touches the database |
|---|---|---|
| cut batches | `pnpm cli research-batches --domain artist` | reads |
| research | any agent, any model, anywhere | **no** |
| validate, merge, import | `pnpm cli research-ingest` → `admin-csv-import` | writes |

## What is researched, and what is refused

Six fields: `website`, `socialLinks`, `city`, `specialisations`, `birthPlace`, `activeYears`.

**The omissions are the design**, and they are enforced in `RESEARCH_FIELDS` rather than only
asked for in the brief — a worker that sends one anyway has it thrown away with a reason:

- **`biography`.** `domain/artist/media-kit.ts` states the rule: every artist platform lets a
  press-kit paragraph *become* the record, which is how biographies fill with claims nobody
  checked, and `rewrite-artist-bios` exists to drain that field back to narrative once the facts
  are in fields. Crawling promotional prose in refills what the pipeline was built to empty.
  Prose here is **derived from fields** — by `artistMetaDescription` for search results and by
  the media kit for a press paragraph — never researched into them.
- **`photoUrl`.** A raga's scale is a fact; a photograph is someone's copyrighted work. It also
  cannot travel this path: the column is deliberately absent from `ADMIN_CSV_DOMAINS`, and
  `packages/og-image`'s `isAllowedPhotoUrl` pins the fetch to the CDN host — an external URL
  would store cleanly and silently degrade every share card to text. Photos belong to the upload
  flow.
- **`birthYear`** — a claim about a private individual, and many here are children performing an
  arangetram. Note the column *is* writable by CSV; the field list is the only thing stopping it.
- **`gurus`** — the credential in this domain, and prose flattens exactly the distinction
  `GURU_RELATIONSHIPS` exists to keep. A workshop attendee and a senior disciple both read as
  "studied under".

## Run it in this order

1. **`pnpm prod-cli enrich-artists --apply` first** (done, 2026-08-09). It fills `instrument`
   from stage credits for free, and the packets report it under `context.roles` — which is a
   large part of what makes identity checkable.
2. **Then the head of the corpus, busiest-first.** `--min-events 2` drops the 957 artists with
   fewer than two appearances. That is not a coverage decision, it is the identity one: an artist
   with no appearances has no context block, so a worker has nothing to check the person
   against — the exact case that produces a confident biography of a namesake. Researching them
   needs a different method, not a laxer one.
3. **Deduplicate at some point, but it is not blocking.** About 20 exact-name groups and 20 near
   pairs at `findArtistMatch`'s 0.85 threshold — 3%, against the ragas' 20%. There is no
   `dedup-artists` command yet; `domain/artist/dedup.ts` holds the matcher. It misses
   `Phanindra Bhaskara` beside `Phanindra Bhaskar`, because the surname must match outright.

## Cutting the batches

```bash
pnpm prod-cli research-batches --domain artist --out-dir ./data/artist-research/main \
  --size 25 --min-events 2
```

212 records, 9 batches. Put the run under `data/`, which is gitignored, so a result file survives
a session ending without being committed.

Each record carries `id`, `name`, what is `missing`, what is already `current`, and:

```json
"context": {
  "appearances": 8,
  "roles": ["mridangam"],
  "venues": ["Prestige Centre for Performing Arts (PCPA)", "Rama Mandira"],
  "organisers": ["Sree Ramaseva Mandali, Ramanavami Celebrations Trust"],
  "artForms": ["carnatic"],
  "firstSeen": "2020-03-29", "lastSeen": "2026-08-07",
  "performsWith": ["Giridhar Udupa", "Sikkil Gurucharan", "G Guruprasanna"]
}
```

`performsWith` is usually the strongest signal of the lot — an accompanist is identified by who
they accompany far more reliably than by a surname.

## Ingesting what comes back

```bash
pnpm prod-cli research-ingest --domain artist --dir ./data/artist-research/main \
  --out artist-filled.csv --report artist-refused.csv
pnpm prod-cli admin-csv-import --domain artist --file artist-filled.csv --user <id> --dry-run
pnpm prod-cli admin-csv-import --domain artist --file artist-filled.csv --user <id>
pnpm prod-cli reindex
```

**Read `artist-refused.csv` before importing, and read the filled CSV too.** The raga run's
lesson holds and is sharper here: a refusal count of zero measures the pattern, not the prose.
The specific thing to scan for is a *cluster of plausible values on one artist* — a city, a
website and a specialisation that all agree with each other and all belong to somebody else. The
validator cannot see that; only the `notes` column and a person can.

**`notes` is the most useful column in an artist run.** A worker told to refuse when it cannot
settle identity will say so there, and those rows are the ones worth a human lookup.

## Ranking by search demand (2026-10-13)

`docs/research/artist-priority-2026-10.csv` ranks all 1,169 artists by how often people search for
them, so a batch can start with the pages that can earn traffic. `research-batches` orders by
event count, which is a different thing: the most-searched names here are composers and touring
stars with zero or one event.

How it was built (scripts in `data/artist-priority/bin/`, gitignored with the inputs):

1. **A search spelling per artist.** Stored names are scholarly romanisation, and Google gets
   nothing for them: `Annamaacaarya` has 0 searches, `annamacharya` 5,400. Eight Sonnet agents
   wrote one `search` spelling, an optional `alt`, and an `ambiguous` flag per record, from
   packets holding the name, instrument, event roles and composition titles.
2. **Volume** from Keyword Planner (the `rasika.life` preset: India + US, English), one exact
   lookup per spelling.
3. **Search Console** impressions and clicks per artist page, 2026-07-13 to 2026-10-12, with the
   `/events` and other subpages added to their artist.

The sort key is unambiguous `monthly_searches`, then impressions, then events. Ambiguous rows
rank on impressions alone.

Three traps, each of which put a wrong number at the top of the first draft:

- **Close variants.** Keyword Planner folds similar keywords into one row and lists the others
  as `close_variants`. Copying the row's volume to its variants gave `s kalyanaraman` 14,800;
  asked alone it has 110. Use only a keyword's own row, and ask again for any keyword that was
  folded away.
- **`alt` spellings are not scored.** They often drop the initial (`rajam`, `kalyanaraman`,
  `gnb`) or name someone else (`chinna jeeyar` for Yathiraja Jeeyar). Their volume is in
  `alt_monthly_searches` for a person to read.
- **The ambiguous flag misses some.** `anand vishwanathan` has 49,500 searches, nearly all for
  the chess player. The overrides are a short list in `merge.py`; add to it rather than editing
  the CSV.

Read the top rows before trusting them. A saint's volume (Raghavendra Swamy 135,000, Tulsidas
74,000) is demand for the person, not for our one-composition page about them, and Wikipedia holds
that query. The performers are where enrichment can move a ranking.

## What the first run taught (2026-08-10, 212 records, 9 batches)

All nine came back complete — 212 records, 177 with at least one field, 35 refused outright, and
**zero records claiming a field without a source**. The identity rule worked exactly as intended:
`Hariharan` came back empty with *"This is NOT the playback singer Hariharan"*, and `Team` with
*"not an individual artist… a placeholder for an accompaniment ensemble"*.

**The one systematic fault was `specialisations`, and it was our own fault.** 130 of 177 were the
packet's own `roles` handed back capitalised — `roles: ["violin"]` returned as
`["Carnatic violin"]`. The context block is supplied for *identity*, and a model asked to fill a
field will fill it from whatever is in front of it. Since `enrich-artists` had just written
`instrument` from those same credits, importing them would print the instrument twice on one
page. `withoutRedundantSpecialisations` now drops them at merge time, per entry rather than per
field — because the same run also returned real additions: Sid Sriram's "Playback singing", Shubha
Mudgal's "Khayal", "Thumri", "Dadra", Giridhar Udupa's "Konnakol" and "Morsing".

**A specialisation contradicting the derived `instrument` is usually not an error.** Six looked
wrong and all six were right: Ranjani and Gayatri of the Ranjani-Gayatri duo both began as
violinists; H M Smitha and Sindhu Suchethan are violinist-vocalist sisters; Vighnesh Bhagwat is a
harmonium accompanist with a master's in Hindustani vocal. Read the note before removing one.

**The workers found four faults in our own data, which is worth more than a field.** Read the
`notes` for these — no validator can produce them:

| record | what they found |
|---|---|
| `Neyveli Venkatesh` | stored `instrument: vocal`; he is a documented mridangist, and the role was scraped from the event *title* ("Carnatic Vocal Concert") rather than his credit |
| `Shashank` | `flute, tabla` — the tabla credit "cannot belong to the same person"; two people share one record |
| `Dushyanth Sridhar` | identity refused: the notable one is a harikatha exponent, so the keyboard record is somebody else of the same name |
| `Padmini Ravi` | credited chief-guest, correctly filling no instrument |

**Importing 1,169 rows took eight hours, and that was a bug.** `updateArtist` fired
`cascadeArtistNameUpdate` whenever the payload carried a name rather than when the name changed,
and every exported row carries `name`. Fixed; a full pass now runs in about ten minutes. If a
future import crawls, suspect the same shape somewhere else — the CSV submits every column of
every row, so no writer downstream may treat "field present" as "field changed".

**The import is idempotent, so a broken run is resumed by re-running it.** This one died around
row 480 when the machine lost its network (`ENOTFOUND dynamodb.us-east-1.amazonaws.com`,
`EADDRNOTAVAIL`), taking ten rows with it. Nine had nothing to write; one, `Janardhan`, lost a
specialisation. Re-running the same CSV picked it up — each row is a single atomic update and a
blank cell means "leave alone", so nothing is double-applied.

**A wrong `instrument` cannot be fixed by clearing it.** `fillArtistInstruments` refills an empty
field from the same bad role on the next weekly cron, so `admin-clear-fields` is not stable here.
Either correct the value — a filled field is never touched, and a two-column `id,instrument` CSV
through `admin-csv-import` is enough, blank cells meaning "leave alone" — or fix the `role` on the
event's cast, which is the actual source and also corrects the event page.

## What the validator refuses, and why

- **`biography`, `photoUrl`, `birthYear`, `gurus`** — not researched fields; see above.
- **A social host in `website`.** Both columns feed `sameAs` in the JSON-LD, so the same account
  arriving twice publishes one profile as two claims about the person.
- **A `socialLinks` entry whose host does not match its platform.** The cheap failure is a handle
  guessed from the artist's name, which points a reader at a stranger's account.
- **A `city` or `birthPlace` containing a digit, or more than one comma.** A house number or a
  postcode is not a place name, and `Mylapore, Chennai, Tamil Nadu, India` is an address where
  the profile wants a city.
- **An `activeYears` that is not a year span.** `over four decades` and `since the early 1990s`
  are what a worker reaches for first, and neither renders beside a dated one. Real years only:
  `1985`, `1985-2010`, `1985-present`, `since 1985`. An en dash is normalised; a backwards span
  or one outside `YearSchema`'s 1800–2100 is refused.
- **More than six `specialisations`**, which is a model listing every art form it has heard of.
- **Praise and hedging anywhere**, via the shared `PUFFERY` and `SPECULATION` lists.
- **A value already stored**, which is never overwritten.

---

## Prompt: the orchestrator

Identical to the raga runbook's, with `raga-NNN.json` read as `artist-NNN.json`. The rules there
about resuming — a `.result.json` is the only record of completion, never re-dispatch a batch
that has one, never delete a partial to "start clean" — apply unchanged.

## Prompt: the worker

> You are filling reference data about performing artists in Indian classical music and dance for
> an encyclopedia. These are real, mostly living people, and the page you are filling is one they
> can read. Accuracy matters far more than coverage: a blank field is a correct answer, and a
> plausible guess is a false claim about a person.
>
> **Read your batch file first.** Its `brief` array is your rulebook and overrides anything here
> that conflicts. Its `records` array is your work.
>
> **Settle identity before you research anything.** Every record has a `context` block holding
> what this artist was credited playing, the venues and organisers they appeared for, who they
> share a stage with, and the dates. Many names in this corpus are shared — with each other, and
> sometimes with a famous person in another field. Find a source, then check it against the
> context. If the person you found does not match, or you cannot tell, **return no fields and say
> so in `notes`**. A confidently sourced profile of the wrong person is the worst thing this run
> can produce, and it is worse than an empty page.
>
> **Do not research a biography, a photograph, a birth year, or who the artist studied under.**
> They are not fields here and anything you send for them is discarded, so a lookup spent on one
> is wasted.
>
> **The fields, and the exact shapes that survive the validator:**
> - `website` — the artist's own site, one http(s) URL. A Facebook, Instagram or YouTube page is
>   **not** a website; it belongs in `socialLinks` and is refused here.
> - `socialLinks` — `[{"platform":"instagram","url":"https://instagram.com/…"}]`. Platform is one
>   of instagram, facebook, youtube, twitter, wikipedia, spotify, apple_music, soundcloud. The
>   host must match the platform. **Never guess a handle from the name.**
> - `city`, `birthPlace` — a city name: `Chennai`, `Bengaluru`. No digits, at most one comma. A
>   state or country alone is not enough; leave it blank.
> - `specialisations` — up to six plain noun phrases: `Carnatic vocal`, `Ragam Tanam Pallavi`,
>   `Bharatanatyam`.
> - `activeYears` — real years only: `1985`, `1985-2010`, `1985-present`, `since 1985`. "Over four
>   decades" and "since the early 1990s" are refused outright.
>
> **No praise and no hedging.** The validator throws out any value containing: renowned, premier,
> iconic, prestigious, leading, legendary, famous, acclaimed, eminent, illustrious, foremost,
> world-class, unparalleled, vibrant, majestic, soul-stirring, hauntingly, mesmerising; "one of
> the oldest/most/largest/finest/greatest"; implying, presumably, apparently, seemingly, likely,
> appears to, seems to, possibly, probably, may have been, might be, reportedly, is believed to,
> thought to be, unclear, "not sure".
>
> **Working method.** Do the records in order. Write your result file after **every 3 records**,
> overwriting it each time with everything accumulated so far — if you are stopped, only the
> unwritten tail is lost. Budget 1–3 lookups per artist and move on; much of this corpus is
> accompanists and students with no web presence at all, and finding nothing is the expected
> outcome for many of them.
>
> **Output** — a JSON array at `<batch-path-without-.json>.result.json`, one object per record you
> attempted, in the input order:
>
> ```json
> [{"id":"...","name":"...","fields":{"city":"Chennai","activeYears":"since 2015"},
>   "sources":["https://..."],"notes":"identity confirmed via the Gayana Samaja listing"}]
> ```
>
> Include only fields you actually found; omit the rest. `fields` may be `{}`. **Put how you
> settled identity in `notes`, every time** — it is the column a person reads first.
>
> **Finish** by reporting how many records got at least one field, how many you refused on
> identity, and anything contradictory across sources.
