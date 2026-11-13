// Copy only, so the footer and organiser pages can import it without pulling in the form code.
/**
 * Not in the Copy tab yet (owner request 2026-11-13)
 *
 * Headline, the three points, the five form labels and the thank-you line are the owner's own
 * words. Every other string on `/for-sabhas` is plain wording written here, for the owner to
 * replace.
 */
// Not in the Copy tab yet (owner request 2026-11-13)
export const FOR_SABHAS_COPY = {
  metaTitle: 'Free QR Codes for Your Sabha | Rasika.life',
  metaDescription:
    'Rasikas scan a QR code at your concert and follow your sabha. You get your follower list, with WhatsApp numbers they chose to share. We print the codes.',
  eyebrow: 'For sabhas',
  headline: 'Free QR codes for your sabha',
  intro:
    'Put a QR code at your hall. Rasikas scan it at the concert and follow your sabha on rasika.life.',
  points: [
    'Rasikas scan and follow you',
    'You get your follower list, with WhatsApp numbers they chose to share',
    'We print and set up the codes',
  ],
  formHeading: 'Ask for your codes',
  labels: {
    venueName: 'Sabha or venue name',
    contactName: 'Your name',
    role: 'Role',
    whatsapp: 'WhatsApp number',
    concertDates: 'Upcoming concert dates',
  },
  hints: {
    role: 'For example, secretary or trustee. Optional.',
    whatsapp: 'A 10-digit mobile number. We will message you here.',
    concertDates: 'For example, 22 and 24 December. Optional.',
  },
  submit: 'Request free QR codes',
  submitting: 'Sending...',
  thanks: "Thanks. We'll message you on WhatsApp within two days.",
  alreadyInvited: 'Already invited? Sign in',
  dashboard: 'Go to your dashboard',
  footerLink: 'For sabhas',
  errors: {
    venueName: 'Enter the name of your sabha or venue.',
    contactName: 'Enter your name.',
    whatsapp: 'Enter a 10-digit mobile number, for example 98765 43210.',
    tooLong: 'This is too long. Please shorten it.',
    summary: 'Please check the fields marked below.',
    failed: 'We could not send your request. Please try again in a moment.',
    rateLimited: 'Too many requests from this network. Please try again in an hour.',
  },
} as const;
