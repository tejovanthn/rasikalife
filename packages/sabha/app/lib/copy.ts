/**
 * Dashboard strings. `SABHA_COPY` is verbatim from
 * `docs/plans/261112-01-venue-qr-follow/copy.md` ("Sabha dashboard, invite, export" and
 * "Add a concert"). Placeholders are functions, so braces never reach the screen.
 *
 * `SABHA_EXTRA_COPY` is verbatim from copy.md's "Strings added after the build (12 Nov)".
 * No em dashes anywhere.
 */
export const SABHA_COPY = {
  switcherLabel: 'Managing',
  noAccess: "You don't manage any sabha or venue yet. Ask the rasika.life team for an invite.",
  inviteMismatch: (inviteeEmail: string) =>
    `This invite was sent to ${inviteeEmail}. Sign in with that Google account to accept it.`,
  verified: 'Verified',
  verifiedTooltip: (targetName: string) => `Managed by ${targetName} on rasika.life`,
  overviewCards: {
    followers: 'Followers',
    newThisMonth: 'New this month',
    scansThisWeek: 'Scans this week',
    upcomingConcerts: 'Upcoming concerts',
  },
  followersScreen: {
    total: 'Total followers',
    sharing: 'Sharing details with you',
    stoppedSharing: 'Stopped sharing this month',
  },
  profileSaved: 'Changes saved.',
  export: {
    notice: (targetName: string) =>
      `This file has personal details that followers chose to share with ${targetName}. Use it only for event notices. Delete older exports when you download this one. WhatsApp numbers marked Unverified have not been confirmed yet.`,
    download: 'Download CSV',
    viewerOnly: 'Only owners can download followers.',
  },
  addConcert: {
    fields: {
      title: 'Title',
      date: 'Date',
      startTime: 'Start time',
      space: 'Space',
      organiser: 'Organiser',
      artists: 'Artists',
      notes: 'Notes',
    },
    submitReview: 'Submit for review',
    submitPublish: 'Publish concert',
    publishedAt: (venueName: string) => `Published. It's now on ${venueName}'s page.`,
  },
  // Tab names are the Spec's "Screens" table.
  tabs: {
    overview: 'Overview',
    profile: 'Profile',
    events: 'Events',
    spaces: 'Spaces',
    codes: 'QR codes',
    followers: 'Followers',
    export: 'Export',
  },
  venue: 'Venue',
} as const;

/** Copy tab, "Strings added after the build (12 Nov)", Sabha dashboard. */
export const SABHA_EXTRA_COPY = {
  brand: 'rasika.life for sabhas',
  signIn: 'Sign in with Google',
  signOut: 'Sign out',
  signInLead: 'Sign in with the Google account your invite was sent to.',
  errorTitle: 'Something went wrong',
  errorBody: 'Try again in a moment.',
  notFoundTitle: 'Not found',
  forbiddenTitle: 'No access',
  forbiddenBody: "You don't have access to this sabha or venue.",
  home: 'Back to your dashboards',
  chooseHeading: 'Pick one to open',
  // Not in the Copy tab yet (owner request 2026-11-13)
  notInvited: 'Not invited yet? Ask for free QR codes for your sabha.',
  typeLabel: { organiser: 'Organiser', venue: 'Venue' },
  roleLabel: { owner: 'Owner', viewer: 'Viewer', moderator: 'Moderator' },
  // Invite page
  inviteAccepted: (name: string) => `You now manage ${name}.`,
  inviteExpired: (name: string) =>
    `The invite for ${name} has expired. Ask the rasika.life team to send it again.`,
  inviteNothing: 'There is no invite waiting for this account.',
  inviteOpen: 'Open dashboard',
  // Copy tab, invite email: the button's label, reused on the invite page (decision 20).
  inviteAccept: 'Accept invite',
  // TODO(copy): no string in copy.md for who sent the invite, shown on the invite page.
  inviteFrom: (inviterName: string) => `Invited by ${inviterName}`,
  // Overview
  trendHeading: 'Followers, last 30 days',
  trendSummary: (from: number, to: number) =>
    `Followers over the last 30 days: from ${from} to ${to}.`,
  trendNew: 'New followers',
  // Profile
  profileReadOnly: 'Only owners can change these details.',
  profileSave: 'Save changes',
  profileFields: {
    name: 'Name',
    description: 'Description',
    organisationType: 'Type',
    city: 'City',
    website: 'Website',
    phone: 'Phone',
    email: 'Email',
    foundedYear: 'Founded in',
    capacity: 'Seats',
    nearestTransit: 'Nearest transit',
    street: 'Street',
    state: 'State',
    postalCode: 'PIN code',
    country: 'Country',
  },
  profileNothingChanged: 'Nothing was changed.',
  // Events
  eventsUpcoming: 'Upcoming',
  eventsPast: 'Past',
  eventsNone: 'No concerts here yet.',
  eventsAdd: 'Add a concert',
  eventsEdit: 'Edit',
  eventsEditTitle: 'Edit concert',
  eventsSave: 'Save concert',
  eventsReviewWait: 'Waiting for review',
  eventsView: 'View on rasika.life',
  eventsBack: 'Back to concerts',
  eventsArtistsHint: 'One name per line, or separated by commas.',
  eventsNoSpace: 'No space',
  eventsSubmitted: 'Thanks. A moderator will review it shortly.',
  eventsSaved: 'Concert saved.',
  eventsVenueRequired: 'Pick a venue.',
  eventsOwnersOnly: 'Only owners can add or change concerts.',
  eventsOrganiserOnly: 'Concerts are added from an organiser dashboard.',
  // Spaces
  spacesNone: 'No spaces yet. Add each hall of this venue.',
  spacesName: 'Name',
  spacesCapacity: 'Seats',
  spacesNotes: 'Notes',
  spacesCodes: 'QR codes',
  spacesAdd: 'Add space',
  spacesSave: 'Save',
  spacesOwnersOnly: 'Only owners can add or change spaces.',
  spacesVenueOnly: 'Spaces belong to a venue.',
  spacesNoCodes: 'None',
  spacesVenueWide: 'Whole venue',
  spacesSaved: 'Space saved.',
  // QR codes
  codesNone: 'No QR codes are placed here yet. The rasika.life team places them.',
  codeCode: 'Code',
  codeVenue: 'Venue',
  codeSpace: 'Space',
  codeLabel: 'Label',
  codeScans: 'Scans',
  codeScansWeek: 'Scans, 7 days',
  codeFollows: 'Follows',
  codeRetired: 'Retired',
  codeNoHome: 'QR codes belong to venues. This organiser has no home venue set, so none are shown.',
  // Followers
  followersNote:
    'Counts only. Names appear only in the export, for followers who chose to share them.',
  // Export
  exportHistory: 'Recent downloads',

  // Not in the Copy tab yet (owner request 2026-11-13): the header's invites link and the Team
  // tab. "Email", "Send invite" and "Revoke" are the admin app's invite strings, reused.
  invitesLink: (count: number) => `Invites (${count})`,
  teamTab: 'Team',
  teamMembers: 'Members',
  teamNoMembers: 'Nobody manages this yet.',
  teamName: 'Name',
  teamEmail: 'Email',
  teamRole: 'Role',
  teamYou: 'You',
  teamRevoke: 'Revoke',
  teamRevoked: 'Access removed.',
  teamPending: 'Invites waiting',
  teamNoPending: 'No invites are waiting.',
  teamExpires: 'Expires',
  teamWithdraw: 'Withdraw',
  teamWithdrawn: 'Invite withdrawn.',
  teamInviteHeading: 'Invite a viewer',
  teamInviteHint:
    'A viewer can look at this dashboard. They cannot change anything or download followers. The invite expires in 14 days. Sending again renews it.',
  teamInviteEmail: 'Email',
  teamInviteSubmit: 'Send invite',
  teamInviteSent: (email: string) => `Invite sent to ${email}.`,
  teamInviteSavedNoEmail: (email: string) =>
    `Invite saved for ${email}, but the email could not be sent. Send it again.`,
  teamReadOnly: 'Only owners can invite or remove people.',
  teamOwnersNote: 'The rasika.life team adds and removes owners.',
} as const;
