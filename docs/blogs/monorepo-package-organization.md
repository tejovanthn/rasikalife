# Monorepo Package Organization - Structured Code Sharing

## Introduction

Monorepos enable code sharing between multiple applications while maintaining clear boundaries and dependencies. Proper package organization is crucial for maintainability, build performance, and developer experience. This blog post explores the monorepo structure used in the Rasika.life platform, covering package boundaries, subpath exports, TypeScript configuration, and best practices.

**Related ADRs:**
- [ADR-003: tRPC v11 for Type-Safe APIs](../adrs/adr-003-trpc-v11-type-safe-api.md)
- [ADR-005: ElectroDB for Type-Safe Database Operations](../adrs/adr-005-electrodb-type-safe-database-operations.md)
- [ADR-009: Overall Architecture Patterns](../adrs/adr-009-overall-architecture-patterns.md)

## The Monorepo Challenge

### Traditional Multi-Repo Approach

```
rasika-core/         # Separate repos
rasika-api/
rasika-web/
rasika-auth/
```

**Problems:**
- **Code duplication**: Shared types duplicated across repos
- **Version management**: Coordinating versions is complex
- **Circular dependencies**: Can't reference each other easily
- **Build coordination**: Must build and publish separately
- **Testing difficulty**: Integration testing across repos is hard

### Monorepo Benefits

```
rasika/              # Single repo
├── packages/
│   ├── core/        # Shared domain logic
│   ├── trpc/        # API layer
│   ├── auth/        # Authentication
│   ├── web/         # Frontend
│   ├── functions/   # Lambda functions
│   └── scripts/     # Utility scripts
```

**Benefits:**
- ✅ Single source of truth
- ✅ Shared code without publishing
- ✅ Atomic commits across packages
- ✅ Simplified dependency management
- ✅ Easier refactoring
- ✅ Better developer experience

## Package Structure

### Overview

```
packages/
├── core/              # Domain logic and database
│   ├── src/
│   │   ├── auth/          # Auth subjects and roles
│   │   ├── constants.ts   # Shared constants
│   │   ├── db/            # Database client
│   │   ├── domain/        # Domain entities
│   │   │   ├── artist/
│   │   │   ├── composition/
│   │   │   ├── edit/
│   │   │   ├── raga/
│   │   │   ├── tala/
│   │   │   └── user/
│   │   ├── index.ts       # Main exports
│   │   └── utils/         # Utilities
│   ├── package.json
│   └── tsconfig.json
│
├── trpc/              # tRPC API server
│   ├── src/
│   │   ├── routers/       # Domain routers
│   │   │   ├── artist.ts
│   │   │   ├── composition.ts
│   │   │   ├── edit.ts
│   │   │   └── index.ts
│   │   └── trpc.ts        # tRPC setup
│   ├── package.json
│   └── tsconfig.json
│
├── auth/              # OpenAuth issuer
│   ├── src/
│   │   └── issuer.ts
│   ├── package.json
│   └── tsconfig.json
│
├── web/               # Remix frontend
│   ├── app/
│   │   ├── routes/
│   │   ├── components/
│   │   └── lib/
│   ├── package.json
│   └── tsconfig.json
│
├── functions/         # Lambda functions
│   ├── src/
│   │   ├── trpc.ts
│   │   └── search.ts
│   ├── package.json
│   └── tsconfig.json
│
├── scripts/           # Utility scripts
│   ├── src/
│   │   └── seed.ts
│   ├── package.json
│   └── tsconfig.json
│
└── search/            # Search service
    ├── src/
    └── package.json
```

## Core Package Design

### Modular Domain Structure

```
packages/core/src/domain/
├── artist/
│   ├── client.ts      # Client-safe exports
│   ├── entity.ts      # ElectroDB entity
│   ├── index.ts       # Main exports
│   ├── schema.ts      # Zod schemas
│   ├── service.ts     # Business logic
│   └── types.ts       # TypeScript types
├── composition/
│   ├── client.ts
│   ├── entity.ts
│   ├── index.ts
│   ├── schema.ts
│   ├── service.ts
│   └── types.ts
└── edit/
    ├── client.ts
    ├── diff.ts
    ├── entity.ts
    ├── index.ts
    ├── registry.ts
    ├── service.ts
    └── types.ts
```

**Benefits:**
- **Clear boundaries**: Each domain is self-contained
- **Consistent structure**: Same pattern across all domains
- **Easy navigation**: Find what you need quickly
- **Client safety**: Separate client-safe exports

### Subpath Exports

```json
// packages/core/package.json
{
  "name": "@rasika/core",
  "version": "1.0.0",
  "exports": {
    ".": "./src/index.ts",
    "./domain/artist": "./src/domain/artist/index.ts",
    "./domain/artist/client": "./src/domain/artist/client.ts",
    "./domain/composition": "./src/domain/composition/index.ts",
    "./domain/composition/client": "./src/domain/composition/client.ts",
    "./domain/edit": "./src/domain/edit/index.ts",
    "./domain/raga": "./src/domain/raga/index.ts",
    "./domain/tala": "./src/domain/tala/index.ts",
    "./domain/user": "./src/domain/user/index.ts",
    "./auth": "./src/auth/index.ts",
    "./utils": "./src/utils/index.ts",
    "./db/client": "./src/db/client.ts"
  }
}
```

**Usage:**
```typescript
// Import from main entry
import { Artist, Composition } from '@rasika/core';

// Import from specific subpath
import { Artist } from '@rasika/core/domain/artist';
import { createEdit } from '@rasika/core/domain/edit';
import { ROLE, can } from '@rasika/core/auth';
import { generateId } from '@rasika/core/utils';

// Client-safe imports (no Node.js/AWS dependencies)
import type { Artist } from '@rasika/core/domain/artist/client';
```

**Benefits:**
- **Selective imports**: Only import what you need
- **Better tree-shaking**: Unused code is eliminated
- **Clear API**: Explicit entry points
- **Client safety**: Separate client exports prevent SSR issues

### Client-Safe Exports

```typescript
// packages/core/src/domain/artist/client.ts
/**
 * Client-safe exports for Artist domain
 * No Node.js or AWS dependencies - safe for browser import
 */

// Re-export types only
export type { Artist, CreateArtistInput, UpdateArtistInput } from './types';

// Re-export schemas (Zod is client-safe)
export { CreateArtistSchema, UpdateArtistSchema } from './schema';
```

**Why Client-Safe Exports?**
- **SSR compatibility**: Remix/Next.js can import types safely
- **Smaller bundles**: No server dependencies in client code
- **Clear separation**: Explicit client vs server API

```typescript
// ❌ Not client-safe (has AWS SDK dependency)
import { createArtist } from '@rasika/core/domain/artist';

// ✅ Client-safe (types only)
import type { Artist } from '@rasika/core/domain/artist/client';
import { CreateArtistSchema } from '@rasika/core/domain/artist/client';
```

## Package Dependencies

### Dependency Flow

```
web ────────┐
            ├──> trpc ──> core
functions ──┘              │
                          │
auth ─────────────────────┘
scripts ───────────────────┘
```

**Rules:**
- **core**: No dependencies on other packages (foundation)
- **trpc**: Depends only on core
- **auth**: Depends only on core
- **functions**: Depends on trpc (and transitively core)
- **web**: Depends on trpc (and transitively core)
- **scripts**: Depends on core

### package.json Dependencies

```json
// packages/core/package.json
{
  "name": "@rasika/core",
  "dependencies": {
    "electrodb": "^2.14.3",
    "ksuid": "^3.0.0",
    "zod": "^3.23.8",
    "@aws-sdk/client-dynamodb": "^3.682.0",
    "@aws-sdk/lib-dynamodb": "^3.682.0"
  }
}

// packages/trpc/package.json
{
  "name": "@rasika/trpc",
  "dependencies": {
    "@rasika/core": "workspace:*",
    "@trpc/server": "^11.0.0-rc.624",
    "zod": "^3.23.8"
  }
}

// packages/web/package.json
{
  "name": "@rasika/web",
  "dependencies": {
    "@rasika/core": "workspace:*",
    "@trpc/client": "^11.0.0-rc.624",
    "@remix-run/node": "^2.15.1",
    "@remix-run/react": "^2.15.1"
  }
}
```

## TypeScript Configuration

### Root tsconfig.json

```json
// tsconfig.json (root)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "noEmit": true,

    // Path mapping for package references
    "paths": {
      "@rasika/core": ["./packages/core/src/index.ts"],
      "@rasika/core/*": ["./packages/core/src/*"],
      "@rasika/trpc": ["./packages/trpc/src/index.ts"],
      "@rasika/trpc/*": ["./packages/trpc/src/*"]
    }
  }
}
```

### Package-Specific tsconfig

```json
// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}

// packages/trpc/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../core" }  // Reference core package
  ]
}
```

## Build and Development

### pnpm Workspace

```yaml
# pnpm-workspace.yaml
packages:
  - packages/*
```

### Scripts Organization

```json
// package.json (root)
{
  "scripts": {
    "dev": "sst dev",
    "format": "biome format --write .",
    "lint": "biome lint --write .",
    "check": "biome check --write .",
    "typecheck": "pnpm -r exec tsc --noEmit"
  }
}

// packages/core/package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  }
}

// packages/trpc/package.json
{
  "scripts": {
    "test": "sst shell vitest run",
    "test:coverage": "sst shell vitest run --coverage",
    "typecheck": "tsc --noEmit"
  }
}
```

### Running Commands

```bash
# Run command in all packages
pnpm -r test

# Run command in specific package
pnpm --filter @rasika/core test

# Run command in multiple packages
pnpm --filter "@rasika/core" --filter "@rasika/trpc" test

# Run dev mode (SST)
pnpm run dev
```

## Import Patterns

### Good Import Patterns

```typescript
// ✅ Import from package entry point
import { Artist, Composition } from '@rasika/core';

// ✅ Import from subpath
import { Artist } from '@rasika/core/domain/artist';

// ✅ Client-safe import
import type { Artist } from '@rasika/core/domain/artist/client';

// ✅ Utility import
import { generateId } from '@rasika/core/utils';

// ✅ Auth import
import { ROLE, can } from '@rasika/core/auth';
```

### Bad Import Patterns

```typescript
// ❌ Relative imports across packages
import { Artist } from '../../core/src/domain/artist';

// ❌ Importing from internal paths
import { ArtistEntity } from '@rasika/core/src/domain/artist/entity';

// ❌ Importing Node.js deps in client code
import { createArtist } from '@rasika/core/domain/artist';  // Has AWS SDK!
```

## Testing in Monorepo

### Test Organization

```
packages/core/
├── src/
│   ├── domain/
│   │   └── artist/
│   │       ├── service.ts
│   │       └── service.test.ts    # Collocated tests
│   └── utils/
│       ├── pagination.ts
│       └── pagination.test.ts
└── vitest.config.ts
```

### Vitest Configuration

```typescript
// packages/core/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/test/**'],
    },
  },
});
```

### Running Tests

```bash
# Test single package
cd packages/core
pnpm test

# Test all packages
pnpm -r test

# Test with watch mode
cd packages/core
pnpm test:watch

# Test with coverage
pnpm test:coverage
```

**Related Reading:** [Testing Patterns for DynamoDB](./testing-patterns-dynamodb.md)

## Linting and Formatting

### Biome Configuration

```json
// biome.json (root)
{
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noNonNullAssertion": "error",
        "useImportType": "error"
      },
      "suspicious": {
        "noExplicitAny": "error"
      }
    }
  },
  "organizeImports": {
    "enabled": true
  }
}
```

### Running Checks

```bash
# Format all code
pnpm run format

# Lint all code
pnpm run lint

# Check (lint + format)
pnpm run check
```

## Best Practices

### 1. Clear Package Boundaries

```typescript
// ✅ Good - packages have clear responsibilities
packages/
├── core/         # Domain logic, no HTTP/UI
├── trpc/         # API layer, no UI
├── web/          # UI, no direct DB access
```

### 2. Explicit Exports

```json
// package.json - Always define exports
{
  "exports": {
    ".": "./src/index.ts",
    "./domain/artist": "./src/domain/artist/index.ts"
  }
}
```

### 3. Client-Safe Exports

```typescript
// Separate client exports
export * from './types';      // ✅ Safe
export * from './schemas';    // ✅ Safe (Zod)
export * from './service';    // ❌ Not safe (AWS SDK)
```

### 4. Consistent Structure

```typescript
// Every domain follows same pattern
domain/
├── client.ts      # Client-safe exports
├── entity.ts      # Database entity
├── index.ts       # Server exports
├── schema.ts      # Validation schemas
├── service.ts     # Business logic
└── types.ts       # TypeScript types
```

### 5. Workspace Dependencies

```json
// Always use workspace protocol
{
  "dependencies": {
    "@rasika/core": "workspace:*"
  }
}
```

## Common Pitfalls

### 1. Circular Dependencies

**Problem**: Packages depend on each other

```typescript
// ❌ Bad - circular dependency
// packages/core imports from packages/trpc
// packages/trpc imports from packages/core
```

**Solution**: Keep dependency flow one-way
```typescript
// ✅ Good - one-way dependency
// packages/trpc imports from packages/core
// packages/core has no dependencies on other packages
```

### 2. Leaking Server Code to Client

**Problem**: Importing server code in client

```typescript
// ❌ Bad - AWS SDK in browser
import { createArtist } from '@rasika/core/domain/artist';
```

**Solution**: Use client-safe exports
```typescript
// ✅ Good - types only
import type { Artist } from '@rasika/core/domain/artist/client';
```

### 3. Inconsistent Package Structure

**Problem**: Each package organized differently

**Solution**: Follow consistent patterns

### 4. Not Using Subpath Exports

**Problem**: Importing from internal paths

```typescript
// ❌ Bad
import { Artist } from '@rasika/core/src/domain/artist/types';
```

**Solution**: Use defined exports
```typescript
// ✅ Good
import { Artist } from '@rasika/core/domain/artist';
```

## Monorepo Tools Comparison

### pnpm Workspaces (Our Choice)

**Pros:**
- ✅ Fast, efficient
- ✅ Strict dependency hoisting
- ✅ Good workspace support
- ✅ Compatible with most tools

**Cons:**
- ❌ Less mature than npm/yarn

### Turborepo

**Pros:**
- ✅ Excellent caching
- ✅ Parallel execution
- ✅ Remote caching

**Cons:**
- ❌ Additional complexity
- ❌ Not needed for small monorepos

### Nx

**Pros:**
- ✅ Powerful build system
- ✅ Code generation
- ✅ Dependency graph

**Cons:**
- ❌ Complex configuration
- ❌ Overkill for simple monorepos

## Conclusion

A well-organized monorepo enables efficient code sharing while maintaining clear package boundaries and dependencies. By using subpath exports, client-safe patterns, and consistent structure, you can build maintainable applications that scale with your team.

For the Rasika.life platform, our monorepo organization enables seamless code sharing between the API, web app, and Lambda functions, while maintaining type safety and clear separation of concerns.

**Related Reading:**
- [tRPC Type-Safe API Layer](./trpc-type-safe-api-layer.md)
- [SST v3 Infrastructure Patterns](./sst-infrastructure-patterns.md)
- [Testing Patterns for DynamoDB](./testing-patterns-dynamodb.md)

## Resources

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Node.js Package Exports](https://nodejs.org/api/packages.html#package-entry-points)
- [Monorepo Best Practices](https://monorepo.tools/)
