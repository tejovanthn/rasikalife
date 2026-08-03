import { describe, expect, it } from 'vitest';
import { studentAddedEmail } from './index';

const base = {
  learnerName: 'Meera',
  guruName: 'Priya Raman',
  institutionName: "Priya Raman's Bharatanatyam Classes",
  programTitle: 'Saturday Bharatanatyam',
  recipientEmail: 'meeras.parent@gmail.com',
  signInUrl: 'https://classes.rasika.life/',
} as const;

describe('studentAddedEmail', () => {
  it('names the learner when a guardian was invited', async () => {
    const email = await studentAddedEmail({ ...base, relation: 'guardian' });
    expect(email.subject).toBe('Priya Raman added Meera to Saturday Bharatanatyam');
    expect(email.html).toContain('Meera');
    expect(email.html).toContain(base.signInUrl);
    expect(email.html).toContain(base.recipientEmail);
    expect(email.text).toContain('Meera');
    expect(email.text).not.toContain('<');
  });

  it('addresses the student directly when the invite is for themself', async () => {
    const email = await studentAddedEmail({ ...base, relation: 'self' });
    expect(email.subject).toBe('Priya Raman added you to Saturday Bharatanatyam');
    expect(email.html).not.toContain('Meera');
  });
});
