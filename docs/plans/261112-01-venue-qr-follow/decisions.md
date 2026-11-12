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
