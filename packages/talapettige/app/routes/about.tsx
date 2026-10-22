import { PageTitle, SectionTitle } from '@rasika/ui';

export function meta() {
  return [
    { title: 'About - Talapettige' },
    {
      name: 'description',
      content: 'About Talapettige - A web-based Indian Tanpura and Tala application',
    },
  ];
}

export default function About() {
  return (
    <article className="space-y-6">
      <PageTitle>About Talapettige</PageTitle>
      <section className="space-y-2">
        <SectionTitle>What is Talapettige?</SectionTitle>
        <p className="text-muted-foreground">
          Talapettige (ತಾಳಪೆಟ್ಟಿಗೆ) means "rhythm box" in Kannada. It's a web-based application that
          provides a digital Tanpura (Shruthi) and Tala metronome for practicing Indian classical
          music.
        </p>
      </section>

      <section className="space-y-2">
        <SectionTitle>Features</SectionTitle>
        <ul className="text-muted-foreground list-inside list-disc space-y-1">
          <li>Realistic Tanpura drone synthesis</li>
          <li>All 35 Carnatic Talas with customizable Jati</li>
          <li>Nadai subdivisions (Single to Sankeerna)</li>
          <li>Adjustable pitch with fine-tuning</li>
          <li>Beat visualization with muting</li>
          <li>Dynamic Sam/Non-Sam note based on first string</li>
          <li>Works offline once installed</li>
        </ul>
      </section>

      <section className="space-y-2">
        <SectionTitle>Carnatic Tala System</SectionTitle>
        <p className="text-muted-foreground">
          The Suladi Sapta Tala system consists of 7 base talas, each with 5 possible jatis (laghu
          lengths), giving 35 talas in total. The app also includes Misra Chapu and Khanda Chapu,
          commonly used in concerts.
        </p>
      </section>

      <section className="space-y-2">
        <SectionTitle>Technology</SectionTitle>
        <p className="text-muted-foreground">
          Built with React, Web Audio API, and AudioWorklet for low-latency, high-quality audio
          synthesis directly in your browser. No plugins required.
        </p>
      </section>
      <section className="space-y-2">
        <SectionTitle>Part of Rasika.life</SectionTitle>
        <p className="text-muted-foreground">
          Talapettige is a practice tool from{' '}
          <a className="text-primary underline" href="https://rasika.life">
            Rasika.life
          </a>
          , a community record of Indian classical music and dance. Install it from your browser's
          menu and it works with no connection.
        </p>
      </section>
    </article>
  );
}
