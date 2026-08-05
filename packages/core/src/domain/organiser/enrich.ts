/**
 * Deriving organiser fields from the events they already ran.
 *
 * 109 organisers are in prod and exactly one carries anything beyond a name. Meanwhile 224 of
 * the 739 events carry a `contactInfo` block with a website, a phone number and an email —
 * and that block is the **organiser's**, not the venue's. The evidence is unambiguous once
 * the same data is aggregated both ways: grouped by organiser it is self-consistent and the
 * domain matches the name (Trikala → trikalaarts.com, Vanamala → vanamalaarts.org, Sri Rama
 * Lalitha Kala Mandira → srlkmandira.org), while grouped by venue it is nonsense — "Zoom"
 * collects Trikala's website, the J.N. Tata Auditorium collects SPIC MACAY's, Chowdaiah
 * Memorial Hall collects rkhegde.com, and the Indian Institute of World Culture collects
 * three different phone numbers from three different organisers.
 *
 * So contact details derived this way may be written to an organiser and must never be
 * written to a venue.
 */

import {
  ORGANISATION_TYPES,
  ORGANISER_TAGS,
  type OrganisationType,
  type OrganiserTag,
} from './schema';

/** The slice of an event this module reads. Keeps the signature independent of the entity. */
export interface EnrichmentEvent {
  artForm?: string;
  tags?: string[];
  entryType?: string;
  startDateTime?: string;
  festivalId?: string;
  contactInfo?: unknown;
}

export interface DerivedContact {
  website?: string;
  phone?: string;
  email?: string;
}

function normalize(name: string): string {
  return ` ${name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

/**
 * The organisation type a name states outright, or `undefined`.
 *
 * Deliberately narrow. "Foundation" is left undecided because the enum offers `trust` and
 * `ngo` and the name does not say which — a foundation is registered as either, and picking
 * one would be inventing a legal fact about a real organisation.
 */
export function organisationTypeFromName(name: string): OrganisationType | undefined {
  const n = normalize(name);
  // "Samskruthi - The Temple of Art" is a metaphor, not a shrine.
  const literalTemple =
    / (temple|mutt|math|devasthana|devalaya|samsthanam|goushala) /.test(n) &&
    !/ temple of /.test(n);
  if (literalTemple) return 'temple';
  if (/ (trust|nyasa) /.test(n)) return 'trust';
  // `vedike` is left out: it means "forum", and carries no claim about the body behind it —
  // "Rashtriya Nava Nirmana Vedike" is not a concert-presenting society.
  if (/ (sabha|samaja|samaaja|sangha|samithi|mandali) /.test(n)) return 'sabha';
  // Only `college` and `university`. A `vidyalaya` is a school, and the enum has no entry for
  // one — reading it as a university would promote every neighbourhood music class.
  if (/ (college|university) /.test(n)) return 'university';
  return undefined;
}

/**
 * Pick the value the events agree on. Ties keep the longer string, because the disagreements
 * in this corpus are supersets rather than conflicts — one Vanamala event lists a single
 * number and two list the same number plus a second one.
 */
function consensus(values: string[]): string | undefined {
  if (!values.length) return undefined;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
}

function readContactField(contactInfo: unknown, field: string): string | undefined {
  if (!contactInfo || typeof contactInfo !== 'object') return undefined;
  const value = (contactInfo as Record<string, unknown>)[field];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/**
 * Website, phone and email as the organiser's own events state them.
 *
 * The website is normalized to an absolute URL because `CreateOrganiserSchema` requires one
 * and the events carry both forms — `vanamalaarts.org` beside `http://nadasurabhi.org`. It is
 * also lowercased: one event shouts `WWW.RAMANAVAMITICKETS.COM`.
 */
export function organiserContactFromEvents(events: EnrichmentEvent[]): DerivedContact {
  const websites: string[] = [];
  const phones: string[] = [];
  const emails: string[] = [];

  for (const event of events) {
    const website = readContactField(event.contactInfo, 'website');
    if (website) websites.push(website);
    const phone = readContactField(event.contactInfo, 'phone');
    if (phone) phones.push(phone);
    const email = readContactField(event.contactInfo, 'email');
    if (email) emails.push(email);
  }

  const contact: DerivedContact = {};

  const website = consensus(websites);
  if (website) {
    const lowered = website.toLowerCase();
    contact.website = /^https?:\/\//.test(lowered) ? lowered : `https://${lowered}`;
  }

  const phone = consensus(phones);
  // The column is capped at 30 characters, and several events pack three numbers into it.
  if (phone && phone.length <= 30) contact.phone = phone;

  const email = consensus(emails);
  if (email) contact.email = email.toLowerCase();

  return contact;
}

/**
 * The subset of `derived` the organiser does not already hold.
 *
 * The rule the batch fill and the approval cascade share, so the two can never drift: an empty
 * field is filled, a filled one is never touched. What is stored was put there by a person, and
 * a value read off a poster is weaker evidence than that. It also makes the cascade idempotent
 * — approving a second event for the same organiser writes nothing.
 */
export function missingOrganiserContact(
  organiser: { website?: string; phone?: string; email?: string },
  derived: DerivedContact
): DerivedContact {
  const missing: DerivedContact = {};
  for (const field of ['website', 'phone', 'email'] as const) {
    const value = derived[field];
    if (value && !organiser[field]?.trim()) missing[field] = value;
  }
  return missing;
}

/** Event signals that imply a tag. An event may imply several. */
const ART_FORM_TAGS: Record<string, OrganiserTag[]> = {
  carnatic: ['carnatic'],
  hindustani: ['hindustani'],
  bharatanatyam: ['bharatanatyam', 'dance'],
  kathak: ['dance'],
  kuchipudi: ['dance'],
  odissi: ['dance'],
};

const EVENT_TAG_TAGS: Record<string, OrganiserTag[]> = {
  instrumental: ['instrumental'],
  'instrumental-music': ['instrumental'],
  veena: ['instrumental'],
  violin: ['instrumental'],
  flute: ['instrumental'],
  mandolin: ['instrumental'],
  nadaswaram: ['instrumental'],
  percussion: ['instrumental'],
  jugalbandhi: ['jugalbandi'],
  jugalbandi: ['jugalbandi'],
  'lecture-demonstration': ['lecture-demo'],
  'lecture-demo': ['lecture-demo'],
  lecture: ['lecture-demo'],
  'award-ceremony': ['award-conferring'],
  dance: ['dance'],
  'dance-recital': ['dance'],
  bharatanatyam: ['bharatanatyam', 'dance'],
  hindustani: ['hindustani'],
  carnatic: ['carnatic'],
  festival: ['festival-organiser'],
  competition: ['music-competition'],
};

/**
 * A tag needs either two events behind it, or a third of the organiser's events. The second
 * clause is what makes the rule usable at all: most organisers here have one to three events,
 * so a flat "two events" floor would leave nearly every record untagged.
 */
function meetsThreshold(count: number, total: number): boolean {
  return count >= 2 || count / total >= 1 / 3;
}

export interface OrganiserTagInput {
  name: string;
  events: EnrichmentEvent[];
}

/**
 * Tags describing what an organiser actually programmes, read off their events.
 *
 * `year-round` needs five distinct calendar months, which separates a body running a
 * continuous concert series from one that wakes up for Ramanavami. `music-school` and
 * `charitable` come from the name because no event states them.
 */
export function organiserTagsFromEvents({ name, events }: OrganiserTagInput): OrganiserTag[] {
  const total = events.length;
  if (!total) return [];

  const counts = new Map<OrganiserTag, number>();
  const bump = (tag: OrganiserTag) => counts.set(tag, (counts.get(tag) ?? 0) + 1);

  const months = new Set<string>();

  for (const event of events) {
    for (const tag of ART_FORM_TAGS[(event.artForm ?? '').toLowerCase()] ?? []) bump(tag);

    for (const raw of event.tags ?? []) {
      for (const tag of EVENT_TAG_TAGS[raw.toLowerCase().trim()] ?? []) bump(tag);
    }

    if (event.entryType === 'free') bump('free-entry');
    if (event.entryType === 'ticketed') bump('ticketed');
    if (event.festivalId) bump('festival-organiser');

    if (event.startDateTime) months.add(event.startDateTime.slice(0, 7));
  }

  const tags = new Set<OrganiserTag>();
  for (const [tag, count] of counts) {
    if (meetsThreshold(count, total)) tags.add(tag);
  }

  if (months.size >= 5) tags.add('year-round');

  const n = normalize(name);
  // `academy` has to be qualified by an art form. Bare, it takes in the Karnataka Engineers
  // Academy, whose hall hosts concerts but which teaches nobody to sing.
  const teachesAnArt =
    / (music|dance|sangeet|sangeeta|sangeetha|natya|nritya|nrityoma|performing arts|fine arts) (academy|school|vidyalaya|college|kendra) /.test(
      n
    ) ||
    / (academy|school|vidyalaya|gurukul) (of|for) (music|dance|performing|fine|indian) /.test(n) ||
    / (vidyalaya|gurukul|kala kendra|vidya kendra|college of music) /.test(n);
  if (teachesAnArt) tags.add('music-school');
  if (/ charitable /.test(n)) tags.add('charitable');

  // Stable order, so a re-run does not rewrite the row just to reshuffle the list.
  return ORGANISER_TAGS.filter(tag => tags.has(tag));
}

export { ORGANISER_TAGS, ORGANISATION_TYPES };
