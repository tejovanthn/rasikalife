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

Related: [[project-rasika-shape]], [[feedback-review-gate]].
