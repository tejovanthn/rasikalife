import { describe, expect, it } from 'vitest';
import { HELP_WHATSAPP_NUMBER, ragaHelpLink, ragaHelpText } from './help-request';

const opts = {
  ragaName: 'Bhairavi',
  section: 'movement' as const,
  pageUrl: 'https://rasika.life/carnatic/ragas/bhairavi-38avUziLkV5coHIV2RKJ2Dm8zez',
};

describe('ragaHelpText', () => {
  it('names the raga, the section and the page', () => {
    const text = ragaHelpText(opts);
    expect(text).toContain('Bhairavi raga');
    expect(text).toContain('how it moves');
    expect(text).toContain(opts.pageUrl);
  });
});

describe('ragaHelpLink', () => {
  it('opens a chat with the owner, text filled in', () => {
    const link = ragaHelpLink(opts);
    expect(link.startsWith(`https://wa.me/${HELP_WHATSAPP_NUMBER}?text=`)).toBe(true);
    expect(decodeURIComponent(link.split('text=')[1] ?? '')).toBe(ragaHelpText(opts));
  });
});
