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

  /** Case-insensitive because the plain-text renderer upper-cases headings. A case-sensitive
   * negative here would pass even with the bug present. */
  it('never tells a guardian that they were added to the class', async () => {
    const email = await studentAddedEmail({ ...base, relation: 'guardian' });
    expect(email.text).toMatch(/Meera has been added to a class/i);
    expect(email.text).not.toMatch(/You've been added/i);
  });

  /**
   * The footer domain used to be hardcoded to production, so a dev-stage email pointed its
   * button at the stage and its footer at the live site.
   */
  it('takes the footer link from the stage URL rather than hardcoding production', async () => {
    const email = await studentAddedEmail({
      ...base,
      relation: 'guardian',
      signInUrl: 'https://classes.dev.rasika.life',
    });
    expect(email.html).toContain('https://classes.dev.rasika.life');
    // Not a substring of the dev host, so this catches a reintroduced hardcoded production link.
    expect(email.html).not.toContain('//classes.rasika.life');
    expect(email.text).not.toContain('//classes.rasika.life');
  });
});
