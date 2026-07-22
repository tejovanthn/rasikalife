---
name: electrodb-key-casing-bug
description: ElectroDB lowercases every pk/sk value, so the hand-built UPPERCASE DynamoDB Keys throughout cascade.ts match nothing and their deletes silently no-op
metadata:
  type: project
---

ElectroDB lowercases key values by default. `ArtistEntity.get({id:'a1'}).params()` yields `{pk:'artist#a1', sk:'#metadata'}` — not `ARTIST#a1`. No `casing` option is set anywhere in `packages/core/src`, so this holds for every entity.

`packages/core/src/domain/cascade.ts` builds raw `DeleteCommand` / `UpdateCommand` / `BatchGetCommand` keys by hand with UPPERCASE prefixes (`ARTIST#`, `GROUP#`, `EVENT#`, `COMPOSITION#`, `#METADATA`). DynamoDB compares key values byte-wise, so those commands address keys that do not exist, and a delete of a missing key succeeds silently. ~28 sites as of 2026-07-22. The same hand-built-key habit appears in `concert-log/index.ts`, `composition/index.ts`, `rsvp/index.ts` and `packages/scripts/src/recompute-performance-counts.ts`.

**Why:** found 2026-07-22 during the phase 3 artist-photo review. `cascadeArtistDeleteToMemberships` is entirely dead because a raw delete is its only DB operation, and the photo migration copies rather than moves. The unit tests mock the entity and assert the UPPERCASE keys, so they cement the bug instead of catching it — mocking the entity is exactly what hides this class of defect.

**How to apply:** Flag any new DynamoDB `Key` literal built from a template string. The fix is to route through the entity — `ArtistMembershipEntity.delete({groupId, memberId}).go()`; `removeArtistMembership` in `artist-membership/index.ts` already does it right. Verify ElectroDB behaviour by calling `.params()` on the real entity inside a throwaway vitest file (defaults run before setters, `readOnly` is enforced on update only, `create` carries `attribute_not_exists`), then delete the file promptly — see [[project-auto-checkpoint-commits]].

Related: [[project-rasika-shape]], [[feedback-review-gate]].
