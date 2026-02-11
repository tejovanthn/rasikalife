# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the Rasika.life platform.

## Overview

ADRs document significant technical decisions made during development, providing context, rationale, and consequences.

## ADRs

### Infrastructure & Architecture

1. **[ADR-001](adr-001-single-table-dynamodb-design.md)**: Single-Table DynamoDB Design
   - Status: Accepted
   - Single table with GSIs for optimal access patterns

2. **[ADR-002](adr-002-sst-v3-infrastructure-framework.md)**: SST v3 Infrastructure
   - Status: Accepted
   - Serverless infrastructure with SST v3

9. **[ADR-009](adr-009-overall-architecture-patterns.md)**: Overall Architecture
   - Status: Accepted
   - Modern serverless architecture patterns

13. **[ADR-013](adr-013-pnpm-workspaces-monorepo.md)**: pnpm Workspaces for Monorepo
   - Status: Accepted
   - Fast, efficient monorepo management

### API & Type Safety

3. **[ADR-003](adr-003-trpc-v11-type-safe-api.md)**: tRPC v11 API
   - Status: Accepted
   - End-to-end type-safe API layer

5. **[ADR-005](adr-005-electrodb-type-safe-database-operations.md)**: ElectroDB Type Safety
   - Status: Accepted
   - Type-safe database operations

12. **[ADR-012](adr-012-zod-runtime-validation.md)**: Zod for Runtime Validation
   - Status: Accepted
   - Schema validation with type inference

### Frontend & UI

4. **[ADR-004](adr-004-remix-v2-frontend-framework.md)**: Remix v2 Frontend
   - Status: Accepted
   - Full-stack React framework

### Domain & Features

6. **[ADR-006](adr-006-generic-edit-system-design.md)**: Generic Edit System
   - Status: Accepted
   - Flexible edit management system

7. **[ADR-007](adr-007-rbac-system-implementation.md)**: RBAC System
   - Status: Accepted
   - Role-based access control

### Development Tools

8. **[ADR-008](adr-008-testing-strategy-framework-selection.md)**: Testing Strategy
   - Status: Accepted
   - Vitest with comprehensive coverage

10. **[ADR-010](adr-010-ksuid-unique-identifiers.md)**: KSUID for Unique Identifiers
   - Status: Accepted
   - Time-sortable unique IDs

11. **[ADR-011](adr-011-biome-code-quality-tooling.md)**: Biome for Code Quality
   - Status: Accepted
   - Fast formatting and linting

18. **[ADR-018](adr-018-subpath-exports-pattern.md)**: Subpath Exports for Tree-Shaking
   - Status: Accepted
   - Optimized bundle sizes

### Authentication & Security

14. **[ADR-014](adr-014-openauth-authentication.md)**: OpenAuth for Authentication
   - Status: Accepted
   - Serverless-native OAuth authentication

### Data Patterns

15. **[ADR-015](adr-015-error-handling-pattern.md)**: Structured Error Handling
   - Status: Accepted
   - Type-safe error codes

16. **[ADR-016](adr-016-cursor-based-pagination.md)**: Cursor-Based Pagination
   - Status: Accepted
   - Efficient DynamoDB pagination

19. **[ADR-019](adr-019-content-versioning-strategy.md)**: Content Versioning Strategy
   - Status: Accepted
   - DynamoDB version tracking

20. **[ADR-020](adr-020-denormalization-strategy.md)**: Denormalization for Read Performance
   - Status: Accepted
   - Embed data for fast reads

21. **[ADR-021](adr-021-cascade-update-pattern.md)**: Cascade Updates for Consistency
   - Status: Accepted
   - Maintain denormalized data

22. **[ADR-022](adr-022-six-gsi-access-patterns.md)**: Six GSI Access Pattern Design
   - Status: Accepted
   - Strategic index allocation

### Search & Discovery

17. **[ADR-017](adr-017-fusejs-client-side-search.md)**: Fuse.js for Client-Side Search
   - Status: Accepted
   - Cost-effective fuzzy search

### Frontend & SEO

23. **[ADR-023](adr-023-seo-friendly-url-slugs.md)**: SEO-Friendly URL Slugs
   - Status: Accepted
   - slug-KSUID URL pattern

## ADR Template

See [template.md](template.md) for the standard ADR format.

## Decision Log

See [decision-log.md](decision-log.md) for historical decisions.

## References

- [ADR GitHub Repository](https://github.com/joelparkerhenderson/architecture_decision_record)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
