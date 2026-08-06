# Filling the raga corpus with an outside agent

The raga corpus is 1,869 records and almost entirely empty in the fields that make a page worth
reading: **1 of 1,869 has a description**, 1 has a rasa, 1 has a timeOfDay, and 677 have no
arohanam at all. That is too much work for an expensive model, and it does not need one — the
fetching is cheap and the *checking* is what carries the risk.

So the work splits in three, and only the middle part leaves this repo:

| step | who | touches the database |
|---|---|---|
| cut batches | `pnpm cli research-batches` | reads |
| research | any agent, any model, anywhere | **no** |
| validate, merge, import | `pnpm cli research-ingest` → `admin-csv-import` | writes |

Nothing a worker produces reaches the database without passing `packages/core/src/admin/research.ts`,
which is unit-tested. **Every rule a worker is told in prose is also enforced there**, because a
prompt and a validator that disagree is how a rule quietly stops applying.

## Run it in this order

1. **`pnpm cli dedup-ragas` first.** Around 312 of the 1,869 are a second copy of a raga already
   in the corpus — `kharaharapriyA` sits beside `kharaharapriyA (shrIrAgam)` today. Researching
   before merging spends the budget twice and writes the answer onto a page that is about to
   become a redirect. (Done: the corpus is 1,526 records now.)
2. **Then the 72 melakartas' own numbers and scales — computed, not researched.** A melakarta's
   scale *is* its number: M1 below 37 and M2 above, the (Ra, Ga) pair from the chakra and the
   (Da, Ni) pair from the position inside it. So the whole of `melaNumber`, `arohanam` and
   `avarohanam` for all 72 falls out of `MELAKARTA_LINKS` (`packages/web/app/lib/melakarta-links.ts`)
   with no lookup and no chance of a wrong scale. Do not spend an agent on it. Three of the 72
   already stored a scale and all three matched the derivation, which is the check that the
   number-to-record map is right.
3. **Then the 72 melakartas as their own research batch**, for the fields that are not derivable
   — description, tradition, rasa, timeOfDay, season. They are canonical and well-documented, so
   they are the cheapest records to get right, and every raga page that names a parent links here.
4. **Then everything else, busiest-first.** The signal is compositions attached: scan the
   `composition_raga` junction and rank by it. Of 1,526 ragas, 667 carry a composition and the
   head is steep — `shankarAbharaNa` has 322, the 143rd-busiest has 10. Feed that order in with
   `--ids`, so the batches that get researched first are the pages people already reach.

Two flags exist for step 3 and 4: `--ids <file>` takes one id per line (`#` starts a comment) and
both selects and orders, and `--exclude-ids <file>` drops what an earlier pass covered. A run is
cut in passes, so the order records appear in has to be something the caller can state.

**Watch the melakartas stored under asampurna names.** Ten or so of the 72 records are named for
the Dikshitar-school raga rather than the Kanakangi-Ratnangi one — mela 17 is stored `chAyAvati`,
51 `kAshIrAmakriya`, 69 `dhautapancamam`. The ids are right; the names are the other tradition's.
An asampurna raga need not be sampurna, so a researcher should check the source scale against
what is stored and say so rather than assume.

## Cutting the batches

```bash
pnpm cli research-batches --domain raga --out-dir ./raga-batches --size 25
```

Writes `raga-001.json … raga-075.json` plus a `manifest.json`. Each packet is self-contained: it
carries the field list, the rules, and for every record its `id`, `name`, what is `missing` and
what is already `current`. A worker needs no other context, and should not be given a prompt that
restates the rules — the packet is the contract.

Put the run under `data/`, which is gitignored, so a result file survives a session ending
without being committed. This run used `data/raga-research/melakarta/` and
`data/raga-research/main/`, with the id lists beside them.

A worker prompt may still carry a **fact about its batch** that the cutter could not know —
"every record here is one of the 72 melakartas, so leave `parentRaga` blank". That is context,
not a rule, and the distinction is worth keeping: a rule restated in a prompt can drift from the
validator, a fact cannot. It is also worth telling a worker the validator's refused vocabulary
outright, since a description thrown out for the word "renowned" is a whole lookup wasted.

## Ingesting what comes back

```bash
pnpm cli research-ingest --domain raga --dir ./raga-batches \
  --out raga-filled.csv --report raga-refused.csv
```

Reads every `*.result.json` in the directory, validates each value, and writes an ordinary admin
CSV plus a refusal report saying what was thrown away and why. A truncated result file is skipped
with a warning rather than taking the rest of the run down with it. Then:

```bash
pnpm cli admin-csv-import --domain raga --file raga-filled.csv --user <id> --dry-run
pnpm cli admin-csv-import --domain raga --file raga-filled.csv --user <id>
pnpm cli reindex
```

**Read `raga-refused.csv` before importing.** It is the most informative artefact in the run: a
refusal rate that is suddenly high, or clustered on one field, means the workers misread the brief
and the batch is worth re-running rather than accepting.

## What the validator refuses, and why

- **`melaNumber` from a worker — always.** A janya stores its *parent's* mela number, which is
  exactly the fact a model gets subtly wrong. It is derived from the parent record after the
  merge, where it is free and correct.
- **Anything that is not swara notation** in `arohanam`, `avarohanam`, `alternateScales`. This is
  the field people search for, and a wrong scale actively misleads. Prose, `sa ri ga` spelled as
  words, and IAST diacritics are all refused.
- **A description that ranks, praises or hedges.** "One of the greatest", "the most popular",
  "likely a janya of…" — none is a fact, and all read as authority.
- **Off-enum `tradition` or `timeOfDay`**, and a value already stored, which is never overwritten.

---

## Prompt: the orchestrator

> You are coordinating a bulk reference-data research run for rasika.life, an Indian classical
> arts encyclopedia. The work is already cut into self-contained batch files; your job is to get
> them processed, not to do the research yourself and not to touch any database.
>
> **Input.** A directory of `raga-NNN.json` batch files and a `manifest.json` listing them. Each
> batch holds 25 raga records and its own `brief` — the rules the worker must follow.
>
> **What to do.** For each batch that has no `raga-NNN.result.json` beside it yet, dispatch one
> worker with the worker prompt below and the path to that batch. Run several in parallel, but
> keep the number modest — these runs are long, and a provider rate limit that kills ten agents at
> once loses more than it saves. Four at a time is a reasonable default; drop to two if you start
> seeing rate-limit errors.
>
> **Resuming.** A run will be interrupted. Treat the presence of a valid `raga-NNN.result.json`
> as the only record of completion, and never re-dispatch a batch that has one. If a worker dies
> partway, its partial file is still valid and useful — the ingest step reads whatever is there,
> and a later run can top it up. Do not delete a partial result to "start clean".
>
> **What you must not do.** Do not edit batch files. Do not merge, combine or reformat results —
> the ingest step does that and validates as it goes. Do not connect to any database, run any
> `admin-csv-import`, or "fix" a value a worker left blank. A blank is a correct answer.
>
> **When you finish**, report: how many batches have results, how many records those cover, and
> any batch that failed repeatedly. Say plainly if coverage is partial. Do not estimate quality —
> the validator measures that, and you cannot see it.

## Prompt: the worker

> You are filling reference data about Indian classical ragas for an encyclopedia. Accuracy
> matters far more than coverage: a blank field is a correct answer, and a plausible guess is a
> false claim on a page people rely on.
>
> **Read your batch file first.** Its `brief` array is your rulebook and overrides anything here
> that conflicts. Its `records` array is your work; each has an `id`, a `name`, the fields that
> are `missing`, and the values already `current` — never research a field that is already
> current.
>
> **Names are stored in ITRANS**, so `dhEnukA (dhunibhinnashadjam)` is the raga usually written
> "Dhenuka", and the bracket holds its aliases. Search the ordinary spelling, and use the bracket
> to confirm you have the right raga. Common sources: Wikipedia, rasikas.org, karnatik.com,
> ragasurabhi.com, and Sangeetapriya. Prefer a source that names the raga's parent and scale
> explicitly.
>
> **Working method.** Do the records in order. Write your result file after **every 5 records**,
> overwriting it each time with everything accumulated so far — if you are stopped, only the
> unwritten tail is lost. Budget 1–3 lookups per raga and move on when one is not yielding; a
> large fraction of this corpus is obscure and will yield nothing, which is expected.
>
> **The rules that will get your work thrown away if broken:**
> - Never report `melaNumber`. It is derived from the parent raga afterwards and yours is discarded.
> - `arohanam`, `avarohanam` and `alternateScales` must be swara notation only, e.g.
>   `S R2 G3 M1 P D2 N3 S`. Never words, never prose, never diacritics.
> - `tradition` is exactly `carnatic`, `hindustani` or `both`. `timeOfDay` is exactly `morning`,
>   `afternoon`, `evening`, `night` or `universal`.
> - `description` is 2–5 plain factual sentences: what the raga is, whether it is a melakarta or a
>   janya and of what, its mood, when it is sung. No praise, no ranking, no hedging. If you only
>   know one true sentence, write one true sentence.
> - A fact about the parent raga is not a fact about this raga.
>
> **Output** — a JSON array at `<batch-path-without-.json>.result.json`, one object per record you
> attempted, in the input order:
>
> ```json
> [{"id":"...","name":"...","fields":{"rasa":"bhakti","timeOfDay":"evening"},
>   "sources":["https://..."],"notes":"anything you were unsure about"}]
> ```
>
> Include only fields you actually found; omit the rest. `fields` may be `{}`. Put every doubt in
> `notes` rather than resolving it yourself — the notes are read.
>
> **Finish** by reporting how many records got at least one field, and anything you found
> confusing or contradictory across sources.
