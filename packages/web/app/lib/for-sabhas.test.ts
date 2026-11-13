import { describe, expect, it } from 'vitest';
import { FOR_SABHAS_COPY } from './for-sabhas';
import {
  buildSabhaMessage,
  parseSabhaRequestForm,
  sabhaOrigin,
  sabhaWhatsAppUrl,
} from './for-sabhas-form';
import { HELP_WHATSAPP_NUMBER } from './help-request';
import { STATIC_SITEMAP_PAGES } from './sitemap-static';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const good = {
  venueName: ' Bangalore Gayana Samaja ',
  role: '',
  whatsapp: '+91 98765 43210',
  email: ' secretary@example.org ',
};

describe('parseSabhaRequestForm', () => {
  it('accepts a valid form, trims, and leaves a blank role out', () => {
    const result = parseSabhaRequestForm(form(good));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request).toEqual({
      venueName: 'Bangalore Gayana Samaja',
      whatsapp: '9876543210',
      email: 'secretary@example.org',
    });
  });

  it('keeps the role when given', () => {
    const result = parseSabhaRequestForm(form({ ...good, role: 'Secretary' }));
    expect(result.ok && result.request).toMatchObject({ role: 'Secretary' });
  });

  it('requires the sabha name, a number and an email, and says all at once', () => {
    const result = parseSabhaRequestForm(form({ venueName: '  ', whatsapp: '', email: '' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual({
      venueName: FOR_SABHAS_COPY.errors.venueName,
      whatsapp: FOR_SABHAS_COPY.errors.whatsapp,
      email: FOR_SABHAS_COPY.errors.email,
    });
  });

  it.each(['12345', '5876543210', '98765 4321', 'abcdefghij', '+1 9876543210'])(
    'refuses the number %s',
    whatsapp => {
      expect(parseSabhaRequestForm(form({ ...good, whatsapp })).ok).toBe(false);
    }
  );

  it.each(['secretary', 'a@b', 'a b@example.org', '@example.org'])(
    'refuses the email %s',
    email => {
      const result = parseSabhaRequestForm(form({ ...good, email }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.email).toBe(FOR_SABHAS_COPY.errors.email);
    }
  );

  it('refuses text past the limits', () => {
    const result = parseSabhaRequestForm(
      form({ ...good, venueName: 'x'.repeat(101), role: 'y'.repeat(61) })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.venueName).toBe(FOR_SABHAS_COPY.errors.tooLong);
    expect(result.errors.role).toBe(FOR_SABHAS_COPY.errors.tooLong);
  });

  it('hands the typed values back for redisplay', () => {
    const result = parseSabhaRequestForm(form({ ...good, whatsapp: '123' }));
    expect(result.values.venueName).toBe('Bangalore Gayana Samaja');
    expect(result.values.whatsapp).toBe('123');
  });
});

describe('buildSabhaMessage', () => {
  const request = {
    venueName: 'Bangalore Gayana Samaja',
    role: 'Secretary',
    whatsapp: '9876543210',
    email: 'secretary@example.org',
  };

  it('writes one line per fact', () => {
    expect(buildSabhaMessage(request)).toBe(
      [
        "Hello, I'd like free QR codes for Bangalore Gayana Samaja.",
        'Role: Secretary',
        'WhatsApp: +91 9876543210',
        'Email: secretary@example.org',
        'From rasika.life/for-sabhas',
      ].join('\n')
    );
  });

  it('leaves the role line out when there is none', () => {
    const { role, ...noRole } = request;
    expect(buildSabhaMessage(noRole)).not.toContain('Role:');
  });

  it('keeps "$&" in a name as typed', () => {
    expect(buildSabhaMessage({ ...request, venueName: 'A $& B' })).toContain('codes for A $& B.');
  });

  it('has no em dash', () => {
    expect(buildSabhaMessage(request)).not.toContain('\u2014');
  });
});

describe('sabhaWhatsAppUrl', () => {
  it('goes to the owner number with the encoded message', () => {
    const request = {
      venueName: 'Gayana Samaja & Sons',
      whatsapp: '9876543210',
      email: 'a@example.org',
    };
    const url = sabhaWhatsAppUrl(request);
    expect(url.startsWith(`https://wa.me/${HELP_WHATSAPP_NUMBER}?text=`)).toBe(true);
    const text = new URL(url).searchParams.get('text');
    expect(text).toBe(buildSabhaMessage(request));
  });

  it('stays well under 2,000 characters at the longest allowed input', () => {
    const url = sabhaWhatsAppUrl({
      venueName: 'ஸ'.repeat(100),
      role: 'ஸ'.repeat(60),
      whatsapp: '9876543210',
      email: `${'a'.repeat(88)}@example.org`,
    });
    expect(url.length).toBeLessThan(2000);
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
      role: 'Role',
      whatsapp: 'WhatsApp number',
      email: 'Email',
    });
    expect(FOR_SABHAS_COPY.nextStep).toBe("Thanks. We'll message you on WhatsApp within two days.");
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
