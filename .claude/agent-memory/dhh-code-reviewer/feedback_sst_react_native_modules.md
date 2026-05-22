---
name: feedback-sst-react-native-modules
description: Sharp/native modules can't live in the React server Lambda; SST's React SSR strips node_modules and the install option lives at server.install (not server.nodejs.install)
metadata:
  type: feedback
---

`sst.aws.React` does not include `node_modules/` in the deployed server bundle — only `bundle.mjs`. Native modules like Sharp will fail at runtime with `Cannot find package 'sharp'`.

The `install` option for `sst.aws.React` is at `args.server.install`, **not** `args.server.nodejs.install`. The nested-under-`nodejs` form is silently ignored (see `.sst/platform/src/components/aws/ssr-site.ts` lines 380–413 and 1442–1445).

**Why:** confirmed by inspecting the deployed `.sst/artifacts/RasikaWebServerUseast1/code.zip` — only `bundle.mjs` was present despite `server.nodejs.install: ['sharp', ...]` being set. The SsrSite code reads `args.server?.install`, not the nested form.

**How to apply:** when a React server route needs sharp/canvas/puppeteer or anything else with native binaries, do not try to install it into the React server. Instead, factor the work into a dedicated `sst.aws.Function` (mirroring the `packages/image-processor` and `packages/og-image` pattern) and have the React route 302-redirect to that function's URL. For other `nodejs.install` props on regular `sst.aws.Function` resources, the nested syntax is correct — that pitfall is React-specific.

Related: [[project-rasika-shape]].
