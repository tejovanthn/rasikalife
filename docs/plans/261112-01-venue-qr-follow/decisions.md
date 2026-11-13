# Venue QR Follow: build decisions (2026-11-12)

Owner answers given before the build. They sit beside `spec.md`, `copy.md` and `build-notes.md`
and win where those tabs disagree.

## Process

- Each phase is built in its own git worktree and merged into local `main`. Nothing is pushed
  or deployed by the build. The owner deploys.
- Tests: core tests, plus tRPC **unit** tests (`*.unit.test.ts`, `pnpm test:unit`). The
  `sst shell` integration suite is not run, because the only reachable stage is prod and the
  suite writes.
- All eight phases are built (phase 6, the pilot, has no code).

## Email sender

- Add a second `sst.aws.Email` for the root domain `rasika.life`, with its own configuration set
  and SNS topics for bounce and complaint. Digest and reminder mail send as
  `rasika.life <concerts@rasika.life>`, reply-to `hello@rasika.life` (Copy tab).
- Do not send this mail from the transactional `mail.` identity in `infra/email.ts`.
- Known risk, to record in docs: the SES suppression list is per AWS account, so a complaint on a
  digest also suppresses that address for Classes invites and approval mail.

## Conflicts between the tabs, resolved

1. **Share consent**: one checkbox per venue or organiser the user toggled on, each naming that
   target (Copy and Build notes). The Spec journey's single organiser checkbox is superseded.
2. **Retired codes**: a scan of a retired code is still counted (`scanCount`, `QrScanDay.scans`,
   `lastScannedAt`), then redirects. (Edge cases section wins over Resolution order.)
3. **Unsubscribe token**: a random `unsubscribeToken` stored on `User`, rotated on use, carried in
   the link inside an HMAC signed with `UnsubscribeSecret` (the HMAC also binds the kind:
   digest, reminders or all).
4. **Moderator scans an unassigned code**: `/q/{code}` redirects to
   `admin.rasika.life/qr/{code}/assign`. No inline form on rasika.life.
5. **Venue QR panel**: shown to moderators on the public venue page `rasika.life/venues/:venueid`
   (not in the admin app). Columns and actions as in the Spec.

## Owner decisions after the code review (2026-11-12)

6. **Scan rate limit**: carrier-grade NAT (Jio, Airtel) puts a hall's phones behind one IP.
   `/q/*` is 300 per minute per IP (WAF: 1,500 per 5 minutes). `SCAN_RATE_LIMIT_PER_MIN = 300`.
   Add a per-user limit on `follow.bulkSet` of 30 per minute.
7. **List-Unsubscribe**: https only, with `List-Unsubscribe-Post` (RFC 8058). No `mailto`, since
   nothing processes it.
8. **`qr_intent` cookie**: bound to the sign-in attempt. A random nonce goes in the cookie and in
   the OAuth `state`; the callback applies the intent only when they match. The cookie is cleared
   at the end of every sign-in, applied or not.
9. **Admin user list**: `unsubscribeToken` never appears in any API response (only the
   unsubscribe flow reads it). WhatsApp numbers are masked in lists (`+91 ••••• •2345`); the full
   number shows only on the user detail page, to admins, and each view writes an audit row.
10. **Follower counts and the page cache**: follows do not purge `/*`. Purge only the followed
    entity's page paths, debounced to at most once per 30 minutes per target.

## Owner decisions on the open items (2026-11-12)

11. **Moderators and sabha data**: export and profile edit stay refused to moderators. Consent named
    the sabha. Moderators edit through the existing admin and Edit paths; a sabha that wants help
    invites a moderator as a viewer.
12. **Venues an organiser manages**: verify only the invited target. `Organiser.venueId` is the usual
    hall, often rented, and proves no ownership. A sabha that owns its hall gets a second invite for
    the venue. The Spec drops "and on each venue it manages".
13. **Edits to approved events while the review switch is on**: go to review. The edit goes through
    the existing Edit workflow as a submitted draft; the live event is unchanged until a moderator
    approves. With the switch off, edits stay instant.
14. **Hall renames**: cascade the new `spaceName` to events that have not started yet. Past events
    keep the name the hall had at the time.
15. **Organiser dashboard codes**: home venue only. Codes belong to venues; a sabha renting a hall
    would otherwise see scans from other sabhas' concerts there. Codes at a rented hall show on
    that venue's dashboard.
16. **Reminders unsubscribe**: keeps stopping push too. Copy now reads "You won't get day-before
    reminders any more." Tapping "Remind me the day before" or turning on push sets
    `notifyReminder` back on.

## Owner decision on cost (2026-11-12)

17. **Scan rate limit, WAF dropped for the pilot on cost.** The WAF costs about $6 a month fixed
    plus $0.60 per million requests, and every request to the distribution is billed, not only
    `/q/`. The limit is now in the app: a per-IP limit through `hitRateLimit`, keyed
    `scan-ip#<ip>`, 300 a minute (decision 6), applied in `qr.resolve` on the counting page load
    only. A flood still invokes Lambda. The WAF is backlog.

## Owner decision on bulk assign labels (2026-11-12)

18. **Bulk assign takes a label per code.** The label is shown to rasikas on the follow screen
    ("You're at ..."), and one batch is usually spread over different spots (entrance, register
    table, ticket desk), so each code needs its own label. `qr.bulkAssign` takes
    `items: [{ code, label }]` (1 to 50, codes unique) with `venueId` and `spaceId?`. The prefix
    with numbers is gone from the API. It survives in the admin page only as a "Fill labels"
    helper that numbers the empty labels of ticked rows.

## Owner decision on sharing (2026-11-12)

19. **"Share with all of these" shortcut.** On the follow screen, a checkbox above the rows ticks
    every visible per-target share box for this scan only. It shows only when two or more venue or
    organiser rows are toggled on, is never pre-ticked, and is hidden without JavaScript. It is
    checked when all boxes are ticked, unchecked when none, indeterminate when some. It posts
    nothing. Consent is still one checkbox per target (decision 1), stored per target with the
    share consent version. It never covers hidden targets, artists or future follows.

## Owner decision on invite acceptance (2026-11-13)

20. **A partner invite is accepted only by an explicit tap, never by signing in.** The auth
    issuer used to accept every pending invite on each sign-in, so an existing rasika.life user
    became a sabha owner, and the first owner turned on the public Verified badge, without seeing
    anything. Now `/invite` lists each pending invite (target, type, role, inviter) with its own
    "Accept invite" button. There is no "Decline" in v1: an unwanted invite expires after 14 days.
