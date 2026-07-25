---
name: electrodb-key-casing-bug
description: ElectroDB lowercases every pk/sk value, so the hand-built UPPERCASE DynamoDB Keys throughout cascade.ts match nothing and their deletes silently no-op
metadata:
  type: project
---

ElectroDB lowercases key values by default. `ArtistEntity.get({id:'a1'}).params()` yields `{pk:'artist#a1', sk:'#metadata'}` — not `ARTIST#a1`. No `casing` option is set anywhere in `packages/core/src`, so this holds for every entity.

**REMEDIATED in `cascade.ts` (commit `e54baaca8`, ~2026-07-22): "derive DynamoDB keys from entities instead of hand-writing them".** As of 2026-07-25 every raw command in `cascade.ts` routes its key through `keyOf`/`keysOf` (24 call sites) — no UPPERCASE literals remain, and a re-check of `concert-log-item`, `composition`, `rsvp`, and `packages/scripts/src` found no hand-built `pk:`/`sk:` template keys either. Do NOT re-flag cascade.ts for this. The lesson below is retained because the *pattern* is easy to reintroduce.

Historical: `cascade.ts` once built raw `DeleteCommand` / `UpdateCommand` / `BatchGetCommand` keys by hand with UPPERCASE prefixes (`ARTIST#`, `GROUP#`, `EVENT#`, `COMPOSITION#`, `#METADATA`). DynamoDB compares key values byte-wise, so those commands addressed keys that do not exist, and a delete of a missing key succeeds silently. ~28 sites at 2026-07-22, now zero.

**Why:** found 2026-07-22 during the phase 3 artist-photo review. `cascadeArtistDeleteToMemberships` is entirely dead because a raw delete is its only DB operation, and the photo migration copies rather than moves. The unit tests mock the entity and assert the UPPERCASE keys, so they cement the bug instead of catching it — mocking the entity is exactly what hides this class of defect.

**How to apply:** Flag any *new* DynamoDB `Key` literal built from a template string (the phase-2 ArtistMembership merge blocks originally had this exact defect at commit `d2d0fa5e8`, since fixed). The fix is to route through the entity — `keyOf(Entity, {...})` for a raw command, or `Entity.delete({...}).go()`; `removeArtistMembership` in `artist-membership/index.ts` and the current `cascade.ts` both do it right. Verify ElectroDB behaviour by calling `.params()` on the real entity inside a throwaway vitest file (defaults run before setters, `readOnly` is enforced on update only, `create` carries `attribute_not_exists`), then delete the file promptly — see [[project-auto-checkpoint-commits]].

**Second-order variant the key-derivation fix does NOT catch (found 2026-07-25, phase-3 concern-B review, still live at commit `700458c09`):** once the raw Key is correctly lowercased, code that later *recovers an id by string-stripping that key* gets a lowercase id that never matches a mixed-case KSUID attribute. Two live sites: `cascade.ts` `batchGetCompositions` does `map.set((item.pk).replace('composition#',''), item)` and every caller looks it up with `compositions.get(item.compositionId)` → always `undefined`, so `cascadeRaga/TalaNameUpdate` and `cascadeRaga/TalaMerge` silently never rewrite the denormalized `ragas[]`/`talas[]` arrays; `concert-log/index.ts listPastRsvpedWithoutLogs` builds `loggedEventIds` from `item.sk.replace('concert_log#','')` (lowercase) and compares to `pastEventIds` from `item.id` (mixed) → reports every already-logged event as unlogged. **Rule: never reconstruct an id from a key — read the mixed-case attribute (`item.id`, `item.eventId`) off the returned row instead.** Grep smell: `.replace('<lowercase>#','')` or `.split('#')` on a `pk`/`sk`. Pre-existing landmine still unconverted (out of phase 3): `packages/scripts/src/fixGsiKeys.ts` (cli `fix:gsi-keys`) scans `begins_with(pk,'EVENT#')`/`sk='#METADATA'` uppercase → matches nothing, total no-op; `shared/singleTable.ts` builds uppercase keys but is now unimported/dead.

Related: [[project-rasika-shape]], [[feedback-review-gate]].
