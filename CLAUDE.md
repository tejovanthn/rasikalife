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
  `cascadeOrganiserMerge`) must carry it, plus `cascadeArtistDeleteToAffiliations`.
- **`completion.ts` scores only fields on the artist record.** The moderator enrichment queue
  scores 100 artists straight off `artist.list`, which never loads a junction — a rule for
  affiliations there would mark every artist incomplete and flatten the ranking. Use
  `missingFields(entity, type)` for the gap-naming claim prompt.

Writes split by storage, and the wizard says so: affiliations write immediately (like
memberships), while gurus, credentials, works and the arangetram ride the form's Publish.
`affiliations` is deliberately absent from `CLAIMANT_EDITABLE_ARTIST_FIELDS` — it is not an
artist attribute at all, so "artistic director" cannot be self-granted through a claim.
`credentials` is excluded too: nothing else on the platform can corroborate a degree.

### Bio structuring pipeline (`pnpm cli`, three steps, in order)

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
`domain/artist/bio-proposals.ts` (flattening to CSV rows, and name matching). Two precision
rules the prompt and the code both enforce:

- **Classify, don't just pull names.** An influence ("influenced by the teachings of X" — who may
  have died before the artist was born) is not a guru edge; a professor who taught a degree
  module is `institutional`, not a discipleship. Anything unclassifiable goes to `unresolved`,
  which is the most useful column in the CSV.
- **Never auto-create an `Artist` or `Organiser`.** There are already duplicate slugs publicly
  indexed. `bestArtistMatch` reports a scored candidate and a human picks or creates. Load the
  corpus **once** with `listAllArtistsForMatching()` and pass it down — see that function's own
  warning about per-name sweeps.

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