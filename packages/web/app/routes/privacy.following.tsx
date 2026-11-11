import type { MetaFunction } from 'react-router';

export const meta: MetaFunction = () => [
  { title: 'Following on rasika.life - Rasika.life' },
  { name: 'robots', content: 'noindex, follow' },
];

// Copy from docs/plans/261112-01-venue-qr-follow/copy.md, "Privacy summary page", verbatim.
// The copy says: "This page needs a final review before launch."
export default function PrivacyFollowing() {
  return (
    <main className="container mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="page-title">Following on rasika.life</h1>
      <section className="space-y-2">
        <p>
          When you follow an artist, sabha or venue, we store your name, email, what you follow and
          when. We use this to send you a weekly list of concerts and a reminder the day before, if
          you keep those turned on.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="section-heading">Sharing with a sabha or venue</h2>
        <p>
          If you tick the share box, that sabha or venue can download your name, email and WhatsApp
          number (if you added one) to send you event notices. Only the ones you tick get these
          details. You can stop sharing any time from Following; they won't get your details in
          future exports, but copies they already downloaded stay with them.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="section-heading">WhatsApp</h2>
        <p>
          If you add a WhatsApp number, we may message you about concerts you follow once we have
          confirmed the number. You can remove it any time from Notifications.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="section-heading">Deleting your account</h2>
        <p>
          Deleting your account removes everything you follow, your sharing choices, your WhatsApp
          number and your notification settings.
        </p>
      </section>
    </main>
  );
}
