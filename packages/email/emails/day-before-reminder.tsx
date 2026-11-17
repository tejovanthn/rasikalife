import { Text } from 'react-email';
import { Button } from './components/button';
import { EmailLayout } from './components/layout';
import { NotifyFooter } from './components/notify-footer';
import type { NotifyFooterProps } from './components/notify-footer';

export interface ReminderEventLine {
  /** `{eventTitle}, {time} at {venueName}.` The reason is added after it. */
  line: string;
  reason?: string;
  url: string;
}

export interface DayBeforeReminderEmailProps extends NotifyFooterProps {
  preheader: string;
  events: ReminderEventLine[];
  siteUrl: string;
}

export default function DayBeforeReminderEmail({
  preheader,
  events,
  siteUrl,
  ...footer
}: DayBeforeReminderEmailProps) {
  return (
    <EmailLayout
      preview={preheader}
      appUrl={siteUrl}
      appName="rasika.life"
      footer={<NotifyFooter {...footer} />}
    >
      {events.map(event => (
        <div key={event.url} style={row}>
          <Text style={body}>
            {event.line}
            {event.reason ? ` ${event.reason}` : ''}
          </Text>
          <Button href={event.url}>View concert</Button>
        </div>
      ))}
    </EmailLayout>
  );
}

DayBeforeReminderEmail.PreviewProps = {
  preheader: 'Starts 6:00 pm at Narada Gana Sabha',
  events: [
    {
      line: 'Vocal concert by T.M. Krishna, 6:00 pm at Narada Gana Sabha.',
      reason: "You said you're going",
      url: 'https://rasika.life/events/abc',
    },
  ],
  siteUrl: 'https://rasika.life',
  manageUrl: 'https://rasika.life/me/following',
  turnOffUrl: 'https://rasika.life/unsubscribe/x',
  unsubscribeAllUrl: 'https://rasika.life/unsubscribe/y',
} satisfies DayBeforeReminderEmailProps;

const row = { margin: '0 0 20px' };
const body = { fontSize: '16px', lineHeight: '24px', margin: '0 0 12px' };
