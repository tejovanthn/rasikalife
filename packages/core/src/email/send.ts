import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const sesClient = new SESv2Client({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * The display name when a caller names none. Rasika Classes was the first sender; the event
 * approval email sends as Rasika.life from the same verified identity. Both are transactional,
 * which is the line `infra/email.ts` draws: a marketing stream would need its own subdomain.
 */
const DEFAULT_FROM_NAME = 'Rasika Classes';

/**
 * `EMAIL_SENDER` is whatever `sst.aws.Email` verified — see `infra/email.ts`, where it is the
 * `mail` subdomain. A verified domain can send from any address on it; a single verified
 * address cannot, so it is used as-is.
 *
 * Exported for its test. It throws rather than defaulting: an unset variable would otherwise
 * build the malformed `noreply@`, and SES's rejection of that names neither the variable nor the
 * missing resource link.
 */
export function getFromAddress(fromName: string = DEFAULT_FROM_NAME): string {
  const sender = process.env.EMAIL_SENDER;
  if (!sender) {
    throw new Error('EMAIL_SENDER is unset — link the Email resource to this function');
  }
  const address = sender.includes('@') ? sender : `noreply@${sender}`;
  return `${fromName} <${address}>`;
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
  /** The From display name; the address is always the verified sender. */
  fromName?: string;
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
      FromEmailAddress: getFromAddress(input.fromName),
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

/** Digest and reminder mail send as this display name from `concerts@<NOTIFY_EMAIL_SENDER>`. */
const NOTIFY_FROM_NAME = 'rasika.life';
/** Replies go to a real mailbox on the root domain, whatever stage sends. */
export const NOTIFY_REPLY_TO = 'hello@rasika.life';

export function getNotifyFromAddress(): string {
  const sender = process.env.NOTIFY_EMAIL_SENDER;
  if (!sender) {
    throw new Error('NOTIFY_EMAIL_SENDER is unset: link the NotifyEmail resource to this function');
  }
  const address = sender.includes('@') ? sender : `concerts@${sender}`;
  return `${NOTIFY_FROM_NAME} <${address}>`;
}

export interface SendBulkInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** The https one-click link. It is the whole `List-Unsubscribe` header. */
  unsubscribeUrl: string;
}

/** The one-click unsubscribe headers (RFC 8058): the https URL alone, and the Post marker. */
export function listUnsubscribeHeaders(
  unsubscribeUrl: string
): Array<{ Name: string; Value: string }> {
  return [
    { Name: 'List-Unsubscribe', Value: `<${unsubscribeUrl}>` },
    { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
  ];
}

/**
 * Digest and reminder mail, from the root-domain identity (never the `mail.` one: see
 * `infra/email.ts`). Every message carries `List-Unsubscribe` (https only; nothing processes a
 * mailto) and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058), which Gmail needs
 * from a bulk sender.
 * SESv2 `Content.Simple.Headers` carries them without building raw MIME.
 */
export async function sendBulk(input: SendBulkInput): Promise<void> {
  await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: getNotifyFromAddress(),
      Destination: { ToAddresses: [input.to] },
      ReplyToAddresses: [NOTIFY_REPLY_TO],
      ConfigurationSetName: process.env.NOTIFY_EMAIL_CONFIG_SET || undefined,
      Content: {
        Simple: {
          Subject: { Data: input.subject },
          Body: { Html: { Data: input.html }, Text: { Data: input.text } },
          Headers: listUnsubscribeHeaders(input.unsubscribeUrl),
        },
      },
    })
  );
}
