import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const sesClient = new SESv2Client({ region: process.env.AWS_REGION || 'us-east-1' });

/** Only Rasika Classes sends transactional email today; rename this when a second sender does. */
const APP_NAME = 'Rasika Classes';

/**
 * `EMAIL_SENDER` is the domain (or single address) `sst.aws.Email` verified — see
 * `infra/email.ts`. A bare domain can send from any address on it; a single verified address
 * cannot, so it is used as-is.
 */
function getFromAddress(): string {
  const sender = process.env.EMAIL_SENDER || '';
  const address = sender.includes('@') ? sender : `noreply@${sender}`;
  return `${APP_NAME} <${address}>`;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Transactional email only: an account or roster change the recipient needs to know about.
 * There is no marketing sender here and no opt-in to check — Rasika Classes has no mailing
 * list, and this must not grow one under a different name.
 */
export async function sendTransactional(input: SendEmailInput): Promise<void> {
  await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: getFromAddress(),
      Destination: { ToAddresses: [input.to] },
      Content: {
        Simple: {
          Subject: { Data: input.subject },
          Body: {
            Html: { Data: input.html },
            ...(input.text ? { Text: { Data: input.text } } : {}),
          },
        },
      },
    })
  );
}
