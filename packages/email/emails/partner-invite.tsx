import { Heading, Text } from '@react-email/components';
import { Button } from './components/button';
import { EmailLayout } from './components/layout';

export interface PartnerInviteEmailProps {
  inviterName: string;
  targetName: string;
  inviteeEmail: string;
  acceptUrl: string;
  siteUrl: string;
}

/**
 * One person's invite to manage a sabha or venue. Strings are verbatim from the Copy tab
 * ("Invite email"). Sent by a moderator, not in bulk.
 */
export default function PartnerInviteEmail({
  inviterName,
  targetName,
  inviteeEmail,
  acceptUrl,
  siteUrl,
}: PartnerInviteEmailProps) {
  return (
    <EmailLayout
      preview={`You're invited to manage ${targetName} on rasika.life`}
      appUrl={siteUrl}
      appName="Rasika.life"
    >
      <Heading style={heading}>{`You're invited to manage ${targetName} on rasika.life`}</Heading>
      <Text style={paragraph}>
        {`${inviterName} has invited you to manage ${targetName} on rasika.life. You'll see who follows ${targetName}, how your QR codes are doing, and you can keep your details and concerts up to date. Sign in with Google using ${inviteeEmail} to accept.`}
      </Text>
      <Button href={acceptUrl}>Accept invite</Button>
      <Text style={muted}>This invite expires in 14 days.</Text>
    </EmailLayout>
  );
}

PartnerInviteEmail.PreviewProps = {
  inviterName: 'Tejovanth',
  targetName: 'Bangalore Gayana Samaja',
  inviteeEmail: 'secretary@example.org',
  acceptUrl: 'https://sabha.rasika.life/invite?email=secretary%40example.org',
  siteUrl: 'https://rasika.life',
} satisfies PartnerInviteEmailProps;

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
