/**
 * The request for help a page shows where it has nothing sourced to show.
 *
 * A raga section with no cited data does not just vanish: it asks the reader whether they know
 * a source, and the answer arrives on WhatsApp (owner, 2026-10-27). The text names the raga,
 * the section and the page so a reply can be acted on without a follow-up question. Nothing
 * about the reader goes into the link, and it is the same for everyone, so the page stays
 * cacheable.
 */

/** The owner's WhatsApp, international format without the plus. One place, never inline. */
export const HELP_WHATSAPP_NUMBER = '919611131648';

export type RagaHelpSection = 'character' | 'movement' | 'learn';

export const RAGA_HELP_SECTION_LABELS: Record<RagaHelpSection, string> = {
  character: 'its mood and the time it is sung',
  movement: 'how it moves (its phrases and important notes)',
  learn: 'which composition to learn it from',
};

export function ragaHelpText(opts: {
  ragaName: string;
  section: RagaHelpSection;
  pageUrl: string;
}): string {
  return [
    `Hi Rasika.life, I can help with ${opts.ragaName} raga: ${RAGA_HELP_SECTION_LABELS[opts.section]}.`,
    'Source (book, page, or teacher):',
    '',
    opts.pageUrl,
  ].join('\n');
}

export function ragaHelpLink(opts: {
  ragaName: string;
  section: RagaHelpSection;
  pageUrl: string;
}): string {
  return `https://wa.me/${HELP_WHATSAPP_NUMBER}?text=${encodeURIComponent(ragaHelpText(opts))}`;
}
