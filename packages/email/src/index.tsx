import type { ClassLearnerAccess } from '@rasika/core';
import { render } from '@react-email/render';
import StudentAddedEmail from '../emails/student-added';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

async function renderBoth(element: React.ReactElement): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}

export interface StudentAddedEmailInput {
  learnerName: string;
  guruName: string;
  institutionName: string;
  programTitle: string;
  relation: ClassLearnerAccess.AccessRelation;
  recipientEmail: string;
  signInUrl: string;
}

/**
 * The guru added a learner and named an account to watch it. Sent once, at `addLearner` —
 * see `packages/trpc/src/routers/classes.ts`.
 */
export async function studentAddedEmail(input: StudentAddedEmailInput): Promise<EmailContent> {
  const who = input.relation === 'self' ? 'you' : input.learnerName;
  return {
    subject: `${input.guruName} added ${who} to ${input.programTitle}`,
    ...(await renderBoth(<StudentAddedEmail {...input} />)),
  };
}
