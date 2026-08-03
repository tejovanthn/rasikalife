import { CalendarCheck, Layers, Rows3, ShieldCheck, Smartphone, Users } from 'lucide-react';
import type { MetaFunction } from 'react-router';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { serializeJsonLd } from '~/lib/json-ld';

const CLASSES_APP_URL = 'https://classes.rasika.life';

export const meta: MetaFunction = () => {
  return [
    { title: 'Rasika Classes — Attendance & Class Credits for Music and Dance Teachers' },
    {
      name: 'description',
      content:
        'A class register built for Indian classical music and dance teachers. Track attendance and class credits, and see who has paid — without a payment gateway.',
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
        'The class register for music and dance teachers: attendance, class packs, and payments received — no gateway, no fees.',
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
    body: "See every student's classes left, last class, and last payment in a single table — the view you need when deciding who to remind.",
  },
  {
    icon: Layers,
    title: 'Credits that count themselves',
    body: 'Sell a pack of ten classes, and the balance drops by one each time a class is confirmed — never by hand, and never twice for the same class.',
  },
  {
    icon: ShieldCheck,
    title: 'Payments stay off the platform',
    body: "A family uploads a screenshot of what they paid; you tap 'received.' No gateway, no card numbers — nothing that puts your students' money through us.",
  },
  {
    icon: Users,
    title: 'One sign-in for the whole family',
    body: 'A parent manages every child from one account. A student old enough to sign in for themselves keeps their own — nobody loses access when they want to check their own balance too.',
  },
  {
    icon: CalendarCheck,
    title: 'Nobody has to remember alone',
    body: 'A student can mark a class up to a month late. You can mark one on the spot for the days they forget — confirmed straight away, since you taught it.',
  },
  {
    icon: Smartphone,
    title: 'Installed like an app',
    body: "Add it to your phone's home screen from the browser. No app store, no update to wait for.",
  },
];

const STEPS = [
  {
    title: 'Sign in with Google',
    body: 'Set up your teaching profile in a few taps. No password to remember.',
  },
  {
    title: 'Add your class and your students',
    body: 'One-on-one or a whole group — each family gets an invite by email.',
  },
  {
    title: 'Sell a pack, mark a class',
    body: 'Every confirmed class counts down from the pack it came from.',
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
      'No. A one-on-one class works the same way as a group of twenty — Rasika Classes was built around the solo teacher first.',
  },
  {
    question: 'What happens if a student forgets to mark a class?',
    answer:
      "You can mark it for them, on the spot. It's confirmed straight away, since you're the one recording it.",
  },
  {
    question: 'What do you keep about my students, especially children?',
    answer:
      "A first name, a last initial, and whether they're a minor. No date of birth, photo, phone number, or address — and nothing here is ever indexed or made public.",
  },
  {
    question: 'Do I need to download anything?',
    answer:
      "No app store. Sign in from your phone's browser and add it to your home screen — it opens and behaves like an app from there.",
  },
];

function ClassesFaqStructuredData() {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD structured data
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQS.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer },
          })),
        }),
      }}
    />
  );
}

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
          class, and last payment — no payment gateway, no card details, nothing but the record.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <a href={CLASSES_APP_URL}>Set Up Your Class List</a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>
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
          <a href={CLASSES_APP_URL}>Set Up Your Class List</a>
        </Button>
      </section>

      <ClassesFaqStructuredData />
    </main>
  );
}
