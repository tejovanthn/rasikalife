/**
 * Printed strings, verbatim from `docs/plans/261112-01-venue-qr-follow/copy.md`
 * ("Printed stickers, tents, posters"). Do not reword here: change copy.md first.
 *
 * The Kannada lines are drafts. A native speaker must review them before the first print run.
 */
export const STICKER_COPY = {
  headline: 'Scan to follow concerts here',
  kannada: 'ಇಲ್ಲಿನ ಸಂಗೀತ ಕಛೇರಿಗಳ ಮಾಹಿತಿಗಾಗಿ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ',
  footer: 'rasika.life',
} as const;

export const PANEL_COPY = {
  headline: "Don't miss the next concert",
  body: "Scan to follow this sabha, this hall and tonight's artists. Get a weekly list and a reminder the day before.",
  kannada: 'ಮುಂದಿನ ಕಛೇರಿಯನ್ನು ತಪ್ಪಿಸಿಕೊಳ್ಳಬೇಡಿ. ಸ್ಕ್ಯಾನ್ ಮಾಡಿ, ಫಾಲೋ ಮಾಡಿ.',
  reassurance: 'Free. No app needed.',
  footer: 'rasika.life',
} as const;

export function codeLine(code: string): string {
  return `Code ${code}`;
}
