# STATE

Single next step, kept current. Everything else lives in `docs/plans/`.

## Active: artist bio structuring (2026-07-30)

Plan: `~/.claude/plans/eventual-bubbling-mountain.md`. All eight steps of the handoff spec are built.

**Next step: deploy, then run the pipeline against real bios.** Nothing here has executed against a deploy either — it lands on top of the undeployed artist profile redesign below, so one deploy covers both.

What landed: typed `gurus` (`relationship` + `source`), a new **`ArtistAffiliation` junction** (not a list attribute — the spec said no new entity, but its own step 5 wanted an Organiser reverse lookup, which a list cannot serve without a scan), `credentials` and `works` as list attributes, arangetram fields, wizard editors for all of them, conditional profile sections, the organiser "Artists" listing, and the three-step bio pipeline (`extract-artist-bios` → `import-bio-extractions` → `rewrite-artist-bios`). See CLAUDE.md for the model and the rules that hold it together.

**There are no bios in the prod database yet** (confirmed by the repo owner 2026-07-31), so the corpus pipeline has nothing to chew on. The wizard's per-artist Extract button is therefore the path that matters first: paste a bio, press Extract, read what it proposes. That is now also the cheapest way to measure precision — it shows every proposal in context instead of requiring a CSV round trip.

Note `sst shell --stage prod` **does** run here; what fails is importing `@rasika/core`'s main entry from a script, on an `@openauthjs/openauth` `./subject` subpath. So the CLI cannot be exercised locally, but SST itself is not the blocker.

**Post-deploy, in order:**

1. **Paste a long bio into the wizard's About step and press Extract.** Needs `GEMINI_API_KEY`, already linked to the tRPC lambda (`infra/trpc.ts`). Check the three classification traps land under "Needs your judgment" rather than becoming guru edges — an influence, an institutional teacher, and a workshop teacher. **This is the gate on the bulk-approval screen**, which is still unbuilt on purpose.
2. **Then the corpus tools**, once there are bios to run them over: `extract-artist-bios` → review the CSV → `import-bio-extractions`. Only after that is `rewrite-artist-bios` safe — its `--min-fields` guard (default 2, counting only extracted fields) exists precisely because shortening a bio whose facts were never extracted destroys them.
3. **Check a moderator can add an affiliation** through the wizard and that it appears on the organisation's page. This is the one new write path with a junction behind it.

**Two things worth watching on the first artist edit:** the arangetram guru/venue pickers resolve names through two extra loader queries (a dangling id renders blank, by design), and the profile now splits gurus into lineage and "Also studied with" — unclassified rows count as lineage, so nothing existing should move.

## Also active: artist profile redesign

Plan: `docs/plans/260722-01-artist-profile-redesign.md` (revised 2026-07-22 against the codebase).

**Next step: deploy.** Every phase is built and the whole-feature review is done and acted on (2026-07-29, below). Nothing is outstanding in code; what remains is the pre-deploy list.

**Nothing in phases 7–9 has run against a deploy.** `sst` does not run in this environment, so the composited OG card, the gallery reorder, the login-time invite redemption, the claims queue, the claim form and the events split have never executed for real. Check on the first deploy, in order:

1. **A Google sign-in still succeeds** — the `verified_email` gate can refuse a login that previously worked.
2. **An invite redeems on login.**
3. **The OG card renders with a photo** — and note the photo fetch is now allowlisted to the CDN host, so if artist photos are served from any other origin the card silently degrades to text. `[og] refusing to fetch off-CDN photoUrl` in the logs is the tell.
4. **`ArtistDenormRebuildCron` completes.** It now runs three full-table sweeps, not two; its timeout went 300s → 900s and memory 1024 → 2048 MB on estimate, not measurement. Read the duration and max-memory metrics off the first run and bring them back down if there is room.
5. **Run the backfills once** — `pnpm prod-cli rebuild-repertoire`, `rebuild-featured`, and `rebuild-collaborators`. The last one has never successfully run: it crashed on a missing export until this review.

Also: the OG cache-key change orphans every existing `og-images/**` object (harmless, reclaimable), and `cascadeEventMetadataToArtists` wrote malformed `gsi1sk` values until this review — **any artist whose event was edited before this deploy has a corrupted junction row that will show as "Upcoming" forever**. `pnpm cli rebuild-collaborators` does not fix it; the row needs rewriting through ElectroDB. Worth a scan for `gsi1sk` values not starting with `$eventartist_` if the events lists look wrong.

### From the design audit (2026-07-29)

`/impeccable audit` over the feature's surfaces: **15/20, Good**. Accessibility was the weak dimension and the cause was three colour tokens, not diffuse sloppiness. All nine findings are fixed.

**The token defects, which reached far past this feature.** Light-mode `--primary` sat at L 53.7% and gave **2.97:1** as link text, below AA and below even the 3:1 large-text floor. Fixing it exposed two more the audit had missed and a test then caught: white on that same rust was **3.38:1** on every filled button in both themes, and dark-mode `--destructive` was **2.19:1**, so form errors were close to invisible on dark. The shared cause was one value serving both themes. Now light `--primary` is L40 (links 4.73, buttons 5.38), dark `--primary-foreground` flips to near-black (5.76), dark `--destructive` goes to L50 with a dark label (4.89), and `--ring` tracks the light primary so the focus indicator clears 1.4.11's 3:1. Hue and saturation are untouched, so the earthenware character holds; only the value moved.

`--muted` and `--accent` also carried hue **-21**, which CSS normalises to 339 and renders rose while every other token sits on the brand's 17. Every `bg-muted` surface site-wide was quietly off-brand.

**`app/lib/contrast.test.ts` now pins all of it** — it parses the real `globals.css`, asserts each on-screen pair in both themes, and fails on a negative hue. It is what found the destructive failure. `app/lib/contrast.ts` exports the maths so a candidate value can be checked before committing.

**Smaller fixes:** the verified badge on artist cards was an `aria-label` on a bare `<svg>`, which is not reliably announced, so it is an `aria-hidden` icon plus `sr-only` text; gallery images set `alt=""` when a `<figcaption>` already shows the caption, instead of making screen readers hear it twice; the public claim button moved off `size="sm"` (36px) to 44px with a pending label, and the rank input off 32px; `text-amber-600` became `text-warning`.

**Three anti-patterns:** events render as hairline rows with a leading `<time>` column rather than three stacked groups of identical cards (which I introduced in phase 9, and which also gets the row to a 44px tap target for free); "Explore More" — three same-sized cards carrying "Browse other musicians" and the like — is now a plain row of links; and the subtitle stopped printing twice, since the header and the hero each rendered one and with no instrument or city both read "Indian classical music artist".

**Not done, deliberately:** `ui/button.tsx`'s `sm` size stays at 36px. PRODUCT.md asks for 44px, but changing the shared primitive restyles every button on the site, which is a decision worth taking on its own rather than as a side effect of an artist-profile audit. The two public 44px targets that matter are fixed directly. Also unaddressed: no DESIGN.md exists, which is how a hue of `-21` survived; `/impeccable document` would generate one.

### From the whole-feature review (2026-07-29)

One `/code-review` fork over phases 0–9. Fifteen findings; I verified the load-bearing ones by hand before acting (dumping the real `gsi1sk` from the entity, reading SST's generated cache policy, checking `UpdateArtistSchema`'s shape). Two were downgraded to plausible — the eventual-consistency pair, real in the code but unobservable without a deploy. All fifteen are now fixed.

**The three that would have hurt in production:**

- **The artist subroutes shared-cached signed-in documents.** `/events`, `/compositions` and `/gallery` each declared `public, s-maxage=120` from a static `headers` export. But the root loader puts the viewer's name and email into every document, and SST's generated CloudFront server cache policy sets `cookieBehavior: "none"` — the session cookie is not in the cache key. So one signed-in moderator loading a subroute would populate the edge cache with their own email and hand it to every subsequent visitor for two minutes. The profile index had this right; the three subroutes diverged from it. All four now route through one `publicPageCacheControl` in `auth.server.ts`, which decides from the session cookie (cheap, no I/O) rather than `getUser` (a token verify plus a tRPC fetch — far too costly for an anonymous path). An expired cookie costs a cache miss, never a leak. Phase 6 flagged the cookie-in-cache-key question and judged it cosmetic; that judgement was only ever true of the index route.
- **`cascadeEventMetadataToArtists` wrote a raw ISO timestamp into `gsi1sk`.** The real key is `$eventartist_1#eventstartdatetime_<lowercased iso>`; `'2'` sorts above `'$'`, so every row it touched compared greater than every correctly-keyed row. Latent until phase 9 gave `listEventsByArtist` a `.gt(now)`/`.lt(now)` split — after which any concert whose title a moderator had edited read as *upcoming*, permanently. The whole raw `UpdateCommand` is gone: ElectroDB recomputes the GSI key from the composite on `.patch().set()`, verified with `.params()`, and `.patch()` brings the existence condition a raw update lacks. The old test asserted the wrong value and so was the bug's alibi — the same failure mode as the phase-7 reorder test.
- **The phase-8 claimant auto-approve granted more than it claimed to.** `UpdateArtistSchema` is `CreateArtistSchema.partial()`, so it admits `name`, `isGroup` and `photoUrl` — meaning a verified claimant could rename an artist (cascading across four entity types), flip `isGroup` (the field `artist.update` is `moderatorProcedure` to protect), or set the URL the OG lambda fetches server-side. §4.3.1 described the grant as the editor form on their own record. Narrowed to `CLAIMANT_EDITABLE_ARTIST_FIELDS`, a named allowlist in the artist schema with a test per exclusion. An edit outside the set is not rejected, only left in the moderator queue.

**Also fixed:**

- **JSON-LD was serialised with a bare `JSON.stringify` into `dangerouslySetInnerHTML`.** Phase 6 started feeding it `sameAs` from `socialLinks[].url`, and `z.string().url()` validates without rewriting, so `https://x.com/</script><script>…` stored verbatim would end the script element on the public, edge-cached profile. Both call sites now use a tested `serializeJsonLd` that escapes `<`.
- **The OG lambda's photo fetch is pinned to the CDN host.** A known phase-7 deferral, closed: `/og/artist/{id}` is public and unauthenticated, and `photoUrl` was an unrestricted URL any editor could set, so an anonymous request could make the lambda fetch instance metadata or a VPC address. An off-CDN URL now reads as "no photo" rather than as a failed fetch, which matters because a failed fetch is deliberately never cached.
- **`rebuild-collaborators` had never worked.** It imported `collaboratorsFrom` from the artist barrel, which never exported it, so the sweep the plan calls mandatory (§4.5.1) completed both full table scans and then threw. It also reached across the package boundary into core's entity modules by relative path. The sweep now lives in core beside the repertoire and featured ones, the CLI is a thin wrapper, and **the daily cron runs it** — which also gives the inline collaborator recompute a healer it never had: it reads the `byArtist` GSI immediately after writing to it, so a just-approved event can be computed away, and over-cap casts and merges are skipped inline by design.
- **A merge destroyed guru years and discipline.** The `gurus[]` fixup built a fresh `{id, name}`, dropping the three keys §4.6 widened the element with — the fixup predates the reshape. Spread now, with the years in the test fixture.
- **The merge's claim recompute raced its own writes.** `recomputeArtistClaimStatus` takes a `justWritten` hint precisely because the re-read is an eventually-consistent Query; the merge passed nothing, so it could compute `unclaimed` and strip `verifiedAt` from an artist that had just received the only verified claim. The parameter takes a list now, since a merge moves many rows at once.
- **The gallery page was unreachable for most artists.** Both the teaser and its "View all photos" link were gated on there being *featured* photos, and `addArtistPhoto` defaults `featured` to false. The section now shows whenever there are photos at all, preferring featured ones, and the loader fetches 24 rather than 12 so a featured photo further down the order is not silently ignored.
- **The reorder reply truncated the gallery.** It answered with `listPhotos` at the core default of 20 while the client replaced its whole state with the reply, so a moderator with more than 20 photos watched rows vanish. The editor loader had the same omission. One `GALLERY_EDITOR_PAGE_SIZE` now, used by both.
- Smaller: the claim prompt no longer invites anonymous visitors to claim a profile that already shows a Verified badge; `resolveArtist` memoizes the candidate *promise*, so the concurrent resolves within one event share a table sweep instead of each starting one; `cascadeArtistNameUpdate`'s silence about `collaborators[].name` is now a stated omission with its reasoning (unindexed, self-heals on the daily sweep, and the URL resolves by id regardless); and the unused 124-line `SourceEntity` is deleted.

### Phase 9 — polish (2026-07-28)

Scope was settled with the repo owner: surface instrument/city in the UI (not a derived-data sweep), restyle the events block, add the deferred rank input.

- **The events teaser showed an artist's *oldest* concerts.** `byArtist` sorts ascending by date, so `limit: 6` returned six rows from years ago and never the date the artist is about to play — on the profile and on `/artists/:id/events` alike. `listEventsByArtist` takes `when: 'upcoming' | 'past'` now (forward from now, or backward from it), the router passes it through, and omitting it keeps the whole-run behaviour the wizard's performances list wants. The profile renders one Events section as Upcoming → Notable performances → Recent, with an upcoming date beating a featured one on the overlap. The subroute gives past events the pagination and shows upcoming whole, on the first page only.
- **The artist card ignored two phases of work.** It rendered initials and `specialisations[0]` — no phase-7 photo, no phase-1 instrument/city. Now photo, "instrument · city", and the verified tick, on `/artists` and the home page. Search results still fall back to name + specialisation: the Fuse index carries `{id, name, description}` per §5, and widening `SearchDocument` for one entity type would bloat the shared blob for all eight.
- **The profile hero rendered the city twice** for anyone with a city and no instrument — once in the joined line, once in the `MapPin` paragraph under it. Both callers now go through one `artistTagline` helper (`app/lib/artist-display.ts`, tested).
- **`setEventArtistFeatured` never cleared `featureRank`**, despite its own comment claiming it did. It passed `featureRank: undefined` to `.set()`, and ElectroDB drops undefined values out of the UpdateExpression — verified against the real entity with `.params()`, where the attribute was simply absent. So an unfeatured row kept a stale rank that would silently reorder the teaser if it were ever featured again. It is an explicit `.remove(['featureRank'])` now. **The old test was the bug's alibi**, asserting the `.set()` call shape rather than the effect — the same shape of mistake the phase-7 reorder test made. Three tests replace it, including one pinning that a rank of `0` is kept rather than read as absent.
- The rank input the phase-5 recognition slice dropped is back: a per-row box that appears once a row is featured, committing on blur rather than per keystroke (typing "12" would otherwise write rank 1 first and reorder the list under the moderator's hands). `api.artist.performance` reads it with `readOptionalInt` — its `parseInt` read `'2.7'` as 2 — and rejects a sub-1 rank with a readable message rather than letting a stringified Zod issues array reach the toast.

**Deferred, with reasons:** search results still show the plain card (see above). The per-row rank input shares one fetcher with the feature toggles, so an in-flight write disables every control in the list — the same deferral phase 7 made for the gallery grid, and it should be closed for both at once or neither. Nothing derives instrument or city from the events an artist has played; that sweep was considered and deliberately not built.

### From the phases 7–8 review (2026-07-28)

One `dhh-code-reviewer` on Opus across both phases. It re-verified the phase-7 fixes as correct and confirmed the parts of phase 8 that matter most: the anonymous profile document cannot vary by viewer, no email or claim detail reaches a public read path, email normalization has one definition every writer and reader routes through, no attacker-controlled address can reach it, and the claim-then-delete ordering in redemption is right in every partial-failure case it traced. Its verdict on the whole: the data model was sound and the feature was **write-only** — a grant nothing could see, undo, or use. Everything below is fixed.

- **An invite was irreversible through the product.** Nothing listed invites and nothing deleted them, so a mistyped address was a standing offer of someone else's profile to whoever owned the typo, redeemable at any future login and removable only by hand. Now `getInvitedClaims`/`revokeArtistClaimInvite`, an `invited` + `revokeInvite` procedure pair, and the wizard lists outstanding invites beside the field that creates them with a Withdraw button.
- **The only grant that skipped review was the only one not requiring a `moderatorNote`.** Approve and reject were guarded twice over; the invite — which reaches `verified` with no review at all — took none. Required now in the Zod schema, in core, in the router and in the wizard. The invite's own timestamp was also being destroyed: ElectroDB's `upsert` re-applies the `createdAt` default unconditionally, so redemption overwrote "when was this address trusted" with the moment of redemption. Carried across as `invitedAt`.
- **`canManageArtist` was granted and never checked** — see the note below, this one is a design fix rather than a wiring fix.
- **A merge could strand a verified grant.** "Canonical always wins" silently dropped a verified claim when the loser held it and the canonical held a rejection, and the claimant lost management of their own profile with no trace. Resolved by status precedence (verified > pending > rejected > invited), tested in both directions. The merge also never recomputed the canonical's badge, so a verified claim could arrive on an artist whose `claimStatus` still said unclaimed — `recomputeArtistClaimStatus` is now extracted and called after the claim pass.
- **Every claim failure reported "you have already claimed this artist."** A bare `catch` mapped throttles and permission errors to CONFLICT, so a user whose write had genuinely failed stopped retrying. Narrowed to the conditional-check failure; everything else rethrows.
- **The moderator queue never showed its own errors** — a failed approve was indistinguishable from a success. **The claim affordance was hidden from logged-out visitors**, which is nearly the whole audience and includes the artist arriving at their own page; the signed-out branch is viewer-invariant so it stays cacheable. **`mine` was a GSI query used as a point read** and returned full rows including the moderator's private reasoning about the claimant, over a public function URL — replaced by `myStatusFor`, a GetItem returning only the status.
- **Two artist writes used `.update()`, which has no existence condition** and would create a phantom row rather than fail — the exact shape of the uppercase-key bug this repo repaired in production. Both are `.patch()` now, and redemption skips a soft-deleted or merged-away artist instead of resurrecting it with a verified badge.
- **`packages/og-image/src/card.ts` contained a literal NUL byte**, so git treated a TypeScript source file as binary and every future change to the OG card would have been undiffable. It came from the phase-7 field-separator fix being written as a raw control character instead of the `\0` escape. Now the escape, with a comment saying why it must stay one.
- Nits: dropped two `as never` casts on the writes that decide who manages a profile (they suppressed nothing), and the claim disclosure is `<details>` rather than a `useState` toggle so it works before hydration.

**What a verified claim actually confers, and why that needed deciding.** §4.3.1 said it should unlock "the existing editor form on their own record" — but `createDraft` is `protectedProcedure` and the edit route only calls `requireUser`, so **every signed-in user could already do that for any artist**. The grant as specced was vacuous, and a claims queue whose approvals confer nothing is worse than no queue. `edit.submit` now auto-approves a submitted edit when the submitter holds a verified claim on that artist. Deliberately narrow: it applies to the named artist only, requires `verified` (not invited, not pending), and the edit still travels the ordinary Edit pipeline with the same schema, validation and audit row — so it widens *who may approve*, not *what may be written*. The check is server-side in the router because the client must not be able to assert it. **This was chosen as a stated default, not confirmed by the repo owner** — the alternatives were the moderator wizard scoped to the claimant's own record (richer, but it writes across five entity types including shared event data) or recognition-only with no new powers. Reversible in one place.

**Deliberately deferred, with reasons:** `cascadeArtistNameUpdate` does not refresh `ArtistClaim.artistName` — the one junction it skips, cosmetic per §4.2 but now the only exception to the pattern. Nothing bounds claims per user, so any account can fill the pending queue (not an access risk). `api.artist.claim.tsx` is the sixth copy of the `/api/artist/*` boilerplate the whole-phase-5 review said to collapse into `withModerator(handler)` + `field(formData, name)`; fold it into that pending refactor rather than adding a seventh variant. `issuer.ts` throws inside `success()` for an unverified account, which surfaces as a blank 500 rather than a message.

### Phase 8, slice 1: the `ArtistClaim` core domain (2026-07-28)

Built across two commits: an agent wrote the four modules and then hit the monthly spend limit, leaving no tests and no merge fixup (`bbe0f70ad`, committed as wip); both were finished afterwards along with the index redesign below.

Landed: `packages/core/src/domain/artist-claim/{schema,entity,client,index,index.test}.ts`, `'invited'` added to `ARTIST_CLAIM_STATUSES`, and the `cascadeArtistMerge` claim fixup with three tests. Two row kinds share the `ARTIST#${artistId}` partition behind a `kind` discriminator — `CLAIM#${userId}` and `INVITE#${normalizedEmail}` — so `getArtistClaims` stays one query.

Now wired up: exported from `packages/core/src/index.ts` and given an `./domain/artist-claim/client` subpath for browser-safe types.

**The index trap it was built on, and the fix.** The obvious shape is a `byUser` index on `userId` and a `byEmail` index on `email`, each expected to be sparse because the other kind leaves its field unset. **ElectroDB does not omit an index whose composite is missing — it writes the template with an empty suffix.** Checked against the real entity with `.params()`:

```
invite row (no userId) → gsi2pk = "artist_claim_user#"
claim  row (no email)  → gsi3pk = "artist_claim_email#"
```

That is a hot partition on both sides, and on the byEmail side it is worse than untidy: `getClaimsByEmail` is the **login-time authorization lookup**, so a blank argument would have matched every pre-authorized artist on the site instead of none.

Replaced by a single `byActor` index keyed on `['kind', 'subject']` — `ARTIST_CLAIM_ACTOR#${kind}#${subject}`. `subject` is required and always present (the userId or the normalized email), so there is no empty partition to fall into, `kind` keeps the two lookups from ever returning each other, and it costs one GSI slot less: **gsi3 is free again**. Re-verified with `.params()` that no key ends in a bare `#`. The empty-argument guards stay as belt and braces on the authorization path.

**Worth carrying forward:** that trap is not specific to this entity. Any future ElectroDB index over an optional attribute has the same shape, and the failure is silent — the index simply fills up with one giant partition nobody queries until someone passes a blank value.

Also settled in slice 1: `moderatorNote` is required to approve as well as reject (§8 calls it the audit trail, and a TS `string` still admits `''`); rejecting one of several claimants recomputes the badge as verified-beats-pending-beats-unclaimed rather than dropping straight to unclaimed; and a merge drops rather than overwrites a row the canonical artist already has for the same actor, so a verified claim can't be silently demoted by the loser's copy.

**Still unstarted in phase 8:** the tRPC router, `canManageArtist`, the claim UI, and the moderator queue. Nothing collects artist emails yet, so enrichment done before phase 8 ships needs a second pass to add them.

The other phase-8 piece already done: `05c7bb941` makes a verified Google email a precondition of signing in, so the email is safe to use as an authorization key. Note it can refuse a login that previously succeeded; unexercised against a deploy.

Phase 7 also adds two things to the pre-deploy list: (1) the OG cache key changed shape, so **every existing `og-images/**` object is orphaned** — harmless, but the prefix can be emptied to reclaim the space. (2) The **degraded-card rule is unverified against a real deploy**: a card that should carry a photo but couldn't fetch one is served and deliberately *not* cached, so watch that a genuinely photo-less artist doesn't cause a render on every request (it shouldn't — no `photoUrl` means not degraded).

### From the phase-7 review (2026-07-27)

One `dhh-code-reviewer` on Opus over the whole phase. It confirmed the risky parts sound — the `featured` round trip end to end (this is what un-deadens the profile Gallery section), the data URI genuinely rendering through librsvg, no SVG injection, and the photo fetch being unable to wedge the Lambda. Three must-fix and six should-fix, all acted on:

- **The reorder could not express a move between photos sharing an `order`.** Swapping two equal values writes each row the value it already had: two 200s, no toast, no movement, and no sequence of clicks recovers. Duplicates are easy to reach — `addArtistPhoto` defaults `order` to 0. `computePhotoReorder` now renumbers by position and returns only rows that changed, which also heals duplicates already in production. The test that asserted the broken output was itself the bug's alibi; it now asserts the move.
- **A partially-failed reorder diverged the UI from the table.** Two independent POSTs, and the catch rolled *local* state back while the server kept half the write. Now one request carrying the whole move, and the reply always returns the stored list — on the error arm too — so the client syncs to truth instead of a guess.
- **One transient photo-fetch timeout poisoned the cache for a year.** The text-only fallback was written to a key hashed over the unchanged `photoUrl`, and the HEAD then served it forever without retrying. A degraded card is now served but not persisted.
- **The truncation ladder let real names under the photo.** It counted characters; SVG text is measured in pixels. "Bombay Jayashri Ramnath" overflowed 6px, synthetic worst cases by up to 371px, and because the photo paints after the text the title was sliced mid-glyph by the photograph. Replaced with one width estimate driving both font size and truncation, plus a `clipPath` as the hard guarantee since Lambda resolves fonts against Amazon Linux and we cannot measure that here. Verified by rendering through Sharp and measuring the rightmost title pixel: worst case now ends at 719 against a panel starting at 760.
- **The raw `fetch` read a session-expiry redirect as success** — `requireModerator` throws a `redirect`, `fetch` follows it, the login page returns 200 HTML, `res.ok` is true. Dissolved by moving to `useFetcher`.
- **`CARD_VERSION` now feeds the cache hash.** The hash covered the content but not the template, so a redesign would leave every existing card frozen for a year with no remedy but emptying the S3 prefix by hand. The hash also gained a field separator, so a rename shifting a character across the title/subtitle boundary no longer collides.
- Smaller: clearing a caption now `remove`s the attribute instead of storing `''` (so "absent" and "present but blank" stop disagreeing); `readOptionalInt` uses `Number` + `isInteger` rather than `parseInt`, which read `'12.7'` as 12; Remove is held during an in-flight move; the dead `content-length` pre-check, the redundant `preserveAspectRatio`, and the "not an error" comment sitting above a `console.error` are gone. `packages/og-image` split into `card.ts` / `request.ts` / `handler.ts`, so a unit test no longer constructs an S3 client and a tRPC client to call `escapeXml`.

**Deliberately deferred, with reasons:**
- **An atomic reorder via a DynamoDB transaction.** The rows share a partition so it is the natural shape, but nothing in core uses ElectroDB transactions yet. Renumbering made a partial failure self-healing rather than permanent, and the reply now reports truth, so the remaining exposure is a brief wrong order — not corruption. Revisit if it bites.
- **Carrying the hash in the OG URL.** Every request now pays one tRPC query before it can HEAD, including cache hits, which is real cost on a crawler-heavy path. The page emitting `og:image` already has the artist loaded, so `/og/artist/{id}/{hash}` would let the Lambda HEAD immediately. Bigger than the rest; the comment in `handler.ts` states the cost honestly rather than claiming it is free.
- **Streaming the photo fetch with a byte counter.** It buffers the whole body before checking size, and `artist.photoUrl` is an unrestricted `z.string().url()`, so it is a mild SSRF surface. Low risk — moderator-only field, 2.5s cap, sharp's own pixel limit — but pinning to the CDN host would close it.
- **A fetcher per gallery row.** One shared update fetcher means an in-flight toggle disables every Feature and Save button in the grid.

### Phase 6, and what it still owes the first deploy (2026-07-26)

Phase 6 is complete and DHH-reviewed (two agents: backend + frontend) with every finding fixed. Profile redesign, gallery subroute, §6.2 denormalization (repertoire + featured), the daily `ArtistDenormRebuildCron` (both sweeps), and anon-only CDN caching all landed. Before/after deploy: (1) **Run the backfills once post-deploy** so the profile isn't empty until the first cron fires — `pnpm prod-cli rebuild-repertoire` and `pnpm prod-cli rebuild-featured`. (2) **Verify the caching segments on auth:** the profile `_index` loader sends `public, s-maxage=120, stale-while-revalidate=600` to anonymous viewers and `private, no-cache` to signed-in ones (subroutes are public and cache unconditionally). Full CDN offload is safe only if the CloudFront **server cache key includes the `rasika_session` cookie** — confirm SST's default does, or add it, else a logged-in viewer can briefly get a cached anon page (cosmetic only: no sensitive data, gated routes enforce auth themselves). (3) None of this is **verified against a running deploy** (`sst` can't run here) — render the profile, confirm the cron bundles, and check the cache behaviour on the first deploy. A full DHH review of phases 1–5 ran earlier (2026-07-25) and is also fixed — see "From the full phases 1–5 review" below.

### From the phase-6 review (2026-07-26)

Two `dhh-code-reviewer` agents (backend + frontend). Both found the risky parts sound — the CDN caching is correct (RR7 header bubbling traced in the installed dist; no auth leak), the repertoire denormalization is clean, JSON-LD/dates/empty-states/links all verified. Two should-fix clusters, both fixed:

- **Featured only ever *grew* correctly.** Every path that should *remove* a featured entry — event soft-delete, un-crediting an artist, merge — left a dangling teaser link, and `rebuild-featured` had no deleted-event filter so it reinstated stale data. Fixed by giving featured the same scheduled, deleted-event-excluding sweep repertoire has: `Artist.rebuildAllFeatured` rebuilds from the live `isFeatured` junction rows, so all three self-heal (un-credit removes the row, merge rewrites it, delete is filtered). The daily cron now runs both sweeps (renamed `ArtistDenormRebuildCron`).
- **The profile route was a layout *and* the index.** Split into `artists.$artistid._index.tsx` (profile body) + a thin `<Outlet/>` layout — no wasted parent-loader work on subroute SSR, no brittle pathname sniffing.

Nits fixed: stable tie-breaks in the repertoire/featured sorts; CLI sweeps delegate to core (no cross-package reach-ins); loader-typed artist (dropped the casts, added `mergedIntoId`/`deletedAt` to the browser type); `capitalize` dedup; gallery meta group-noun; lazy gallery images; public cache headers on the subroutes. Also null-guarded the events/compositions subroute loaders (pre-existing baseline errors).

### Phase 6 progress (2026-07-25)

Done and committed:
- **Foundations:** `formatEventDate` in `web/app/lib/utils.ts` pins the zone to `Asia/Kolkata` (fixes the runtime-TZ off-by-one), tested under `TZ=UTC`; `structured-data.tsx` gained `MusicGroupStructuredData` and an extended `PersonStructuredData` (image/sameAs/award/memberOf).
- **`artists.$artistid.tsx` redesigned** — hero (photo or initial placeholder, honorific, instrument·city, website + socials), About high, Awards, Gurus & lineage (linked, chronological), Compositions teaser, Repertoire, Notable performances (featured), Events, Gallery teaser, Members/Groups (group-aware), Frequent collaborators, Explore. One empty-state rule, one date formatter, names as stored, JSON-LD switches by `isGroup`. Loader parallelizes `getUser`.
- **New `artists.$artistid.gallery.tsx`** — SSR photo grid via `listPhotos`, paginated, canonical + breadcrumb + empty state; teaser "View all" wired.
- **`/events` subroute** now uses `formatEventDate` (was the runtime-TZ bug); `/compositions` needed no change (renders no dates, already uses shared cards).
- **§6.2 read-efficiency denormalization — done.** Repertoire (`topCompositions`/`topRagas`) and featured performances (`featuredPerformances`) are denormalized onto the Artist row; the loader reads them as fields, so it makes **zero** extra queries for either (down from getRepertoire's ~51-query fan-out and getFeaturedEventsByArtist's full-partition scan). `getRepertoire`/`listFeaturedPerformances`/`getFeaturedEventsByArtist` deleted as dead. Repertoire is refreshed by the `rebuild-repertoire` sweep (scheduled, not inline — see the trigger note in the commit); featured is maintained inline by `setEventArtistFeatured` and backfilled by `rebuild-featured`.

Not visually verified yet (typecheck/lint/tests pass).

**Phase 6 kickoff — read the plan first: `docs/plans/260722-01-artist-profile-redesign.md` §6 (page structure), §6.1 (index subroutes), §7 (JSON-LD).**

The main file to rework is `packages/web/app/routes/artists.$artistid.tsx` (the public profile). Everything phase 6 renders already has data and a procedure behind it — reuse them, do not add new backend:

- **Hero** — `artist.photoUrl` (initial-based placeholder if absent), `artist.name` (rendered as stored, no `fromItrans` — see 0c), instrument + city line, honorific/title, `socialLinks`, `website`. OG image already exists (`packages/og-image`, `artistOgImageUrl`).
- **About** — `biography`, `specialisations`, `activeYears`, `birthYear`/`birthPlace` (the main crawlable block; place high).
- **Awards** — `artist.listAwards` (already loaded in the edit route the same way).
- **Gurus / lineage** — `artist.gurus` now carries `fromYear`/`toYear`/`discipline`; render chronologically, each linked. `displayName ?? name` is NOT a thing — names render as stored.
- **Compositions** — `composition.byComposer` (already used on the profile).
- **Events** — `event.byArtist` (already used); featured-past selection via `artist.listFeaturedPerformances`.
- **Gallery teaser** — `artist.listPhotos` (top `featured`, ordered); hidden entirely when no photos.
- **Members / Groups** — group record (`isGroup`): `artist.listMembers`; individual: `artist.listGroups`. Both render single-hop off the junction's denormalized names.
- **Frequent collaborators** — `artist.collaborators` (denormalized on the record; `Collaborator[]` on the browser-safe `@rasika/core/domain/artist/client`). Re-sort in the browser by `strength` — it is stored but decays with wall-clock time (see the phase-4 deferral).
- **Every section hides cleanly when empty** — no bare headers.

**JSON-LD (§7):** `~/components/structured-data.tsx` has a minimal `PersonStructuredData` (name/url only) and NO `MusicGroup` type. Phase 6 adds `MusicGroup` (with `member[]` for groups), extends `Person` (`image` from photoUrl, `sameAs` from socialLinks+website, `award`, `memberOf` from `listGroups`), switching by `isGroup`.

**Index subroutes (§6.1):** `/artists/:id/events` and `/artists/:id/compositions` already exist — restyle only. `/artists/:id/gallery` is new (`artist.listPhotos`, SSR, canonical, breadcrumb, paginated).

**Heed the whole-phase-5 review's lesson:** phase 6 touches many sections at once. Keep one consistent empty-state rule, one date-formatting rule (pin `timeZone: 'Asia/Kolkata'` — the profile currently formats dates in the runtime TZ, which is UTC on the SSR Lambda; the prefill review found this bites), and one link/name-rendering convention across all sections rather than letting each drift.

**Read-efficiency follow-up (plan §6.2, from the pre-phase-6 DDB review):** the rendering reuses existing procedures, but two read paths are wasteful and must be fixed before the profile ships to production, not before building it — `getRepertoire` is a 51-query per-view fan-out, and `getFeaturedEventsByArtist` filters after a full-partition read. Fix both by denormalizing `topCompositions`/`topRagas` and the short featured list onto the Artist row at write time (the `collaborators` pattern), then swap the loader to single-field reads. Add careful CDN caching (anon-only — the page varies on auth). The S3 search-blob pattern is the wrong granularity for a per-artist page; see §6.2 for why.

### Phase status

| Phase | What | Status |
|---|---|---|
| 0a | Artist write auth: tighten `create`/`update` to editor, `delete` to moderator + soft delete | done |
| 0b | Shared dedup helper; `mergeArtist` gaps (`ArtistAward`, `gurus[]`); artist-rename name-copy cascade | done |
| 0c | Drop `fromItrans` from artist read paths | done |
| 1 | Artist attributes, `EventArtist.isFeatured`, `Image` 'artist', admin CSV columns | done |
| 2 | `ArtistMembership` junction | done |
| 3 | `ArtistPhoto` gallery entity | done |
| 4 | Collaborator engine + `rebuild-collaborators` backfill sweep | done |
| 5 | Create/edit wizard (moderator-only, direct write) | done |
| 6 | Presentation redesign + JSON-LD + gallery subroute + §6.2 denorm | done (reviewed 2026-07-26) |
| 7 | Photo enrichment incl. OG compositing in `packages/og-image` | done (reviewed 2026-07-27) |
| 8 | Claims + verification queue, incl. moderator-invited claims (§4.3.1) | done (reviewed 2026-07-28) |
| 9 | Polish: events split, instrument/city on cards, rank input | done |
| — | Whole-feature review (phases 0–9), 15 findings, all fixed | done (2026-07-29) |

### From the full phases 1–5 review (pre-phase-6, 2026-07-25)

One `dhh-code-reviewer` per phase (phase 2 had never had a machine review). All actionable findings fixed across four commits (core, tRPC, web, cleanup). The two sharpest were verified by hand against the code, then fixed:

- **Two silent data-drift bugs from recovering an id by stripping a lowercased key** — the exact sibling of the key-casing bug the phase-3 sweep couldn't catch, invisible to tests because before and after gave the same wrong answer. (1) `cascade.batchGetCompositions` keyed its map by the lowercased pk, so raga/tala rename and merge never matched the mixed-case `compositionId` and skipped the composition `ragas[]`/`talas[]` refresh. (2) `concert-log.listPastRsvpedWithoutLogs` compared a lowercased sk-stripped id against mixed-case `pastEventIds`, so every logged event reappeared as unlogged. Both now read the id attribute; both guarded with mixed-case tests.
- **`createPerformance` featuring ran outside the approval try/catch** — a featuring failure reported the whole call as failed, so a retry created a *second* approved public event. Now tolerated; returns the true `isFeatured`.
- **`cascadeArtistNameUpdate` skipped `ArtistMembership.groupName`/`memberName`** (the merge path handled them); **photo merge** now upserts-before-deletes so a mid-merge crash can't lose a photo; **`rebuildArtistCollaborators` returns the computed list** so the merge fixup no longer under-repairs from an eventually-consistent re-read; **`canonicalRole` dropped `dance → bharatanatyam`** (it mislabelled every other dance form) and gained `tanpura`/`nadaswaram`/`thavil`.
- Smaller: `addAward` and `addMember` give a friendly CONFLICT + verify the artist exists; `addMember` rejects a merged-away tombstone; the wizard Form swallows a bare Enter (was: publish + jump out mid-flow); the editor draft carries the guru `id` so a rename keeps years/discipline; `api.upload.image` uses `Object.hasOwn`; `searchLive` skips sub-2-char scans; `ArtistPhoto` order cap enforced at the entity; a shared `existingKeySet` guards all six merge existence-checks against unprocessed BatchGet keys.
- **Deleted dead/broken tooling:** `scripts/fixGsiKeys.ts` (+ `fix:gsi-keys` CLI) scanned uppercase keys against lowercase rows so it repaired nothing while reporting "healthy"; `core/shared/singleTable.ts` was unimported uppercase-key dead code.

**Deliberately not changed (defensible as-is, not fixes):**
- `listMembers`/`listGroups` stay `publicProcedure` over `pages:'all'` — the public profile must read them and the partitions are tiny (a duo has two members). Bounding the core query would break the merge cascade, which needs all rows.
- `searchLive` does **not** short-circuit the fuzzy scan on an exact hit — a typeahead should still offer alternatives; the sub-2-char guard is the real cost cut.
- `ArtistPhoto` has no per-photo moderation status field — "moderation" in §4.7 is the moderator-gated writes (all photo mutations are `moderatorProcedure`), which exist. No status workflow was specced.
- The pre-existing phase-4 design deferrals below (strength decay, inline-cap dimension, nothing schedules `rebuild-collaborators`, hard-delete leaves junctions) are unchanged — they predate this review and are design calls, not review findings. The one phase-4 deferral this review *did* close: `rebuildArtistCollaborators` no longer returns void.

### Phase 5 slices (it is large, so it is built in vertical slices)

| Slice | What | Status |
|---|---|---|
| wave 1 | Live artist/award search endpoints; `/artists/new` flat form; `EventArtist.isFeatured` setter + procedures | done |
| shell | `/artists/:id/edit` role branch: moderator wizard (Identity, About, Review) writing Artist directly; editor keeps draft form. Reviewed. | done |
| relationships | Guru timeline + group-membership section. Reviewed. | done |
| recognition | Awards + notable-performances + gallery sections. Reviewed. | done |
| prefill | 'Add a performance' path: event.createPerformance creates+approves a single event tagging the artist. Reviewed. | done |

Phase 5 also had a **whole-phase review** after all slices landed — it caught three cross-slice defects (auth policy applied to one mutation not nine; a dead award-search slice; a Review screen that promised a clearing preserve-on-blank never performs) and several consistency items, all fixed. See "From the whole-phase 5 review" below.

Each modal writes to one sub-collection through procedures already built: gurus → `artist.update`, membership → `artist.addMember`/`removeMember`, awards → `artist.addAward`/`removeAward`, performances → `artist.setFeaturedPerformance`, gallery → `artist.addPhoto`/`updatePhoto`/`deletePhoto`. `SearchSelect` (with `createNew`) is the picker; the live endpoints back it.

### What phase 0 landed

- **0a** — `artist.create`/`update` now require editor, `delete` requires moderator and soft-deletes. Previously any logged-in user could hard-delete an artist.
- **0c** — artist and composer names no longer pass through `fromItrans`. Raga names, tala names, composition titles and lyrics still do; the split is per field.
- **0b** — `packages/core/src/domain/artist/dedup.ts` holds the shared find-or-create, now backing the event router's `resolveArtist`. `cascadeArtistMerge` migrates `ArtistAward` rows and rewrites `gurus[]` on other artists. New `cascadeArtistNameUpdate` refreshes `EventArtist.artistName` and `ArtistAward.artistName` on rename.
- **1** — new Artist fields (`instrument`, `city`, `practiceStartYear`, `debutYear`, `photoUrl`, `photoUploadId`, `isGroup`, plus entity-only `claimStatus`/`verifiedAt`), widened `gurus`, `EventArtist.isFeatured`/`featureRank`, `Image` `'artist'` end to end, and the admin CSV columns.

### Resolved: the uppercase-key bug (fixed in code and repaired in prod)

ElectroDB lowercases key values, so the table holds `event#abc` / `#metadata`. Around thirty raw commands hand-wrote `EVENT#abc` / `#METADATA`, addressing rows that do not exist. Both failure modes were silent — `DeleteItem` succeeds having deleted nothing, `UpdateItem` *creates* the row instead of updating the real one. Three GSI key writes were wrong the same way, which is quieter still: the row updates but drops out of that index, so after a merge compositions vanished from `byComposer` and events from their venue and organiser listings.

**Code:** `packages/core/src/db/keys.ts` now holds `keyOfEntity`/`keysOfEntity`, which ask the entity via `conversions.fromComposite.toKeys`. Raw commands remain only where ElectroDB cannot express the operation (atomic counters, nested attribute updates) but no longer build their own keys. Entity mocks in tests take real `conversions`, so key assertions exercise the real derivation rather than agreeing with the test's own literals.

**Production, repaired 2026-07-22:** 30,198 items scanned, 15 phantom rows found. Nine attributes repaired from source rather than by replaying stale phantom values — eight `venueName`s (seven events were displaying a street address instead of "Sri Siddi Ganapathi Temple") and one `rsvpCount` recounted from the actual RSVP rows. All 15 phantoms deleted; a re-scan reports zero. `pnpm cli repair-uppercase-keys` re-runs the scan, dry by default.

Five `EDIT#` phantoms were deleted without repair: those edits are already approved and their real rows still carry `proposedValues`, so the lost write was a superseded update.

### From the whole-phase 5 review

Acted on: the auth policy (all nine wizard mutations now moderatorProcedure, not one), the dead award-search slice (deleted; resolveOrCreate now case-insensitive), the Review-screen dishonesty (blanked preserve-on-blank fields show "(unchanged)"), the anonymous full-scan search endpoint (moderator-gated), the PerformancesEditor dedup guard, and the misleading guru copy.

Still open — one focused follow-up, its own review:

- **The five `/api/artist/*` resource routes are copy-paste** — method-check, `requireModerator`, the `((formData.get(x) as string) || '').trim()` idiom, and a try/catch/`console.error`/`data({error},{status})` block, repeated ~7 sites including `artists.new.tsx` and the edit action. The repetition has already diverged: `api.artist.resolve` returns 500 while the others return 400, and four pass raw `error.message` to the client (fine for TRPCError text, a mild leak on an unexpected fault). A `withModerator(handler)` + `field(formData, name)` helper would collapse them to their logic and single-source the error contract. This is the review's "third cross-cutting pass"; it is a real refactor and should be reviewed on its own.
- The review's named pattern: invariants that live *between* slices (one auth policy, one error contract, one empty-field rule, one verified consumer per endpoint) were owned by no slice, so they drifted. Worth remembering for phase 6, which is even more cross-cutting.

### Deferred from the phase 5 recognition slice

(The recognition and prefill DHH reviews have both been run; findings applied. These are the leftover UI-polish items only.)

- ~~**Per-performance featureRank input was dropped**~~ — closed in phase 9: a per-row box that appears once a row is featured, committing on blur. Building it surfaced that the setter had never cleared a rank; see the phase 9 notes.
- **Awards use a plain name input, not a picker.** `award.resolveOrCreate` now matches case-insensitively, so it is safe find-or-create; a typeahead would only aid discovery. (Note: the `award.searchLive` endpoint and `/api/search/award-live` route were deleted in the whole-phase review as dead code — a future picker would re-add them.)
- ~~Gallery reorder is a future item~~ — closed in phase 7: move-up/move-down buttons (not drag, see §5.4e's note), renumbering by position in one request, and new photos append past the highest `order` rather than by count.

### Deferred from the phase 5 relationships review

- **specialisations and gurus clear oppositely.** gurus (a managed row list) publishes `[]` when emptied and clears; specialisations (a free-text field) preserves on blank. Left as-is — the controls are visibly different, so "row list clears, text preserves" is a defensible model — but it is an asymmetry a moderator could trip on.
- **Unchecking group on an artist with members orphans the edges.** `updateArtist` writes `isGroup: false` but does not cascade the membership rows; they survive hidden but are still rewritten on merge. This is the deliberately-accepted isGroup trade-off (flip is allowed, stranding is rare and repairable); the wizard now warns rather than fixing it.
- **Browser-only, low priority:** a guru name typed into the picker but neither selected nor "created" leaves the row nameless and is silently dropped on publish; and removing a guru row while its resolve fetcher is in flight can land the resolved id on the re-indexed row (key={i}). Both narrow; confirm/handle in the browser pass.

### Deferred from the phase 5 shell review

- **The venue and organiser edit wizards share the hidden-step validity bug** the artist wizard just fixed: a `required`/`min`/`max`/`type=url` field on a `display:none` step blocks submission with a non-focusable control and no visible error. `venues.$venueid_.edit.tsx` and `organisers.$organiserid_.edit.tsx` want the same step-advance validity gate. Out of scope for the artist slice; worth a small dedicated pass.
- ~~**The moderator wizard cannot clear a field**~~ — closed 2026-07-30, after a moderator hit it on `website`. Blanking a field now clears it: every field renders pre-filled, so emptying one is deliberate. The intent travels as `clearFields`, a named list, because a value cannot carry it — `website` is validated with `.url()` so `''` fails the schema, and writing `''` elsewhere leaves the row claiming the field exists and is blank. `updateArtist` filters the list against `CLEARABLE_ARTIST_FIELDS` (it arrives from a request, and `clearFields: ['name']` would otherwise strip what every read path depends on) and skips anything the same call is setting. The Review screen said "(unchanged)" for a blanked field; it now says what it will clear.
- `EditorArtistForm` destructures `user` and never uses it — a verbatim carry-over from the original, not introduced here.

### Deferred from the phase 4 code review

Raised, judged real, not yet done:

- **`strength` is stored but decays with wall-clock time.** It is a pure function of `sharedEventCount` and `lastSharedAt`, both stored, so the persisted value and the persisted sort order are stale the moment they are written — and the profile re-sorts in the browser anyway, making it both stored and recomputed. Kept for now only because a naive consumer doing `.slice(0, 12)` without sorting gets roughly-right results from a stored order. Dropping it would shrink the item too, which the 400KB note cares about. Decide deliberately rather than by inertia.
- **The inline cap guards the wrong dimension.** `COLLABORATOR_INLINE_CAP` counts cast size, but the cost is the sum of the cast's *lifetime event counts* — each rebuild walks that artist's whole history, sequentially. Twelve busy accompanists with 300 events each is ~3,600 queries and passes the cap; a 40-artist festival of newcomers is cheap and gets rejected. The guard belongs on event history.
- **Nothing schedules `rebuild-collaborators`.** There is no infra entry, so a skipped festival or a swallowed failure stays stale until someone runs the CLI by hand. `collaboratorsComputedAt` is stored precisely so a sweep could find stale artists by timestamp — but something has to run it.
- **Hard `deleteEvent` leaves junction rows and never recomputes.** Filtered correctly by accident (a missing row is absent from the batch-get result), but no rebuild is triggered.
- ~~`rebuildArtistCollaborators` returns `void`, so `rebuildCollaboratorsAfterMerge` re-reads the artist it just computed.~~ — closed in the phases 1–5 review: it now returns `Collaborator[]` and the merge fixup uses it directly, which also fixes the eventually-consistent stale-read that could under-repair.

### Deferred from the phase 2 self-review

The DHH reviewer failed twice (a stalled stream, then the monthly spend limit), so phase 2 was reviewed by hand against the same questions. Verified sound: the self-membership guards in both merge sweeps are symmetric; the `addMember` `z.union` genuinely rejects both-fields and neither-field payloads, confirmed by parsing rather than reading; `pages: 'all'` on the two membership queries is fine at group sizes.

Fixed on review: `addMember` rejected a non-group target, and a duplicate member now returns `CONFLICT` instead of surfacing an ElectroDB write failure as a 500.

Still open:

- ~~`softDeleteArtist` leaves membership rows behind~~ — closed in phase 3 via `cascadeArtistDeleteToMemberships`. But the phase 3 review made a fair objection that is still open: `softDeleteArtist` is now the only `softDelete*` in the repo that destroys anything, and it is also the `deleteEntity` handler in `edit/registry.ts`, so approving a delete proposal hard-drops membership edges too. The cleaner shape is a `deletedAt` on `ArtistMembership` filtered inside `getGroupMembers`, which already sorts in memory and so pays nothing extra.
- **Phase 2 never got a machine review.** Worth re-running the reviewer over `5ee3234f0..HEAD` when budget allows, since the parts I checked were the parts I already suspected.

### Deferred from the phase 1 code review

- `'venue' | 'organiser' | 'artist'` is written in four places (`image/s3.ts`, `ImageUpload.tsx`, and twice in `api.upload.image.tsx`). A fifth entity means finding all four. Wants a browser-safe `ImageEntityType` in its own subpath — it cannot come from `s3.ts`, which pulls in the AWS SDK.
- `bool()` and `flags()` in `columns.ts` now carry the same truthy/falsy ladder; one `parseFlagCell` would collapse them.
- `json()` has no explicit-clear escape hatch, so `gurus` can never be emptied from CSV — unlike `flags()`, which advertises exactly that. The two conventions now sit in the same column list.
- `bool()` exports `''` for both `false` and unset, so an export can't distinguish "not a group" from "nobody has said".
- `createEventArtistJunctions` (`event/index.ts`) is the third `EventArtistEntity.upsert` and was deliberately not given the `isFeatured` carry-forward, because `updateApprovedEvent` only passes artists not already linked. Nothing records that reasoning, and a refactor that stops filtering would wipe the flag with no test to catch it.

### Carried into later phases

- ~~`isGroup` gating~~ — settled in phase 2: `artist.update` rejects an `isGroup` change from a non-moderator. The admin CSV import bypasses that check by calling `Artist.updateArtist` directly, which is fine since `adminData.import` is `adminProcedure`.
- `claimStatus` and `verifiedAt` exist on the entity but nothing writes them until phase 8.
- `EventArtist.isFeatured`/`featureRank` exist but have no setter yet; the performances modal in phase 5 owns that.

Every wizard picker added later must route through `findOrCreateArtist` rather than calling `createArtist` — that is the guard against multiplying duplicate artists. See 11.2 in the plan. When resolving a batch, fetch `listAllArtistsForMatching()` once and pass it as `candidates`; otherwise each new name sweeps the artist list again.

### Deferred from the phase 0 code review

Raised, judged real, not yet done:

- `cascadeArtistMerge`'s `ArtistAward` block is a copy of its `EventArtist` block with the nouns swapped, verbatim comment included. Both want one `migrateJunctionRows` helper, and `cascadeVenueMerge` probably does too.
- Neither block checks BatchGet `unprocessed`. If keys come back unprocessed the existence check under-reports and the upsert overwrites a canonical `ArtistAward`'s `rank`/`year`/`category`. Pre-existing, inherited by the copy.
- `dedup.ts` imports from `'.'` while `index.ts` re-exports it — a cycle, and the reason the test has to mock the barrel that exports the thing under test.
- `initialsMatch` is exported and tested but no longer called internally; `tokenMatches` absorbed its job.
- Transliteration forks (`Raghunathan`/`Ragunathan`, `Subrahmanyan`/`Subrahmanyam`) are currently rejected as a deliberate false negative. Folding `aa→a`, `ee/ii→i`, `oo/uu→u` and post-stop `h` inside `normalizeArtistName` would catch them without weakening the surname rule. Do not reach for Soundex or Metaphone — they are tuned for English orthography and collide `Krishna` with `Krishnan`.

### Known baselines (so regressions are visible)

Re-measured 2026-07-30 at the end of the bio-structuring work. All failures below are pre-existing, none caused by this work — a clean run matches these, and any increase is a regression to investigate. **The previously recorded core and web test counts were stale** (758 and 111); the numbers here were measured, and the pre-work figures were verified by running the same suites in a worktree at HEAD.

- `packages/core`: **882 tests pass, 3 fail** (`updateArtist`/`updateRaga`/`updateTala` "should throw error when update fails" — all three assert a capitalised message the code emits lowercase; confirmed failing identically at HEAD); **2 files with typecheck errors** (`edit/service.ts`, `event/index.ts:46` — a `festivalId` null). Was 795 pass before this work; +87 for the affiliation junction, the widened artist schema, the completion labels, the extraction pipeline, the two review passes, and the extractor↔record contract tests.
- `packages/web`: **151 tests pass, 12 files** (was 137). +14 for `readRepeatedRows` and `affiliationPeriod`. Typecheck errors sit in **8 files**, unchanged by this work and none in artist, organiser or gallery files: `api.server.ts`, `lib/auth.server.ts`, `$artform.events.tsx`, four `carnatic.*` routes, `events.new_.api.tsx`, `moderator.request-deletion.tsx`. It was 11 until `sst-env.d.ts` was committed with the current resource declarations — the three `Resource.*` errors were stale generated types, not real.
- `packages/scripts`: **17 typecheck errors, all pre-existing**, in `check-id.ts` (6), `recompute-performance-counts.ts` (3), `enrichRagas.ts` (3), `cli.ts` (2 — `Resource.RasikaTable`/`SearchIndexBucket`, environmental like the web ones), `bulkUpload.ts` (2), `backfillWebp.ts` (1). **This package was never typechecked until 2026-07-30**: it had no `typecheck` script, and its tsconfig paired `module: NodeNext` with `moduleResolution: Bundler`, which are mutually exclusive, so `tsc` refused to start. That gap let a call to a non-existent `Edit` namespace reach a commit — the edit service is exported flat from core, not as a namespace. Both are fixed; run `pnpm typecheck` here now.
- Note that importing `@rasika/core`'s main entry from a script fails in this environment on an `@openauthjs/openauth` `./subject` subpath — pre-existing, reproduced with the untouched `rebuildRepertoire.ts`, so scripts cannot be smoke-tested locally regardless.
- `packages/og-image`: **25 tests pass**, **0 own typecheck errors** (its `pnpm typecheck` surfaces the same 7 core errors through the `@rasika/trpc` type import — filter with `grep -v 'core/src'`).
- `packages/trpc`: **0 errors under `src/routers/`** (its `npx tsc --noEmit -p .` reports the same 7 core errors, which are not its own).
- Pre-existing lint, do not treat as new: `event.ts` non-null assertion (~line 424), `ImageUpload.tsx` a11y `useKeyWithClickEvents`, and `noArrayIndexKey` warnings (warn-severity per the web override) throughout the wizard.
- Commit messages with inner double-quotes break `git commit -m` shell quoting — commit prose via `git commit -F <file>`.
