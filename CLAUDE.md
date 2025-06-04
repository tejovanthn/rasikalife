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
- **Type Checking**: `cd packages/core && pnpm typecheck`

### Infrastructure
- Infrastructure is defined in `/infra/` directory using SST v3
- Database: Single DynamoDB table with 6 GSIs for optimal access patterns

## Architecture

### Monorepo Structure
- **packages/core**: Domain logic, database operations, utilities (TypeScript)
- **packages/trpc**: tRPC API server with domain routers
- **packages/functions**: AWS Lambda functions  
- **packages/scripts**: Utility scripts for data operations
- **packages/web**: Remix-based frontend application
- **infra/**: SST infrastructure definitions

### Core Package Architecture

The core package uses a domain-driven design with:

- **Single-Table Design**: All entities stored in one DynamoDB table using composite keys
- **Domain Structure**: Separate modules for artist, composition, raga, tala (more planned)
- **Repository Pattern**: Each domain has repository, service, schema, and types
- **Access Patterns**: Optimized for DynamoDB with GSI queries
- **KSUID IDs**: Time-sortable unique identifiers with domain prefixes

### Key Technical Patterns

1. **Entity Keys**: Format `[ENTITY_TYPE]#[ID]` for primary keys
2. **Versioning**: Content uses `VERSION#v[n]#[timestamp]` pattern for wiki-style updates
3. **ACL Pattern**: Artist management uses granular permission system
4. **Error Handling**: Standardized error codes following `[DOMAIN]_[ERROR_TYPE]` pattern
5. **Validation**: Zod schemas for all domain entities with consistent error messages

### Database Design

- Single DynamoDB table with primary key (PK/SK) and 6 Global Secondary Indexes
- Entity relationships managed through composite keys and access patterns
- Pagination using Base64-encoded continuation tokens
- Search currently uses DynamoDB scan (Elasticsearch planned for future)

### Testing Strategy

- Vitest for all testing with coverage reports
- Mock DynamoDB implementation for unit tests
- Tests collocated with implementation files (`*.test.ts`)
- Global test setup with deterministic ID and date generation

## Code Conventions

### Formatting & Linting
- Uses Biome for formatting and linting (configured in `biome.json`)
- 2-space indentation, single quotes, semicolons required
- Line width: 100 characters
- Strict TypeScript rules: no explicit any, import type enforcement

### File Naming
- Domain modules: `packages/core/src/domain/[entity]/`
- Each domain has: `types.ts`, `schema.ts`, `repository.ts`, `service.ts`, `index.ts`
- Tests: `*.test.ts` alongside implementation files
- Barrel exports via `index.ts` files

### Import Organization
- Biome automatically organizes imports
- Use import type for type-only imports
- Domain exports structured for selective importing

## Development Workflow

1. Always run tests after changes: `pnpm test` in relevant package
2. Run `pnpm check` before committing to ensure code quality
3. For tRPC changes, test with `sst shell vitest run` to include proper environment
4. Type checking: Use `pnpm typecheck` to validate TypeScript without building

## Domain Implementation Pattern

When adding new domains to core package:

1. Create domain directory in `packages/core/src/domain/[name]/`
2. Implement in order: `types.ts` → `schema.ts` → `repository.ts` → `service.ts`
3. Add comprehensive tests for each layer
4. Export from domain `index.ts` and main package `index.ts`
5. Add tRPC router in `packages/trpc/src/routers/[name].ts`
6. Register router in `packages/trpc/src/routers/index.ts`

## Key Dependencies

- **SST v3**: Infrastructure and serverless deployment
- **DynamoDB**: Primary database with AWS SDK v3
- **tRPC**: Type-safe API layer
- **Zod**: Schema validation
- **KSUID**: Time-sortable unique IDs
- **Vitest**: Testing framework
- **Biome**: Formatting and linting
- **Remix**: Frontend framework (in web package)