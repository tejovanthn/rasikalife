/**
 * Admin strings. The first block is verbatim from `docs/plans/261112-01-venue-qr-follow/copy.md`
 * ("Admin app copy"). Placeholders are functions, so braces never reach the screen.
 *
 * The second block is strings the screens need that copy.md does not list. They are marked
 * `TODO(copy)` and kept plain; replace them once copy.md has them.
 */
export const ADMIN_COPY = {
  batches: {
    title: 'QR codes',
    newBatch: 'New batch',
  },
  newBatch: {
    count: 'Number of codes (1 to 200)',
    format: 'Format',
    note: 'Note (optional)',
    formats: {
      sticker: 'Sticker 100 mm',
      'table-tent': 'Table tent A5',
      poster: 'Poster A4',
    },
    submit: 'Generate codes',
  },
  batch: {
    pending: 'Preparing PDF',
    ready: 'Download PDF',
    failed: 'PDF failed. Try again',
  },
  assign: {
    title: (code: string) => `Activate code ${code}`,
    venue: 'Venue',
    space: 'Space (optional)',
    label: 'Placement label',
    note: 'Note (optional)',
    labelPlaceholder: 'Main entrance',
    submit: 'Activate code',
    success: (code: string, venueName: string) => `Code ${code} is live at ${venueName}.`,
    testScan: 'Test scan',
    alreadyActive: (venueName: string) => `This code is already live at ${venueName}.`,
  },
  bulkAssign: {
    submit: (count: number) => `Activate ${count} codes`,
  },
  retire: {
    title: (code: string) => `Retire ${code}?`,
    body: (venueName: string) =>
      `Anyone who scans it will be sent to the ${venueName} page. This can't be undone.`,
    confirm: 'Retire code',
  },
} as const;

/** TODO(copy): none of these are in copy.md. */
export const ADMIN_EXTRA_COPY = {
  brand: 'rasika.life admin',
  signOut: 'Sign out',
  forbiddenTitle: 'No access',
  forbiddenBody: 'This app is for moderators and admins.',
  notFoundTitle: 'Not found',
  errorTitle: 'Something went wrong',
  errorBody: 'Try again in a moment.',
  codes: 'Codes',
  batchesHeading: 'Batches',
  assignBox: 'Assign code',
  assignBoxHint: 'Type the code printed under the QR.',
  assignBoxSubmit: 'Open',
  filterStatus: 'Status',
  filterBatch: 'Batch',
  filterVenue: 'Venue',
  filterAll: 'All',
  filterApply: 'Filter',
  statuses: { unassigned: 'Unassigned', active: 'Active', retired: 'Retired' },
  noCodes: 'No codes match.',
  noBatches: 'No batches yet.',
  tableCode: 'Code',
  tableStatus: 'Status',
  tableVenue: 'Venue',
  tableLabel: 'Label',
  tableScans: 'Scans',
  tableFollows: 'Follows',
  tableBatch: 'Batch',
  tableFormat: 'Format',
  tableCount: 'Codes',
  tableNote: 'Note',
  tableCreated: 'Created',
  tablePdf: 'PDF',
  loadMore: 'Load more',
  batchBack: 'Back to QR codes',
  assignSelected: 'Assign these codes to a venue',
  bulkVenue: 'Venue',
  bulkPrefix: 'Label prefix',
  bulkPrefixHint: 'Labels become Entrance 1, Entrance 2 and so on, in the order shown.',
  bulkLimit: 'Up to 50 codes at a time.',
  bulkNone: 'Tick at least one code.',
  noUnassigned: 'Every code in this batch is assigned or retired.',
  createVenue: 'Create a venue',
  venueSearch: 'Search venues',
  edit: 'Edit label',
  reassign: 'Reassign',
  retireAction: 'Retire',
  saveLabel: 'Save label',
  saveReassign: 'Reassign code',
  cancel: 'Cancel',
  retiredNotice: 'This code is retired and cannot be changed.',
  unassignedNotice: 'This code is not assigned yet.',
  pdfRetry: 'Try again',
  codeNotFound: 'No code with that value.',
  invalidCode: 'Codes are 8 characters: digits and letters, without I, L, O or U.',
} as const;
