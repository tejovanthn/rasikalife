# Venue QR Follow: strings missing from copy.md

Every `TODO(copy)` in the code, with the placeholder text it shows now. Write the final wording
into the Copy tab; an agent then replaces these verbatim. Keys are the code names.

## One-off strings

| Where | Placeholder now |
| --- | --- |
| Follower count under a Follow button (`web/app/lib/follow.ts`) | `1 follower` / `{count} followers` (hidden at 0) |
| Digest and reminder reason, one followed name (`core/.../notification/match.ts`) | `Because you follow {name}` |
| Reminder email subject, event with no venue (`email/src/notify.tsx`) | `Tomorrow: {eventTitle}` |
| Reminder push body, event with no venue (`core/.../notification/push.ts`) | `{eventTitle}` |
| Unsubscribe confirm button, GET step (`web/app/lib/notifications.ts`) | `Unsubscribe` |
| Venue QR panel empty state (`web/app/components/VenueQrPanel.tsx`) | `No QR codes at this venue yet.` |

## Admin app (`packages/admin/app/lib/copy.ts`, `ADMIN_EXTRA_COPY`)

| Key | Placeholder now |
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
| *Partners (sabha dashboard access). All TODO(copy): copy.md only has the invite form.* | |
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
| partnersReviewHeading | Review of owner events |
| partnersReviewOff | Events added by owners are published at once. |
| partnersReviewOn | Events added by owners wait for a moderator. |
| partnersReviewTurnOn | Turn review on |
| partnersReviewTurnOff | Turn review off |
| spotCheck | Owner events |
| spotCheckHint | Concerts that owners published without review, newest first. |
| spotCheckNone | No owner events yet. |
| spotCheckPublished | Published |
| spotCheckEvent | Concert |
| spotCheckWhen | When |
| spotCheckOrganiser | Organiser |
| spotCheckVenue | Venue |

## Sabha dashboard (`packages/sabha/app/lib/copy.ts`, `SABHA_EXTRA_COPY`)

| Key | Placeholder now |
| --- | --- |
| brand | rasika.life |
| signIn | Sign in with Google |
| signOut | Sign out |
| signInLead | Sign in with the Google account your invite was sent to. |
| errorTitle | Something went wrong |
| errorBody | Try again in a moment. |
| notFoundTitle | Not found |
| forbiddenTitle | No access |
| forbiddenBody | You don't manage this one. |
| home | Back to your dashboards |
| chooseHeading | Pick one to open |
| typeLabel.organiser | Organiser |
| typeLabel.venue | Venue |
| roleLabel.owner | Owner |
| roleLabel.viewer | Viewer |
| roleLabel.moderator | Moderator |
| *Invite page* | |
| inviteAccepted(name) | You now manage {name}. |
| inviteExpired(name) | The invite for {name} has expired. Ask the rasika.life team to send it again. |
| inviteNothing | There is no invite waiting for this account. |
| inviteOpen | Open dashboard |
| *Overview* | |
| trendHeading | Followers, last 30 days |
| trendSummary(from, to) | Followers over the last 30 days: from {from} to {to}. |
| trendNew | New followers |
| *Profile* | |
| profileReadOnly | Only verified owners can change these details. |
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
| *Events* | |
| eventsUpcoming | Upcoming |
| eventsPast | Past |
| eventsNone | No concerts here yet. |
| eventsAdd | Add a concert |
| eventsEdit | Edit |
| eventsEditTitle | Edit concert |
| eventsSave | Save concert |
| eventsReviewWait | Waiting for review |
| eventsView | View on rasika.life |
| eventsBack | Back to events |
| eventsArtistsHint | One name per line, or separated by commas. |
| eventsNoSpace | No space |
| eventsSubmitted | Thanks. A moderator will review it shortly. |
| eventsSaved | Concert saved. |
| eventsVenueRequired | Pick a venue. |
| eventsOwnersOnly | Only owners can add or change concerts. |
| eventsOrganiserOnly | Concerts are added from an organiser dashboard. |
| *Spaces* | |
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
| *QR codes* | |
| codesNone | No QR codes are placed here yet. The rasika.life team places them. |
| codeCode | Code |
| codeVenue | Venue |
| codeSpace | Space |
| codeLabel | Label |
| codeScans | Scans |
| codeScansWeek | Scans, 7 days |
| codeFollows | Follows |
| codeRetired | Retired |
| codeNoHome | This organiser has no home venue, so no codes are shown. |
| *Followers* | |
| followersNote | Counts only. Names are never shown here. |
| *Export* | |
| exportHistory | Recent downloads |
