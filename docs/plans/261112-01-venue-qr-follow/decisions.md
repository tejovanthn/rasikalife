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
