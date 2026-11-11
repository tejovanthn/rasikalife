import { database } from './database';
import { getDomain } from './domain';

// Venue QR Follow, phase 5: the weekly digest, the day-before reminder, and the second SES
// identity they send from. See the note in infra/email.ts on why this is not the `mail.` one.

/** Signs unsubscribe links (decisions.md #3). Set with `sst secret set UnsubscribeSecret <value>`. */
export const unsubscribeSecret = new sst.Secret('UnsubscribeSecret');

/**
 * Web push (phase 7). Generate the pair with `npx web-push generate-vapid-keys`, then
 * `sst secret set VapidPublicKey <public>` and `sst secret set VapidPrivateKey <private>`.
 * The public key is not secret: it goes to the browser for `PushManager.subscribe` (RasikaWeb
 * reads it through its environment). The private key is linked only to the reminder cron.
 */
export const vapidPublicKey = new sst.Secret('VapidPublicKey');
export const vapidPrivateKey = new sst.Secret('VapidPrivateKey');

const { name: sender, dns } = getDomain();

const bounceTopic = new sst.aws.SnsTopic('NotifyEmailBounceTopic');
const complaintTopic = new sst.aws.SnsTopic('NotifyEmailComplaintTopic');

/**
 * Digest and reminder mail: `rasika.life <concerts@rasika.life>` in prod, and
 * `concerts@<stage>.rasika.life` on a dev stage. The root domain, so DKIM records are written
 * for it (and `_dmarc.rasika.life`: see the runbook in CLAUDE.md). Its own configuration set,
 * with bounce and complaint events going to SNS.
 */
export const notifyEmail = new sst.aws.Email('NotifyEmail', {
  sender,
  dns,
  events: [
    { name: 'bounce', types: ['bounce'], topic: bounceTopic.arn },
    { name: 'complaint', types: ['complaint'], topic: complaintTopic.arn },
  ],
});

// SES publishes to the topic as a service, so each topic needs a policy that allows it.
const account = aws.getCallerIdentityOutput();
for (const [name, topic] of [
  ['Bounce', bounceTopic],
  ['Complaint', complaintTopic],
] as const) {
  new aws.sns.TopicPolicy(`NotifyEmail${name}TopicPolicy`, {
    arn: topic.arn,
    policy: $jsonStringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'ses.amazonaws.com' },
          Action: 'sns:Publish',
          Resource: topic.arn,
          Condition: { StringEquals: { 'AWS:SourceAccount': account.accountId } },
        },
      ],
    }),
  });
}

const notifyEnvironment = {
  DYNAMODB_TABLE: database.name,
  AWS_REGION: undefined,
  NOTIFY_EMAIL_SENDER: notifyEmail.sender,
  NOTIFY_EMAIL_CONFIG_SET: notifyEmail.configSet,
  UNSUBSCRIBE_SECRET: unsubscribeSecret.value,
  SITE_URL: `https://${getDomain().name}`,
};

// Hard bounce or complaint: `notifyEmail = false` for that address.
const emailEvents = { handler: 'packages/scripts/src/notifyCrons.emailEventsHandler' };
bounceTopic.subscribe('NotifyEmailBounceHandler', {
  ...emailEvents,
  link: [database],
  environment: { DYNAMODB_TABLE: database.name, AWS_REGION: undefined },
});
complaintTopic.subscribe('NotifyEmailComplaintHandler', {
  ...emailEvents,
  link: [database],
  environment: { DYNAMODB_TABLE: database.name, AWS_REGION: undefined },
});

// Sunday 18:00 IST. SST cron expressions are UTC: 12:30Z is 18:00 in India.
new sst.aws.Cron('NotifyDigestCron', {
  schedule: 'cron(30 12 ? * SUN *)',
  job: {
    handler: 'packages/scripts/src/notifyCrons.digestHandler',
    link: [database, notifyEmail, unsubscribeSecret],
    memory: '1024 MB',
    timeout: '600 seconds',
    environment: notifyEnvironment,
  },
});

// Daily 18:00 IST. Each event's "tomorrow" is read in the event's own zone, not this one.
new sst.aws.Cron('NotifyReminderCron', {
  schedule: 'cron(30 12 * * ? *)',
  job: {
    handler: 'packages/scripts/src/notifyCrons.reminderHandler',
    link: [database, notifyEmail, unsubscribeSecret, vapidPrivateKey],
    memory: '1024 MB',
    timeout: '600 seconds',
    environment: {
      ...notifyEnvironment,
      VAPID_PUBLIC_KEY: vapidPublicKey.value,
      VAPID_PRIVATE_KEY: vapidPrivateKey.value,
    },
  },
});
