import { Link, Text } from '@react-email/components';

export interface NotifyFooterProps {
  manageUrl: string;
  turnOffUrl: string;
  unsubscribeAllUrl: string;
}

/** The footer every follow-based email carries. Wording is Copy's, verbatim. */
export function NotifyFooter({ manageUrl, turnOffUrl, unsubscribeAllUrl }: NotifyFooterProps) {
  return (
    <Text style={text}>
      You're getting this because you follow concerts on rasika.life.{' '}
      <Link href={manageUrl} style={link}>
        Manage what you follow
      </Link>
      {' · '}
      <Link href={turnOffUrl} style={link}>
        Turn off this email
      </Link>
      {' · '}
      <Link href={unsubscribeAllUrl} style={link}>
        Unsubscribe from all email
      </Link>
    </Text>
  );
}

const text = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 0 8px',
};

const link = { color: '#6b7280', textDecoration: 'underline' };
