# Rasika Classes: Build Plan (MVP)

Spec ID: `260802-01-rasika-classes`
Status: phase 1 of 9 built (2026-08-02). Phases 2–9 unstarted.

A class-tracking product for Carnatic gurus, served at `classes.rasika.life`.

## 1. What this is

Gurus take upfront payment for a pack of N classes. Students draw the pack down as classes
happen. When the balance runs low, the student pays again and sends a screenshot. Today this
lives in WhatsApp threads and the guru's memory.

This replaces that with a shared ledger.

**Primary goal:** ship fast for one guru (the founder's wife's teacher).
**Secondary goal:** return-user retention. This is the first thing on Rasika someone opens weekly.
**Deferred goal:** feed the composition knowledge graph. Schema supports it from day one, UI does not.

### Explicitly out of scope for MVP

- Composition picker on sessions (field exists, no UI)
- Payment amounts, currency, invoicing, any finance reporting
- Reminders and notifications
- Publishing a workshop to the public Rasika events site
- Multiple institutions per teacher in the UI

## 2. Non-negotiables

These are decisions already made. Do not relitigate them during implementation.

1. **Never move money.** No UPI collect, no payment gateway, no payment intent. A screenshot
   upload plus the guru tapping "received" is the entire payment surface. Anything more puts the
   project in financial compliance territory.
2. **Payment screenshots must not use the public image pipeline.** `Image.getImageUploadUrl`
   writes to `EVENT_POSTERS_BUCKET` behind a public CDN. A new private variant is required. See
   section 8.
3. **Do not change the user role enum.** Students sign in with Google and remain `editor`, the
   existing default. Authorisation for every class route derives from enrollment membership, not
   role. Adding a `student` role would leak into the wiki permission model.
4. **Do not reuse the `Event` entity for workshops.** Events are public, moderated and
   wiki-editable. Class programs are private to a roster. Overloading `Event` drags private data
   into the moderation queue.
5. **Never mutate `creditsRemaining` directly.** It is a denormalized sum of immutable `classPack`
   rows. All adjustments are new rows with a signed delta.
6. **All class routes are `noindex` and excluded from the sitemap generator's route filter**, not
   just meta-tagged.

## 3. Deployment shape

**Rasika Classes** is a separate React Router v7 app in `packages/classes`, deployed to
`classes.rasika.life` as its own SST component. It is an installable PWA with its own manifest,
icon set and app identity. Logo and brand assets are supplied by the founder during the build.

### 3.1 Monorepo layout

| Package | Role |
|---|---|
| `packages/classes` | New. React Router v7 app, PWA, own SST site component. |
| `packages/ui` | New. Shared primitives and design tokens. |
| `packages/core` | Existing. New `class-*` domains added here, not in `packages/classes`. |
| `packages/trpc` | Existing. New `classes` router added here. |
| `packages/web` | Existing. Untouched by this project. |

Domain logic lives in `packages/core` as it does for every other entity. `packages/classes`
contains routes, components and PWA config only.

### 3.2 packages/ui

**Do not treat extracting `packages/web`'s components as a prerequisite.** That is a big-bang
refactor touching every wiki route and it will stall phase 1.

Instead:

- Create `packages/ui` and seed it with **only** what Classes needs: button, input, select, card,
  table, dialog, badge, toast, and the layout shell.
- Export a shared Tailwind preset and design tokens (colours, spacing, type scale, radii) from
  `packages/ui`. This is where visual consistency actually comes from, not from component reuse.
- Both apps consume the preset. `packages/web` keeps its existing components for now and migrates
  opportunistically, never as a blocking task.
- Tailwind `content` globs in both apps must include `../ui/src/**/*.{ts,tsx}` or shared component
  classes get purged.
- `packages/ui` is browser-only. It must never import from `@rasika/core` outside `/client`
  subpaths.

### 3.3 tRPC

Mount a tRPC handler route **inside** `packages/classes`, importing the same router from
`packages/trpc`.

Do not have the Classes app call `rasika.life/api/trpc`. That is cross-origin, which pulls in a
CORS allowlist, `credentials: 'include'` on the client, and a preflight on every mutation.
Same-origin inside the app avoids all of it.

### 3.4 Auth

Session is shared via the root-domain cookie, already verified as `Domain=.rasika.life`. No second
auth system.

| Item | Status |
|---|---|
| Session cookie set with explicit `Domain=.rasika.life`, not host-only | Verified |
| `classes.rasika.life` added to Google OAuth redirect allowlist | To do |
| Same origin added to OpenAuth issuer config | To do |
| Sign-in redirect returns to the classes origin, not the main site | To do |

**PWA auth gotcha, worth testing early.** On iOS, an OAuth redirect from a standalone-mode PWA can
open in the in-app browser and land the session cookie outside the installed app's storage,
leaving the user signed out on return. Test the full sign-in flow from an installed icon on iOS
before phase 6, not after. If it breaks, the fallback is to complete auth in the browser and
deep-link back.

### 3.5 PWA

- `manifest.webmanifest`: name "Rasika Classes", short name "Classes", `display: standalone`,
  portrait orientation, theme and background colours from the shared tokens.
- Icon set including maskable icons, plus `apple-touch-icon` and iOS splash screens, which the
  manifest does not cover.
- Service worker via `vite-plugin-pwa`. Scope is app shell and static assets only.
- **No offline writes in MVP.** Caching a "mark attended" action for later sync conflicts directly
  with the conditional-transition and credit-decrement model in section 5.6. Show a clear offline
  state instead. Revisit only if students actually report signal problems in class.
- Custom install prompt on the student home screen, since that is the whole retention thesis.
  Dismissible, and do not re-prompt.

### 3.6 SEO

Not indexed, but still needs explicit handling:

- `noindex` on every route.
- `robots.txt` on the classes origin disallowing everything.
- The subdomain must not be added to any sitemap, and the existing sitemap generator in
  `packages/web` needs no change since it never sees these routes.
- No canonical links pointing back to the main domain.

## 4. Data model

Eight new entities (the first draft of this plan said seven and listed eight), all following the
existing single-table pattern with KSUID IDs and domain prefixes. Each gets its own directory
under `packages/core/src/domain/`, built in the order given in `CLAUDE.md`: `entity.ts` then
`schema.ts` then `client.ts` then `index.ts`.

The table has 6 GSIs. ElectroDB allows each entity to map its own key prefixes onto the same
physical slots, so these entities reuse `gsi1` through `gsi3` with new prefixes. No new GSIs are
provisioned.

> **Built keys differ from this section in three places.** See 4.9 for what changed and why.

### 4.1 classInstitution

The owner of programs. A solo guru is auto-provisioned an institution on first use and is never
shown the word "institution" anywhere in the UI.

| Index | GSI | Key |
|---|---|---|
| `primary` | - | pk: `CLASS_INSTITUTION#${id}`, sk: `#METADATA` |
| `byOwner` | gsi1 | gsi1pk: `CLASS_INSTITUTION_OWNER#${ownerUserId}`, gsi1sk: `CLASS_INSTITUTION#${id}` |

| Attribute | Type | Req | Notes |
|---|---|---|---|
| `id` | string | yes | KSUID |
| `name` | string | yes | Defaults to the guru's display name |
| `ownerUserId` | string | yes | Creating user |
| `teacherIds` | list\<string\> | yes | Users who may teach. Seeded with the owner. |
| `timezone` | string | yes | **Added in build.** The guru's zone; source of every `sessionDate` |
| `createdAt` / `updatedAt` | string | yes | auto |

**Why institution rather than guru:** the credit ledger must survive a substitute teacher. Credits
belong to the institution, and `teacherId` records who actually taught a given session.

### 4.2 classProgram

A guru's offering. A regular weekly 1:1 class is a program with no title and one enrollment. A
workshop is a program with a title and many enrollments. There is no structural difference beyond
that.

| Index | GSI | Key |
|---|---|---|
| `primary` | - | pk: `CLASS_INSTITUTION#${institutionId}`, sk: `PROGRAM#${createdAt}#${id}` |
| `byId` | gsi1 | gsi1pk: `CLASS_PROGRAM#${id}`, gsi1sk: `#METADATA` |

| Attribute | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | string | yes | - | KSUID |
| `institutionId` | string | yes | - | |
| `type` | string | yes | `regular` | `regular` \| `workshop` |
| `title` | string | no | - | Absent on regular programs. UI renders "Weekly class". |
| `agenda` | string (max 2000) | no | - | Workshop focus, e.g. a specific composition |
| `isGroup` | boolean | yes | false | |
| `defaultMode` | string | yes | `in-person` | `online` \| `in-person` |
| `defaultTeacherId` | string | no | - | Overridable per session |
| `nominalCount` | number | no | - | The "supposed to be 10". Reference only, never a constraint. |
| `defaultPackSize` | number | no | - | Applies to future packs only |
| `skipPolicy` | string | yes | `burn` | `burn` \| `no-burn`. See section 5.3. |
| `publicEventId` | string | no | - | Reserved. Unused in MVP. |
| `archivedAt` | string | no | - | Soft archive |
| `createdAt` / `updatedAt` | string | yes | auto | |

### 4.3 classLearner

The person being taught. Deliberately not a user account. See section 7 for why.

| Index | GSI | Key |
|---|---|---|
| `primary` | - | pk: `CLASS_INSTITUTION#${institutionId}`, sk: `LEARNER#${id}` |
| `byId` | gsi1 | gsi1pk: `CLASS_LEARNER#${id}`, gsi1sk: `#METADATA` |

| Attribute | Type | Req | Notes |
|---|---|---|---|
| `id` | string | yes | KSUID |
| `institutionId` | string | yes | |
| `firstName` | string (max 80) | yes | |
| `lastInitial` | string (max 4) | no | Not a full surname |
| `isMinor` | boolean | yes | Guru-set policy flag, not a verified fact. No DOB is ever collected. |
| `createdAt` / `updatedAt` | string | yes | auto |

Do not add DOB, photo, address, phone or a free-text notes field to this entity.

### 4.4 classLearnerAccess

Which Google accounts may view a learner. A learner may have several: a guardian, and later the
learner themselves.

| Index | GSI | Key |
|---|---|---|
| `primary` | - | pk: `CLASS_LEARNER#${learnerId}`, sk: `USER#${userId}` |
| `byUser` | gsi1 | gsi1pk: `CLASS_USER_LEARNERS#${userId}`, gsi1sk: `CLASS_LEARNER#${learnerId}` |

| Attribute | Type | Req | Notes |
|---|---|---|---|
| `learnerId` | string | yes | |
| `userId` | string | yes | |
| `relation` | string | yes | `self` \| `guardian` |
| `createdAt` | string | yes | auto |

One Google login resolves to every learner it can see via `byUser`. A parent with two children
gets two rows and a profile switcher. An adult student gets one `self` row and never sees a
switcher.

### 4.5 classEnrollment

Links a learner to a program and carries the balance.

| Index | GSI | Key |
|---|---|---|
| `primary` | - | pk: `CLASS_PROGRAM#${programId}`, sk: `LEARNER#${learnerId}` |
| `byLearner` | gsi1 | gsi1pk: `CLASS_LEARNER_ENROLLMENTS#${learnerId}`, gsi1sk: `CLASS_PROGRAM#${programId}` |

| Attribute | Type | Req | Default | Notes |
|---|---|---|---|---|
| `programId` | string | yes | - | |
| `learnerId` | string | yes | - | |
| `institutionId` | string | yes | - | Denormalized for authorisation checks |
| `learnerName` | string | yes | - | Denormalized |
| `programTitle` | string | no | - | Denormalized |
| `programType` | string | yes | - | Denormalized |
| `creditsRemaining` | number | yes | 0 | Atomic `ADD`. May go negative. |
| `status` | string | yes | `active` | `active` \| `ended` |
| `createdAt` / `updatedAt` | string | yes | auto | |

The primary index gives the guru a full program roster in one query. The GSI gives a learner all
their enrollments in one query.

A learner enrolled in both a regular class and a workshop with the same guru has **two independent
balances**. That is correct and matches how gurus already think. The student home screen shows two
cards, never a merged number.

### 4.6 classPack

Credit grants and adjustments. Immutable, append-only. `creditsRemaining` is the running sum.

| Index | GSI | Key |
|---|---|---|
| `primary` | - | pk: `CLASS_ENROLLMENT#${programId}#${learnerId}`, sk: `PACK#${createdAt}#${id}` |

| Attribute | Type | Req | Notes |
|---|---|---|---|
| `id` | string | yes | KSUID |
| `programId` / `learnerId` | string | yes | |
| `delta` | number | yes | Signed. `+8` for a pack, `+1` for a goodwill class, `-2` for a correction. |
| `reason` | string (max 500) | no | Required by the schema for any negative delta |
| `screenshotKey` | string | no | Private S3 key, never a public URL |
| `amount` / `currency` | number / string | no | Reserved. Not collected in MVP. |
| `grantedBy` | string | yes | User ID |
| `createdAt` | string | yes | auto |

**Two operations that look alike and are not:**

- Changing the guru's standard pack size edits `defaultPackSize` on the program. Future packs
  only. Nothing retroactive.
- Correcting a balance writes a new pack row with a delta and a reason. Never an edit to an
  existing row, never a direct write to the counter.

This is the same reasoning as the existing `change_history` entity: when money is involved the
audit trail is the product. "Why do I have 7 credits" must always be answerable.

### 4.7 classSession

One row per learner per class. Group classes fan out to one row each.

| Index | GSI | Key |
|---|---|---|
| `primary` | - | pk: `CLASS_ENROLLMENT#${programId}#${learnerId}`, sk: `SESSION#${sessionDate}#${id}` |
| `byInstitutionStatus` | gsi1 | gsi1pk: `CLASS_SESSION#${institutionId}#${status}`, gsi1sk: `${sessionDate}#${id}` |
| `byGroup` | gsi2 | gsi2pk: `CLASS_GROUP_SESSION#${groupSessionId}`, gsi2sk: `LEARNER#${learnerId}` |
| `byDue` | gsi3 | gsi3pk: `CLASS_SESSION_DUE#${status}`, gsi3sk: `${autoConfirmAt}#${id}` |

| Attribute | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | string | yes | - | KSUID |
| `programId` / `learnerId` / `institutionId` | string | yes | - | |
| `sessionDate` | string | yes | - | `YYYY-MM-DD` in the **guru's** local timezone. Ledger key. |
| `startsAt` | string | no | - | Full ISO instant, for rendering |
| `timezone` | string | yes | `Asia/Kolkata` | The guru's zone, matching the `event` entity pattern |
| `status` | string | yes | `pending` | `pending` \| `confirmed` \| `disputed` \| `absent` |
| `mode` | string | yes | - | `online` \| `in-person`. Defaults from program, set per session. |
| `teacherId` | string | no | - | Who actually taught |
| `groupSessionId` | string | yes | own id | Shared across a fan-out. Required — see 4.9. |
| `notes` | string (max 2000) | no | - | Required when a person confirms. Optional when the student marks. |
| `compositionIds` | list\<string\> | no | [] | Reserved. No UI in MVP. |
| `programTitle` / `programType` | string | - | - | Denormalized so a session list renders in one query |
| `markedBy` | string | no | - | User who created it |
| `confirmedBy` | string | no | - | User or `system` for cron |
| `autoConfirmAt` | string | yes | - | `sessionDate` + 7 days. Required — see 4.9. |
| `createdAt` / `updatedAt` | string | yes | auto | |

**On timezone.** Storing only UTC does not fix the cross-timezone off-by-one, it relocates it to a
third zone that is wrong for both parties. An 8am IST class for a US student is 02:30 UTC the same
day, while the student experienced it the previous evening. The fix is to store both: `sessionDate`
in the guru's local zone as the ledger key, because the guru is the one who decides a class
happened, and `startsAt` as the instant, rendered in each viewer's own zone. Student sees "Mon
8:30pm your time", guru sees "Tue 7am", one row, sort key never shifts.

### 4.8 classInvite

| Index | GSI | Key |
|---|---|---|
| `primary` | - | pk: `CLASS_INVITE#${normalizedEmail}`, sk: `INVITE#${id}` |

| Attribute | Type | Req | Notes |
|---|---|---|---|
| `id` | string | yes | KSUID |
| `normalizedEmail` | string | yes | See normalisation rules below |
| `rawEmail` | string | yes | As typed, for display |
| `institutionId` | string | yes | |
| `programId` | string | no | Present for enrollment invites |
| `learnerId` | string | no | Present when adding access to an **existing** learner |
| `learnerName` | string | no | Present when the invite should create a new learner |
| `relation` | string | yes | `self` \| `guardian` |
| `invitedBy` | string | yes | |
| `claimedAt` / `claimedByUserId` | string | no | |
| `createdAt` | string | yes | auto |

### 4.9 Where the build departs from this section

Three changes, made during phase 1 and carried in the code:

1. **`classSession.byPending` became `byInstitutionStatus`, and a third index `byDue` was
   added.** The planned key (`CLASS_PENDING#${institutionId}`) is dense over every session ever
   taught, because `institutionId` and `sessionDate` are both always present — ElectroDB writes a
   GSI key for every row whose composites resolve. The review queue would therefore read thousands
   of confirmed rows to find three pending ones. Putting `status` in the partition key makes the
   query exact. That alone leaves the auto-confirm cron unable to sweep across institutions, since
   nothing maintains a list of them, so `byDue` keys on status alone with the deadline as its sort
   key. Both indexes read only rows they are about to act on.
2. **`groupSessionId` and `autoConfirmAt` became required.** `CLAUDE.md` rule 9: an index over an
   optional attribute is not sparse — a missing composite writes the template with an empty suffix,
   producing one hot partition that a blank lookup then matches in full. `markClassSession` defaults
   `groupSessionId` to the row's own id, which makes a solo class a group of one and, incidentally,
   removes the special case from the review queue's grouping.
3. **`classInstitution` gained a `timezone`.** A session's `sessionDate` must be computed in the
   guru's zone *before* the session row exists, so the zone cannot only live on the session.

## 5. Behaviour

### 5.1 Session lifecycle

```
                  guru confirms (notes required)
                  or cron after autoConfirmAt
  pending ─────────────────────────────────────> confirmed  [terminal]
     │
     ├── guru marks absent ──────────────────────> absent    [terminal]
     │
     └── guru disputes ──────────────────────────> disputed  [resolved by manual edit]
```

- `confirmed` always decrements one credit.
- `absent` decrements one credit only when the program's `skipPolicy` is `burn`.
- `disputed` decrements nothing until resolved.

The student marks a class attended, which creates a `pending` session. The guru confirms. This is
the answer to "who is the source of truth": the student initiates, the guru has final say, and
neither is blocked by the other.

### 5.2 Auto-confirm

A pending session older than `autoConfirmAt` is confirmed by an SST cron, with
`confirmedBy: 'system'`. Same infrastructure shape as the existing search index refresh cron.

This exists so the ledger never freezes when the guru forgets. Consequence for UI design: the
guru's queue is a **review** queue, not an approval queue. Her default action is to do nothing. She
opens it to catch mistakes. So sort newest first, make dispute as prominent as confirm, and show
the auto-confirm date on every row so she knows what she is letting through.

### 5.3 Group sessions

Fan out on write. The guru marks one group session and the domain layer creates one `classSession`
per active enrollment on that program, sharing a `groupSessionId`. Reads stay in one partition per
learner, a student's history looks identical whether the class was group or solo, and credits
decrement per learner with no branching.

Fan-out is not a transaction: it moves no credits, DynamoDB caps a transaction at 100 items, and a
workshop can run to 200 people.

If a learner in a group skips, the guru marks that one row `absent` and `skipPolicy` decides
whether the credit burns. Default is `burn`, since that is the prevailing assumption and it is the
option that does not create arguments about money later.

Group rosters are **never shown to students**. A count only. Workshops can run to 200 people, and
some learners are children.

### 5.4 Overrun

`creditsRemaining` is allowed to go negative. Do not block marking, do not add a "completed" state,
do not force a new pack. Workshops nominally sold as 10 classes routinely run to 13, and blocking
at zero would make the guru abandon the tool.

Display negative balances as "3 classes over" and surface them as a soft flag on the guru's roster.

### 5.5 Archive

Setting `archivedAt` on a program hides it from the guru's roster by default. It stays fully
visible in every enrolled learner's history, including all session notes. The notes are the durable
value of the product and must never disappear behind an archive toggle.

### 5.6 Concurrency

Confirm must be idempotent, because the cron and the guru's tap can race on the same row.

- Guard the credit decrement on a **conditional status transition from `pending`**, not on the
  button press.
- Each confirm is a two-item transaction: the session status update and the atomic `ADD` on the
  enrollment counter.
- Bulk confirm is a loop of these transactions, not a single `BatchWrite`. Cap the selection at 50
  and return per-row results so one failure does not silently drop the rest.

## 6. Authorisation

A single helper in the classes router, used by every procedure:

```ts
assertClassAccess(ctx, { institutionId?, programId?, learnerId? })
```

Resolution order:

1. **Teacher access:** `ctx.user.id` is in the institution's `teacherIds`. Grants read and write
   across the institution. (`isInstitutionTeacher`, already built.)
2. **Learner access:** a `classLearnerAccess` row exists for `ctx.user.id` and the target learner.
   Grants read of that learner's own enrollments, packs and sessions, plus the ability to create a
   `pending` session and edit its notes. (`hasLearnerAccess`, already built.)
3. Otherwise `FORBIDDEN`.

All mutations use the existing `protectedProcedure`. Authorisation is enforced in tRPC, never only
in the UI.

Learners can never see another learner's rows, including within a group program.

## 7. Learners, guardians and minors

A meaningful share of students are children with no email of their own, and one parent often
manages two or more children. This is why a learner is not a user account.

### Access rules

| Rule | Enforcement |
|---|---|
| Every learner has at least one access row | `checkRevokeLearnerAccess` → `lastAccess` |
| While `isMinor` is true, the last `guardian` row cannot be removed | → `lastGuardianOfMinor` |
| Only a teacher or an existing guardian may create access to a learner | `assertClassAccess` (phase 3) |
| A `self` row may not remove a `guardian` row | → `selfCannotRemoveGuardian` |

That last asymmetry matters. Without it a 15 year old can lock a parent out of an account the
parent is paying for, and the guru ends up refereeing.

### Young adults

A 16 year old with their own Gmail gets a **second** access row with `relation: self`. The guardian
keeps theirs. Both see the same learner, the same sessions, the same balance. Nothing is duplicated
or migrated.

The guardian initiates this through the same invite flow, with `learnerId` set on the invite so the
claim creates an access row against the existing learner rather than a new learner.

When the guru clears `isMinor`, the last-guardian block lifts and the young adult can stand alone.

### Data minimisation

- First name and optional last initial only. No date of birth, no photo.
- The guardian's email is the account. Do not collect a child's email even when one exists.
- Session notes are written by the guru or the guardian and are visible to both. Do not build a
  private child-only channel.

India's DPDP Act treats under-18 data as requiring verifiable parental consent. The structure above
satisfies the spirit of that by never giving a minor an independent account, but this is not legal
advice and the rules have been moving. Worth a proper check before onboarding gurus beyond the
founder's immediate circle.

## 8. Private image upload

Payment screenshots cannot go through `Image.getImageUploadUrl`, which writes to
`EVENT_POSTERS_BUCKET` fronted by a public CDN. Putting people's UPI transaction screenshots on a
public endpoint is not acceptable.

Add a private variant:

- New S3 bucket with all public access blocked and no CDN distribution.
- `Image.getPrivateUploadUrl(namespace, fileName, contentType)` returning a presigned PUT, key
  pattern `private/classes/{uploadId}/{fileName}`.
- Store only the **S3 key** on the pack row, never a URL.
- A tRPC procedure that runs `assertClassAccess` and then returns a short-lived presigned GET.
  Screenshots are fetched through that procedure only.

## 9. Invites

`classInvite` rows sit unclaimed until the invited email signs in.

**Email normalisation.** Lowercase everything. For `gmail.com` and `googlemail.com` specifically,
strip dots from the local part and everything after a `+`. Gurus type `Priya.Raman@gmail.com`,
students sign in as `priyaraman@gmail.com`. Dots stay significant everywhere else — stripping them
at another provider would match an invite to the wrong person, which is worse than an unclaimed
invite.

**Claim on every sign-in, not just first.** Hook into the existing `findOrCreateUser` path. Look up
invites by normalized email, and for each unclaimed one:

- If `learnerId` is set, create a `classLearnerAccess` row against that learner.
- If `learnerName` is set, create the learner, then the access row, then the enrollment.
- Mark the invite claimed. `markInviteClaimed` is conditional on `claimedAt` not existing, so two
  tabs signing in at once cannot both claim it and create two learners.

Existing users get invited to new programs later, so a first-sign-in-only check would silently drop
those.

## 10. Screens

### Student (`/`)

- One card per active enrollment: program name, credits remaining (or "N over"), a mark-attended
  button for today.
- Profile switcher, shown only when the signed-in user has access to more than one learner.
- Session history, newest first, showing date, mode, status and notes. Includes archived programs.
- Pack history with screenshot thumbnails where present.

### Guru roster (`/students`)

- Programs list, archived hidden behind a toggle.
- Per program: learner rows with credits remaining, low or negative balances flagged.
- Grant pack action, with optional screenshot upload.
- Add learner action, which sends an invite.
- Mark group session action on group programs.

### Guru review queue (`/review`)

- Flat table across all programs, **not** grouped by learner.
- Columns: date, learner, program, mode, auto-confirm date, actions.
- Group sessions collapse to a single row showing the learner count, expanding on tap. Otherwise a
  12-person workshop floods the queue with 12 identical rows. (`groupSessions` in
  `class-session/schema.ts`.)
- Header checkbox for select-all, one bulk confirm action, cap 50.
- Confirm requires notes. Dispute and mark-absent are single taps.

## 11. Build order

**Phase 1: core domain. — DONE (2026-08-02).** All eight entities in `packages/core` with Zod
schemas and collocated tests, plus `shared/timezone.ts`. 146 tests. Includes the pack-sum
invariant, conditional status transitions and the group fan-out. `class-session/keys.test.ts`
asserts real key shapes off `.params()` rather than off mocks.

**Phase 2: private upload.** New bucket in `/infra/`, `getPrivateUploadUrl`, signed-read procedure.

**Phase 3: tRPC router.** `packages/trpc/src/routers/classes.ts`, registered in `routers/index.ts`.
`assertClassAccess` on every procedure. Tests via `sst shell vitest run`.

**Phase 4: invites and sign-in claim.** Hook into `findOrCreateUser`. The entity, normalisation and
conditional claim already exist; the orchestration does not.

**Phase 5: app scaffold.** `packages/classes` React Router v7 app, `packages/ui` seeded with the
shared Tailwind preset and the primitives Classes needs, SST site component, `classes.rasika.life`
domain, tRPC handler route, OAuth allowlist, `noindex` and `robots.txt`. Ends with a deployed
signed-in blank page.

**Phase 6: student screens.**

**Phase 7: guru screens** including the review queue.

**Phase 8: PWA.** Manifest, icons, service worker, install prompt. **Test the iOS installed-app
sign-in flow here at the latest**, ideally as a spike during phase 5.

**Phase 9: auto-confirm cron.** `listSessionsDueForAutoConfirm` and `confirmClassSession` with
`confirmedBy: 'system'` already exist; the scheduled function does not.

Each phase ships independently. Do not start a phase before the previous one's tests pass. Do not
migrate `packages/web` components into `packages/ui` as part of any phase.

## 12. Conventions

Standard `CLAUDE.md` rules apply. Reiterating the ones most likely to be missed here:

- **Never import from bare `@rasika/core` in route files**, in `packages/classes` any more than in
  `packages/web`. React Router v7 bundles the top-level imports of every route module for the
  client, and the main entry pulls in ElectroDB and the AWS SDK. Every `class-*` domain already has
  a `client.ts` and a `@rasika/core/domain/class-*/client` subpath export. `*.server.ts` files are
  the only exception.
- `packages/ui` never imports from `@rasika/core` outside `/client` subpaths, and preferably not at
  all.
- `packages/classes` follows the same route conventions as `packages/web`: `@react-router/fs-routes`,
  loaders for reads, actions for writes.
- Biome: 2-space indent, single quotes, semicolons, 100 char lines, `import type` enforced, no
  `forEach`, no non-null assertions.
- Tests collocated as `*.test.ts`.
- `pnpm check` before committing.
- KSUID IDs with domain prefixes.

## 13. Deferred, with triggers

| Item | Trigger |
|---|---|
| Composition picker on sessions | **One** guru with three months of session history, not more gurus. More gurus gives more thin data; the same guru over time is what makes "you have not touched Nagumomu since April" a real sentence. |
| Payment amounts and finance views | Only if a guru asks. Never a gateway. |
| `publicEventId` bridge to the main events site | A guru wants a workshop filled publicly. This is the version where Classes stops being a side tool. |
| Multi-teacher UI | A second teacher exists. Schema already supports it. |
| Reminders and notifications | Retention data shows students forgetting to mark. |
