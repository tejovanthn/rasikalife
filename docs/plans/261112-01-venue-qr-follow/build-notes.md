# Build notes

## Ground rules for agents

1. The three tabs (Spec, Copy, Build notes) are the source of truth. If two of them disagree, stop and ask; do not pick one.
2. Do not invent entities, fields, routes, procedures, copy or behaviour. If something you need is missing, add `TODO(spec): <question>` in code and list it in the PR description.
3. Build in the phase order from the Spec's Build sequence. One PR per phase. Each PR passes `pnpm check`, `pnpm typecheck` and the tests of every package it touches.
4. Open questions in the Spec are not yours to resolve. Where a default is written (digest Sunday 18:00 IST), use it.
5. Do not refactor unrelated code and do not move existing admin routes; that comes after this feature.
6. No em dashes in any user-facing string, email template or UI text.

## Repo conventions to follow

From the repo's `CLAUDE.md`; repeated here because agents skip it.

- **Domains** live in `packages/core/src/domain/<name>/`, written in order: `entity.ts` (ElectroDB) → `schema.ts` (Zod) → `client.ts` (browser-safe types) → `index.ts`. Tests in `index.test.ts` beside them, using the mock DynamoDB and the global deterministic ID and date setup
- **New domains**: `venue-qr`, `qr-batch`, `follow`, `venue-space`, `partner-member`, `partner-invite`, `push-subscription`, `notification`. ElectroDB service `rasikalife`, model version `1`
- **Subpath exports**: add each new domain to `packages/core/package.json` `exports`, including its `/client` path
- **Web route imports**: never import the bare `@rasika/core` entry in route modules of `web`, `admin` or `sabha`. Use subpath or `/client` imports. Only `*.server.ts` files may import the bare entry
- **IDs**: KSUID with a domain prefix, as the rest of core does. QR codes are the exception: they use the 8-char code as their ID
- **Errors**: `[DOMAIN]_[ERROR_TYPE]` codes (list below)
- **Routers**: one file per router in `packages/trpc/src/routers/`, registered in `routers/index.ts`. Use `protectedProcedure` for signed-in calls; add `moderatorProcedure` if it doesn't exist and `partnerProcedure` as specified
- **tRPC tests** run under `sst shell vitest run`
- **Biome**: 2 spaces, single quotes, semicolons, width 100, `import type` for types, no `forEach`, no non-null assertions
- **Counters**: follower counts use atomic `ADD` inside the same `TransactWrite` as the `Follow` put or delete, like `rsvpCount`
- **Cascades**: merge handling goes in `packages/core/src/domain/cascade.ts`

## Existing code to reuse

Call these; do not reimplement them.

| Need | Use |
| --- | --- |
| Events at a venue by time | `listEventsByVenue` (gsi4, sorted by `startDateTime`); filter `status === 'approved'` and no `deletedAt` |
| Approved events in a window (jobs) | `byStatus` index (gsi2) via `listApprovedEvents` params, or a new range helper in `event` if none fits |
| Artists of an event | `getEventArtists(eventId)` |
| RSVPs of an event | `Rsvp` primary index, pk `RSVP#${eventId}` |
| Event display title | `isGenericTitle` in `packages/web/app/lib/generic-title.ts` |
| Concert book | `upsertConcertLog(userId, eventId)` |
| Poster upload for Add a concert | existing poster upload flow and `extractAndCreateDrafts` |
| Event creation and submit | `createEvent`, `submitEvent`; `approveEvent` for verified owners |
| Audit log | `createChangeHistory` + `computeDiff`; extend `entityType` with `organiser`, `venue`, `venueQr` |
| Venue, organiser updates | `updateVenue`, `updateOrganiser` |
| Merges | `mergeVenue`, `mergeOrganiser`, `mergeArtist` in `cascade.ts` |
| Sign-in | `findOrCreateUser`; hook partner invite acceptance after it |
| Image upload pattern (for PDF and export presigned URLs) | `Image.getImageUploadUrl` shows the presign pattern |

## Constants

One file: `packages/core/src/domain/venue-qr/constants.ts` (re-export what the notification job needs).

```typescript
export const QR_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32, no I L O U
export const QR_CODE_LENGTH = 8;
export const QR_BASE_URL = 'https://rasika.life/q/';
export const QR_BATCH_MAX = 200;
export const QR_BULK_ASSIGN_MAX = 50;
export const QR_FORMATS = ['sticker', 'table-tent', 'poster'] as const;

export const LIVE_WINDOW_BEFORE_MIN = 90;
export const LIVE_WINDOW_AFTER_MIN = 30;
export const DEFAULT_EVENT_DURATION_MIN = 180;
export const VENUE_MODE_UPCOMING_LIMIT = 3;
export const SCAN_RATE_LIMIT_PER_MIN = 60;

export const QR_INTENT_COOKIE = 'qr_intent';
export const QR_INTENT_TTL_SEC = 15 * 60;

export const DIGEST_WINDOW_DAYS = 14;
export const DIGEST_MAX_EVENTS = 15;
export const REMINDER_MAX_PER_DAY = 3; // RSVPed events sit outside this cap
export const REASON_WEIGHTS = { rsvp: 10, artist: 3, organiser: 2, venue: 1 } as const;

export const CONSENT_VERSIONS = { share: 'share-v1', whatsapp: 'whatsapp-v1' } as const;
export const PRESIGNED_URL_TTL_SEC = 300;
export const PARTNER_INVITE_TTL_DAYS = 14;
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
```

Use `Intl` / `date-fns-tz` with the event's `timezone` for all day boundaries; never the Lambda's local time.

## Zod schemas and error codes

**tRPC inputs** (put shared ones in each domain's `schema.ts`)

```typescript
const QrCode = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{8}$/);
const FollowTargetType = z.enum(['venue', 'organiser', 'artist']);
const ShareTargetType = z.enum(['venue', 'organiser']);
const Label = z.string().trim().min(1).max(60);
const Note = z.string().trim().max(200).optional();

// qr
resolve:     z.object({ code: QrCode })
createBatch: z.object({ count: z.number().int().min(1).max(200), format: z.enum(QR_FORMATS), note: Note })
assign:      z.object({ code: QrCode, venueId: z.string(), spaceId: z.string().optional(), label: Label, note: Note })
bulkAssign:  z.object({ codes: z.array(QrCode).min(1).max(50), venueId: z.string(), spaceId: z.string().optional(), labelPrefix: Label })
             // labels become `${labelPrefix} 1`, `${labelPrefix} 2` in the order given
updateLabel: z.object({ code: QrCode, label: Label })
reassign:    z.object({ code: QrCode, venueId: z.string(), spaceId: z.string().optional(), label: Label })
retire:      z.object({ code: QrCode })
list:        z.object({ status: z.enum(['unassigned', 'active', 'retired']).optional(), batchId: z.string().optional(),
                        venueId: z.string().optional(), cursor: z.string().optional(), limit: z.number().int().max(100).default(50) })

// follow
bulkSet:  z.object({ qrCode: QrCode.optional(), eventId: z.string().optional(),
                     targets: z.array(z.object({ type: FollowTargetType, id: z.string(), follow: z.boolean(),
                                                 share: z.boolean().optional() })).min(1).max(20) })
          // share is only valid for venue and organiser; reject it on artist
toggle:   z.object({ type: FollowTargetType, id: z.string() })
status:   z.object({ targets: z.array(z.object({ type: FollowTargetType, id: z.string() })).max(50) })
setShare: z.object({ type: ShareTargetType, id: z.string(), share: z.boolean() })

// notify
setPrefs:        z.object({ notifyDigest: z.boolean().optional(), notifyReminder: z.boolean().optional(),
                            notifyEmail: z.boolean().optional(), notifyPush: z.boolean().optional() })
subscribePush:   z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) })
unsubscribePush: z.object({ endpoint: z.string().url() })
setWhatsapp:     z.object({ number: z.string().regex(/^[6-9]\d{9}$/), consent: z.literal(true) })
removeWhatsapp, dismissWhatsappPrompt: no input

// space (moderator, or partner owner of the venue)
list:   z.object({ venueId: z.string() })
create: z.object({ venueId: z.string(), name: Label, capacity: z.number().int().positive().optional(), notes: Note })
update: z.object({ venueId: z.string(), spaceId: z.string(), name: Label.optional(),
                   capacity: z.number().int().positive().optional(), notes: Note })

// partner
invite:          z.object({ targetType: ShareTargetType, targetId: z.string(), email: z.string().email(),
                            role: z.enum(['owner', 'viewer']) })
revoke:          z.object({ targetType: ShareTargetType, targetId: z.string(), userId: z.string() })
updateProfile:   z.object({ targetType: ShareTargetType, targetId: z.string(), input: UpdateOrganiserSchema | UpdateVenueSchema })
exportFollowers: z.object({ targetType: ShareTargetType, targetId: z.string() })
```

Procedures above that the Spec's router table does not list (`notify.setWhatsapp`, `notify.removeWhatsapp`, `notify.dismissWhatsappPrompt`, `space.*`, `partner.updateProfile`) are part of the spec. No `space.delete` in v1.

**`PartnerInvite` entity** (needed for the invite flow)

- pk `PARTNER_INVITE#${emailLowercase}`, sk `${targetType}#${targetId}`
- `role`, `invitedBy`, `createdAt`, `expiresAt`, `acceptedAt?`
- After `findOrCreateUser`, look up invites for the user's email; accept unexpired ones into `PartnerMember`, set `verifiedAt` on the target when the role is `owner` and it is not set yet

**`Follow` consent fields**: `shareWithTarget`, `shareConsentAt?`, `shareConsentVersion?` (from `CONSENT_VERSIONS.share`). **`User`**: `whatsappConsentVersion?` beside the WhatsApp fields.

**Error codes**

| Code | When |
| --- | --- |
| `QR_NOT_FOUND` | Unknown code |
| `QR_NOT_UNASSIGNED` | Assign called on an active or retired code |
| `QR_RETIRED` | Any change to a retired code |
| `QR_BATCH_LIMIT` | Count over 200 |
| `QR_CODE_COLLISION` | Internal; retry minting, never shown to users |
| `VENUE_NOT_FOUND`, `SPACE_NOT_FOUND` | Bad venue or space id |
| `FOLLOW_TARGET_NOT_FOUND` | Target missing or soft-deleted (after following any merge) |
| `FOLLOW_SHARE_NOT_ALLOWED` | `share` sent for an artist |
| `PARTNER_FORBIDDEN` | No membership, or viewer attempting an owner action |
| `PARTNER_INVITE_EXPIRED` | Invite past `expiresAt` |
| `PARTNER_INVITE_EMAIL_MISMATCH` | Signed-in email differs from invite |
| `WHATSAPP_INVALID_NUMBER` | Fails the regex |
| `PUSH_SUBSCRIPTION_INVALID` | Bad endpoint or keys |

## Infrastructure, secrets, schedules

**New apps**

- `packages/admin` and `packages/sabha`: React Router v7, same setup as `packages/web` (fs-routes, tRPC client, auth)
- SST site resources in `infra/` with domains `admin.rasika.life` and `sabha.rasika.life`, linked to the table and the tRPC API
- Auth: session cookie domain `.rasika.life`; add both subdomains to the auth issuer's allowed redirect URIs

**Secrets** (`sst secret set`)

| Secret | Use |
| --- | --- |
| `VapidPublicKey`, `VapidPrivateKey` | Web push |
| `QrIntentSecret` | Signs the `qr_intent` cookie |
| `UnsubscribeSecret` | Signs unsubscribe tokens |

**Storage**

- Private bucket, prefixes `qr-batches/{batchId}.pdf` and `exports/{targetType}/{targetId}/{timestamp}.csv`. Use the existing private bucket if one is linked; otherwise add one. Never the public CDN bucket
- Lifecycle rule: delete `exports/` objects after 7 days

**Email (SES)**

- Verify the `rasika.life` domain with DKIM; request production access before the pilot (sandbox only sends to verified addresses)
- Configuration set with SNS topics for bounce and complaint; a handler sets `notifyEmail = false` on hard bounce or complaint
- Headers on every bulk email: `List-Unsubscribe` (mailto and https) and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`

**Schedules** (SST Cron, UTC expressions)

| Job | IST | Expression |
| --- | --- | --- |
| Weekly digest | Sunday 18:00 | `cron(30 12 ? * SUN *)` |
| Day-before reminder | Daily 18:00 | `cron(30 12 * * ? *)` |
| Scan rollup | none, written inline on scan |  |

**PDF rendering**

- SST Queue + Lambda; libraries `qrcode` (SVG) and `pdf-lib`; bundle Noto Sans Kannada and the Latin UI font as assets
- Batch item gets `pdfStatus` (`pending` / `ready` / `failed`) and `pdfKey`

**Rate limit on `/q/*`**

- WAF rate-based rule on the web distribution: 300 requests per 5 minutes per IP (WAF's minimum window, equal to 60 per minute)

**Web push**

- `packages/web` has no service worker today; add a minimal one that handles only `push` and `notificationclick`. Do not add offline caching

## Acceptance criteria per phase

**1. Data layer**

- [ ] All new entities with the keys in the Spec; `followerCount` on Venue, Organiser, Artist
- [ ] Following twice never double counts (conditional put); unfollow decrements once
- [ ] Merging a venue, organiser or artist moves follows to the canonical one, deduped, counts correct
- [ ] Account deletion removes follows, push subscriptions, memberships and decrements counts

**2. Follow everywhere**

- [ ] Follow button on venue, organiser and artist pages; signed-out tap goes through Google and completes
- [ ] `/me/following` lists, unfollows with Undo, toggles sharing with the confirm copy

**3. Scan page**

- [ ] Each state in Scan resolution renders with its Copy strings, verified with fixtures for 0, 1 and 2+ live events, later-today and venue mode
- [ ] Live window uses the event's timezone, works for concerts that cross midnight
- [ ] Signed-out flow keeps selections through Google sign-in via `qr_intent`
- [ ] Share checkbox appears per venue or organiser toggled on, never pre-ticked, stores consent version
- [ ] `scanCount`, `followCount` and `QrScanDay` update on scan and follow
- [ ] In-app browser screen shows for WhatsApp and Instagram user agents

**4. Admin**

- [ ] Batch of 200 mints unique codes and renders a PDF in under 60 seconds
- [ ] PDF prints at the Spec's sizes; QR scans from 1 m (sticker) on a mid-range Android phone
- [ ] Moderator scanning an unassigned code lands on the assign form; non-moderator sees "isn't active yet"
- [ ] Assign, bulk assign, relabel, reassign, retire all write `ChangeHistory`

**5. Email**

- [ ] Digest and reminder pick the right events per user, apply the cap and RSVP rule, skip concert-book events
- [ ] Digest not sent when empty; one-click unsubscribe works from Gmail
- [ ] Bounce and complaint turn off email for that user

**6. Pilot**: not code. Codes printed, assigned at 2 to 3 sabhas, metrics from the Spec's pilot table reviewable

**7. Web push**

- [ ] Subscribe from confirmation and `/me/notifications`; reminder arrives as push when subscribed, email otherwise
- [ ] `410 Gone` deletes the subscription

**8. Sabha dashboard**

- [ ] Invite email, acceptance on sign-in, expiry and email mismatch handled with Copy strings
- [ ] First owner acceptance sets `verifiedAt`; badge shows on public pages
- [ ] Owners edit profile (audited), add events (auto-approved), manage spaces; viewers are read-only
- [ ] Export contains only opted-in followers, exact CSV header, Verified column, audit row written

## Out of scope: do not build

- Sending WhatsApp messages or verifying WhatsApp numbers (collect and store only)
- Phone OTP sign-in or accountless subscribers
- Importing paper registers
- QR assignment by sabhas
- Follower export for artists
- Deleting spaces
- Season pinning of codes
- Moving existing admin routes into `admin.rasika.life`
- Offline caching or PWA install prompts for the web app
- Any paid tier, billing or usage limits
