import { describe, expect, it } from 'vitest';
import { FOR_SABHAS_COPY } from './for-sabhas';
import { isHoneypotFilled, parseSabhaRequestForm, sabhaOrigin } from './for-sabhas-form';
import { STATIC_SITEMAP_PAGES } from './sitemap-static';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const good = {
  venueName: ' Bangalore Gayana Samaja ',
  contactName: 'R. Srinivasan',
  role: '',
  whatsapp: '+91 98765 43210',
  concertDates: '',
};

describe('parseSabhaRequestForm', () => {
  it('accepts a valid form, trims, and leaves blank optional fields out', () => {
    const result = parseSabhaRequestForm(form(good));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request).toEqual({
      venueName: 'Bangalore Gayana Samaja',
      contactName: 'R. Srinivasan',
      whatsapp: '9876543210',
    });
  });

  it('keeps optional text when given', () => {
    const result = parseSabhaRequestForm(
      form({ ...good, role: 'Secretary', concertDates: '22 Dec' })
    );
    expect(result.ok && result.request).toMatchObject({
      role: 'Secretary',
      concertDates: '22 Dec',
    });
  });

  it('requires the sabha name, your name and a number, and says all at once', () => {
    const result = parseSabhaRequestForm(
      form({ ...good, venueName: '  ', contactName: '', whatsapp: '' })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual({
      venueName: FOR_SABHAS_COPY.errors.venueName,
      contactName: FOR_SABHAS_COPY.errors.contactName,
      whatsapp: FOR_SABHAS_COPY.errors.whatsapp,
    });
  });

  it.each(['12345', '5876543210', '98765 4321', 'abcdefghij', '+1 9876543210'])(
    'refuses the number %s',
    whatsapp => {
      const result = parseSabhaRequestForm(form({ ...good, whatsapp }));
      expect(result.ok).toBe(false);
    }
  );

  it('refuses text past the limits', () => {
    const result = parseSabhaRequestForm(
      form({ ...good, role: 'x'.repeat(81), concertDates: 'y'.repeat(501) })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.role).toBe(FOR_SABHAS_COPY.errors.tooLong);
    expect(result.errors.concertDates).toBe(FOR_SABHAS_COPY.errors.tooLong);
  });

  it('hands the typed values back for redisplay', () => {
    const result = parseSabhaRequestForm(form({ ...good, whatsapp: '123' }));
    expect(result.values.venueName).toBe('Bangalore Gayana Samaja');
    expect(result.values.whatsapp).toBe('123');
  });
});

describe('isHoneypotFilled', () => {
  it('is true only when the hidden field has text', () => {
    expect(isHoneypotFilled(form({ website: 'http://spam.example' }))).toBe(true);
    expect(isHoneypotFilled(form({ website: '  ' }))).toBe(false);
    expect(isHoneypotFilled(form({}))).toBe(false);
  });
});

describe('sabhaOrigin', () => {
  it('sits beside the site, for prod and for a stage', () => {
    expect(sabhaOrigin('https://rasika.life/for-sabhas')).toBe('https://sabha.rasika.life');
    expect(sabhaOrigin('https://www.rasika.life/')).toBe('https://sabha.rasika.life');
    expect(sabhaOrigin('https://dev.rasika.life/')).toBe('https://sabha.dev.rasika.life');
    expect(sabhaOrigin('http://localhost:5173/')).toBe('https://sabha.rasika.life');
  });
});

describe('FOR_SABHAS_COPY', () => {
  it('uses the owner wording verbatim', () => {
    expect(FOR_SABHAS_COPY.headline).toBe('Free QR codes for your sabha');
    expect(FOR_SABHAS_COPY.points).toEqual([
      'Rasikas scan and follow you',
      'You get your follower list, with WhatsApp numbers they chose to share',
      'We print and set up the codes',
    ]);
    expect(FOR_SABHAS_COPY.labels).toEqual({
      venueName: 'Sabha or venue name',
      contactName: 'Your name',
      role: 'Role',
      whatsapp: 'WhatsApp number',
      concertDates: 'Upcoming concert dates',
    });
    expect(FOR_SABHAS_COPY.thanks).toBe("Thanks. We'll message you on WhatsApp within two days.");
  });

  it('fits search results, with a title under 60 and a description under 160', () => {
    expect(FOR_SABHAS_COPY.metaTitle.length).toBeLessThanOrEqual(60);
    expect(FOR_SABHAS_COPY.metaDescription.length).toBeLessThanOrEqual(160);
  });

  it('has no em dash anywhere', () => {
    expect(JSON.stringify(FOR_SABHAS_COPY)).not.toContain('—');
  });
});

describe('sitemap-static.xml', () => {
  it('lists /for-sabhas once', () => {
    expect(STATIC_SITEMAP_PAGES.filter(p => p.path === '/for-sabhas')).toHaveLength(1);
  });
});
