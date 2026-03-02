# ADR-024: React Router v7 (Migration from Remix v2)

## Status
Accepted

Supersedes: ADR-004

## Context
The Remix team announced the unification of Remix and React Router into a single project under the React Router name. Remix v3 was released as React Router v7 — the same full-stack framework with the same SSR, loader/action, and file-based routing patterns, but with unified packages and improved Vite-native tooling.

Continuing on Remix v2 would mean staying on an end-of-life package while the ecosystem moved to React Router v7. The migration path was designed to be mechanical: package renames with minimal API changes.

## Decision
Migrate `packages/web` from Remix v2 to React Router v7 (`react-router` + `@react-router/*`).

## Consequences

### Positive
- ✅ **On the maintained path**: Remix v2 is EOL; React Router v7 is the official successor
- ✅ **Same mental model**: Loaders, actions, file-based routing, and error boundaries are unchanged
- ✅ **Vite-native**: React Router v7 is built on Vite, replacing the custom compiler
- ✅ **Better typegen**: `react-router typegen` generates route-level types automatically
- ✅ **File system routes**: `@react-router/fs-routes` provides the same flat-file routing convention
- ✅ **Ecosystem alignment**: Community packages target React Router v7

### Negative
- ❌ **Import churn**: All `remix` and `@remix-run/*` imports replaced with `react-router` and `@react-router/*`
- ❌ **Config changes**: `remix.config.ts` replaced with `react-router.config.ts` and Vite plugin

## Alternatives Considered

### Stay on Remix v2
- **Pros**: No migration effort
- **Cons**: End-of-life, no security patches, diverging from community
- **Why rejected**: Not viable long-term

### Migrate to Next.js
- **Pros**: Large ecosystem, Vercel hosting
- **Cons**: App Router paradigm shift, loses SST/Lambda deployment model, major rewrite
- **Why rejected**: Disproportionate cost, no meaningful benefit

## Implementation Details

Key package changes:
- `@remix-run/react` → `react-router`
- `@remix-run/node` → `@react-router/node`
- `@remix-run/serve` → `@react-router/serve`
- `@remix-run/dev` → `@react-router/dev`
- File-system routes via `@react-router/fs-routes` + `@react-router/remix-routes-option-adapter`
- Route typegen via `react-router typegen` (run before `tsc`)

## References
- [React Router v7 announcement](https://remix.run/blog/merging-remix-and-react-router)
- [React Router v7 upgrade guide](https://reactrouter.com/upgrading/remix)
- ADR-004: Original Remix v2 decision
