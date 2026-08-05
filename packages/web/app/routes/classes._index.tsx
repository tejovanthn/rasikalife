import {
  CalendarCheck,
  CalendarRange,
  Layers,
  Rows3,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import type { MetaFunction } from 'react-router';
import { FaqStructuredData } from '~/components/structured-data';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { AnalyticsEvent, trackEvent } from '~/lib/analytics';

/**
 * Straight to guru onboarding, not to the app root.
 *
 * The root is a context resolver: a brand-new visitor has no teaching and no learner rows, so it
 * sends them to `/welcome`, which asks whether they teach — a question they answered by pressing
 * a button on a page about teaching. `/welcome/teaching` is reachable cold; `requireUser` carries
 * the path through sign-in as `redirectTo`, and its own loader bounces a guru who has already
 * finished setting up on to `/teaching`. So this is right for both the first visit and the fifth.
 */
const CLASSES_SIGNUP_URL = 'https://classes.rasika.life/welcome/teaching';

export const meta: MetaFunction = () => {
  return [
    { title: 'Rasika Classes — Attendance & Class Credits for Music and Dance Teachers' },
    {
      name: 'description',
      content:
        'A class register for Indian classical music and dance teachers. Track attendance and class credits, and see who has paid. No payment gateway involved.',
    },
    {
      name: 'keywords',
      content:
        'class attendance tracker, class credit tracker, music teacher app, dance teacher app, Bharatanatyam class management, Carnatic music classes, guru student roster',
    },
    { property: 'og:title', content: 'Rasika Classes — Track Attendance and Class Credits' },
    {
      property: 'og:description',
      content:
        'The class register for music and dance teachers: attendance, class packs, and payments received. No gateway, no fees.',
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://rasika.life/classes' },
    { property: 'og:image', content: 'https://rasika.life/og-image.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Rasika Classes — Track Attendance and Class Credits' },
    {
      name: 'twitter:description',
      content: 'The class register for music and dance teachers. No gateway, no fees.',
    },
    { name: 'twitter:image', content: 'https://rasika.life/og-image.png' },
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/classes' },
  ];
};

const FEATURES = [
  {
    icon: Rows3,
    title: 'One roster, not a notebook',
    body: "Every student's classes left, last class, and last payment sit in one table. That's the view you check before deciding who to remind.",
  },
  {
    icon: Layers,
    title: 'Credits that count themselves',
    body: 'Add classes in whatever size you sell them: ten at a time, a month at a time, or a whole workshop. The balance drops by one each time a class is confirmed, never by hand and never twice for the same class.',
  },
  {
    icon: CalendarRange,
    title: 'Weekly classes and workshops, side by side',
    body: 'A student on your Saturday class and your summer intensive has two separate balances, shown as two cards. A workshop sold as ten that runs to thirteen shows "3 over" rather than blocking the eleventh.',
  },
  {
    icon: ShieldCheck,
    title: 'Payments stay off the platform',
    body: "A family uploads a screenshot of what they paid; you tap 'received.' No gateway, no card numbers. Your students' money never passes through us.",
  },
  {
    icon: Users,
    title: 'One sign-in for the whole family',
    body: 'A parent manages every child from one account. A student old enough to sign in for themselves keeps their own too, so nobody loses access when they want to check their balance directly.',
  },
  {
    icon: CalendarCheck,
    title: 'Nobody has to remember alone',
    body: 'A student can mark a class they forgot, up to a month later. It waits in your review queue, and no credit moves until you say so. Or you can mark it yourself in one tap, confirmed on the spot.',
  },
  {
    icon: Smartphone,
    title: 'Installed like an app',
    body: "Add it to your phone's home screen from the browser. No app store, no update to wait for.",
  },
];

/**
 * The roster, drawn rather than screenshotted.
 *
 * The whole pitch is "one glance shows every balance", and a page that only *says* that is
 * asking to be taken on trust. Real markup rather than an image because it stays sharp, reflows
 * on a phone, reads to a screen reader, and cannot go stale against a redesign the way a PNG
 * exported once does. The columns are the real ones from `/teaching/:id`.
 */
const SAMPLE_ROSTER = [
  { name: 'Anjana R.', lastClass: 'Sat, 1 Aug', lastPaid: '4 Jul', left: 6, low: false },
  { name: 'Karthik S.', lastClass: 'Sat, 1 Aug', lastPaid: '12 Jun', left: 1, low: true },
  { name: 'Meera V.', lastClass: 'Tue, 14 Jul', lastPaid: '2 Aug', left: 9, low: false },
  { name: 'Nikhil P.', lastClass: 'Sat, 1 Aug', lastPaid: '—', left: -2, low: true },
];

function RosterPreview() {
  return (
    <figure className="m-0">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">
            An example of the roster a teacher sees, with four students.
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Name
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                Last class
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                Last paid
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                Classes left
              </th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ROSTER.map(row => (
              <tr key={row.name} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-primary whitespace-nowrap">{row.name}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {row.lastClass}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {row.lastPaid}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {row.low ? (
                    <span className="inline-block rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">
                      {row.left < 0 ? `${Math.abs(row.left)} over` : row.left}
                    </span>
                  ) : (
                    row.left
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-3 text-center text-sm text-muted-foreground">
        Karthik is down to his last class and hasn't paid since June. Nikhil has run two over. You
        knew that in about a second. That's the whole product.
      </figcaption>
    </figure>
  );
}

const STEPS = [
  {
    title: 'Sign in with Google',
    body: 'Set up your teaching profile in a few taps. No password to remember.',
  },
  {
    title: 'Add your class and your students',
    body: 'One-on-one or a whole group. Each family gets an invite by email.',
  },
  {
    title: 'Add classes, mark attendance',
    body: 'However you sell them. Every confirmed class counts down from what you added.',
  },
  {
    title: 'See who needs a nudge',
    body: "Your roster shows exactly who's low on classes or behind on payment.",
  },
];

const FAQS = [
  {
    question: 'Do you process payments?',
    answer:
      'No. A family uploads a screenshot of what they paid you directly, and you confirm you received it. Rasika Classes never touches a card number or a bank account.',
  },
  {
    question: 'Is this only for schools with many students?',
    answer:
      'No. A one-on-one class works the same way as a group of twenty. Rasika Classes was built around the solo teacher first.',
  },
  {
    question: 'I charge monthly, not by the class. Does this still work?',
    answer:
      "Yes. A pack is however many classes you're adding at once, so a month's worth is just a pack the size of a month. The count is what the app tracks; what you charge for it stays between you and the family.",
  },
  {
    question: 'What happens if a student forgets to mark a class?',
    answer: "You mark it for them. One tap, and it's already confirmed.",
  },
  {
    question: 'What do you keep about my students, especially children?',
    answer:
      "A first name, a last initial, and whether they're a minor. No date of birth, photo, phone number, or address. And nothing here is ever indexed or made public.",
  },
  {
    question: 'Do I need to download anything?',
    answer:
      "No app store. Sign in from your phone's browser and add it to your home screen. From there it opens and behaves like an app.",
  },
];

export default function ClassesLandingPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <section className="centered-section">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">
          Rasika Classes
        </p>
        <h1 className="hero-title max-w-3xl mx-auto">
          Who's out of classes? Who hasn't paid? Who hasn't shown up in weeks?
        </h1>
        <p className="hero-description">
          Rasika Classes keeps that register for you. One glance shows every student's balance, last
          class, and last payment. No payment gateway, no card details. Just the record.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <a
              href={CLASSES_SIGNUP_URL}
              onClick={() => trackEvent(AnalyticsEvent.CLASSES_CTA_CLICK, { placement: 'hero' })}
            >
              Set Up Your Class List
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>
        {/* The header's "Login" signs into the wiki, not Classes. Naming the destination here
            costs a line and saves a teacher wondering why she is looking at compositions. */}
        <p className="mt-4 text-sm text-muted-foreground">
          Opens classes.rasika.life, where Rasika Classes has its own sign-in.
        </p>
      </section>

      <section className="mb-14">
        <h2 className="section-heading text-center">The whole thing, in one screen</h2>
        <RosterPreview />
      </section>

      <section className="mb-14">
        <h2 className="section-heading text-center">Built for how you actually teach</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(feature => (
            <Card key={feature.title}>
              <CardContent className="pt-6">
                <feature.icon className="h-6 w-6 text-primary mb-3" aria-hidden="true" />
                <h3 className="font-semibold mb-2 mt-0">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="mb-14 scroll-mt-20">
        <h2 className="section-heading text-center">How it works</h2>
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="text-center">
              <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                {index + 1}
              </div>
              <h3 className="font-semibold mb-2 mt-0">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-14 max-w-3xl mx-auto">
        <h2 className="section-heading text-center">Questions teachers ask</h2>
        <div className="space-y-6">
          {FAQS.map(faq => (
            <div key={faq.question}>
              <h3 className="font-semibold mb-1 mt-0">{faq.question}</h3>
              <p className="text-sm text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="centered-section bg-accent rounded-lg py-12 px-4">
        <h2 className="section-heading">Start your class list</h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Sign in with Google and add your first student in under five minutes.
        </p>
        <Button asChild size="lg">
          <a
            href={CLASSES_SIGNUP_URL}
            onClick={() => trackEvent(AnalyticsEvent.CLASSES_CTA_CLICK, { placement: 'footer' })}
          >
            Set Up Your Class List
          </a>
        </Button>
      </section>

      <FaqStructuredData faqs={FAQS} />
    </main>
  );
}
