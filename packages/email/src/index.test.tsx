import { describe, expect, it } from 'vitest';
import { eventApprovedEmail, partnerInviteEmail, studentAddedEmail } from './index';

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

describe('eventApprovedEmail', () => {
  const event = {
    eventId: '2abcDEF',
    eventTitle: 'Vocal concert by Savita Vasu',
    startDateTime: '2026-11-01T12:30:00Z',
    timezone: 'Asia/Kolkata',
    venueName: 'Bangalore Gayana Samaja',
    siteUrl: 'https://dev.rasika.life/',
  };

  it('links the event, the share text and My events on the stage it was sent from', async () => {
    const email = await eventApprovedEmail(event);
    expect(email.subject).toBe('Your event is live: Vocal concert by Savita Vasu');
    expect(email.html).toContain('https://dev.rasika.life/events/2abcDEF');
    expect(email.html).toContain('https://dev.rasika.life/events/new/submitted?eventId=2abcDEF');
    expect(email.html).toContain('https://dev.rasika.life/my-events');
    expect(email.text).not.toContain('//rasika.life');
  });

  it("states the time in the event's own zone, not the server's", async () => {
    const email = await eventApprovedEmail(event);
    // 12:30Z is 6:00 pm in India; the Lambda runs in UTC.
    expect(email.text).toMatch(/6:00\s?pm/i);
  });

  it('sends as Rasika.life, not Rasika Classes', async () => {
    const email = await eventApprovedEmail(event);
    expect(email.html).toContain('Rasika.life');
    expect(email.html).not.toContain('Rasika Classes');
  });
});

describe('partnerInviteEmail', () => {
  const input = {
    inviterName: 'Tejovanth',
    targetName: 'Bangalore Gayana Samaja',
    inviteeEmail: 'secretary@example.org',
    sabhaUrl: 'https://sabha.rasika.life/',
    siteUrl: 'https://rasika.life',
  };

  it('uses the Copy subject, body, button and footnote', async () => {
    const email = await partnerInviteEmail(input);
    expect(email.subject).toBe("You're invited to manage Bangalore Gayana Samaja on rasika.life");
    expect(email.text).toContain(
      "Tejovanth has invited you to manage Bangalore Gayana Samaja on rasika.life. You'll see who follows Bangalore Gayana Samaja, how your QR codes are doing, and you can keep your details and concerts up to date. Sign in with Google using secretary@example.org to accept."
    );
    expect(email.html).toContain('Accept invite');
    expect(email.text).toContain('This invite expires in 14 days.');
  });

  it('links to the dashboard invite page with the address encoded', async () => {
    const email = await partnerInviteEmail(input);
    expect(email.html).toContain('https://sabha.rasika.life/invite?email=secretary%40example.org');
  });

  it('has no em dash', async () => {
    const email = await partnerInviteEmail(input);
    expect(email.html + email.text).not.toContain('\u2014');
  });
});
