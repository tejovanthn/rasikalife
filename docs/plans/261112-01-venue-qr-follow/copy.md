# Copy

## Rules for using this copy

Use every string here verbatim. If a screen needs a string that is not listed, leave a `TODO(copy)` and flag it; do not write new copy.

- `{curlyBraces}` are placeholders filled at runtime; never show braces to users
- Sentence case for headings and buttons
- Indian English spelling: organiser, colour, cancelled
- No em dashes anywhere, in UI, emails or code comments shown to users
- Dates: `Sat 16 Nov`; times: `6:00 pm`; ranges: `16 to 29 Nov`. All times in the event's timezone (default Asia/Kolkata)
- `{organiserName}`, `{venueName}`, `{artistName}` use the entity's display name exactly as stored
- Store every consent string with a version id (see Build notes, Constants). Changing consent wording means a new version id
- Kannada lines are drafts and must be reviewed by a native speaker before the first print run

## Printed stickers, tents, posters

**Sticker (100 x 100 mm)**

| Element | Text |
| --- | --- |
| Headline | Scan to follow concerts here |
| Kannada line | ಇಲ್ಲಿನ ಸಂಗೀತ ಕಛೇರಿಗಳ ಮಾಹಿತಿಗಾಗಿ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ |
| Under the QR | Code {code} |
| Footer | rasika.life |

**Table tent (A5 faces) and poster (A4)**

| Element | Text |
| --- | --- |
| Headline | Don't miss the next concert |
| Body | Scan to follow this sabha, this hall and tonight's artists. Get a weekly list and a reminder the day before. |
| Kannada line | ಮುಂದಿನ ಕಛೇರಿಯನ್ನು ತಪ್ಪಿಸಿಕೊಳ್ಳಬೇಡಿ. ಸ್ಕ್ಯಾನ್ ಮಾಡಿ, ಫಾಲೋ ಮಾಡಿ. |
| Reassurance | Free. No app needed. |
| Under the QR | Code {code} |
| Footer | rasika.life |

The tent prints the same face on both sides of the fold.

## Scan page states

| State | Title | Body | Action |
| --- | --- | --- | --- |
| Code not found | We couldn't find this code | Check the code printed under the QR, or browse upcoming concerts. | See upcoming concerts |
| Unassigned (not a moderator) | This code isn't active yet | It will start working once it's set up at this venue. | See upcoming concerts |
| Picker (2+ live) | Which concert are you at? | (list of concerts: title, time, space) | (tap a concert) |
| Later today | Later today at {venueName} | (list of concerts) | Add a concert happening here |
| Venue mode | Nothing on right now at {venueName} | Follow to hear about upcoming concerts here. | Add a concert happening here |
| Venue mode, list heading | Coming up here |  |  |
| Rate limited | Too many scans | Please wait a minute and try again. |  |
| Server error | Something went wrong | Please try again in a moment. | Try again |

**In-app browser (WhatsApp, Instagram and similar)**

- Title: Open in your browser to continue
- Body: Google sign-in doesn't work inside this app. Copy the link and open it in Chrome or Safari.
- Button: Copy link
- After copy: Link copied

## Follow screen and consent text

| Element | Text |
| --- | --- |
| Eyebrow above event card | You're at {venueName} |
| QR label line (if set) | {qrLabel} |
| Section heading | Get notified about |
| Shortcut link | Follow all |
| Venue row subtitle | Venue |
| Organiser row subtitle | Organiser |
| Artist row subtitle | {role} (falls back to Artist) |
| Row state when already followed | Following |
| Primary button, signed in | Follow |
| Primary button, signed out | Continue with Google |
| Button while saving | Saving |
| Footer note | We'll send a weekly list and a reminder the day before. Change this any time. |
| Footer link | How we use your details |
| Nothing selected, button tapped | Pick at least one to follow. |
| Save failed | Couldn't save. Your choices are still here, please try again. |
| Sign-in cancelled | Sign-in was cancelled. Tap Continue with Google to finish following. |

**Share consent** (consent version `share-v1`)

One checkbox per venue or organiser the user has toggled on, each naming that target. Never pre-ticked. Hidden when that target is off.

- Checkbox: Share my name, email and WhatsApp number (if I add one) with {targetName} so they can send event notices.
- Helper under the checkboxes: Only the sabha or venue you tick gets these details. You can stop sharing any time from Following.

## Confirmation, push, concert book, WhatsApp

| Element | Text |
| --- | --- |
| Title | You're all set |
| Summary line, 1 follow | You're following {name}. |
| Summary line, 2+ follows | You're following {count}: {name1}, {name2} and more. |
| Push button | Remind me the day before |
| Push helper | We'll send a notification the evening before their concerts. |
| Push enabled | Reminders are on for this device. |
| Push blocked by browser | Notifications are blocked for rasika.life. Turn them on in your browser settings. |
| iOS Safari helper (not installed) | On iPhone, add rasika.life to your Home Screen first: tap Share, then Add to Home Screen. |
| Concert book button | Add tonight to my concert book |
| Concert book done | Added to your concert book |
| Manage link | Manage what you follow |

**WhatsApp number** (consent version `whatsapp-v1`)

| Element | Text |
| --- | --- |
| Card heading | Get updates on WhatsApp |
| Field label | WhatsApp number (optional) |
| Prefix | +91 |
| Placeholder | 98450 12345 |
| Consent checkbox (unticked) | rasika.life may message me on this number about concerts I follow. |
| Save button | Save number |
| Dismiss link | Not now |
| Validation | Enter a 10-digit mobile number. |
| Consent missing | Tick the box to let us message this number. |
| Saved | Saved. We'll confirm this number before messaging you. |

## Following and notification settings pages

**`/me/following`**

| Element | Text |
| --- | --- |
| Page title | Following |
| Group headings | Artists, Sabhas and organisers, Venues |
| Empty state | You're not following anyone yet. Scan a code at a concert, or tap Follow on any artist, sabha or venue page. |
| Unfollow button | Unfollow |
| Unfollow toast | Unfollowed {name}. |
| Toast action | Undo |
| Sharing toggle label | Share my details with {name} |
| Stop-sharing confirm title | Stop sharing with {name}? |
| Stop-sharing confirm body | They won't get your details in future exports. Copies they've already downloaded stay with them. |
| Confirm buttons | Stop sharing / Cancel |

**`/me/notifications`**

| Element | Text |
| --- | --- |
| Page title | Notifications |
| Toggle | Weekly list of concerts (Sunday evening) |
| Toggle | Reminder the day before |
| Toggle | Email |
| Toggle | Push notifications on this device |
| WhatsApp row, no number | Add WhatsApp number |
| WhatsApp row, unverified | {number} (not yet confirmed) |
| WhatsApp remove | Remove number |
| Saved toast | Settings saved. |

**`/unsubscribe/:token`**

| Case | Text |
| --- | --- |
| Digest | You won't get the weekly list any more. |
| Reminders | You won't get day-before reminders any more. |
| All email | You're unsubscribed from all rasika.life email. |
| Follow-up link | Changed your mind? Manage notifications |
| Bad or used token | This link has expired. Sign in to manage notifications. |

## Emails and push notifications

All email from `rasika.life <concerts@rasika.life>`, reply-to `hello@rasika.life`.

**Weekly digest** (Sunday 18:00 IST; not sent when there are no events)

| Element | Text |
| --- | --- |
| Subject | Concerts for you: {startDate} to {endDate} |
| Preheader | {count} concerts from artists, sabhas and venues you follow |
| Heading | Coming up in the next two weeks |
| Event line 1 | {eventTitle} |
| Event line 2 | {day} {date}, {time} · {venueName} |
| Event reason, RSVP | You said you're going |
| Event reason, follows | Because you follow {name1} and {name2} |
| Event reason, 3+ follows | Because you follow {name1}, {name2} and {n} more |
| Event link | View concert |
| More link (over 15 events) | See all {total} concerts on rasika.life |

**Day-before reminder, email**

| Element | Text |
| --- | --- |
| Subject, 1 event | Tomorrow: {eventTitle} at {venueName} |
| Subject, 2+ events | Tomorrow: {count} concerts you follow |
| Preheader | Starts {time} at {venueName} |
| Body line per event | {eventTitle}, {time} at {venueName}. {reason} |
| Button | View concert |

**Email footer (all emails)**

You're getting this because you follow concerts on rasika.life. Manage what you follow · Turn off this email · Unsubscribe from all email

**Day-before reminder, push**

| Case | Title | Body |
| --- | --- | --- |
| 1 event | Tomorrow at {time} | {eventTitle}, {venueName} |
| 2+ events | {count} concerts tomorrow | {eventTitle1}, {eventTitle2} and more |

Tapping opens the event page (1 event) or `/me/following` (2+).

## Add a concert

| Element | Text |
| --- | --- |
| Link on scan pages | Add a concert happening here |
| Form title | Add a concert at {venueName} |
| Option A | Upload a poster |
| Option A helper | We'll read the details from the poster. You can fix anything before submitting. |
| Option B | Fill in the details |
| Field labels | Title, Date, Start time, Space, Organiser, Artists, Notes |
| Submit, regular user | Submit for review |
| Submit, verified owner | Publish concert |
| Success, regular user | Thanks. A moderator will review it shortly. Meanwhile you can follow {venueName}. |
| Success, verified owner | Published. It's now on {venueName}'s page. |

## Admin app copy

Internal tool; keep it plain. Strings an agent needs:

| Screen | Element | Text |
| --- | --- | --- |
| Batches | Page title | QR codes |
| Batches | Button | New batch |
| New batch | Fields | Number of codes (1 to 200), Format, Note (optional) |
| New batch | Format options | Sticker 100 mm, Table tent A5, Poster A4 |
| New batch | Submit | Generate codes |
| Batch | PDF pending | Preparing PDF |
| Batch | PDF ready | Download PDF |
| Batch | PDF failed | PDF failed. Try again |
| Assign | Title | Activate code {code} |
| Assign | Fields | Venue, Space (optional), Placement label, Note (optional) |
| Assign | Label placeholder | Main entrance |
| Assign | Submit | Activate code |
| Assign | Success | Code {code} is live at {venueName}. |
| Assign | Success link | Test scan |
| Assign | Already active | This code is already live at {venueName}. |
| Bulk assign | Submit | Activate {count} codes |
| Retire | Confirm title | Retire {code}? |
| Retire | Confirm body | Anyone who scans it will be sent to the {venueName} page. This can't be undone. |
| Retire | Confirm button | Retire code |
| Invite | Form | Email, Role (Owner, Viewer) |
| Invite | Submit | Send invite |

## Sabha dashboard, invite, export

**Invite email**

| Element | Text |
| --- | --- |
| Subject | You're invited to manage {targetName} on rasika.life |
| Body | {inviterName} has invited you to manage {targetName} on rasika.life. You'll see who follows {targetName}, how your QR codes are doing, and you can keep your details and concerts up to date. Sign in with Google using {inviteeEmail} to accept. |
| Button | Accept invite |
| Footnote | This invite expires in 14 days. |

**Dashboard**

| Element | Text |
| --- | --- |
| Header switcher label | Managing |
| No access | You don't manage any sabha or venue yet. Ask the rasika.life team for an invite. |
| Invite email mismatch | This invite was sent to {inviteeEmail}. Sign in with that Google account to accept it. |
| Verified badge | Verified |
| Verified tooltip | Managed by {targetName} on rasika.life |
| Overview cards | Followers, New this month, Scans this week, Upcoming concerts |
| Followers screen labels | Total followers, Sharing details with you, Stopped sharing this month |
| Profile save | Changes saved. |

**Export screen**

- Notice: This file has personal details that followers chose to share with {targetName}. Use it only for event notices. Delete older exports when you download this one. WhatsApp numbers marked Unverified have not been confirmed yet.
- Button: Download CSV
- Viewer role sees instead: Only owners can download followers.

**CSV columns (exact header row)**

`name,email,whatsapp_number,whatsapp_verified,followed_at,source,followed`

- `whatsapp_verified`: `Yes` or `Unverified`; blank when there is no number
- `followed_at`: ISO date in IST, `2026-11-16`
- `source`: `qr` or `web`
- `followed`: `venue` or `organiser`

## Privacy summary page

Route `/privacy/following`, linked from "How we use your details". Full text:

**Following on rasika.life**

When you follow an artist, sabha or venue, we store your name, email, what you follow and when. We use this to send you a weekly list of concerts and a reminder the day before, if you keep those turned on.

**Sharing with a sabha or venue**

If you tick the share box, that sabha or venue can download your name, email and WhatsApp number (if you added one) to send you event notices. Only the ones you tick get these details. You can stop sharing any time from Following; they won't get your details in future exports, but copies they already downloaded stay with them.

**WhatsApp**

If you add a WhatsApp number, we may message you about concerts you follow once we have confirmed the number. You can remove it any time from Notifications.

**Deleting your account**

Deleting your account removes everything you follow, your sharing choices, your WhatsApp number and your notification settings.

This page needs a final review before launch.

## Strings added after the build (12 Nov)

These replace every `TODO(copy)` in the code, verbatim. Keys match the code.

**One-off strings**

| Where | Text |
| --- | --- |
| Follower count under a Follow button (`web/app/lib/follow.ts`) | `1 follower` / `{count} followers` (hidden at 0) |
| Digest and reminder reason, one followed name | Because you follow {name} |
| Reminder email subject, event with no venue | Tomorrow: {eventTitle} |
| Reminder push body, event with no venue | {eventTitle} |
| Unsubscribe confirm button, GET step | Unsubscribe |
| Venue QR panel empty state | No QR codes at this venue yet. |

**Admin app** (`packages/admin/app/lib/copy.ts`, `ADMIN_EXTRA_COPY`)

| Key | Text |
| --- | --- |
| brand | rasika.life admin |
| signOut | Sign out |
| forbiddenTitle | No access |
| forbiddenBody | This app is for moderators and admins. |
| notFoundTitle | Not found |
| errorTitle | Something went wrong |
| errorBody | Try again in a moment. |
| codes | Codes |
| batchesHeading | Batches |
| assignBox | Assign code |
| assignBoxHint | Type the code printed under the QR. |
| assignBoxSubmit | Open |
| filterStatus | Status |
| filterBatch | Batch |
| filterVenue | Venue |
| filterAll | All |
| filterApply | Filter |
| statuses.unassigned | Unassigned |
| statuses.active | Active |
| statuses.retired | Retired |
| noCodes | No codes match. |
| noBatches | No batches yet. |
| tableCode | Code |
| tableStatus | Status |
| tableVenue | Venue |
| tableLabel | Label |
| tableScans | Scans |
| tableFollows | Follows |
| tableBatch | Batch |
| tableFormat | Format |
| tableCount | Codes |
| tableNote | Note |
| tableCreated | Created |
| tablePdf | PDF |
| loadMore | Load more |
| batchBack | Back to QR codes |
| assignSelected | Assign these codes to a venue |
| bulkVenue | Venue |
| bulkPrefix | Label prefix |
| bulkPrefixHint | Labels become Entrance 1, Entrance 2 and so on, in the order shown. |
| bulkLimit | Up to 50 codes at a time. |
| bulkNone | Tick at least one code. |
| noUnassigned | Every code in this batch is assigned or retired. |
| createVenue | Create a venue |
| venueSearch | Search venues |
| edit | Edit label |
| reassign | Reassign |
| retireAction | Retire |
| saveLabel | Save label |
| saveReassign | Reassign code |
| cancel | Cancel |
| retiredNotice | This code is retired and cannot be changed. |
| unassignedNotice | This code is not assigned yet. |
| pdfRetry | Try again |
| codeNotFound | No code with that value. |
| invalidCode | Codes are 8 characters: digits and letters, without I, L, O or U. |
| partners | Partners |
| partnersSearch | Search organisers and venues |
| partnersSearchSubmit | Search |
| partnersNoResults | No organiser or venue matches. |
| partnersTypeHeading | Type |
| partnersType.organiser | Organiser |
| partnersType.venue | Venue |
| partnersMembers | Members |
| partnersNoMembers | Nobody manages this yet. |
| partnersMemberName | Name |
| partnersMemberEmail | Email |
| partnersMemberRole | Role |
| partnersRevoke | Revoke |
| partnersRevoked | Access removed. |
| partnersInviteHeading | Invite |
| partnersInviteSent(email) | Invite sent to {email}. |
| partnersInviteSavedNoEmail(email) | Invite saved for {email}, but the email could not be sent. Send it again. |
| partnersInviteExpiry | The invite expires in 14 days. Sending again renews it. |
| partnersVerified | Verified |
| partnersNotVerified | Not verified yet. The first owner to accept an invite verifies it. |
| partnersOpenPage | Open public page |
| partnersReviewHeading | Review of owner concerts |
| partnersReviewOff | Concerts added or edited by owners are published right away. |
| partnersReviewOn | Concerts added or edited by owners wait for a moderator. |
| partnersReviewTurnOn | Turn review on |
| partnersReviewTurnOff | Turn review off |
| spotCheck | Owner concerts |
| spotCheckHint | Concerts that owners published without review, newest first. |
| spotCheckNone | No owner concerts yet. |
| spotCheckPublished | Published |
| spotCheckEvent | Concert |
| spotCheckWhen | When |
| spotCheckOrganiser | Organiser |
| spotCheckVenue | Venue |

**Sabha dashboard** (`packages/sabha/app/lib/copy.ts`, `SABHA_EXTRA_COPY`)

| Key | Text |
| --- | --- |
| brand | rasika.life for sabhas |
| signIn | Sign in with Google |
| signOut | Sign out |
| signInLead | Sign in with the Google account your invite was sent to. |
| errorTitle | Something went wrong |
| errorBody | Try again in a moment. |
| notFoundTitle | Not found |
| forbiddenTitle | No access |
| forbiddenBody | You don't have access to this sabha or venue. |
| home | Back to your dashboards |
| chooseHeading | Pick one to open |
| typeLabel.organiser | Organiser |
| typeLabel.venue | Venue |
| roleLabel.owner | Owner |
| roleLabel.viewer | Viewer |
| roleLabel.moderator | Moderator |
| inviteAccepted(name) | You now manage {name}. |
| inviteExpired(name) | The invite for {name} has expired. Ask the rasika.life team to send it again. |
| inviteNothing | There is no invite waiting for this account. |
| inviteOpen | Open dashboard |
| trendHeading | Followers, last 30 days |
| trendSummary(from, to) | Followers over the last 30 days: from {from} to {to}. |
| trendNew | New followers |
| profileReadOnly | Only owners can change these details. |
| profileSave | Save changes |
| profileFields.name | Name |
| profileFields.description | Description |
| profileFields.organisationType | Type |
| profileFields.city | City |
| profileFields.website | Website |
| profileFields.phone | Phone |
| profileFields.email | Email |
| profileFields.foundedYear | Founded in |
| profileFields.capacity | Seats |
| profileFields.nearestTransit | Nearest transit |
| profileFields.street | Street |
| profileFields.state | State |
| profileFields.postalCode | PIN code |
| profileFields.country | Country |
| profileNothingChanged | Nothing was changed. |
| eventsUpcoming | Upcoming |
| eventsPast | Past |
| eventsNone | No concerts here yet. |
| eventsAdd | Add a concert |
| eventsEdit | Edit |
| eventsEditTitle | Edit concert |
| eventsSave | Save concert |
| eventsReviewWait | Waiting for review |
| eventsView | View on rasika.life |
| eventsBack | Back to concerts |
| eventsArtistsHint | One name per line, or separated by commas. |
| eventsNoSpace | No space |
| eventsSubmitted | Thanks. A moderator will review it shortly. |
| eventsSaved | Concert saved. |
| eventsVenueRequired | Pick a venue. |
| eventsOwnersOnly | Only owners can add or change concerts. |
| eventsOrganiserOnly | Concerts are added from an organiser dashboard. |
| spacesNone | No spaces yet. Add each hall of this venue. |
| spacesName | Name |
| spacesCapacity | Seats |
| spacesNotes | Notes |
| spacesCodes | QR codes |
| spacesAdd | Add space |
| spacesSave | Save |
| spacesOwnersOnly | Only owners can add or change spaces. |
| spacesVenueOnly | Spaces belong to a venue. |
| spacesNoCodes | None |
| spacesVenueWide | Whole venue |
| spacesSaved | Space saved. |
| codesNone | No QR codes are placed here yet. The rasika.life team places them. |
| codeCode | Code |
| codeVenue | Venue |
| codeSpace | Space |
| codeLabel | Label |
| codeScans | Scans |
| codeScansWeek | Scans, 7 days |
| codeFollows | Follows |
| codeRetired | Retired |
| codeNoHome | QR codes belong to venues. This organiser has no home venue set, so none are shown. |
| followersNote | Counts only. Names appear only in the export, for followers who chose to share them. |
| exportHistory | Recent downloads |
