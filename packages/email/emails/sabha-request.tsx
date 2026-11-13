import { Heading, Text } from '@react-email/components';
import { EmailLayout } from './components/layout';

export interface SabhaRequestEmailProps {
  venueName: string;
  contactName: string;
  role?: string;
  whatsapp: string;
  concertDates?: string;
  siteUrl: string;
}

/**
 * A request from `rasika.life/for-sabhas`, sent to the team only. Internal, so the wording is
 * plain and not in the Copy tab.
 */
export default function SabhaRequestEmail({
  venueName,
  contactName,
  role,
  whatsapp,
  concertDates,
  siteUrl,
}: SabhaRequestEmailProps) {
  return (
    <EmailLayout preview={`QR request from ${venueName}`} appUrl={siteUrl} appName="Rasika.life">
      <Heading style={heading}>{`QR request from ${venueName}`}</Heading>
      <Text style={paragraph}>
        <strong>Sabha or venue:</strong> {venueName}
        <br />
        <strong>Name:</strong> {contactName}
        <br />
        <strong>Role:</strong> {role || 'Not given'}
        <br />
        <strong>WhatsApp:</strong> +91 {whatsapp}
        <br />
        <strong>Upcoming concert dates:</strong> {concertDates || 'Not given'}
      </Text>
      <Text style={paragraph}>Reply on WhatsApp within two days.</Text>
    </EmailLayout>
  );
}

SabhaRequestEmail.PreviewProps = {
  venueName: 'Bangalore Gayana Samaja',
  contactName: 'R. Srinivasan',
  role: 'Secretary',
  whatsapp: '9876543210',
  concertDates: '22 Dec, 24 Dec',
  siteUrl: 'https://rasika.life',
} satisfies SabhaRequestEmailProps;

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
