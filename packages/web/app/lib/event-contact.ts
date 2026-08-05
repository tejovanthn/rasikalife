/**
 * Whose contact details an event page should show.
 *
 * Most posters carry none: 515 of 739 events store no `contactInfo` at all, so the Contact
 * section simply did not render and the page lost a way to reach anybody. The organiser record
 * usually knows — its own contact details are seeded from approved events by
 * `cascadeEventContactToOrganiser`.
 *
 * The fallback is **whole-block, not per-field**. Mixing a phone number off this poster with a
 * website off the organiser's record produces one list the reader cannot take apart: they have
 * no way to tell which number is the one printed for *this* concert. So an event that states
 * any contact detail shows only its own, and one that states none borrows the organiser's,
 * labelled as the organiser's.
 *
 * Nothing is copied onto the event record. The organiser is the canonical home for these
 * details, and a copy taken at approval time goes stale the moment they change a number.
 */

export interface ContactDetails {
  phone?: string;
  email?: string;
  website?: string;
}

export interface ResolvedEventContact extends ContactDetails {
  /** Whose details these are, so the page can say so rather than implying they are the event's. */
  source: 'event' | 'organiser';
}

/** Trimmed, with blanks dropped — `{ phone: '  ' }` is not a contact detail. */
function present(contact: ContactDetails | null | undefined): ContactDetails | undefined {
  if (!contact) return undefined;
  const cleaned: ContactDetails = {};
  for (const field of ['phone', 'email', 'website'] as const) {
    const value = contact[field]?.trim();
    if (value) cleaned[field] = value;
  }
  return Object.keys(cleaned).length ? cleaned : undefined;
}

export function resolveEventContact(
  eventContact: ContactDetails | null | undefined,
  organiserContact: ContactDetails | null | undefined
): ResolvedEventContact | undefined {
  const own = present(eventContact);
  if (own) return { ...own, source: 'event' };

  const organiser = present(organiserContact);
  if (organiser) return { ...organiser, source: 'organiser' };

  return undefined;
}
