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
- **packages/talapettige**: Talapettige, a tanpura drone and Carnatic tala metronome. A static, prerendered React Router v7 PWA at `talapettige.rasika.life` that works offline
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
- `structured-data.ts` — every JSON-LD payload the site emits, as plain functions. See the section below.
- `event-contact.ts` — `resolveEventContact(eventContact, organiserContact)` decides whose contact details an event page shows. 515 of 739 events store no `contactInfo` at all, so the section simply did not render; the organiser record usually knows, having been seeded on approval. The fallback is **whole-block, not per-field** — a phone off this poster beside a website off the organiser's record is one list the reader cannot take apart, and they are entitled to know whether a number is "ring this about this concert" or "this is the sabha's office line". It returns a `source`, and the page says so. Nothing is copied onto the event record: the organiser is the canonical home, and a copy taken at approval goes stale the moment they change a number. The loader only fetches the organiser when the event states nothing, since otherwise the result is discarded.
- `listing-description.ts` — `eventListingDescription({name, events, preposition, fallback, location})` builds the meta description for a page that is really a listing (a venue, an organiser). It names the count and the next event rather than restating what kind of page it is: "Events and performances at X. Indian classical arts venue." took 196 impressions at position 9.8 for "chowdiah memorial hall events" and no clicks at all. Falls back to past events before the generic line, because a hall with only past concerts is still the right answer for that query.
- `listing-description.ts` also has `eventsIndexMeta({count, cities, city})` for `/events`: "Carnatic Concerts and Classical Music Events" plus the upcoming count and the three busiest cities. The old title, "Upcoming Events - Indian Classical Arts", held none of the searched words ("carnatic music" 22,200/month, "classical music concerts near me" 1,300) and the page sat at position 20. A `?city=` filter changes the title; the canonical stays `/events`.
- `raga-description.ts` — `ragaMetaDescription` and `ragaMetaTitle`. The title leads with "<Name> Raga", the form these pages are found by ("bindumalini raga", "rasika ranjani ragam"), then names only what the page shows: "Arohanam, Avarohanam" when the scale is stored, "Compositions" when any are listed, and the melakarta number for a melakarta only. It must fit 60 characters, so detail and the brand are dropped first, never the name. The description drops whole trailing sentences past 155 characters, and when no performance is logged it names two listed compositions. Composition titles reach it converted with `fromItrans`; the page cards still use the raw title for their links.
- `artist-display.ts` — `artistMetaDescription(artist)` builds an artist's description from instrument, city, lineage and upcoming concerts. It replaced one sentence shared by all 1,111 artists that called every one of them "renowned" — the inflation `GURU_RELATIONSHIPS` exists to prevent, applied site-wide. The lineage clause counts only `primary`, `advanced` and unclassified gurus; a workshop teacher must never be rendered as "disciple of". `artistMetaTitle(artist)` is the matching `<title>`: name plus instrument ("Savita Vasu – Vocal | Concerts & Repertoire – Rasika.life"), because "X - Artist" ranked #2 for the name and still took only 6% of clicks — the instrument is what tells a searcher it is the right person.
- `utils.ts` — `titleCaseName(name)` capitalizes every word of an **entity name** for display. Stored names are lowercase ITRANS, so a raga arrives as `darbari kanada` once transliterated and `capitalize` alone leaves the second word bare. Names only; never run it over lyrics or prose.
- `event-time.ts` — `formatEventTime`, `eventDateKey`, `groupByEventDate`, `formatDayLabel`. **Every event time and day is read in the event's own `timezone`, never the runtime's.** The SSR Lambda runs in UTC, so a bare `toLocaleTimeString` printed "12:30 pm" for a 6:00 pm concert, and `startDateTime.slice(0, 10)` put a late concert on the wrong day. Render times with `components/events/event-time.tsx`: it names the zone (`zoneLabel`: IST, PDT, `GMT+8`) when the concert is outside India, and, after hydration, when the reader's own zone differs, so the server HTML and first client render still match.
- `event-filters.ts` — the listing filters (`resolveDateRange` for `today`/`weekend`/`week`/a month/a day, `filterEvents`, `dayCounts`, `monthGrid`) and `listingHref`, the one builder of every listing URL. See "Event listings" below.
- `whatsapp-digest.ts` — `formatWhatsAppDigest(events, opts)`: a listing as WhatsApp text. Stored fields only; `*_~` are stripped from stored text before it is wrapped in bold.
- `distance.ts` — `distanceKm`, `formatDistance` ("≈ 6 km", never a decimal a PIN centroid cannot back).
- `submitted-events.ts` — what `/events/new/submitted` shows after the verify step's Submit. `partitionSubmitted` splits the events named in the URL into live (approved) and waiting (submitted), and shows a viewer only events they created, since the ids arrive in a query string. Only live events get a link and WhatsApp text (`submittedDigestOptions`, campaign `submit_share`): `event.get` returns approved events only, so a link to one still in review is a dead page. The way in is "List your event" in the header's Events menu, on `/events` (shown signed out too) and on every venue and organiser page (`components/events/list-event-prompt.tsx`); `requireUser` keeps the query string through sign-in, so `/events/new?festivalId=` survives it.
- `analytics.ts` — `AnalyticsEvent` and `trackEvent(name, params)`. Every GA4 event name lives in that constant rather than as a string literal at the call site. Adding one means adding it there, wiring the call, and then **marking it a key event in the GA4 console** — the SDK cannot do that, and an unmarked event is collected but not counted as a conversion. Event *parameters* likewise need registering as custom dimensions before they can be reported on; the property has none today.

### Structured data (JSON-LD)

Every payload is built by a plain function in `app/lib/structured-data.ts`;
`components/structured-data.tsx` only serialises them. Nothing builds a payload inline — vitest
runs `app/**/*.test.ts` in a node environment, so a payload assembled inside a component cannot
be asserted on, and what these emit is a public claim about a real person, hall or organisation.
`structured-data.test.ts` round-trips every assertion through `serializeJsonLd`, which is what
catches an `undefined` inside an array (it survives in memory and arrives as `null`).

| Page | Type |
|---|---|
| Artist | `Person`, or `MusicGroup` when `isGroup` |
| Composition | `MusicComposition`, `about` → the raga and tala pages |
| Raga, tala | `DefinedTerm` in a `DefinedTermSet` — nobody authored Kalyani |
| Event | `MusicEvent` + `BreadcrumbList` |
| Festival | `Festival`, with its programme as `subEvent` |
| Venue | `PerformingArtsTheater` or `Place`, with `Place.event` |
| Organiser | `Organization`, `NGO` or `CollegeOrUniversity` |
| Event listings | `ItemList` of `MusicEvent` |

Rules that are load-bearing, each written after finding the opposite shipped:

- **Claim nothing the record does not hold.** The same rule as the meta descriptions, and it had
  already been broken here: every artist's JSON-LD carried "Renowned classical musician in Indian
  classical music" — the inflation `GURU_RELATIONSHIPS` exists to prevent, asserted of all 1,111
  of them — plus a constant `knowsAbout` naming Carnatic music on Bharatanatyam dancers. Both now
  read from the record or are absent. Likewise gone: a composition's `inAlbum` naming a
  "&lt;raga&gt; Raga Collection" that exists nowhere, and its `datePublished` set to `createdAt`,
  which dated a nineteenth-century kriti to this year.
- **An absent field is `undefined`, and an empty list is absent too.** `JSON.stringify` drops
  `undefined` keys, but an `undefined` *inside an array* becomes `null` — so every list goes
  through `list()`. `award: []` is not "no award", it reads as "we checked and there are none".
- **A type is read from an explicit stored word, never defaulted.** `PerformingArtsTheater` is a
  `LocalBusiness` and says this address and phone belong to something trading as a theatre: true
  of an auditorium and a sabha hall, false of a temple hall, a terrace or a university building,
  which all stay `Place`. Same for organisers: only `ngo` and `university` have exact
  counterparts; `HinduTemple` is a *building*, and this record is the body that programmes the
  concerts. One consequence — `email` is an `Organization` property, so a plain `Place` may not
  carry one (`venueTakesEmail`).
- **A location needs an address.** Google's Event rich result requires `location.address`, and
  the event page shipped a `Place` carrying only a name, so every concert was ineligible. The
  event loader therefore returns the venue address twice: joined for the calendar links, and in
  parts for here. A venue page states its address once and every nested event points back at it
  by `@id`.
- **A janya raga gets no `termCode`.** It stores its *parent's* mela number, so publishing it
  would number the raga among the 72 — the same wrong claim the meta description was fixed for.
- **A festival's `location` is claimed only when every concert agrees on it**
  (`festivalLocationName`). A city-wide festival has no one hall, and naming the first would put
  the wrong one in a search result.
- **Offers never fall through to zero.** A ticketed event with no prices filled in gets no
  `offers` at all; a zero offer would print "Free" beside it in a search result.

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

### Thin raga pages: `noindex`, decided from the record

`isThinRaga` (`@rasika/core/domain/raga/client`, pure) marks a raga page thin when it has no
scale (arohanam, avarohanam or an alternate scale), no description, no composition and no logged
performance. The raga page emits `robots: noindex, follow` for it at request time, and the search
indexer sets `SearchDocument.noindex`, which the sitemap skips, so the two cannot disagree for
longer than one reindex. A page leaves the rule the moment any of those fields is filled.

The rule came from Search Console (90 days to 2026-10-09), not from a guess. "No scale and no
composition" caught 60 of 1,526 pages, but 17 of them carry a description and those are the
ones that rank (Mishra Yaman: 400 impressions, 15 clicks). With the description excluded, 43
pages remain, and together they took 48 impressions and 1 click. The owner chose to keep any
page that is shown in results, so the 20 of those 43 with any impression sit in
`KEEP_INDEXED_RAGA_IDS` (`packages/core/src/domain/raga/thin.ts`), which `isThinRaga` checks
first. Only the 23 with no impressions get `noindex`. Refresh that list from Search Console; do
not hand-pick entries. A parent raga alone does not
save a page: it is one line the parent's own page already shows. `transformRagaToDocument`
only marks `noindex` when given a composition count, so a caller without the whole corpus
cannot drop a page from the sitemap by accident.

### Colour tokens and contrast

Every colour comes from the HSL variables in `app/globals.css`; hard-coded Tailwind palette classes (`text-amber-600`) are a bug, not a style choice. Two rules the tokens now enforce:

- **Light and dark are not the same value.** `--primary` is L40 in light and L53.7 in dark, `--destructive` is L30 and L50, `--warning` is L26 and L60 (it is mostly text, and the old light L50 read 1.88:1), and `--primary-foreground` is white in light but near-black in dark. A single value for both modes is what produced 2.97:1 links and 2.19:1 error text.
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

### Handing bulk research to an outside agent (`research-batches` → `research-ingest`)

For a corpus too large to research on an expensive model. The fetching is cheap and delegable;
the *checking* is not, so only the middle step leaves the repo and nothing it produces reaches
the database unvalidated. Full runbook and the orchestrator/worker prompts:
`docs/research/raga-enrichment.md`.

- `research-batches --domain <d> --out-dir <dir> [--size 25]` writes self-contained packets —
  each carries the field list, the rules, and per record its id, name, what is missing and what
  is already stored. **The packet is the contract**; a worker gets no prompt restating the rules,
  because a prompt and a validator that disagree is how a rule quietly stops applying.
- `research-ingest --domain <d> --dir <dir> --out <csv> [--report <csv>]` validates every value
  and writes an ordinary admin CSV plus a refusal report. A truncated result file is skipped with
  a warning rather than taking the run down. Read the refusals before importing — a rate that
  jumps, or clusters on one field, means the batch is worth re-running rather than accepting.
- Rules live in `core/src/admin/research.ts` (browser-safe, unit-tested — `packages/scripts` has
  no vitest). **`melaNumber` is never accepted from research**: a janya stores its *parent's*
  number, exactly the fact a model gets subtly wrong, and `deriveMelaNumbers` computes it from
  the parent afterwards for free. `validateSwaras` refuses anything that is not swara notation,
  because a wrong arohanam is worse than a blank on the field people search for.
- Order matters: **dedup first**, then the 72 melakartas (canonical, and filling them unlocks
  mela derivation for their janyas), then the rest. Researching before merging spends the budget
  twice and writes onto a page about to become a redirect.

### Respelling lyrics (`lyrics-batches` → reader → `lyrics-ingest`)

Lyrics arrived in karnatik.com's romanisation, which is near ITRANS but is not it, and every
composition page renders them through `fromItrans`. Where the two disagree, every other script
shows the wrong letter: `hrdaya` rendered ह्र्दय, `mangaLam` மந்களம், and every Tamil `n` ந, so
என்னை read எந்நை. The source also does not follow its own scheme consistently, so rules alone
cannot repair it. Two halves, in `domain/composition/lyrics-normalize.ts`:

- **`normalizeLyricsText` holds only rules that are true in every language here**: bare `r`
  between consonants is ṛ (`R^i`); `n` before a velar or palatal is `~N`/`~n`; Sanskrit and Hindi
  get long `E`/`O`; Tamil gets `n2` (ன) everywhere except word-initially and before த. Real
  r-clusters (`dAridrya`, `tryambaka`) and swara lines are left alone. Every rule leaves the
  `roman` view unchanged, which matters because that is what Googlebot indexes.
- **Tamil is decided from the text (`looksTamil`), never the label.** Of 5,449 compositions
  labelled Tamil, about 2,000 score near zero on Tamil-only features — Annamacharya in Telugu,
  Swati Tirunal in Sanskrit. The label is a default. Applying ன to those would print ऩ in
  Devanagari.
- **`checkRespelling` is what lets a reader's corrections land unread.** It compares word skeletons
  (case, `h`, doubled letters and ITRANS punctuation dropped), allows joins and splits, gives each
  word its own small budget, and requires swara lines byte-for-byte. A per-*line* budget was tried
  first and let 42% of one-word swaps through; per-word lets 0.3% through, all one-letter cases
  (`kAma`→`rAma`) that no spelling check can tell from a typo fix.

The reader works from packets (`lyrics-batches --out-dir <dir> [--size 50]`) carrying the text
*after* the rules and a brief that is the whole contract. Songs added after the packets were cut get their own
directory (`--ids <file>`, a list or a `source-apply` manifest), since a full re-cut shifts
every open batch and re-reads songs already imported. `lyrics-ingest --dir <dir> --out <csv>
--report <csv>` re-reads the stored text, refuses any section that fails `checkRespelling` (the
rules' version is used instead), refuses the whole reading if the stored text moved since the
packet was cut, and skips a batch with no readable result rather than applying rules to it alone.
Apply the CSV with `admin-csv-import`, then reindex search.

Readers return **whole-word fixes**, not whole sections (`applyWordFixes`; `from` must stand as
whole words so a fix for `n2` cannot reach inside every Tamil word). The pilot returned
sections, at 105–195k tokens a batch, most of it copying out unchanged text. A reader also
returns a corrected **title** and **language**. `cleanCompositionTitle` drops the scraped
"- Click to listen (performer)!" from 290 titles, which also sat in their URL slugs, and keeps
a qualifier like `(varNam)` that tells two pieces apart. Renaming is safe: the route keys on the
id. A corrected language moves the Tamil `n2` and Sanskrit long vowels with it (`retargetTamil`)
so the reader never has to.

**English inside the lyrics is a separate step** (`lyrics-meanings`, flag then `--apply --file`).
96 English lines sit in 26 compositions — translations, gists, and a few compositions holding
*only* a translation. Inside `lyricsV1` they went through `fromItrans` and came out garbled in
every script. The report suggests `meaning` for a translation and `keep` for a note to the singer
("(repeat the ciTTasvara)", `englishLineKind`); `--apply` moves the marked lines into
`meaning`, drops a section left empty, and writes an admin CSV. Run it **after** the respelling
import, because the CSV replaces `lyricsV1` whole. The composition page renders `meaning` as
plain English and had never rendered it before. Until then, `isEnglishLine` keeps both the rules
and the readers off those lines.

`isEnglishLine` protects whole lines only, and a title is one line, so the Tamil ன rule once
printed `(an2other version2)`. The few English words that appear in a title's qualifier are
listed in `ENGLISH_QUALIFIER_WORD`, which leaves them alone and undoes an `n2` a reader copied in.
Extend that list when a new one turns up. A *version* note is then dropped from the title
altogether (`cleanCompositionTitle`): `(version 2)`, `(another version)`, and the respelled
`vErsiOn` the Sanskrit vowel rule made of it. It names a transcription, not a piece. Qualifiers
that do tell pieces apart, such as `(varNam)` or `(sixth AvaraNam)`, stay.

Tamil ற்றி is written `R_Ri`: `RRi` parses as vocalic ṛ. `_` is ITRANS's silent separator, and
`transliterate` strips it from every output, since only Devanagari dropped it on its own.

**Tamil ச stays `s`/`sh`.** Only `c` renders ச, and `c` makes the roman view read `ceydanai`
for a song searched as "seydanai". The Tamil script shows ஸ there; that is the trade.
`transliterate` does tidy two sanscript habits in Tamil output: the apostrophe it puts after ṛ
(`ஹ்ரு'தய`) and ஞ்ஜ, which Tamil writes ஞ்ச.

The same applies to Telugu and Kannada, and a Kannada reader caught it on endarO: both scripts
write a nasal before a stop or sibilant as the **anusvara** (ಎಂದರೋ, ವಂದನ), where sanscript
spells out the conjunct (ಎನ್ದರೋ). `transliterate` converts it for those two scripts only, and
keeps the conjunct before a nasal, y, r, l or v (ಅನ್ನ, ಜನ್ಮ). It also joins karnatik.com's
in-line hyphen splits (`mahAnubhAvu-landariki`) for every Indic script, and folds Tamil `n2`
to `n` for Telugu and Kannada, which have no letter for ன. Store the ITRANS phonetically and
fix a script's convention here, not in the data.

**Scraped text that is not the song is removed by rule** (`lyrics-junk --out <csv> --report
<csv>`, rules in `domain/composition/lyrics-junk.ts`), since readers may not remove words. Three
kinds: carnatic-circle.com navigation ("Go back to…", "click here"), an ashtapadi index (five or
more `aShTapadI N -` lines), and the karnatik.com page header (`title.  rAgA: X.  Y tALA.`),
keeping any pallavi that ran on after it. A header is stripped only when the record holds exactly
one **and** it names the record's own title. Several headers mean several songs in one record,
and a header naming another title is the only sign the lyrics are a different song, so both are
left alone and listed in the report. A standalone `(rAgA: kAmbhOji)` is a ragamalika marker and
stays. The CSV replaces `lyricsV1` whole, like `lyrics-meanings`: import one before cutting the
other.

### Cleaning the tala table (`pnpm cli tala-cleanup`, two steps)

Of 75 talas, 13 carry nearly every composition. Most of the rest came from karnatik.com headers
split on the wrong full stop: a raga name (`kAnaDA.`) or a fragment of "no given tALA" (`given`,
`or`, `m`) in the tala column. `tala-cleanup [--out]` reports every tala with a suggestion;
`--apply --file <csv> [--dry-run]` applies the `decision` column: `keep`, `merge:<name>`,
`split:<name>|<name>` (alternatives such as `Adi/rUpaka`: each composition gets both) or
`unlink` (not a tala: removed from its compositions and soft-deleted, with nothing put in its
place, because a raga name in the tala column says nothing about the tala). Rules live in
`domain/tala/cleanup.ts`. The apply writes `<file>.applied.json` with each composition's talas
before, which is what an undo would restore. Reindex after. The 2026-10 decisions are in
`docs/research/tala-cleanup-2026-10.csv`.

### Static content pages (`seed:content`)

The pages in `packages/scripts/src/addContent.ts` (about, attribution, FAQ…) are written by
`seed:content [--dry-run] [--prune]`, matched by path: a page that exists is updated in place, a
missing one is created. It used to create every page on every run, so prod held two records of
each (January and March 2026). The update covers every record with the path, because
`getContentByPath` returns whichever the index lists first. `--prune` deletes every copy but the
oldest; nothing refers to a content record by id.

### Composition sources, and importing an outside source (`source-*`)

A composition credits every site it draws on in **`sources`, a list of URLs**. It replaced the
single `sourceAttribution`, which could only name karnatik.com. `describeSource`
(`@rasika/core/domain/composition/client`) reads what a link is from the URL itself: a page, a
notation (shivkumar.org PDF or HTML), a class recording (MP3), a video. So the list stays one
pipe-joined admin CSV column. A recording's label comes from its file name (`-class`,
`-detailed`, `_Part2`), and `describeSources` numbers labels that still repeat on one song.
`sourcesOf` falls back to `sourceAttribution` on rows that
`migrate-composition-sources` has not moved yet. Source links keep `rel="nofollow"`, as the
karnatik link always had.

**`notation`** is a lesson document as preformatted text: lyrics, meanings and swara lines,
laid out by its author. Like any swara text it is never transliterated, and the page shows it
in a `<pre>` that scrolls sideways. The columns are what put a note under its syllable, so the
text comes from `pdftotext -layout` (poppler, needed on the machine that runs the fetch).
Word's HTML export breaks the columns, so HTML is only the fallback for the few lessons whose
PDF link is dead.

`toCompositionWithRelations` is the one mapper every composition reader returns. There were
seven copies, and all of them dropped `meaning` and `mergedIntoId`. So no page ever showed a
meaning, and a merged composition never redirected. `notation` is added only by
`getComposition`, because list pages would carry tens of kilobytes for nothing.

An outside archive of compositions comes in through one pipeline, whatever the source. Only an
**adapter** (`packages/scripts/src/sources/<name>.ts`, registered in `sources/index.ts`) knows
the source: it downloads the archive and reads it into `SourceRecord`s
(`domain/composition/source-import.ts`). Matching, review, apply and undo are shared
(`packages/scripts/src/sourceImport.ts`). Downloads live in `data/sources/<name>/`
(gitignored). The first adapter is `shivkumar`: Shivkumar Kalyanaraman's lesson archive,
about 380 krithis and 38 varnams, geethams and swarajatis, parsed in
`domain/composition/shivkumar.ts`.

The second is `carnatic-circle`: a UK bhajan group's WordPress site, read whole from its REST
API into `pages.json` and parsed on load (`domain/composition/carnatic-circle.ts`), so a parser
change needs no refetch. Every page is typed by hand, so raga, tala and composer are readings
for the reviewer, never facts: a page naming several ragas gets none and says so in `note`,
and a collection's composer (`COLLECTION_COMPOSERS`) is used only for one composer's songs and
only when the page names nobody. The site mixes spellings page by page, so a `SourceRecord`
may carry its own `romanisation` (`forNewRecord`); ISO/IAST pages are converted to ITRANS.
Titles here often differ from ours (`brahma okaTE` is our `tandanAnA Ahi`), so the 2026-10
review also compared lyrics; `docs/research/carnatic-circle-matches-2026-10.csv` holds the
scores and a `review_note` per row.

Compositions carry a free-text **`tags`** list (`bhajan` today; lowercase by convention), set on
create through the review CSV's `new_tags` column and round-tripped by the admin CSV. It is not
indexed and nothing on the site reads it yet. Bhajans that name no composer are linked to an
artist named **`Unknown`**, since `composerId` keys an index and cannot be blank (rule 9).

1. `source-fetch --source <name>`: the adapter downloads, cached, so a rerun fetches only
   what is missing. No AWS needed.
2. `source-match --source <name> [--out …]`: one review row per record, with the record of
   ours it matches and a `suggestion` (`match.ts`). Titles differ by spelling
   (`Abhayambikaya` against `abhayAmbikAyAha anyam`), so `foldKey`/`looseKey` fold the usual
   romanisation differences, and one title may be a prefix of the other. One raga carries
   several names (Panthuvarali is `kAmavardhani`), so a source's printed arohanam *and*
   avarohanam agreeing with ours also counts as the same raga (Sri and Madhyamavati share an
   arohanam). When our corpus holds the same song twice, the copy with more lyrics is chosen.
   A composer that differs goes to review. The `new_*` columns hold our existing raga, tala
   and composer spellings; a name with the same key beats a commoner looser match (`Varali`
   is `varALi`, not `punnAgavarALi`).
3. A person writes `decision`: `attach` (edit `match_id` to pick another record), `create` or
   `skip`. `source-csv --source <name> --file <reviewed>` writes the admin CSV. An adapter
   whose romanisation is `plain` gets its new titles and lyrics lowercased, since capitals
   mean retroflex letters in ITRANS. Run the respelling readers over new compositions after.
4. `source-apply --source <name> --file <csv> --user <id> [--dry-run]`. Use this, not
   `admin-csv-import`: it plans each attach against the record **as it stands when it runs**
   (`planAttach`): links merged into the current list, notation written only where none
   exists. It also writes `<csv>.applied-<time>.json`, the manifest: per attached song the
   exact links added and a fingerprint of the notation written, the ids of created songs,
   and any artist, raga or tala a new name created. `bulkUpsertForDomain` now returns
   `createdIds` and `createdLinks` for this.
5. `source-undo --manifest <file> [--only id,id] [--dry-run]` takes it back, wholly or per
   song (`planAttachUndo`). It removes only the links the import added, and the notation only
   while its fingerprint still matches, so an edit made since is kept and reported. It deletes
   a created song unless a concert has logged it since, and a created artist, raga or tala
   only once nothing uses it. It marks what it undid in the manifest, so a rerun is a no-op.
   Reindex after apply and after undo.

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

The survivor is chosen by `compareSurvivors`: Search Console impressions first (pass
`--impressions <page export JSON>`; that URL is the one Google already shows, and a 301 into it
loses nothing), then compositions plus logged performances, then fields filled, then age. Each
pair also gets a `confidence` from `assessRagaDuplicate`: `low` when the records contradict each
other (scale, mela, parent, or melakarta against janya), `high` when both scales agree or the
names differ only by noise, `medium` otherwise. The report pre-fills `suggestion`; only a person
writes `decision`.

Picking by impressions sometimes keeps the barer record (`keeravaaNi` beat `kIravANi`, which held
the scale, the mela number and 18 janya children). So `mergeRaga` does more than re-point
compositions: it copies every field the survivor lacks from the loser (`mergeFillPatch`, blanks
only, nothing overwritten) and re-points janya ragas whose `parentRaga` is the loser
(`listJanyaOf`, a full scan, since there is no parent index). The moderator merge page calls the
same function. It still does **not** move concert-log performances; `--dry-run` counts them, and
`cascadeRagaMergeToSetlistItems` exists if a run ever has some.

There is no automatic undo. Every apply run (and every dry run) writes `<file>.applied.json` or
`<file>.dry-run.json` beside the CSV, listing each pair's moved composition ids, re-parented
children and filled fields: the record from which a merge could be reversed by hand. Use
`pnpm prod-cli` for production; `pnpm cli` runs against your personal stage. After a real run,
reindex search and rerun `generate-melakarta-links`, since a merged id may be in that map. The
2026-10 review lives in `docs/research/raga-dedupe-2026-10.md`.

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
  saying which. Inventing either is inventing a legal fact about a real organisation. This rule was
  written about `vidyalaya` and the code broke it anyway on the next word: a bare `college` match
  stored `Suswaralaya College of Music (R)` — a public charitable trust by its own account — as a
  university. **A college of an art is a music school under a grander word**, so the subject decides,
  not the noun; a general degree college still reads as one.

A tag needs two events behind it or a third of the organiser's programme; the second clause is what
makes it usable, since most organisers here have one to three events. `year-round` needs five
distinct months, which separates a continuous concert series from a body that wakes up for
Ramanavami.

Deliberately out of scope: city, capacity, founded year, street address, description. None is
derivable and all four would have to be looked up. They already have a path — export from
`/admin/data/<domain>/export`, edit the sheet, upload it back. Reindex search after a run.

**The same fill runs continuously, and it hangs off approval — never submission.**
`cascadeEventContactToOrganiser` seeds an organiser's empty contact fields from an approved
event, so the batch above is a backfill rather than something to re-run by hand. Three things
about where it is wired:

- **`Event.approveEvent` is the hook**, because all three approval paths go through it — the
  moderator publishing straight out of `submitVerified`, the explicit `approveEvent`, and the
  bulk draft approve. It is awaited but its failure is swallowed and logged, like the festival
  auto-approve beside it: the event is approved either way, and a failure costs a field rather
  than the moderator's action.
- **Not `submitVerified`.** That is an `editorProcedure`, so any signed-in user reaches it.
  Seeding there would let anyone set a sabha's website by submitting an event about them.
  Approval is the point at which a person has vouched for what the poster said. (`resolveOrganiser`
  in that procedure does auto-*create* organisers for editors, but a name-only row is a far
  weaker claim than a contact detail on an existing organisation's page.)
- **`missingOrganiserContact` is shared with the batch fill**, so the two cannot drift, and it
  makes the cascade idempotent — approving a second event for the same organiser writes nothing,
  and a moderator's correction is never undone.

**The sweep itself lives in core** (`domain/enrichment.ts`, beside `cascade.ts` because it spans
two domains), shared by `pnpm cli enrich-venues-organisers` and the weekly
`VenueOrganiserEnrichCron` — the reason `rebuildArtistDenormCron` gives, that a scheduled run and
a manual run must not be able to differ. The script prints; core decides. The cron does **not**
reindex: `SearchIndexCron` already rebuilds every 6 hours.

Weekly, not daily, because the drift is slow and specific: `resolveOrganiser` in
`event.submitVerified` creates an organiser holding nothing but a name every time an event names
an unknown one, and venues arrive the same way. Contact details on organisers that already exist
are handled the moment they are known, by the approval cascade — the cron is the net for what the
cascade cannot see, chiefly a name-derived type on a record created since the last run.

One consequence of "fill only what is empty" is that **`tags` freezes once set**: an organiser
tagged carnatic-only will not gain `dance` after they start programming it. That is the deliberate
trade. The alternative re-adds a tag a moderator deliberately removed, every week, with no way to
tell that case from "never had it". Widen it only with somewhere to record the removal.

The verify step now shows **Contact Details** (phone, email, website) as an editable block.
It had been extracted, stored, and rendered on the public event page without ever being shown to
the person verifying it, so a wrong number went out uncorrected. Making it visible is what makes
seeding an organiser from it honest: nothing reaches an organiser record that a person has not
had the chance to read. Note this is separate from **Ticketing → Contact Phone(s)**, which is the
booking desk; `PhonesInput` therefore takes a `label` so the two sets of repeated rows are not
both announced as "Contact phone 1".

**A venue's address comes from its posters the same way, on approval.** The extractor always
asked for the hall's street, city and PIN, and the draft write dropped them, so every venue a
poster introduced arrived holding only a name; in Oct 2026 the posters of 82 venues were re-read
by hand to fill them (`docs/research/venue-addresses-2026-10.csv`). The event now keeps the
address as printed (`event.venueAddress`, evidence rather than the venue's address), the verify
step shows it as an editable block under the venue, and `approveEvent` calls
`cascadeEventAddressToVenue`. The rules are in `domain/venue/address.ts`:

- **Whole address or nothing.** A venue holding any address part is never touched, because a
  street from one poster beside a PIN from another is an address nobody wrote.
- **A city that disagrees seeds nothing**, whether it disagrees with the venue's stored `city` or
  with the city its PIN belongs to. That is the sign of an event linked to the wrong venue: the
  Oct 2026 pass found two Chennai concerts attached to Bengaluru halls of the same name.
- `city` is patched beside `address`, since listings and city pages read the top-level field.
  Coordinates are left to `geocode-venues`.

### Filling artists (`pnpm cli enrich-artists`)

The artist corpus arrived barer than the ragas: of 1,159 artists, **503 hold nothing but a name**
and 655 more hold nothing but an honorific (`Dr.`, `Vid.`, `Col.`). Exactly one has a biography,
which is why `extract-artist-bios` has nothing to read — it reads stored prose, and there is
none. So 1,158 of 1,159 pages fall through to the generic meta description on what
`artist-display.ts` already records as the largest and worst-converting query class on the site.

**The fix that needs no research is already in the table.** The `EventArtist` junction carries a
free-text `role` per appearance — 1,378 credits across 133 distinct roles, headed by vocal (210),
mridangam (153), violin (152) and ghatam (62). That is the same fact `instrument` holds, read off
a poster and checked by whoever verified the event. A closed role→instrument vocabulary fills
**703 of 1,169 artists** with no lookup and no model call, and `instrument` is what
`artistTagline` and `artistMetaDescription` both lead with.

Same shape as the venue and organiser fill: dry by default, `--apply` to write, an empty field
filled and a filled one never touched, so a re-run is a no-op.

- **The vocabulary is closed, explicit and alias-by-alias** (`domain/artist/enrich.ts`,
  browser-safe and unit-tested for the reason `dedup.ts` gives). No stemming: `mrudanga`,
  `khajira` and `morching` are how they were actually typed, and no stemmer reaches those from
  the canonical spelling. An unrecognised role fills nothing and waits for a person — the same
  rule as `venueTypeFromName`, which never falls back to `other`.
- **A role is kept when it says what the person *did*, and dropped when it says what their
  *standing* was.** `mridangam` and `bharatanatyam` are kept; `chief-guest` (18),
  `guest-of-honour` (14), `disciple` (22), `awardee` and `convenor` are standing, and `performer`
  (46), `artist` and `accompanist` are true of the whole corpus. That is what correctly leaves
  276 artists with credits blank. `NON_INSTRUMENT_ROLES` lists the tempting ones so the decision
  is reviewable, and a test asserts every one still refuses.
- **Repeats are the ranking, and ties break on first appearance.** One entry per appearance goes
  in, so a mridangist who sang once reads "Mridangam, Vocal" and not the reverse. `creditsByArtist`
  sorts oldest-first *because* of the tie-break — without it the stored string would depend on
  DynamoDB's scan order and a re-run would rewrite it for no reason. Capped at three.
- **`cascadeEventRolesToArtists` is the immediate path, on `approveEvent`**, beside
  `cascadeEventContactToOrganiser` and for the same reasons: approval not submission (any editor
  reaches `submitVerified`, and this writes to a real person's page), failure swallowed and
  logged, only-what-is-empty. The weekly sweep is the net for what it cannot see.
- Consequence, the mirror of the one `tags` has: **`instrument` freezes once set.** An artist
  filled as `mridangam` will not gain `vocal` after they start singing. Same trade, same reason —
  the alternative re-adds an instrument a moderator deliberately removed, every week.

**Three fields are deliberately not derived, each because the derivation would be a false
claim.** `city` — a venue says where the concert was, not where the artist lives, and Chennai
artists play Bengaluru constantly; this is the same error as writing an event's `contactInfo` to
the venue. `activeYears` — the event corpus is too young, and would date Sudha Ragunathan's
career to 2024. `isGroup` — flipping it strands existing membership edges, which is why
`artist.update` is a `moderatorProcedure` at all.

Everything else on an artist has no source in the database and needs outside research — see the
next section, which is now built.

Duplicates are a smaller problem here than in the other corpora: about 20 exact-name groups and
20 near pairs at `findArtistMatch`'s live 0.85 threshold, roughly 3% rather than the ragas' 20%.
Worth a pass, but not the blocker it was there. Note the matcher misses `Phanindra Bhaskara`
beside `Phanindra Bhaskar` — the surname must match outright, by design.

Merge reviewed pairs with `pnpm cli merge-artists --file <csv> [--dry-run]` (`keep_id`,
`merge_id`). **`mergeArtist` does not copy fields**, so the command first fills the kept record's
blanks from the other copy (`artistMergeFillPatch`, `domain/artist/merge-fill.ts`; never
`isGroup`), skips a pair already merged, and writes a manifest of what it copied. A merge of a
busy artist exceeds the collaborator fan-out cap; run `rebuild-collaborators` after, then reindex.

### Researching artists (`research-batches --domain artist`)

The same pipeline as the ragas, with one difference that shapes everything. Runbook:
`docs/research/artist-enrichment.md`.

**A raga's name is its subject; a person's is not.** Handed `kalyANi` a worker can only be
researching Kalyani. Handed `Hariharan` it returns the playback singer, correctly sourced and
about the wrong man — this corpus's Hariharan is an instructor with eight events. So every artist
record in a packet carries a **`context` block** (`domain/artist/research-context.ts`): what they
were credited playing, the venues and organisers, `performsWith`, and the date range. The brief's
first rule is to settle identity against it and to return **no fields** when it cannot be settled.
`performsWith` is the strongest signal in it — an accompanist is identified by who they accompany
far more reliably than by a surname.

Six fields: `website`, `socialLinks`, `city`, `specialisations`, `birthPlace`, `activeYears`.
**The four omissions are enforced in `RESEARCH_FIELDS`, not merely asked for in the brief**, so a
worker that sends one anyway has it refused with a reason:

- **`biography`** — `media-kit.ts` states the rule this codebase runs on: every artist platform
  lets a press-kit paragraph *become* the record. Prose here is **derived from fields**, by
  `artistMetaDescription` and the media kit, and never researched into them. Crawling bios in
  refills the field `rewrite-artist-bios` exists to drain.
- **`photoUrl`** — a scale is a fact, a photograph is someone's copyrighted work. It also cannot
  travel this path: the column is absent from `ADMIN_CSV_DOMAINS` and `isAllowedPhotoUrl` pins
  the OG fetch to the CDN host, so an external URL stores cleanly and silently degrades every
  share card to text.
- **`birthYear`** — a claim about a private individual, many of them children performing an
  arangetram. The column *is* writable by CSV; this list is the only thing stopping it.
- **`gurus`** — prose flattens exactly the distinction `GURU_RELATIONSHIPS` exists to keep.

**A composer is identified by what they composed.** Most have no events, so the context block
also carries `composes` (`buildComposerContext`): the count, six titles and ragas romanised with
`fromItrans`, and the languages. A record holding it passes the `--min-events` floor, and the
brief tells the worker to settle identity by a source naming this person as composer of those
songs. `activeYears` still refuses anything before 1800 (`YearSchema`), so most composers get
city, birthplace, specialisations and a Wikipedia link, and no years.

`--min-events <n>` is an **identity** control, not a coverage one: an artist with no appearances
has no context block, so there is nothing to check a candidate against — the precise case that
produces a confident profile of a namesake. The first run used `--min-events 2`, which cut 957
of 1,169 and left 212 records over 9 batches, ordered busiest-first.

Two rules the artist validators add: a social host in `website` is refused because both columns
feed `sameAs` and the same account arriving twice publishes one profile as two claims; and
`city`/`birthPlace` refuse a digit or a second comma, because a postcode is not a place name and
`Mylapore, Chennai, Tamil Nadu, India` is an address where the profile wants a city.

**`mergeResearch` refuses an artist result whose `name` is not the record's** (letters only,
doubled letters collapsed, so a romanisation still agrees). A worker returned Amrutha Venkatesh's
id under the name Amritha Murali, with Amritha Murali's city: every value valid, all about the
wrong singer.

When reading a returned run, the thing the validator cannot catch is **a cluster of plausible
values on one artist that all belong to somebody else**. Only `notes` and a person find that,
which is why the brief requires the worker to record how it settled identity every time.

**The context block is for identity, and a model will answer fields out of it.** The first run
returned 130 of 177 `specialisations` as the packet's own `roles` capitalised — `["violin"]` came
home as `["Carnatic violin"]` — which, with `instrument` already filled from those same credits,
would print the same fact twice on one page. `withoutRedundantSpecialisations` drops those at
merge time, **per entry, not per field**, because the same run also returned real additions
("Playback singing" beside "Carnatic vocal"). Any new field added here needs the same question
asked of it: could a worker answer this from the context block alone?

A specialisation that *contradicts* the derived `instrument` is usually correct, not an error —
Ranjani and Gayatri both began as violinists, and a harmonium accompanist may hold a vocal degree.
Read the note before removing one.

**A wrong `instrument` cannot be repaired by clearing it**: `fillArtistInstruments` refills an
empty field from the same role next Sunday, so `admin-clear-fields` is not stable for anything a
sweep derives. Correct the value instead — a two-column `id,instrument` CSV through
`admin-csv-import` is enough, since blank means "leave alone" — or fix the `role` on the event's
cast, which is the real source and repairs the event page too.

### Event dates: the year a poster does not print, and the form that could not save one

Three bugs met on one poster and are worth keeping apart, because each is a rule.

**A `datetime-local` input does not submit a storable date.** It gives `2026-08-14T17:45` — no
seconds, no offset — and every event schema wants `z.string().datetime({ offset: true })`. The
event edit form handed that raw value to `edit.saveChanges`, which validates against
`UpdateEventSchema` (`edit/service.ts`), so **the date was the one field on the form that could
never be changed**, and the failure said "No changes detected". Comparing the raw value against
the stored ISO string separately meant every save proposed a date change whether or not one was
made. Both directions now go through `shared/timezone.ts`:

| Direction | Function |
|---|---|
| form value → storable ISO | `zonedDateTimeToIso(local, zone)` |
| stored ISO → form value | `zonedDateTimeInputValue(iso, zone)` |

`zonedDateTimeToIso` preserves the wall clock exactly and computes only the offset, so it cannot
shift a time the way re-parsing through UTC does. Never write `+05:30` at a call site — that
literal was in three places and is wrong anywhere that observes DST; `DEFAULT_EVENT_TIMEZONE`
(`domain/event/schema.ts`, re-exported from `client.ts`) is the one source. And never slice a
stored string to 16 characters for an input: that is only right when the value happens to be
stored local-with-offset, and on a UTC-stored event it silently moves the concert by the offset
when the untouched form is saved.

**The extractor must be told what today is.** Posters routinely print a day and month and no
year at all ("AUG 14 | 5:45 PM"), so the model has to supply one, and with nothing to go on it
supplies one from its training distribution — it dated a 2026 concert to 2024. The prompts in
`domain/event/gemini.ts` are therefore **functions of `today`**, not module constants: they are
built inside a Lambda container that can stay warm for days, so a date captured at module load
would date every later poster to whenever the container booted. `gemini.test.ts` asserts both
the date's presence and that it is read per call.

**Never instruct a model to invent a value.** The festival prompt used to say "if event times
are not specified individually, use reasonable defaults (e.g. evening concerts at 18:00)", and
it duly turned three dancers billed under one 5:45 PM heading into three concerts at 5:45, 7:00
and 8:00 — a running order printed on no poster, published as fact. This is the same rule as the
meta descriptions and the JSON-LD: claim nothing the source does not hold. A missing time is
omitted or inherited from the one the poster states.

**A soft-deleted event can be brought back.** `Event.restoreEvent(id)` /
`pnpm cli restore-event <id>` clears `deletedAt` through the entity, so all five GSI sort keys
are recomputed (rule 7) and the cast's collaborators are rebuilt; it uses `.remove()` rather
than `.set(undefined)` (rule 8) and refuses a row carrying `mergedIntoId`, since that was merged
rather than deleted and restoring it would re-split the merge. Reading such a row needs
`getEventIncludingDeleted` — plain `getEvent` returns null for exactly the rows the tool is for.
Deleting an event to work around some *other* problem with it is an ordinary mistake and needs a
way back.

### Deduplicating venues and organisers (`pnpm cli dedup-places`, two steps)

Both lists carried the duplicates the ragas taught us to expect, for a sharper reason: an event
naming an unknown venue or organiser creates one, so the same body is stored under every spelling
a poster used. One hall was split six ways — `The Bangalore Gayana Samaja (R)`, `Gayana Samaja`,
`Gayana Samaaja`, `Bangalore Gayana Samaja`, `The Bangalore Gayana Samaja Hall`,
`Bengaluru Gayana Samaaja` — splitting its events across six indexable URLs.

1. `dedup-places [--out place-duplicates.csv]` — reads the database, writes only the CSV. Covers
   **both** domains in one file, keyed by a `domain` column, because it is one review pass.
2. `dedup-places --apply --file <path> [--dry-run]` — merges the rows whose `decision` is `merge`.

Same rules as `dedup-ragas` — merge never delete, nothing merges without a person marking it,
keys in the domain rather than in `packages/scripts` — plus three of its own:

- **The keys are in `shared/place-dedup.ts`, shared by both domains**, because it is one naming
  problem: an honorific (`Sri`, `Shree`), a registration marker (`(R)`, `(Regd.)`, `®`), an
  optional city, an optional generic building word, and whichever transliteration was typed.
- **Four tiers, and they are not a filter each row falls through once.** `placeExactKey` removes
  only certain noise, so a collision is real; `placeVariantKey` also drops honorifics, city and
  generic words and collapses spelling; `isNearMatch` catches what no rule predicts
  (`Chowdaiah` beside `Chowdiah`); `wordsSubsetOf` finds a hall named inside its building. A row
  already gathered by a shared key must stay reachable by the weaker tiers, or the report misses
  the best pairs — claiming rows tier by tier stranded `Chowdaiah Memorial Hall` and reported
  *zero* near matches. Relations therefore accumulate into one connected group per place, each row
  keeping the strongest tier that reached it.
- **`contains` is a relation, not a duplicate.** A hall inside a building is sometimes a real
  second venue. It is reported last and is the tier to read most sceptically: on the first run it
  proposed `Bhairavi Sabha` → `Indiranagar Sangeetha Sabha` and `Rama Mandira` → a concert hall,
  which are different places. It also ranked a parent below its own room, so check the direction
  before marking — the canonical is picked by merge score, and a studio can out-score its venue.

Canonical is the row the rest of the database already points at (`getVenueMergeScore` /
`getOrganiserMergeScore`: events attached plus filled fields), age breaking a tie. Both merges
re-point the junctions, soft-delete with `mergedIntoId` — which both routes already turn into a
redirect — and keep the loser's name in `alternateNames`. Renaming afterwards is safe: venue and
organiser routes key on the id, not a slug. Reindex search after a merge run.

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

### Talapettige (`packages/talapettige`)

A practice tool: a tanpura drone and a tala metronome, synthesised in the browser by two
AudioWorklets (`hooks/useFaustDSP.ts`, `hooks/useTalaDSP.ts`). Moved in from its own repo in
2026-10. The `dsp/*.dsp` files are the Faust sources the worklets were ported from; nothing
compiles them and the app does not load Faust.

- **No server.** `ssr: false` with every route prerendered, deployed as an `sst.aws.StaticSite`
  (`infra/talapettige.ts`). Settings and practice history live in `localStorage`, so there is
  no session, no tRPC and no database link. Keep it that way: a server would end offline use.
- **It is offline-first, unlike Classes.** Nothing here is private, so `public/sw.js` precaches
  the whole build at install. `scripts/build-sw.mjs` runs after `react-router build` and writes
  the file list and a content hash into `build/client/sw.js`; the hash names the cache, so a
  deploy replaces it. Pages are network-first, hashed assets cache-first, and Google Fonts are
  cached on first use. The build fails if a placeholder is left unfilled, because a worker that
  does not evaluate shows up in a browser only as "registration failed".
- **Cache headers carry the update path.** Only `assets/` is immutable. `sw.js` and the pages
  must revalidate, or a browser keeps the old worker and never sees a deploy.
- **The look comes from `@rasika/ui`**: the preset, `tokens.css` (so it follows the OS theme),
  `AppShell` with the bottom tab bar, `Card`, `Button`, `Field`/`Select`/`Input`,
  `EmptyState`. Nav items are `Link`s styled with `navItemClasses`, because `NavItem` is a plain
  `<a>` and would reload the page. Only the slider and the switch are local, since `@rasika/ui`
  has neither. Settings sections are `<details>` (`components/settings-section.tsx`).
- Icons come from `pnpm icons` (`scripts/generate-icons.mjs`), as in Classes.

### Event listings: filters, city pages, WhatsApp text, distance

`/events`, its date pages (`/events/today`, `/events/this-weekend`, `/events/this-week`) and
`/<city>/concerts` are one page (`components/events/event-listing.tsx`) over one loader
(`lib/event-listing.server.ts`), which loads **every** upcoming event (`event.upcomingListings`,
23 in Oct 2026, projected fields) and filters in memory. Revisit with a pre-built snapshot past
~1,000 upcoming events. Plan: `docs/plans/261023-01-listing-features.md`.

- **Every filter is a query parameter or a path segment, never client state.** The page works
  without JavaScript and each view is its own cached, shareable URL (the CloudFront policy keys on
  all query strings). Build links with `listingHref`. Only the three date presets of the whole
  listing are pages of their own; on a city page every filter is a query parameter and the
  canonical is the city page. Keyword Planner (Oct 2026): "carnatic concerts in bangalore"
  260/month, "… this weekend" and "… this week" 0, so per-city date pages were dropped.
- **Date-relative pages are cached until midnight in India** (`cacheUntilMidnight`), not for the
  week. Otherwise a quiet day serves yesterday's "Today".
- **An event's city is its venue's** (`EventListings.listUpcomingListings`). `event.venueCity`
  was empty on 22 of 23 upcoming events; nothing is written back. City slugs fold old names
  (`bangalore` → `bengaluru`, `shared/city.ts`) and the route 301s to the stored one; a city no
  venue is in is a 404, and a city with nothing upcoming carries `noindex`. The list of cities
  comes from the search index (`Search.listVenueCities`, venue documents carry `city`), not a
  venue-table scan per request.
- **"Free only" means `entryType === 'free'`.** Missing is unknown, not free.
- **Filters are buttons, not chips** (DESIGN.md: a chip never toggles), and reach 44px on mobile.
- **Distance needs an account.** The reader saves a PIN or their device location in
  `/settings/location` (`user.homeLocation`, never more precise than ~1 km: `resolveHomeLocation`
  rounds a device point to two decimals), and the listing loader computes "≈ 6 km away" on the
  server for that private page. Signed-out readers see a sign-in prompt. Clearing uses
  `.remove()` (rule 8). PIN centroids are `core/src/shared/pin-centroids.json`, built by
  `pnpm cli pin-centroids` from Nominatim (GeoNames was rejected: it puts Bengaluru PINs at the
  district centre). Venue `lat`/`lng`/`geoSource` come from `pnpm cli geocode-venues [--apply]`
  (map link first, else PIN centroid; fill-only, dry by default, `domain/venue/geo.ts`). A stated
  city that disagrees with the PIN places nothing.
- **A PIN-centroid venue point is for distance only.** Directions links and the venue's JSON-LD
  `geo` use `exactVenueCoordinates`, which accepts `map-link` and `manual` and nothing else.
- **WhatsApp text** is `?view=whatsapp` on any listing, plus a panel on the festival page, open to
  everyone (every paste is distribution). The heading carries actual dates (`digestHeading`:
  "Concerts in Bengaluru · This weekend, Sat, 24 Oct – Sun, 25 Oct"), because a forwarded text
  outlives the day it was written. "Open in WhatsApp" is a plain `wa.me` link, shortened or hidden
  past ~3500 encoded characters (`whatsAppOpenLink`), since long `?text=` links fail on some
  Android builds; Copy always has the whole list. It stops at 30 events and ends with the
  listing's own URL. Each event carries its own short link unless `links=0`; it was off while
  the links were full length, because they doubled the text. Every rasika.life link in it carries `utm_source=whatsapp&utm_medium=social`,
  `utm_campaign` (`listing_share`/`festival_share`) and `utm_content` (`listing`/`event`); ticket
  links are left alone. Copy/share/open fire `whatsapp_digest` (mark it a key event in GA4).
- **rasika.life links in the text are short: `rasika.life/l/<code>`** (`ShortLink` domain,
  `routes/l.$code.tsx`). The stored target is the path with its UTM tags, so the short link
  carries them and GA4 sees them on the page it lands on. The code is the first seven base36
  digits of the target's SHA-256: the same link always gets the same code, so building a text
  twice writes nothing, and a collision moves the newcomer to a longer code. Lowercase only,
  because ElectroDB lowercases key values. `shortLink.ensure` is a public mutation, since the
  text is built for signed-out readers; `isShortLinkTarget` keeps it from being an open
  redirect (a site path only, known query keys only). It is in `PRIVATE_ROUTERS`, so it does
  not clear the site cache: it runs while a page renders. The redirect is a 301 cached for a
  year. If the lookup fails the text prints the long links (`shortLinksFor`).
- **Dates are chosen two ways only: the presets and the calendar.** The month-button row was
  removed (a 2026-10 critique counted three overlapping date pickers). The calendar's arrows set
  `cal=YYYY-MM`, which moves the calendar and never filters the list; only the month title
  (`when=YYYY-MM`) and the days do. Arrows stop at this month and at the last month holding an
  event. Presets show their count, muted at zero, so "Today (0)" is honest.
- **Nearest first** (`sort=near`) is offered only to a signed-in reader with a saved location. It
  orders strictly by distance and starts a new date header wherever the day changes
  (`groupConsecutiveByDate`), so a day can appear twice: grouping whole days would put a far
  concert ahead of a near one.
- **A failed PIN save comes back to the listing** as `pin_error=<reason>` (the location form's
  action redirects to its `redirectTo`). It is read only for signed-in readers, is not part of
  `ListingState`, and `listingHref` never writes it, so it cannot leak into a shared link.
- **Events render as rows, not cards** (`EventCard` and `EventList`, DESIGN.md "a list of rows
  is a list"): a leading date/time column, title, venue, cast, badge and distance, and a 64×88
  top-cropped poster with `alt=""` because the row link already names the event. Ticketed and By
  invitation badges are neutral; the raga and tala colours mean those things only. Stored credits
  are shown through `roleLabel` ("chief-guest" → "chief guest").
- **Artists "Popular" and "Verified"** are ranked from the search index (`artist.browse`):
  `artistPopularity` (credited approved events + RSVPs + attendance) and `verified` are written
  onto each artist document at index time, so they refresh every 6 hours. The Verified filter
  renders only when at least one artist is verified (none were in Oct 2026).
- **Sign-in returns to the page that asked.** `/auth/login?redirectTo=` keeps the path in the
  session and the callback sends the reader there; it used to drop it and land everyone on `/`.
  Both ends go through `safeRedirectPath`, which refuses anything but a same-site path.

### Caching a public page (`Cache-Control`)

**Every signed-out page is cached at CloudFront for a week, and writes clear it.**
`applyDefaultCacheControl` (`~/lib/page-cache.ts`) runs in `entry.server.tsx` for documents and
for `.data` navigations, and gives any GET 200 whose route set no `Cache-Control` and no cookie
`public, max-age=0, s-maxage=604800, stale-while-revalidate=86400`, or `private, no-cache` when the
request carries `rasika_session`. Before it, nothing outside the artist routes was cacheable, and
crawlers ran ~850k Lambda invocations in ten days of Oct 2026 (web plus 2–3 tRPC calls a page).
It started at an hour, which barely helped: crawlers reach most pages about once, so the copy
expired before a second request.

It is safe only because of the cache policy in `infra/site.ts`. SST's own policy keys on no
cookie at all, which would serve one cached copy to signed-in readers and to every script and
theme choice. Ours keys on `rasika_session`, `theme` and `script_preference`, the only cookies
that change a page. **A new cookie that changes what a page renders must be added to that
whitelist**, or one reader's version is served to everyone. A request header is the same: no
loader may read `user-agent`, geo or language headers into the page.

**What clears it.** `invalidateSiteCache` (`@rasika/core/site-cache`) invalidates `/*`, never a
single URL: one composition shows on its raga's, its composer's and every list page. It never
throws; the week is the backstop. It is called from:

- **every successful tRPC mutation** (`middleware/site-cache.ts`, on the base procedure, so no
  procedure can skip it), except the `classes`, `concertLog` and `user` routers, which change no
  rasika.life page. A new router whose writes are private belongs in `PRIVATE_ROUTERS`;
- **`VenueOrganiserEnrichCron`**, only when a run wrote something;
- **`pnpm cli reindex`**, which every data script ends with, and `pnpm cli clear-page-cache` for
  a hand edit that runs no reindex.

**Deploys change the cache key instead.** The viewer-request function sets `x-rasika-build` to a
value that changes every deploy, and the cache policy keys on it. SST only clears the cache when
the hashed assets change, so a loader-only change would otherwise keep serving week-old HTML.

**Not hooked, on purpose:** `ArtistDenormRebuildCron` rewrites every artist daily with no signal
of what changed, and clearing on it would cap the cache at a day. Its fixes are a safety net for
the inline paths, which are tRPC mutations and already clear. They reach signed-out readers on
the next clear or within the week. The Instagram scraper writes social posts, which no page
shows. **A new job that writes something a page shows must call `invalidateSiteCache`** and needs
`siteCachePermissions` and `siteCacheEnvironment` (`infra/site-cache.ts`).

The distribution id reaches functions through an SSM parameter (`/rasika/<stage>/web-distribution-id`),
because the site links tRPC and taking the id directly would be a cycle.

**Pages are compressed in the Lambda, not by CloudFront.** CloudFront compresses only a
response with a `Content-Length`, and SST's React handler streams every response chunked, so
every page went out raw (118 kB for /events) despite the cache policy enabling Brotli.
`compressResponse` (`~/lib/compress.server.ts`) runs in `entry.server.tsx` for documents and
`.data` navigations: Brotli quality 5, else gzip, flushed per chunk so streaming still works, and
always `Vary: Accept-Encoding`. The cache policy keys on the normalised encoding, so each variant
is cached apart.

**Access logs** for the site go to the `RasikaWebCdnLogs` bucket (prod only, 30 days). They are
the only record of paths and user agents; Lambda logs carry neither.

A route that must be fresher sets its own header, which is kept: the artist routes use
`publicPageCacheControl(request)` (`~/lib/auth.server`, 2 minutes), returned via
`data(payload, { headers })` and forwarded by the route's `headers` export.

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

**A cascade must fire on a real change, not on a field being present.** `updateArtist` ran
`cascadeArtistNameUpdate` whenever the payload *carried* a name — and every exported row carries
`name`, so a full-corpus import ran the five-entity rename fan-out 1,169 times, rewriting every
composition, junction, award, membership and affiliation row with the value it already held and
bumping their `updatedAt`. Measured at ~10 seconds a row against prod: an eight-hour job to write
309 cells. It now reads the stored name first and compares. **Any cascade reachable from the bulk
importer needs the same question asked of it** — the CSV round-trip submits every column of every
row, so "the caller supplied this field" says nothing about whether it changed.

- **CLI** `pnpm cli admin-csv-export --domain <name> --out <path>` and
  `admin-csv-import --domain <name> --file <path> --user <id> [--dry-run]`, over the same registry
  functions the route uses so the two cannot validate differently. The route stays the ordinary
  path; these exist for a bulk pass against prod, where a dry run, every row error printed rather
  than the first few, and a file a script can build all matter. **A parse error stops the run** —
  landing the readable rows would write a partial edit and report success.
- **`AdminData.clearFieldsForDomain(domain, id, fields)`**, via
  `pnpm cli admin-clear-fields --domain <name> --id <id> --fields a,b`. The CSV cannot express
  this and should not: a blank cell means "leave alone", which is what makes a partial sheet safe
  to upload. But that leaves no way to take back a value that should never have been written, and
  enrichment produces exactly that — a venue was given the website of a same-named society in
  another city, sourced, plausible and wrong. Uses `.remove()` per rule 8, removes only what is
  actually set, and refuses `id`/`name`/`title`/timestamps. Wired for venue and organiser; add a
  `clear` to the registry entry to extend it.

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
| `citySlug`, `canonicalCitySlug` | `@rasika/core/shared/city` |

**A `client.ts` may take only types from `./entity`.** A value re-exported from an entity file
(`COMPOSITION_TYPES` was) drags ElectroDB and the AWS SDK into the browser: 106 kB gzipped on
two routes. Such constants live in a module with no imports (`composition-types.ts`,
`event-setlist/statuses.ts`); `domain/client-boundary.test.ts` fails if one comes back.

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