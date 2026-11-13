// Copy only, so the footer and organiser pages can import it without pulling in the form code.
/**
 * Not in the Copy tab yet (owner request 2026-11-13)
 *
 * Headline, the three points, the form labels it still has (sabha or venue name, role, WhatsApp
 * number) and the next-step line are the owner's own words. Every other string on `/for-sabhas` is plain wording written here, for the owner to
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
    role: 'Role',
    whatsapp: 'WhatsApp number',
    email: 'Email',
  },
  hints: {
    role: 'For example, secretary or trustee. Optional.',
    whatsapp: 'A 10-digit mobile number. We will message you here.',
  },
  submit: 'Request free QR codes',
  submitting: 'Opening WhatsApp...',
  // Shown under the button. The form opens WhatsApp, so there is no thank-you screen.
  nextStep: "Thanks. We'll message you on WhatsApp within two days.",
  // The WhatsApp message. {sabha}, {role}, {number} and {email} are filled in.
  message: {
    intro: "Hello, I'd like free QR codes for {sabha}.",
    role: 'Role: {role}',
    whatsapp: 'WhatsApp: +91 {number}',
    email: 'Email: {email}',
    source: 'From rasika.life/for-sabhas',
  },
  alreadyInvited: 'Already invited? Sign in',
  dashboard: 'Go to your dashboard',
  footerLink: 'For sabhas',
  errors: {
    venueName: 'Enter the name of your sabha or venue.',
    whatsapp: 'Enter a 10-digit mobile number, for example 98765 43210.',
    email: 'Enter a valid email address.',
    tooLong: 'This is too long. Please shorten it.',
    summary: 'Please check the fields marked below.',
  },
} as const;
