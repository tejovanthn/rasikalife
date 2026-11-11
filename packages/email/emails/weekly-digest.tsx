import { Heading, Link, Text } from '@react-email/components';
import { Button } from './components/button';
import { EmailLayout } from './components/layout';
import { NotifyFooter } from './components/notify-footer';
import type { NotifyFooterProps } from './components/notify-footer';

export interface DigestEventLine {
  title: string;
  /** `Sat 16 Nov, 6:00 pm · Venue`, built by the caller in the event's own zone. */
  when: string;
  reason?: string;
  url: string;
}

export interface WeeklyDigestEmailProps extends NotifyFooterProps {
  preheader: string;
  events: DigestEventLine[];
  /** Set when the user has more events than are shown. */
  more?: { label: string; url: string };
  siteUrl: string;
}

export default function WeeklyDigestEmail({
  preheader,
  events,
  more,
  siteUrl,
  ...footer
}: WeeklyDigestEmailProps) {
  return (
    <EmailLayout
      preview={preheader}
      appUrl={siteUrl}
      appName="rasika.life"
      footer={<NotifyFooter {...footer} />}
    >
      <Heading style={heading}>Coming up in the next two weeks</Heading>
      {events.map(event => (
        <div key={event.url} style={row}>
          <Text style={title}>{event.title}</Text>
          <Text style={when}>{event.when}</Text>
          {event.reason ? <Text style={reason}>{event.reason}</Text> : null}
          <Link href={event.url} style={link}>
            View concert
          </Link>
        </div>
      ))}
      {more ? (
        <Button href={more.url}>{more.label}</Button>
      ) : null}
    </EmailLayout>
  );
}

WeeklyDigestEmail.PreviewProps = {
  preheader: '3 concerts from artists, sabhas and venues you follow',
  events: [
    {
      title: 'Vocal concert by T.M. Krishna',
      when: 'Sat 16 Nov, 6:00 pm · Narada Gana Sabha',
      reason: 'Because you follow T.M. Krishna and Narada Gana Sabha',
      url: 'https://rasika.life/events/abc',
    },
  ],
  more: { label: 'See all 18 concerts on rasika.life', url: 'https://rasika.life/events' },
  siteUrl: 'https://rasika.life',
  manageUrl: 'https://rasika.life/me/following',
  turnOffUrl: 'https://rasika.life/unsubscribe/x',
  unsubscribeAllUrl: 'https://rasika.life/unsubscribe/y',
} satisfies WeeklyDigestEmailProps;

const heading = { fontSize: '24px', fontWeight: '700', lineHeight: '32px', margin: '0 0 16px' };
const row = { borderBottom: '1px solid #e6e1db', padding: '0 0 12px', margin: '0 0 12px' };
const title = { fontSize: '16px', fontWeight: '600', lineHeight: '22px', margin: '0' };
const when = { fontSize: '14px', lineHeight: '20px', margin: '2px 0 0' };
const reason = { color: '#6b7280', fontSize: '13px', lineHeight: '18px', margin: '2px 0 0' };
const link = { color: '#c2410c', fontSize: '14px', fontWeight: '600' };
