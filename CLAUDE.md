# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rasika.life is an Indian classical arts community platform built as a monorepo using SST (Serverless Stack). The platform aims to create a comprehensive resource for documenting, discovering, and discussing Indian classical music and arts.

## Commands

### Development
- `pnpm run dev` - Start SST dev environment (runs all services locally)
- `pnpm run format` - Format code using Biome 
- `pnpm run lint` - Lint and auto-fix code using Biome
- `pnpm run check` - Run Biome checks (lint + format)

### Package-specific Commands
- **Core Package Tests**: `cd packages/core && pnpm test` or `pnpm test:watch` for watch mode
- **Core Coverage**: `cd packages/core && pnpm test:coverage`
- **tRPC Tests**: `cd packages/trpc && pnpm test` (requires SST shell: `sst shell vitest run`)
- **tRPC Coverage**: `cd packages/trpc && pnpm test:coverage`
- **Type Checking**: `cd packages/core && pnpm typecheck` or `cd packages/web && pnpm typecheck`
- **Web Build**: `cd packages/web && pnpm build`

### Infrastructure
- Infrastructure is defined in `/infra/` directory using SST v3
- Database: Single DynamoDB table with 6 GSIs for optimal access patterns
- **SST Development**: Use `pnpm run dev` to start all services with live reloading
- **SST Shell**: Use `sst shell` to run commands with proper AWS environment context

## Architecture

### Monorepo Structure
- **packages/core**: Domain logic, database operations, utilities (TypeScript)
- **packages/trpc**: tRPC API server with domain routers
- **packages/auth**: OpenID Connect issuer for authentication (package name: `@rasika/functions`)
- **packages/scripts**: Utility scripts for data operations
- **packages/web**: React Router v7 frontend application
- **packages/search**: Lambda handler for periodic search index refresh
- **packages/image-processor**: S3-triggered Lambda for image processing (Sharp)
- **packages/og-image**: Lambda that renders OG share images (Sharp); kept separate from the web Lambda because `sst.aws.React` does not bundle `node_modules/` so native modules like Sharp can't live in the React server function
- **packages/scraper**: Data scraping utilities
- **packages/classes**: React Router v7 PWA for Rasika Classes, deployed to `classes.rasika.life` as its own SST site
- **packages/ui**: Shared Tailwind preset, design tokens and the primitives Classes needs. Browser-only; never imports `@rasika/core` outside a `/client` subpath
- **infra/**: SST infrastructure definitions

### Core Package Architecture

The core package uses a domain-driven design with:

- **Single-Table Design**: All entities stored in one DynamoDB table using composite keys
- **ElectroDB**: Entity modeling library wrapping DynamoDB (each domain has an `entity.ts`)
- **Domain Structure**: artist, artist-affiliation, composition, raga, tala, event, festival, venue, organiser, award, user, social-post, rsvp, edit, search, change-history, concert-log, and more
- **Access Patterns**: Optimized for DynamoDB with GSI queries via ElectroDB
- **KSUID IDs**: Time-sortable unique identifiers with domain prefixes
- **Modular Exports**: Package supports selective imports via subpath exports (`@rasika/core/domain/artist`, `@rasika/core/utils`, etc.)
- **Cascade Operations**: Cross-domain data consistency handled in `packages/core/src/domain/cascade.ts`

### Key Technical Patterns

1. **Entity Keys**: Format `[ENTITY_TYPE]#[ID]` for primary keys, `#METADATA` for sort keys on single-record entities
2. **Relationship Keys**: Junction/relationship entities use composite PKs — e.g. `rsvp` uses `pk=RSVP#${eventId}`, `sk=USER#${userId}` so all RSVPs for an event can be queried by PK alone
3. **Versioning**: Content uses `VERSION#v[n]#[timestamp]` pattern for wiki-style updates
4. **ACL Pattern**: Artist management uses granular permission system
5. **Error Handling**: Standardized error codes following `[DOMAIN]_[ERROR_TYPE]` pattern
6. **Validation**: Zod schemas for all domain entities with consistent error messages
7. **Never hand-write a GSI key value.** ElectroDB templates them — `EventArtist.gsi1sk` is `$eventartist_1#eventstartdatetime_<lowercased iso>`, not the bare timestamp — and a raw `SET gsi1sk = :v` silently corrupts the index sort order. Patching the composite attribute through `Entity.patch().set()` recomputes every affected key for free. Where a raw command is genuinely unavoidable, derive keys with `keyOfEntity`/`keysOfEntity` (`packages/core/src/db/keys.ts`); `.params()` on the entity prints the truth if you need to check.
8. **`.set({ x: undefined })` does not clear an attribute.** ElectroDB drops undefined values out of the UpdateExpression entirely, so the attribute survives. Use `.remove(['x'])`. This has caused real bugs twice (a photo caption, a `featureRank`), and both times the test asserted the `.set()` call shape and so passed throughout.
9. **An ElectroDB index over an optional attribute is not sparse.** A missing composite writes the template with an empty suffix (`artist_claim_user#`), producing one hot partition — and on an authorization lookup, a blank argument then matches *everything*. Key such an index on a required discriminator plus a required subject instead (see `ArtistClaim.byActor`).

### Database Design

- Single DynamoDB table with primary key (PK/SK) and 6 Global Secondary Indexes
- Entity relationships managed through composite keys and access patterns
- Pagination using Base64-encoded continuation tokens
- Search uses Fuse.js with a pre-built index stored in S3, refreshed on mutations and on a schedule

### Testing Strategy

- Vitest for all testing with coverage reports
- Mock DynamoDB implementation for unit tests in core package
- Tests collocated with implementation files (`*.test.ts`)
- Global test setup with deterministic ID and date generation
- tRPC tests require SST environment context via `sst shell vitest run`

## Code Conventions

### Formatting & Linting
- Uses Biome for formatting and linting (configured in `biome.json`)
- 2-space indentation, single quotes, semicolons required
- Line width: 100 characters
- Strict TypeScript rules: no explicit any, import type enforcement
- Auto-organizes imports and enforces `import type` for type-only imports
- Specific rules: no forEach loops, no non-null assertions, no useless empty exports

### File Naming
- Domain modules: `packages/core/src/domain/[entity]/`
- Each domain has: `entity.ts` (ElectroDB model), `schema.ts` (Zod), `client.ts` (operations), `index.ts` (exports)
- Some domains also have `types.ts` and a `client.ts` for browser-safe exports
- Relationship-only domains (e.g. `rsvp`) may skip `schema.ts`/`client.ts` if there are no browser-safe exports needed
- Tests: `*.test.ts` alongside implementation files
- Barrel exports via `index.ts` files

### Import Organization
- Biome automatically organizes imports
- Use import type for type-only imports
- Domain exports structured for selective importing

### Web Package Utilities (`packages/web/app/lib/`)

- `generic-title.ts` — `isGenericTitle(title, artists?, artForm?)` detects uninformative event titles like "Carnatic Music Concert" or "Concert by Sri X" so the UI can substitute a more descriptive display name. Uses regex patterns plus artist/artForm matching.
- `artist-display.ts` — `artistTagline({instrument, city})` builds the "Vocal · Chennai" line the artist profile hero and `ArtistCard` both lead with. Trims both fields, drops blanks so no stray separator is emitted, capitalizes only the instrument, and returns `undefined` when neither is set so callers can fall back with `??`.
- `form-fields.ts` — `readClearableField` / `readOptionalInt` for resource-route actions. `readClearableField` keeps "not submitted" (`undefined`, preserve) apart from "submitted empty" (`''`, clear); `readOptionalInt` parses with `Number` rather than `parseInt` so `'12.7'` is rejected instead of silently read as 12, and a legitimate `0` survives. `readRepeatedRows(formData, {required, strings, numbers})` reads a variable-length list submitted as parallel repeated field names — rows correlate **by index**, so a row that renders must always emit every one of its inputs even when blank, and a row whose required field is empty is dropped.
- `affiliation-display.ts` — `affiliationPeriod({startYear, endYear, isCurrent})` renders "2017–present", "1998–2015", "since 2017" or `''`. Used by both the artist profile and the organiser page. `isCurrent` is stored apart from `endYear` because a blank end year alone cannot say whether a role is current or merely undated.
- `json-ld.ts` — `serializeJsonLd(data)` for anything going into `<script type="application/ld+json">`. Escapes `<` as `<`, because a `</script>` inside an entity-supplied URL would otherwise end the element and turn the rest of the payload into markup. Never use a bare `JSON.stringify` with `dangerouslySetInnerHTML`.
- `listing-description.ts` — `eventListingDescription({name, events, preposition, fallback, location})` builds the meta description for a page that is really a listing (a venue, an organiser). It names the count and the next event rather than restating what kind of page it is: "Events and performances at X. Indian classical arts venue." took 196 impressions at position 9.8 for "chowdiah memorial hall events" and no clicks at all. Falls back to past events before the generic line, because a hall with only past concerts is still the right answer for that query.
- `artist-display.ts` — `artistMetaDescription(artist)` builds an artist's description from instrument, city, lineage and upcoming concerts. It replaced one sentence shared by all 1,111 artists that called every one of them "renowned" — the inflation `GURU_RELATIONSHIPS` exists to prevent, applied site-wide. The lineage clause counts only `primary`, `advanced` and unclassified gurus; a workshop teacher must never be rendered as "disciple of".
- `utils.ts` — `titleCaseName(name)` capitalizes every word of an **entity name** for display. Stored names are lowercase ITRANS, so a raga arrives as `darbari kanada` once transliterated and `capitalize` alone leaves the second word bare. Names only; never run it over lyrics or prose.
- `analytics.ts` — `AnalyticsEvent` and `trackEvent(name, params)`. Every GA4 event name lives in that constant rather than as a string literal at the call site. Adding one means adding it there, wiring the call, and then **marking it a key event in the GA4 console** — the SDK cannot do that, and an unmarked event is collected but not counted as a conversion. Event *parameters* likewise need registering as custom dimensions before they can be reported on; the property has none today.

### Scripts, swaras, and what Googlebot sees

Names are stored as ITRANS and converted for display by `fromItrans(text, script)`
(`@rasika/core/utils`). Three rules, each of which cost real traffic before it was found:

- **Swara notation must never be transliterated.** `S R2 G2 M1 P D1 N2 S` is notation, not a
  word, and its letters collide with ITRANS consonant codes — `S` is the retroflex `ṣ`, `D` is
  `ḍ`. Running an arohanam through `fromItrans` rendered every raga's defining feature as
  `ṣ ṟ2 ġ2 ṃ1 P ḍ1 ṇ2 ṣ`. Use **`formatSwaras`**, which normalizes case and spacing and converts
  nothing. Raga pages ranking for "&lt;name&gt; arohanam avarohanam" were clicking at under 1%
  against 8.5% for the same pages on name queries.
- **The default display script is `roman`, and it has to stay that way.** Anonymous visitors and
  Googlebot carry no `script_preference` cookie, so `DEFAULT_DISPLAY_SCRIPT`
  (`sessions.server.ts`) is the script every indexed page is rendered in. IAST puts scholarly
  diacritics in every title and meta description. `roman` is IAST with the combining marks
  stripped, which is both how people spell these names when they search and what the URL slugs
  already contain. A new script added to `DISPLAY_SCRIPTS` must also be added to `SCRIPT_OPTIONS`
  in **both** `script-selector.tsx` and `header.tsx`, or the picker mislabels the current script.
- **The source scheme is `itrans_dravidian`, not `itrans`.** Plain ITRANS has no long `E`/`O`, so
  it left those capitals untouched and shipped `husEni` and `vEgavAhini` as display names.

**A meta description must name what is on the page, not what kind of page it is.** Every
generic template found so far was measurably costing clicks: the raga arohanam, the venue's
event list, the artist's instrument and lineage, the composition's lyrics. When adding a
detail page, put the fact the searcher came for into the description, and claim nothing the
record does not hold — the composition description promised "with lyrics" on records storing
none.

A janya raga carries its **parent's** mela number. Reporting `raga.melaNumber` bare said
"Melakarta 20" on a page whose own title read "Janya Raga" — two claims in one search result, the
wrong one being what an arohanam search is there to check. Branch on `parentRaga` first.

### Colour tokens and contrast

Every colour comes from the HSL variables in `app/globals.css`; hard-coded Tailwind palette classes (`text-amber-600`) are a bug, not a style choice. Two rules the tokens now enforce:

- **Light and dark are not the same value.** `--primary` is L40 in light and L53.7 in dark, `--destructive` is L30 and L50, and `--primary-foreground` is white in light but near-black in dark. A single value for both modes is what produced 2.97:1 links and 2.19:1 error text.
- **Hues stay on the brand.** Every surface token sits on hue 17. Two tokens once carried `-21`, which CSS normalises to 339 and renders rose.

`app/lib/contrast.test.ts` parses `globals.css` and asserts the real pairs against WCAG AA (4.5:1 for text, 3:1 for the focus ring), in both themes, plus that no hue is negative. Run it before committing a token change; `app/lib/contrast.ts` exports the maths so a candidate value can be checked first.

### Artist structured sections, and why affiliations are a junction

An artist's facts live in fields, not in the prose. The bio is narrative only, soft-capped at
~200 words in the wizard; everything else has a home:

| Fact | Where it lives | Why |
|---|---|---|
| Gurus | `artist.gurus[]`, each with a `relationship` | Lineage is **the** credential here, so a workshop teacher and a senior disciple must not be representable as the same thing |
| Affiliations | **`ArtistAffiliation` junction** | The reverse direction — "artists on this school's faculty" — is the point |
| Credentials | `artist.credentials[]` | A degree is a weak credential in this domain and no institution wants a diploma-holder listing |
| Works | `artist.works[]` | Productions the artist authored, as against the repertoire they perform (`Composition`) |
| Arangetram | `artist.arangetram{Year,GuruId,VenueId}` | Ids only; the loaders resolve the names |
| Tours, festival appearances | **Never typed** — derived from `EventArtist` | A hand-typed field goes stale |

Three rules that are load-bearing:

- **`GURU_RELATIONSHIPS` is `primary | advanced | workshop | institutional`, and it is optional
  with no backfill.** Every row stored before the field existed is a real relationship of
  unknown type; defaulting those to `primary` would assert lineage nobody verified. The profile
  treats unclassified rows as lineage and splits only the explicitly weaker two into "Also
  studied with".
- **`ArtistAffiliationEntity.organiserId` is required.** Per DynamoDB rule 9 above, an index
  over an optional attribute is not sparse. An affiliation exists only once its organisation
  resolves to an `Organiser`; an unresolved name stays in the extraction CSV. This is why the
  junction carries denormalized `artistName`/`organisationName` and why four cascade functions
  (`cascadeArtistNameUpdate`, `cascadeOrganiserNameUpdate`, `cascadeArtistMerge`,
  `cascadeOrganiserMerge`) must carry it, plus **two** delete cascades:
  `cascadeArtistDeleteToAffiliations` and `cascadeOrganiserDeleteToAffiliations`. The second is
  the first organiser-delete cascade in the codebase — extend it when another junction hangs
  off an Organiser.
- **`addArtistAffiliation` uses `put`, never `upsert`.** The row *is* the pair's complete
  state. `upsert` builds an UpdateExpression, and rule 8 applies — a blank `role` produced no
  SET and no REMOVE, so clearing a wrong role silently restored the old one and
  `response: 'all_new'` echoed the stale value into the form.
- **`completion.ts` scores only fields on the artist record.** The moderator enrichment queue
  scores 100 artists straight off `artist.list`, which never loads a junction — a rule for
  affiliations there would mark every artist incomplete and flatten the ranking. Use
  `missingFields(entity, type)` for the gap-naming claim prompt.

Writes split by storage, and the wizard says so: affiliations write immediately (like
memberships), while gurus, credentials, works and the arangetram ride the form's Publish.

**Any form that rebuilds one of these list attributes must merge onto what is stored.**
`updateArtist` does `.set(input)`, which replaces a list outright, so a row rebuilt from form
fields alone silently drops every key the form does not render — `source`, `institutionId`,
`ensembleId`. Both action branches in the artist edit route match stored rows by id, then by
name, and spread them; copy that shape rather than inventing a third.

Three things stay out of `CLAIMANT_EDITABLE_ARTIST_FIELDS`, each for its own reason:
`affiliations` is not an artist attribute at all (so "artistic director" cannot be
self-granted), `credentials` because nothing on the platform can corroborate a degree, and
`arangetramGuruId` because it is a claim about a *third party* with no per-row `source` to
mark it self-asserted. A patch whose rows set their own `source` does not self-approve either
— the field that exposes inflation must not be supplied by the inflater.

### Extracting fields from one bio, in the wizard

The About step has an **Extract** button (`BioExtractionPanel`) that reads the biography
*currently in the form* — not the stored one — and proposes gurus, qualifications, works and the
arangetram. It goes through `artist.extractFromBio` (`moderatorProcedure`) →
`api.artist.bio-extract`, which calls the same `extractFromBiography` + `toProposals` the CLI
does, so the classifier and the match thresholds cannot diverge between the two paths.

**It writes nothing.** Proposals land in the wizard's form state and the ordinary Publish saves
them. That is what makes it safe to ship before the precision rate is known: every proposal is
seen in context by the person who can tell it is wrong. Applying is additive — a row already
present by name is skipped, and the arangetram fills only fields still empty, because what is on
the record was put there by a person.

Two things it deliberately does not do. **Affiliations are listed but cannot be applied**: they
need a resolved Organiser (see below), so the panel points at the Relationships step. And
`unresolved` rows render under "Needs your judgment" and are never applicable — they are the
sentences the extractor refused to convert.

Cost: one Gemini call plus one full artist-corpus sweep per press. Moderator-only, and a
mutation rather than a query so nothing refetches it.

### Media kit: generating flowery copy *from* the fields

The inverse of extraction, and the direction is the whole point. Every artist platform lets a
press-kit paragraph *become* the record, which is how biographies fill up with claims nobody
checked. Here the record stays the neutral reference and the promotional version is derived from
it on request — so the copy cannot contain a fact the profile does not already show.

`domain/artist/media-kit.ts` builds two lengths (≈50 words for a listing, ≈200 for a
submission) from a `MediaKitFacts` object and nothing else. `artist.mediaKit`
(`protectedProcedure`) → `api.artist.media-kit` → a panel in the profile's rail, signed-in only.

- **It never writes back to `biography`.** The result is cached in the entity-only `mediaKit`
  attribute, which is absent from `CreateArtistSchema` — so no form, no CSV import and no
  claimant edit can put words there. `setArtistMediaKit` is the only writer.
- **The cache is content-keyed on the facts**, like the OG card. `mediaKitFactsHash` hashes
  field-by-field rather than stringifying its argument, so a new photo or a bumped `updatedAt`
  cannot cost a model call — and a caller who later passes a whole artist record cannot silently
  break caching site-wide. `MEDIA_KIT_VERSION` is folded in, so a prompt change invalidates
  every kit instead of freezing the old ones.
- **Guru relationships are rendered as prose before the model sees them**
  (`GURU_RELATIONSHIP_PROSE`). A bare `workshop` invites "a disciple of", which would hand back
  exactly the inflation the relationship field exists to prevent.
- A mutation, not a query, so nothing refetches it. Signed-in only, so an anonymous page cannot
  spend anything; beyond that the hash bounds it to one call per artist per version of the data.

### Bio structuring pipeline (`pnpm cli`, three steps, in order)

For the corpus. The wizard button above is the single-artist path; these share the same core
modules.

Extraction seeds fields; it does not bind to them. **Fields are canonical and the bio is an
import source read once.** Never re-derive fields from prose on a write trigger — extraction is
nondeterministic, so a re-run clobbers a moderator's correction and will not even fail the same
way twice.

1. `extract-artist-bios [--dry-run] [--artist <id>] [--limit <n>] [--out <path>]` — Gemini
   (`gemini-flash-lite-latest`, text-only, JSON mode) over every artist with a biography, into a
   CSV for review. Reads the database, writes nothing to it. Run this and read the precision
   rate **before** building any UI on top.
2. `import-bio-extractions --file <path> --user <id> [--dry-run]` — reads the `decision` column.
   Artist attributes become `Edit` drafts, submitted for moderation; affiliations write straight
   to the junction. They cannot ride the `Edit` path: `edit/registry.ts` keys every handler on a
   single entity id and a junction row is keyed on a pair.
3. `rewrite-artist-bios --user <id> [--dry-run] [--min-fields <n>]` — shortens each bio to
   narrative only. Safe **only because step 1 ran**: nothing is deleted, it is relocated.
   `--min-fields` (default 2) skips artists whose facts are still only in the prose.

Core modules: `domain/artist/bio-extract.ts` (the model call and its Zod contract) and
`domain/artist/bio-proposals.ts` (flattening to CSV rows, and name matching).

**The extractor's schemas and the record's schemas are separate on purpose, and
`bio-contract.test.ts` is what stops them drifting.** The extractor carries `confidence` and
`sourceSentence`, is `.nullish()` throughout because a model emits `null` for "not stated", and
says `startYear`/`endYear` where the guru record says `fromYear`/`toYear`. Collapsing them would
force the database to accept a confidence score. So instead the contract test applies the
importer's mapping and asserts the domain schema accepts the result — a renamed field or a
widened bound fails there rather than one artist at a time mid-import. Year bounds derive from
the shared `YearSchema` rather than being restated, and `GURU_RELATIONSHIPS` is one constant
both sides import.

Two precision rules the prompt and the code both enforce:

- **Classify, don't just pull names.** An influence ("influenced by the teachings of X" — who may
  have died before the artist was born) is not a guru edge; a professor who taught a degree
  module is `institutional`, not a discipleship. Anything unclassifiable goes to `unresolved`,
  which is the most useful column in the CSV.
- **The extraction schemas are lenient on the way in and strict on the way out, and that is a
  rule, not an accident.** A model asked for JSON returns `"2017"` as readily as `2017`, and
  `"Primary"` as readily as `"primary"`. Twice now a single type slip failed the parse for the
  *whole document*, losing every other fact for that artist along with the `unresolved` rows.
  So: years and booleans are coerced, enums are matched case-insensitively, an unreadable value
  becomes "not stated" rather than an exception, and `lenientArray` keeps the rows that parse
  and drops the ones that do not. **Nothing that survives is storable-but-invalid** — the bounds
  still come from `YearSchema`, so what comes out is always a real year or nothing. When adding a
  field here, make it lenient; the strict version will eventually cost a whole extraction.
- **Never auto-create an `Artist` or `Organiser`.** There are already duplicate slugs publicly
  indexed. `bestArtistMatch` reports a scored candidate and a human picks or creates. Load the
  corpus **once** with `listAllArtistsForMatching()` and pass it down — see that function's own
  warning about per-name sweeps.
- **`resolvedId` is a recommendation, so it is withheld unless the match is unambiguous.** The
  subject is excluded from their own candidate list (nobody is their own guru), and two
  *different* records tying means duplicates — pre-filling the first sweep hit would bind the
  edge to an arbitrary one at a confident-looking score. `matchName` is always reported: a
  reviewer cannot judge a match from a KSUID and a number.

### Deduplicating ragas (`pnpm cli dedup-ragas`, two steps)

The corpus holds two import generations and the same raga appears in both under different
spellings — `aabheri`/`abheri`, `hamirkalyani`/`hamir-kalyani`, `kalyANi` beside
`kalyani (meca kalyani, shantakalyani)`. Roughly 312 of 1,869 raga pages are a second copy,
splitting search signals across two indexable URLs.

1. `dedup-ragas [--out raga-duplicates.csv]` — reads the database, writes only the CSV.
2. `dedup-ragas --apply --file <path> [--dry-run]` — merges the rows whose `decision` is `merge`.

Three rules here:

- **Merge, never delete.** `mergeRaga` re-points every `CompositionRaga` junction and soft-deletes
  the loser with `mergedIntoId`, which the raga route already turns into a redirect. The earlier
  version of this script called `deleteRaga`, which orphaned every linked composition and left the
  indexed URL dead. Nothing in this pipeline may delete a raga.
- **Nothing merges without a person marking it.** Matching is two-tier:
  `ragaExactKey` (case, diacritics, punctuation and the alias bracket removed) is safe enough that
  a collision is real; `ragaVariantKey` guesses transliteration spellings and *will* collide
  distinct ragas — `ranjani` is not `rasikaranjani`. Both are reported; neither self-applies.
- **The keys live in `domain/raga/dedup.ts`, not in the script.** `packages/scripts` has no vitest
  setup, so matching logic kept there cannot be tested. Same reason `domain/artist/dedup.ts`
  exists.

Canonical is chosen by evidence: most compositions attached first (that is the record the rest of
the database already points at), then most fields filled, then oldest. Reindex search after a
merge run.

### Filling venues and organisers (`pnpm cli enrich-venues-organisers`)

Both lists arrived name-only: 8 of 132 venues and 1 of 109 organisers carried anything besides a
name. The command fills what the database can already prove and nothing else. Dry run by default,
`--apply` to write, and **a re-run is a no-op** — an empty field is filled, a filled one is never
touched, because what is stored was put there by a person and a derivation is weaker evidence.

| Field | Source |
|---|---|
| `organiser.website` / `phone` / `email` | `contactInfo` on that organiser's own events |
| `organiser.tags` | `artForm`, `tags` and `entryType` across their events |
| `organiser.organisationType` | an explicit word in the name |
| `venue.venueType` | an explicit word in the name |

**Event `contactInfo` is the organiser's, never the venue's.** Aggregated by organiser it is
self-consistent and the domain matches the name (Trikala → trikalaarts.com, Vanamala →
vanamalaarts.org). Aggregated by venue it is nonsense: "Zoom" collects Trikala's website, the
J.N. Tata Auditorium collects SPIC MACAY's, Chowdaiah Memorial Hall collects rkhegde.com, and the
Indian Institute of World Culture collects three phone numbers from three different organisers.
Writing it to a venue would put one body's contact details on another's page. Do not extend this.

Three precision rules, each of which produced a wrong claim before it was found:

- **A name-derived type is only ever read from an explicit word, and never falls back to
  `'other'`.** `other` asserts the kind was determined and is none of the listed ones — a stronger
  claim than a string supports. "Hamsadhwani", "Arohy" and "Bhoomiverse" are real venues whose kind
  simply is not in the name, and they stay blank.
- **Match whole words, and watch the metaphors.** ` mandali ` is a service association, not a
  temple; `vedike` is a "forum" and says nothing ("Rashtriya Nava Nirmana Vedike" is not a sabha);
  a bare `academy` swept in the Karnataka Engineers Academy, whose hall hosts concerts but which
  teaches nobody to sing; and "Samskruthi - The Temple of Art" is not a shrine.
- **Do not promote a school to a `university`, and leave "Foundation" undecided.** `ORGANISATION_TYPES`
  has no entry for a school, and a foundation is registered as a trust or an NGO with the name never
  saying which. Inventing either is inventing a legal fact about a real organisation.

A tag needs two events behind it or a third of the organiser's programme; the second clause is what
makes it usable, since most organisers here have one to three events. `year-round` needs five
distinct months, which separates a continuous concert series from a body that wakes up for
Ramanavami.

Deliberately out of scope: city, capacity, founded year, street address, description. None is
derivable and all four would have to be looked up. They already have a path — export from
`/admin/data/<domain>/export`, edit the sheet, upload it back. Reindex search after a run.

Both lists still carry duplicates the ragas taught us to expect — one venue split six ways
(`The Bangalore Gayana Samaja (R)`, `Gayana Samaja`, `Gayana Samaaja`, `Bangalore Gayana Samaja`,
`The Bangalore Gayana Samaja Hall`, `Bengaluru Gayana Samaaja`), which splits its events across six
indexable URLs. `mergeVenue` and `mergeOrganiser` exist and both re-point the junctions and
soft-delete with `mergedIntoId`; there is no report-and-apply script over them yet. When one is
written, follow `dedup-ragas`: two-tier matching, keys in the domain rather than in
`packages/scripts`, and nothing merges without a person marking it.

### Rasika Classes: the credit ledger (`class-*` domains)

A class-tracking product for gurus, served at `classes.rasika.life` from its own
`packages/classes` app. Plan and its addendum: `docs/plans/260802-01-rasika-classes.md`. All nine
phases are built; nothing is deployed. Nine entities, all `class-*`, all on the same single table
reusing gsi1–gsi3.

**Never move money.** A screenshot upload plus the guru tapping "received" is the entire payment
surface. No gateway, no UPI collect, no payment intent, and `amount`/`currency` on `classPack`
are reserved and uncollected. Anything more puts the project in financial compliance territory.

**Payment screenshots must not touch the public image pipeline.** `Image.getImageUploadUrl`
writes to `EVENT_POSTERS_BUCKET` behind a public CDN, and these are people's UPI transaction
records. `classPack.screenshotKey` stores a private S3 key, never a URL — see `PrivateImage` and
`classes.screenshotUrl` below. The key is prefixed with the institution so the **write** path can
check ownership; without that, a teacher could attach another institution's key to their own pack
row and the read path would sign a GET for it, since it only checks who may see the row.

**Class routes are private and are not `Event`s.** Events are public, moderated and wiki-editable;
a program is private to its roster. Overloading `Event` would drag a child's attendance record
into the moderation queue. Nothing in `class-*` is indexed, sitemapped, or wiki-editable.

Four rules the code depends on:

- **`creditsRemaining` is never assigned.** It is a denormalized cache of an append-only ledger:
  signed `classPack` rows in, confirmed sessions out. Every movement is an atomic `ADD` inside a
  two-item transaction (`ClassLedgerService`, `class-enrollment/ledger.ts`) so the number and its
  own audit trail cannot disagree. A correction is a *new* pack row with a negative delta and a
  reason — never an edit, never a direct write. Changing the guru's standard pack size edits
  `defaultPackSize` on the program instead, and is not retroactive. `expectedCredits` in
  `class-session/schema.ts` is the invariant, and what a repair would rebuild from.
- **A status transition must supply `institutionId` via `.composite()`.** `status` is a composite
  of two GSI partition keys and `institutionId` is not in the primary key, so ElectroDB cannot
  re-format them on its own — it throws `Incomplete composite attributes` and the write fails
  outright. This shipped broken because every test mocked the entity and could only agree about
  which methods were called; `class-session/keys.test.ts` now exercises the real one. Supply the
  session's **true** institution (the router derives it from the program): ElectroDB folds the
  value into the ConditionExpression, so a wrong one is refused rather than mis-keyed, but it
  cancels as `ConditionalCheckFailed` and reads as "already confirmed".
- **Every status transition is guarded on being `pending`, not on the button press.** The
  auto-confirm cron and the guru's thumb race for the same row every week; without the condition
  the loser takes a second credit. `applied: false` is an ordinary outcome — the caller says
  nothing happened rather than erroring. Bulk confirm is a *loop* of transactions (cap 50, per-row
  results), because `BatchWrite` cannot carry a condition.
- **`sessionDate` is `YYYY-MM-DD` in the teacher's zone and it is the ledger key; `startsAt` is
  the instant.** Storing only UTC relocates the off-by-one to a third zone wrong for both parties
  — an 8am Chennai class is 02:30Z, which the student in New York experienced the previous
  evening. `shared/timezone.ts` does the zone arithmetic through `Intl`; `startOfDayInstant`
  corrects its offset *twice* because a single pass reads the zone at the wrong instant and lands
  an hour out around a DST change. The institution holds the zone, because a session's date must
  be decided before the session row exists.
- **No index here is sparse, so no composite is optional** (CLAUDE.md rule 9). `groupSessionId` is
  required and defaults to the row's own id — a solo class is a group of one, which also makes
  fan-out and solo the same code path. `autoConfirmAt` is required for the same reason.
  `classSession` carries `status` in two of its three GSI partition keys so the review queue and
  the cron each read only rows they are about to act on.

Two shapes that look like modelling accidents and are not. A learner is **not a user account** —
children have no email and one parent manages several, so `classLearnerAccess` maps Google
accounts to learners, and a young adult gets a *second* row (`self`) beside the guardian's rather
than a migration. A `self` row may not remove a `guardian` row (`checkRevokeLearnerAccess`),
because otherwise a fifteen year old locks out the parent who is paying. And a learner on both a
weekly class and a workshop has **two independent balances**, shown as two cards, never merged.

`classLearner` holds a first name, an optional last initial and a guru-set `isMinor` flag. No DOB,
photo, address, phone or notes field — India's DPDP Act treats under-18 data as needing verifiable
parental consent, and the cheapest way to stay clear is to hold nothing. Do not add fields here.

Balances go negative on purpose (`creditBalanceLabel` renders "3 classes over"). A workshop sold
as ten routinely runs to thirteen, and a tool that blocks the eleventh is one the guru stops
opening. `nominalCount` is reference only, never a constraint.

Three places the built model departs from the plan document, each for a reason worth keeping:
`byPending` became `byInstitutionStatus` plus a separate `byDue` (the plan's key was dense over
every session ever taught, so the queue would read thousands of confirmed rows to find three
pending ones, and the cron had no way to sweep across institutions); `groupSessionId` and
`autoConfirmAt` became required; and `classInstitution` gained a `timezone`.

### Rasika Classes: the app (`packages/classes`, `packages/ui`)

The whole product runs on **one shared sign-in**. `rasika_session` now carries an explicit
`Domain` (`SESSION_COOKIE_DOMAIN`, set by infra from the stage root) — without it the cookie is
host-only and every visitor to `classes.rasika.life` looks signed out, whatever the app does.
Both apps must keep the cookie's name, secret and domain identical or they are two auth systems
wearing the same clothes. Changing the secret signs everybody out of both at once.

- **Authorisation is membership, never role.** A student signs in with Google and stays `editor`,
  the ordinary default. `assertClassAccess` (`packages/trpc/src/routers/classes-access.ts`) is
  the single gate: a teacher holds a `classTeacher` row for the institution; a learner viewer
  holds a `classLearnerAccess` row for the named learner. A learner viewer is **never** admitted on a
  `programId` alone — a program is a roster, so that would hand one family another's notes. The
  institution is resolved *from* whichever handle was passed, and a supplied `institutionId` that
  disagrees is refused rather than ignored: the mismatched pair is exactly what an attacker sends
  to have the check run against one institution while the write lands in another.
- **Every read and write goes through a loader or an action.** There is deliberately **no** tRPC
  handler route inside `packages/classes`, though the plan's §3.3 asked for one. Its reasoning
  was CORS on browser calls, and with loaders and actions the browser never calls tRPC at all —
  mounting the router here would be a second database-linked endpoint that nothing uses. Add it
  if a genuine client-side call ever appears.
- **`sessionDate` is never taken from the client.** `markAttended` computes it server-side in the
  institution's zone. A teacher may name a date (she is reconstructing last Tuesday); a student
  may not.
- **Nothing on this origin is cacheable.** Every document is somebody's ledger, so the root
  loader sends `private, no-store` unconditionally rather than deciding per request the way the
  main site must. `noindex` on every route, `X-Robots-Tag`, and `robots.txt` disallowing the
  whole origin.
- **`packages/ui` is where visual consistency comes from**, not shared components. Both apps use
  `tailwind-preset.cjs`; `tokens.css` is a copy of the `@layer base` block in web's `globals.css`,
  because `contrast.test.ts` parses that file directly and moving the values would disarm it.
  `token-drift.test.ts` in web asserts all **three** blocks agree — light, the `.dark` class, and
  the `prefers-color-scheme` block that only ui has.
- **Classes follows the OS theme; web has a toggle.** Classes is an installed phone app opened at
  7am and 10pm, so `tokens.css` carries a `@media (prefers-color-scheme: dark)` block and there is
  no switch. Web deliberately has no such block — a media query would fight its cookie-backed
  toggle. `theme-color` is two media-scoped meta tags, because a single light value paints a cream
  status bar above a dark app.
- **Contrast is only tested for shapes the test can see.** `contrast.test.ts` reads *solid* token
  pairs, which is exactly how the badges shipped broken: they were alpha composites
  (`bg-primary/15 text-primary`) at 3.46:1 in light and 1.31:1 in dark. `badge-contrast.test.ts`
  now parses the tone map out of `card.tsx` and composites any alpha back over both surfaces, so a
  new tone is checked automatically and a reintroduced tint cannot slip through. Extracting web's component library into
  `packages/ui` is explicitly not a prerequisite for anything.
- **Tailwind `content` globs must include `../ui/src/**/*.{ts,tsx}`** or every class used only
  inside a shared primitive is purged and the buttons render unstyled.
- **The service worker caches static assets only — never a document, never an API response.**
  Hand-written rather than generated (`packages/classes/public/sw.js`) so the omission is visible
  at a glance. There are no offline writes: a queued "mark attended" replayed an hour later can
  lose the conditional-transition race, and there is nothing honest to show the student then.
- **Navigation changes place, not shape.** `AppShell` renders the same `nav` node into two slots
  — a bottom tab bar below `md`, the header at `md` and above — each hidden at the other
  breakpoint. Two copies in the DOM, one in the accessibility tree, because `display: none` is not
  exposed. `navItemClasses` styles both placements in one responsive string, which works only
  because exactly one container is ever visible. A bar pinned to the bottom of a 1200px window is
  a phone convention applied to something that is not a phone.
- **The header carries the product name, not the page's.** Every screen opens with an `<h1>`, so a
  page title there said the same word twice. Wayfinding lives in the document title instead, and
  every route emits it through `~/lib/meta`'s `pageMeta` — a child `meta` export **replaces** the
  root's rather than merging, so a route that set only a title would silently drop `noindex` from
  a page showing a child's attendance record.
- **PWA icons are placeholders.** `pnpm icons` in `packages/classes` regenerates the whole set
  from one SVG in `scripts/generate-icons.mjs`; swap the mark when real brand assets arrive.

**A person here may teach, learn, or both**, and that is the ordinary case rather than an edge —
gurus study under a senior vidwan for decades while running their own class. Role is a property of
a *relationship*, so it can be neither a field on the user nor a separate subdomain. `/` is a
**resolver**: it reads `classes.getMyContexts`, redirects server-side, and renders nothing. Doing
it on the server matters because the manifest's `start_url` is `/`, so it runs on every cold start
from the installed icon, where a flash of the wrong context reads as breakage. `app/lib/context.ts`
holds the pure table and is tested against the §A7 matrix directly.

The last-used context is a **cookie** (`rl_ctx_v1`), not `localStorage`, which is a departure from
§A1 and the reason is in that file: the server cannot read `localStorage`, so a both-contexts user
would have to land on `/teaching` and bounce — the exact flash the same paragraph forbids.

**Who may teach lives in the `classTeacher` junction, not a list attribute.** It replaced
`classInstitution.teacherIds`, which could not answer "which institutions does this user teach at"
— a list is not indexable, so a co-teacher who owns nothing would have been sent to the "do you
teach?" screen for ever. `institutionName` is denormalized onto it because the context switcher
renders it on every page load; `cascadeInstitutionNameUpdate` is the obligation that buys.

**The guru's screens are tables; the learner's are sections.** A guru is comparing rows — who has
run out, who has not paid, who has not been in for a fortnight — and cards put one learner per
screenful, making every one of those a scroll. So `/teaching` is tiles, `/teaching/:id` is a
roster table (name, last class, last paid, left), and the ledger is two tables with the settle
control inline. `packages/ui`'s `TableScroll` is not optional on any of them: without it a wide
table scrolls the *document* sideways, which on iOS drags the whole app shell. The learner's home
is the other shape — one section per program with its last few classes inline, because "what did
we do last week" is what a student opens the app for and it used to be a navigation away.

**Every form that adds something is a `FormDialog`, and `<details>` is for disclosing, not for
forms.** On a phone an expanding disclosure pushes the page around underneath the thumb reaching
for it; a modal takes the screen, which is what filling in a form is. The two remaining
`<details>` are a real disclosure (the review queue's group expansion) and a menu (the context
switcher), which is what the element is for.

`FormDialog` renders its form **once**. A `<noscript>` copy would duplicate every field `id`, so
every `<label for>` in the fallback would bind to the modal's hidden inputs instead. Rather than
that, the `<noscript>` stylesheet in `root.tsx` changes what a `<dialog>` *is*: `.js-only` hides
the trigger, and `dialog.form-dialog` becomes a static block, so the modal degrades into an
inline form. Both paths are verified in a browser, not reasoned about.

(Superseded, kept because `<details>` is still used: a fragment link into a `<details>` must
target a **descendant**. The browser auto-expands only then, and merely scrolls when the fragment
names the element itself — which is how three "+ Add" buttons shipped looking broken.)

**`classEnrollment.lastSessionDate` / `lastPaidAt` are display-only.** They exist so the roster
table is one query rather than two per learner, they are written where the row they summarise is
written, and nothing decides anything from them — a stale value costs a wrong date on a screen,
never a wrong credit.

**A learner may backdate a mark by up to a month, and never into the future.** `markAttended` used
to compute the date server-side and refuse a client one, which is right about the future and wrong
about the past: "I forgot to mark Tuesday" is the ordinary case, and refusing it left marking the
wrong day as the student's only option. What makes the past safe is the review queue — the row
lands `pending` with its date on it and the guru decides. The bound is longer than the seven-day
auto-confirm window, so anything older is a conversation rather than a form.

**`autoConfirmAt` counts from the day a class was *marked*, not from `sessionDate`.** Those were
the same thing until backdating shipped, and then they were not: a class named three weeks ago was
written with a deadline a fortnight in the past, so `listSessionsDueForAutoConfirm` — which is
simply `autoConfirmAt <= now` — swept it up on the next run and spent the credit before the guru
had opened the app. The review queue is the only thing that makes backdating safe, and it was
being skipped for exactly the classes least likely to be remembered right. `autoConfirmDeadline`
therefore takes a third argument and anchors on the **later** of the class and the marking day, so
the seven days are a promise about *her* reviewing time rather than about the class's age. A class
marked the day it happened is unaffected, which is nearly all of them. Do not reintroduce a
`sessionDate`-only deadline; `index.test.ts` fails if you do.

**A guru may record a class for a learner too, and it lands `confirmed`, not `pending`.**
`markClassForLearner` exists beside `markAttended` because she is the one recording it — leaving
it `pending` would put her own entry in her own review queue. It still writes through
`markClassSession` then `confirmClassSession` as two calls rather than one, so the credit still
moves inside the guarded transaction every other confirmation uses; a create that wrote
`confirmed` directly would be a second, unguarded way to spend a credit. She may backdate but
never postdate, same as the student's path, and one class per learner per day still holds — a
second attempt returns the existing row rather than duplicating it.

**`classLearner.email` is required at creation, not merely encouraged.** A learner created
without one had no `classLearnerAccess` row and no invite — a roster row the guru could grant
packs against, and a family with no way to ever see them, with nothing to say so. Once a family
has signed in, `changeLearnerEmail` corrects a typo by withdrawing the outstanding invite and
sending a new one; it refuses once the invite is **claimed**; because that means a real person
already holds access, and silently revoking it because a guru retyped an address would take a
family's session notes away without saying so — adding a new account and removing the old one are
two deliberate acts, not one. `ClassInvite.byInstitution` (gsi1, keyed on `institutionId` +
`createdAt`) is what lets a guru see what is still outstanding; it could not key on `learnerId`
instead because that attribute is optional (an invite may carry a name for a learner that does
not exist yet), and rule 9 applies.

**Session notes are optional for everyone**, including the guru confirming. They were required
of a person once, on the reasoning that the note is the durable value of the product — still
true, and still the wrong trade: a required field on a Sunday-evening catch-up buys "ok" and
"done", which is noise in the one column meant to be worth reading, and a reason to leave the
queue to the cron. An empty note is never written (rule 8 drops it), so the student's own note
survives. Revisit with a prompt rather than a requirement if the column turns out empty.

**A "back" link has to know who is looking.** The learner ledger is reached by a guardian from
their own card and by a guru from the program roster — and the guru has no `classLearnerAccess`
row for her student, so sending her to `/home` showed her her own empty learner list. The page
branches on whether the viewer follows *that* learner, not on whether they are a learner at all.

**Guru onboarding is `/welcome/teaching`, three steps, one mutation each** — never one submit at
the end. Which step to show is read from the records (`classes.onboardingState`), not from a
progress flag, so abandoning halfway resumes rather than restarting. **Learners have no
onboarding and must never self-provision**: a `classLearner` with no institution has no guru to
confirm sessions and no source of credits, and there is no merge tooling to clean up the orphan.
`/welcome` shows them their signed-in address to forward instead.

Payment screenshots use `PrivateImage` (`domain/image/private-s3.ts`), a separate namespace from
`Image` on purpose — different bucket, no CDN, and it returns a **key** rather than a URL, so
nothing stored would resolve if it leaked. Reads go through `classes.screenshotUrl`, which reads
the key off the pack row after the access check; a key accepted from the client would sign a GET
for any object in the bucket.

`packages/trpc` now has two vitest configs. `pnpm test` is the integration suite and needs
`sst shell`; `pnpm test:unit` (`*.unit.test.ts`, `vitest.unit.config.ts`) has no setup file,
because the integration setup imports `@rasika/core` before any test file's `vi.mock` applies.

### Caching a public page (`Cache-Control`)

SST's generated CloudFront server cache policy sets `cookieBehavior: "none"`, so **the session cookie is not part of the cache key**. The root loader puts the signed-in viewer's name and email into every document, so a route that declares a static `public, s-maxage=…` header will have one signed-in viewer's document cached and served to everyone else.

Any public page therefore decides per request, not statically:

- Routes with the user already loaded pick `PRIVATE_PAGE_CACHE_CONTROL` / `PUBLIC_PAGE_CACHE_CONTROL` directly (both in `~/lib/auth.server`).
- Routes without one call `await publicPageCacheControl(request)`, which reads the session cookie rather than calling `getUser` — that verifies a token and fetches the user over tRPC, far too costly for an anonymous read path. An expired cookie costs a cache miss, never a leak.

Either way the loader returns the header via `data(payload, { headers })` and the route's `headers` export forwards `loaderHeaders`, defaulting to private.

### Admin: bulk CSV export/import (all domains)

An admin-only tool to export any domain to CSV, edit it in a spreadsheet, and re-upload to update the database. It is registry-driven — one config per domain, not per-domain routes.

- **Core `src/admin/`** (the source of truth):
  - `csv.ts` — browser-safe RFC 4180 `toCsv` / `parseCsv` (quoting, embedded newlines, CRLF/LF, BOM).
  - `columns.ts` — browser-safe. `ADMIN_CSV_DOMAINS` maps each domain slug (`artist`, `raga`, `tala`, `composition`, `venue`, `organiser`, `festival`, `award`, `event`) to an ordered column list. `domainToCsv(domain, entities)` and `parseDomainCsv(domain, text)` serialize/parse. Encoding: lists → pipe-joined; closed-set lists → one `yes`/blank column per allowed value via `flags()` (venue `amenities_*`, organiser `tags_*`), so the headers document the legal values and a spreadsheet editor never types a slug; `address` → `address_*` columns; `socialLinks` → `platform:url` pairs; linked entities → the linked entity's **name** (a new name is created on import); deeply nested objects (lyrics, ticketing, tala structure, sponsors) → JSON in one cell. Exposed to web via the `@rasika/core/admin/columns` subpath.

    `flags()` import semantics follow the registry's "blank = leave alone" rule: the field is written only when at least one of its columns is non-blank. Ticked cells accept `yes`/`y`/`true`/`1`/`x`; an explicit `no`/`n`/`false`/`0` in any one column both opts the row in and clears the rest, which is the only way to empty an existing list from CSV. Enum constants powering both the form and the CSV live in the domain schema, re-exported from `client.ts` — never redeclare them in a route. Today: `VENUE_AMENITIES`/`VENUE_TYPES` (`domain/venue/schema.ts`) and `ORGANISER_TAGS`/`ORGANISATION_TYPES` (`domain/organiser/schema.ts`). Those two closed-set lists are the only `z.array(z.enum(...))` fields in the codebase; `tags` on **festival** and **event** is free text (`z.array(z.string())`) despite the shared name, so `list()` stays correct there.
  - `bulk-data.ts` — Node-only registry wiring each domain's entity (export scan), client create/update/get, and Zod schemas. `listAllForDomain(domain)` and `bulkUpsertForDomain(domain, rows, userId)`. A domain `prepare` hook resolves linked names → ids via cached get-or-create before validation. Rows with an `id` update; blank-`id` rows create; each row is validated independently so one bad row never aborts the batch. Exported as the `AdminData` namespace from `@rasika/core`.
  - `BULK_DOMAIN_KEYS` (bulk-data) and `ADMIN_CSV_DOMAIN_KEYS` (columns) must stay in sync — a test asserts it.
- **tRPC** `adminData.export` / `adminData.import` (`adminProcedure`, in `routers/admin-data.ts`).
- **Web** `routes/admin.data._index.tsx` (domain list) and `routes/admin.data.$domain.tsx` (`/admin/data/<domain>`, `requireAdmin`): the page shows the count and an upload form whose action parses the CSV and calls `adminData.import`. The CSV download is a separate **resource route** `routes/admin.data.$domain_.export.tsx` (`/admin/data/<domain>/export`, no component) — a UI route can't return a raw file Response for a document request (the browser saves the rendered HTML instead), so the download link points here. Nav link "Manage Data" → `/admin/data`.

To add a domain: add its column list to `ADMIN_CSV_DOMAINS` and a registry entry (with a `prepare` hook if it has linked names) to `bulk-data.ts`.

### Importing from `@rasika/core` in web routes

**Never import from the bare `@rasika/core` entry in web route files.** The main entry re-exports everything including ElectroDB and AWS SDK, which use Node.js-only APIs (e.g. `util.promisify`). React Router v7 bundles the top-level imports of every route module for the client, so this crashes the browser.

Always use a subpath export instead:

| What you need | Import from |
|---|---|
| `SOCIAL_PLATFORM_LABELS`, `SocialPlatform`, `SocialLink` | `@rasika/core/domain/social-link` |
| `ROLE`, `PERMISSION` (auth roles) | `@rasika/core/auth` |
| Edit types/status | `@rasika/core/domain/edit/client` |
| Artist/Raga/Tala/etc. types & schemas | `@rasika/core/domain/[name]/client` |
| Concert log types | `@rasika/core/domain/concert-log/client` |
| `GURU_RELATIONSHIPS`, `GURU_RELATIONSHIP_LABELS`, `LINEAGE_RELATIONSHIPS`, `isGuruRelationship`, `CLAIM_SOURCES`, `Credential`, `Work` | `@rasika/core/domain/artist/client` |
| Pure utilities (completion score, `missingFields`) | `@rasika/core/shared/completion` (or relevant subpath) |
| Class schemas, enums, `programDisplayTitle`, `creditBalanceLabel`, `expectedCredits`, `checkRevokeLearnerAccess`, `normalizeInviteEmail` | `@rasika/core/domain/class-[name]/client` |
| `todayInTimeZone`, `dateInTimeZone`, `startOfDayInstant` | `@rasika/core/shared/timezone` |
| `fromItrans`, `transliterate`, `formatSwaras`, `TransliterationScheme` | `@rasika/core/utils` |
| `ragaExactKey`, `ragaVariantKey` | `@rasika/core/domain/raga/dedup` |

All available subpaths are listed in `packages/core/package.json` under `"exports"`. When adding a new browser-safe utility to core, add a dedicated subpath export there rather than relying on the main entry.

The only exception is `*.server.ts` files — React Router's convention excludes them from the client bundle, so they may safely import from `@rasika/core`.

## Development Workflow

1. Always run tests after changes: `pnpm test` in relevant package
2. Run `pnpm check` before committing to ensure code quality
3. For tRPC changes, test with `sst shell vitest run` to include proper environment
4. Type checking: Use `pnpm typecheck` to validate TypeScript without building

## Domain Implementation Pattern

When adding new domains to core package:

1. Create domain directory in `packages/core/src/domain/[name]/`
2. Implement in order: `entity.ts` (ElectroDB) → `schema.ts` (Zod) → `client.ts` (operations) → `index.ts`
3. Add tests in `index.test.ts` alongside implementation
4. Export from main package `index.ts` if needed
5. Add tRPC router in `packages/trpc/src/routers/[name].ts`
6. Register router in `packages/trpc/src/routers/index.ts`

For auth-gated mutations, use `protectedProcedure` (defined in `packages/trpc/src/trpc.ts`) — it throws `UNAUTHORIZED` if no session is present and narrows `ctx.user` to non-null inside the handler.

## Key Dependencies

- **SST v3**: Infrastructure and serverless deployment
- **DynamoDB**: Primary database with AWS SDK v3
- **ElectroDB**: Entity modeling layer over DynamoDB
- **tRPC**: Type-safe API layer
- **Zod**: Schema validation
- **KSUID**: Time-sortable unique IDs
- **Fuse.js**: Client-side fuzzy search (index stored in S3)
- **Vitest**: Testing framework
- **Biome**: Formatting and linting
- **React Router v7**: Frontend framework (in web package, using `@react-router/fs-routes`)
- **Sharp**: Image processing (in image-processor package)