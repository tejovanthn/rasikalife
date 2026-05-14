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
- **packages/scraper**: Data scraping utilities
- **infra/**: SST infrastructure definitions

### Core Package Architecture

The core package uses a domain-driven design with:

- **Single-Table Design**: All entities stored in one DynamoDB table using composite keys
- **ElectroDB**: Entity modeling library wrapping DynamoDB (each domain has an `entity.ts`)
- **Domain Structure**: artist, composition, raga, tala, event, festival, venue, organiser, award, user, social-post, rsvp, edit, search, change-history, concert-log, and more
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
| Pure utilities (completion score, etc.) | `@rasika/core/shared/completion` (or relevant subpath) |

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