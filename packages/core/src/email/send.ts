import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const sesClient = new SESv2Client({ region: process.env.AWS_REGION || 'us-east-1' });

/** Only Rasika Classes sends transactional email today; rename this when a second sender does. */
const APP_NAME = 'Rasika Classes';

/**
 * `EMAIL_SENDER` is whatever `sst.aws.Email` verified — see `infra/email.ts`, where it is the
 * `classes` subdomain. A verified domain can send from any address on it; a single verified
 * address cannot, so it is used as-is.
 *
 * Exported for its test. It throws rather than defaulting: an unset variable would otherwise
 * build the malformed `noreply@`, and SES's rejection of that names neither the variable nor the
 * missing resource link.
 */
export function getFromAddress(): string {
  const sender = process.env.EMAIL_SENDER;
  if (!sender) {
    throw new Error('EMAIL_SENDER is unset — link the Email resource to this function');
  }
  const address = sender.includes('@') ? sender : `noreply@${sender}`;
  return `${APP_NAME} <${address}>`;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /**
   * Where a reply goes, since the From address is an unattended `noreply@`. Worth setting on
   * anything a person would naturally answer.
   */
  replyTo?: string;
}

/**
 * Transactional email only: an account or roster change the recipient needs to know about.
 * There is no marketing sender here and no opt-in to check — Rasika Classes has no mailing
 * list, and this must not grow one under a different name. A marketing stream needs its own
 * verified subdomain; `infra/email.ts` explains why sharing this one would break delivery here.
 */
export async function sendTransactional(input: SendEmailInput): Promise<void> {
  await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: getFromAddress(),
      Destination: { ToAddresses: [input.to] },
      ReplyToAddresses: input.replyTo ? [input.replyTo] : undefined,
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
