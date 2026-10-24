import { Heading, Link, Text } from '@react-email/components';
import { Button } from './components/button';
import { EmailLayout } from './components/layout';

export interface EventApprovedEmailProps {
  eventTitle: string;
  /** Already formatted in the event's own zone: the template knows no time zones. */
  when: string;
  venueName?: string;
  eventUrl: string;
  /** The after-submit page, which holds the WhatsApp text for a live event. */
  shareUrl: string;
  myEventsUrl: string;
  siteUrl: string;
}

export default function EventApprovedEmail({
  eventTitle,
  when,
  venueName,
  eventUrl,
  shareUrl,
  myEventsUrl,
  siteUrl,
}: EventApprovedEmailProps) {
  return (
    <EmailLayout preview={`${eventTitle} is live`} appUrl={siteUrl} appName="Rasika.life">
      <Heading style={heading}>Your event is live</Heading>
      <Text style={paragraph}>
        <strong>{eventTitle}</strong>
        <br />
        {when}
        {venueName ? ` · ${venueName}` : ''}
      </Text>
      <Text style={paragraph}>
        It now shows on the concerts page, and on the venue and organiser pages.
      </Text>
      <Button href={eventUrl}>See your event</Button>
      <Text style={paragraph}>
        To tell people about it, <Link href={shareUrl}>get the text for WhatsApp</Link>. It has the
        date, the venue, the performers and a link.
      </Text>
      <Text style={muted}>
        Everything you have added is on <Link href={myEventsUrl}>My events</Link>.
      </Text>
    </EmailLayout>
  );
}

EventApprovedEmail.PreviewProps = {
  eventTitle: 'Vocal concert by Savita Vasu',
  when: 'Sat, 1 Nov, 6:00 pm',
  venueName: 'Bangalore Gayana Samaja',
  eventUrl: 'https://rasika.life/events/vocal-concert-by-savita-vasu-abc',
  shareUrl: 'https://rasika.life/events/new/submitted?eventId=abc',
  myEventsUrl: 'https://rasika.life/my-events',
  siteUrl: 'https://rasika.life',
} satisfies EventApprovedEmailProps;

const heading = {
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '32px',
  margin: '0 0 16px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const muted = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '16px 0 0',
};
