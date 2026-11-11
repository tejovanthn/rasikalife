/**
 * Dashboard strings. `SABHA_COPY` is verbatim from
 * `docs/plans/261112-01-venue-qr-follow/copy.md` ("Sabha dashboard, invite, export" and
 * "Add a concert"). Placeholders are functions, so braces never reach the screen.
 *
 * `SABHA_EXTRA_COPY` holds what the screens need and copy.md does not list. Each is a
 * `TODO(copy)`, kept plain, to be replaced once copy.md has them. No em dashes anywhere.
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

/** TODO(copy): none of these are in copy.md. */
export const SABHA_EXTRA_COPY = {
  brand: 'rasika.life',
  signIn: 'Sign in with Google',
  signOut: 'Sign out',
  signInLead: 'Sign in with the Google account your invite was sent to.',
  errorTitle: 'Something went wrong',
  errorBody: 'Try again in a moment.',
  notFoundTitle: 'Not found',
  forbiddenTitle: 'No access',
  forbiddenBody: "You don't manage this one.",
  home: 'Back to your dashboards',
  chooseHeading: 'Pick one to open',
  typeLabel: { organiser: 'Organiser', venue: 'Venue' },
  roleLabel: { owner: 'Owner', viewer: 'Viewer', moderator: 'Moderator' },
  // Invite page
  inviteAccepted: (name: string) => `You now manage ${name}.`,
  inviteExpired: (name: string) =>
    `The invite for ${name} has expired. Ask the rasika.life team to send it again.`,
  inviteNothing: 'There is no invite waiting for this account.',
  inviteOpen: 'Open dashboard',
  // Overview
  trendHeading: 'Followers, last 30 days',
  trendSummary: (from: number, to: number) =>
    `Followers over the last 30 days: from ${from} to ${to}.`,
  trendNew: 'New followers',
  // Profile
  profileReadOnly: 'Only verified owners can change these details.',
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
  eventsBack: 'Back to events',
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
  codeNoHome: 'This organiser has no home venue, so no codes are shown.',
  // Followers
  followersNote: 'Counts only. Names are never shown here.',
  // Export
  exportHistory: 'Recent downloads',
} as const;
