import type { ClassLearnerAccess } from '@rasika/core';
import { Heading, Text } from '@react-email/components';
import { Button } from './components/button';
import { EmailLayout } from './components/layout';

export interface StudentAddedEmailProps {
  learnerName: string;
  guruName: string;
  institutionName: string;
  programTitle: string;
  relation: ClassLearnerAccess.AccessRelation;
  recipientEmail: string;
  signInUrl: string;
}

export default function StudentAddedEmail({
  learnerName,
  guruName,
  institutionName,
  programTitle,
  relation,
  recipientEmail,
  signInUrl,
}: StudentAddedEmailProps) {
  const isSelf = relation === 'self';
  // A guardian was not added to anything; their child was. Saying "you" to them is simply wrong.
  const whoWasAdded = isSelf ? 'You have' : `${learnerName} has`;
  const preview = `${guruName} added ${isSelf ? 'you' : learnerName} to ${programTitle}`;

  return (
    <EmailLayout preview={preview} appUrl={signInUrl}>
      <Heading style={heading}>
        {isSelf ? "You've been added to a class" : `${learnerName} has been added to a class`}
      </Heading>
      <Text style={paragraph}>
        {guruName} at {institutionName} added {isSelf ? 'you' : learnerName} to{' '}
        <strong>{programTitle}</strong>.
      </Text>
      <Text style={paragraph}>
        {whoWasAdded} a place on the roster, so you can see the class schedule and how many classes
        are paid for.
      </Text>
      <Button href={signInUrl}>Open Rasika Classes</Button>
      <Text style={muted}>
        Sign in with Google using <strong>{recipientEmail}</strong>, the address {guruName} used to
        add {isSelf ? 'you' : learnerName}.
      </Text>
      <Text style={muted}>If you were not expecting this, you can ignore this email.</Text>
    </EmailLayout>
  );
}

StudentAddedEmail.PreviewProps = {
  learnerName: 'Meera',
  guruName: 'Priya Raman',
  institutionName: "Priya Raman's Bharatanatyam Classes",
  programTitle: 'Saturday Bharatanatyam',
  relation: 'guardian',
  recipientEmail: 'meeras.parent@gmail.com',
  signInUrl: 'https://classes.rasika.life/',
} satisfies StudentAddedEmailProps;

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
