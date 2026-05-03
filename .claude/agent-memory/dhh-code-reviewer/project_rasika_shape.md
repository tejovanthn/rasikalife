---
name: Rasika.life shape
description: High-level structural facts about the rasika.life monorepo that recur across reviews
type: project
---

Rasika.life is an SST v3 monorepo for Indian classical arts. Packages: core (ElectroDB single-table), trpc, web (React Router v7), functions, auth, search, image-processor, scraper, scripts.

**Why:** Reviews keep touching the same axes — domain CRUD repetition, tRPC router boilerplate, web/server boundary leaks. Knowing the shape avoids re-deriving it.

**How to apply:** When reviewing, expect: per-domain quartet of `entity.ts`/`schema.ts`/`client.ts`/`index.ts`; tRPC routers that are thin wrappers around `@rasika/core` domain functions; web routes using `createServerClient` from `~/api.server` in loaders/actions. Subpath exports in `@rasika/core/package.json` exist specifically to keep ElectroDB/AWS SDK out of the browser bundle.
