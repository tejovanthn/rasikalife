import { serializeJsonLd } from '~/lib/json-ld';
import {
  artistJsonLd,
  breadcrumbJsonLd,
  definedTermJsonLd,
  eventJsonLd,
  faqJsonLd,
  festivalJsonLd,
  itemListJsonLd,
  musicCompositionJsonLd,
  organiserJsonLd,
  organizationJsonLd,
  venueJsonLd,
  websiteJsonLd,
} from '~/lib/structured-data';
import type {
  ArtistJsonLdInput,
  EventJsonLdInput,
  JsonLdObject,
  NestedEventInput,
} from '~/lib/structured-data';

/**
 * The one place a JSON-LD payload becomes markup.
 *
 * Everything above it is a plain function in `~/lib/structured-data`, where it can be tested;
 * this file only serialises. Nothing here should build a payload inline — vitest runs
 * `app/**\/*.test.ts` in a node environment and cannot reach into a component.
 */
function JsonLdScript({ payload }: { payload: JsonLdObject | undefined }) {
  if (!payload) return null;

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD structured data
      dangerouslySetInnerHTML={{
        // serializeJsonLd, not JSON.stringify — much of what lands here is editor-supplied
        // (sameAs, a venue's website, an entity's own name), and an unescaped `</script>` in
        // any of it ends this element and turns the rest of the payload into markup.
        __html: serializeJsonLd(payload),
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Site-wide
// ---------------------------------------------------------------------------

export function OrganizationStructuredData() {
  return <JsonLdScript payload={organizationJsonLd()} />;
}

export function WebsiteStructuredData() {
  return <JsonLdScript payload={websiteJsonLd()} />;
}

export function BreadcrumbStructuredData({
  items,
}: {
  items: Array<{ name: string; item: string }>;
}) {
  return <JsonLdScript payload={breadcrumbJsonLd(items)} />;
}

/** A listing page's entries. Build the items with the helpers below. */
export function ItemListStructuredData({ items }: { items: JsonLdObject[] }) {
  return <JsonLdScript payload={itemListJsonLd(items)} />;
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

/** A single artist. Pass `isGroup` straight through from the record. */
export function ArtistStructuredData({
  artist,
  isGroup,
}: {
  artist: ArtistJsonLdInput;
  isGroup: boolean;
}) {
  return <JsonLdScript payload={artistJsonLd(artist, isGroup)} />;
}

export function MusicCompositionStructuredData({
  composition,
}: {
  composition: Parameters<typeof musicCompositionJsonLd>[0];
}) {
  return <JsonLdScript payload={musicCompositionJsonLd(composition)} />;
}

/** A raga or a tala: a named term in a controlled vocabulary, not a work anybody authored. */
export function DefinedTermStructuredData({
  term,
}: {
  term: Parameters<typeof definedTermJsonLd>[0];
}) {
  return <JsonLdScript payload={definedTermJsonLd(term)} />;
}

export function EventStructuredData({ event }: { event: EventJsonLdInput }) {
  return <JsonLdScript payload={eventJsonLd(event)} />;
}

export function FestivalStructuredData({
  festival,
}: {
  festival: Parameters<typeof festivalJsonLd>[0];
}) {
  return <JsonLdScript payload={festivalJsonLd(festival)} />;
}

export function VenueStructuredData({ venue }: { venue: Parameters<typeof venueJsonLd>[0] }) {
  return <JsonLdScript payload={venueJsonLd(venue)} />;
}

export function OrganiserStructuredData({
  organiser,
}: {
  organiser: Parameters<typeof organiserJsonLd>[0];
}) {
  return <JsonLdScript payload={organiserJsonLd(organiser)} />;
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export function FaqStructuredData({
  faqs,
}: {
  faqs: Array<{ question: string; answer: string }>;
}) {
  return <JsonLdScript payload={faqJsonLd(faqs)} />;
}

/**
 * The questions a raga page is searched with. Each one is asked only when the record can
 * answer it, and the janya branch comes first for the reason the meta description does: a
 * janya raga stores its *parent's* mela number, so "which melakarta is X" must never be
 * answered for one.
 */
export function RagaFaqStructuredData({
  name,
  arohanam,
  avarohanam,
  melaNumber,
  parentRagaName,
}: {
  name: string;
  arohanam?: string | null;
  avarohanam?: string | null;
  melaNumber?: number | null;
  parentRagaName?: string | null;
}) {
  const faqs: Array<{ question: string; answer: string }> = [];

  if (arohanam) faqs.push({ question: `What is the arohanam of ${name} raga?`, answer: arohanam });

  if (avarohanam)
    faqs.push({ question: `What is the avarohanam of ${name} raga?`, answer: avarohanam });

  if (parentRagaName)
    faqs.push({
      question: `Is ${name} a janya raga?`,
      answer: `Yes, ${name} is a janya raga derived from ${parentRagaName}.`,
    });
  else if (melaNumber)
    faqs.push({
      question: `Which melakarta is ${name}?`,
      answer: `${name} is melakarta number ${melaNumber} in the Carnatic system.`,
    });

  return <FaqStructuredData faqs={faqs} />;
}

export type { JsonLdObject, NestedEventInput };
