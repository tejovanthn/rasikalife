import { z } from 'zod';

import { YearSchema } from '../shared/schemas';
import { SocialLinkSchema } from '../social-link';

// 'invited' is a moderator pre-authorization (artist-claim/entity.ts, §4.3.1) — it is
// a valid status for an ArtistClaim row but never a value of artist.claimStatus below:
// an invite is not itself a claim, so it never flips the public badge. It shares this
// union rather than a parallel one so the vocabulary can't drift between the two places
// it's used.
export const ARTIST_CLAIM_STATUSES = [
  'unclaimed',
  'pending',
  'verified',
  'rejected',
  'invited',
] as const;
export type ArtistClaimStatus = (typeof ARTIST_CLAIM_STATUSES)[number];

/**
 * How an artist learned from a teacher. The distinction is the whole point: a senior
 * disciple, someone who attended a three-day workshop, and someone taught by a professor
 * during a degree are all "studied under" in prose, and flattening them into one list
 * overstates the weaker three. In this domain guru lineage *is* the credential, so an
 * inflated edge is a substantive misstatement, not a cosmetic one.
 *
 * Deliberately optional on `GuruSchema`. Every row stored before this existed is a real
 * relationship of unknown type, and defaulting those to 'primary' would assert lineage the
 * data does not support — so an unlabelled row renders unlabelled and waits for a human.
 */
export const GURU_RELATIONSHIPS = ['primary', 'advanced', 'workshop', 'institutional'] as const;
export type GuruRelationship = (typeof GURU_RELATIONSHIPS)[number];

/**
 * Where a structured claim came from, recorded per row rather than per record.
 *
 * Once artists fill their own profiles, the failure mode is well known from every
 * self-declared professional profile: no title is ever downgraded, roles inflate, past
 * positions never end. A per-row provenance marker is what lets the page stay a reference
 * work — a reader can see that a role is self-asserted, and a moderator can tell an
 * extraction guess apart from a sabha listing without re-reading the bio.
 */
export const CLAIM_SOURCES = [
  'artist-claimed',
  'bio-extraction',
  'sabha-listing',
  'press',
  'iccr',
] as const;
export type ClaimSource = (typeof CLAIM_SOURCES)[number];

export const GuruSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  fromYear: YearSchema.optional(),
  toYear: YearSchema.optional(),
  discipline: z.string().max(100).optional(),
  relationship: z.enum(GURU_RELATIONSHIPS).optional(),
  source: z.enum(CLAIM_SOURCES).optional(),
});

export type Guru = z.infer<typeof GuruSchema>;

/**
 * A formal qualification. Kept as a list attribute rather than its own section-with-edges,
 * because in Indian classical arts a degree is a weak credential next to lineage — most
 * artists have none, and an institution page listing "people with a diploma from here"
 * serves nobody. `institutionId` is therefore a convenience link, not an index.
 *
 * `institution` is optional: an extractor that reads "holds a master's degree in yoga
 * therapy" with no named institution has still found a real qualification.
 */
export const CredentialSchema = z.object({
  qualification: z.string().min(1).max(200),
  institution: z.string().max(200).optional(),
  institutionId: z.string().optional(),
  year: YearSchema.optional(),
  source: z.enum(CLAIM_SOURCES).optional(),
});

export type Credential = z.infer<typeof CredentialSchema>;

/**
 * A production, ballet or choreographed piece — the dance-side equivalent of a Composition,
 * which is why it does not reuse that entity: a Composition is a repertoire item many
 * artists perform, a work is one artist's authored piece.
 *
 * `role` is optional despite always being present in practice. A production title with an
 * unclear role is still worth recording, and requiring the field would force an extractor
 * or a moderator to invent one.
 *
 * `ensembleName` is stored alongside the optional `ensembleId` and accepts staleness on a
 * rename, the same trade `featuredPerformances` documents on the entity: the list is tiny
 * and there is no reverse index to refresh it cheaply.
 */
export const WorkSchema = z.object({
  title: z.string().min(1).max(300),
  year: YearSchema.optional(),
  role: z.string().max(100).optional(),
  ensembleId: z.string().optional(),
  ensembleName: z.string().max(200).optional(),
  source: z.enum(CLAIM_SOURCES).optional(),
});

export type Work = z.infer<typeof WorkSchema>;

export const CreateArtistSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(50).optional(),
  gurus: z.array(GuruSchema).default([]),
  biography: z.string().max(10000).optional(),
  specialisations: z.array(z.string().min(1).max(100)).optional(),
  birthYear: YearSchema.optional(),
  birthPlace: z.string().max(200).optional(),
  website: z.string().url().optional(),
  socialLinks: z.array(SocialLinkSchema).optional(),
  activeYears: z.string().max(50).optional(),
  // A comma-separated list: "mridangam, vocal". One free-text field rather than an array or
  // an enum, because the values arrive from posters and scrapes where a closed set would
  // reject real data (§11.1). 200 leaves room for several without inviting an essay.
  instrument: z.string().max(200).optional(),
  city: z.string().max(200).optional(),
  practiceStartYear: YearSchema.optional(),
  debutYear: YearSchema.optional(),
  credentials: z.array(CredentialSchema).optional(),
  works: z.array(WorkSchema).optional(),
  // The arangetram — the debut recital that marks the end of formal training — is the
  // credential that matters here, so it gets flat fields rather than a row in a list.
  // Guru and venue are ids only, with no denormalized names: a name copy would need a
  // cascade sweep on every artist and venue rename, and neither has an index to drive
  // one. The profile loader resolves both, which costs two GetItems on a page already
  // running several queries and can never go stale.
  arangetramYear: YearSchema.optional(),
  arangetramGuruId: z.string().optional(),
  arangetramVenueId: z.string().optional(),
  photoUrl: z.string().url().optional(),
  photoUploadId: z.string().optional(),
  isGroup: z.boolean().optional(),
  // Keeps a record out of the artist index and the search corpus; see the entity. Set when a
  // photographer is created from a photo credit, never by a moderator form.
  unlisted: z.boolean().optional(),
});

// claimStatus and verifiedAt are deliberately absent. They are set by the
// artist-claim flow, so exposing them here would let any editor — or any
// bulk CSV import — hand themselves a verified badge.
export const UpdateArtistSchema = CreateArtistSchema.partial();

/**
 * The optional fields the moderator wizard may empty.
 *
 * Clearing needs its own channel rather than riding on the value: `website` is validated with
 * `.url()`, so `''` would fail the schema, and writing `''` for the ones that would accept it
 * leaves the row claiming the field exists and is blank. So the caller names what to remove
 * and `updateArtist` removes those attributes.
 *
 * `name` is absent deliberately: it is required, and an artist with no name is not a record
 * anyone can find or merge. `isGroup` is absent because a checkbox already says false.
 */
export const CLEARABLE_ARTIST_FIELDS = [
  'title',
  'instrument',
  'city',
  'photoUrl',
  'photoUploadId',
  'biography',
  'specialisations',
  'birthYear',
  'birthPlace',
  'practiceStartYear',
  'debutYear',
  'activeYears',
  'website',
  'socialLinks',
  'gurus',
  'credentials',
  'works',
  'arangetramYear',
  'arangetramGuruId',
  'arangetramVenueId',
] as const;

export type ClearableArtistField = (typeof CLEARABLE_ARTIST_FIELDS)[number];

/**
 * What a verified claimant may change on their own profile without a moderator (§4.3.1):
 * descriptive facts about the person, and nothing that reaches past this one record.
 *
 * The exclusions are the point, so they are listed rather than inferred:
 *
 * - `name` — a rename fires `cascadeArtistNameUpdate` across EventArtist, ArtistAward,
 *   ArtistMembership and Composition rows. Those are other people's listings.
 * - `isGroup` — `artist.update` is `moderatorProcedure` largely to hold this line (§11.1),
 *   and flipping it strands existing membership edges.
 * - `photoUrl` — the OG card lambda server-side fetches whatever URL this holds, so it is
 *   a network-request primitive, not a description. It stays with the upload flow.
 * - `alternateNames` is absent from the create schema entirely, but note for anyone adding
 *   it: it feeds the dedup matcher, so a claimant could make their record absorb the
 *   find-or-create for someone else's name.
 * - `credentials` — a degree nobody can check. Unlike a guru or a venue, a qualification
 *   has no other record on the platform to corroborate it, so self-asserted degrees go to
 *   the moderator queue. `works` stays here: a production is announced publicly and its
 *   claim is modest.
 * - `affiliations` does not appear because it is not an artist attribute at all. It lives in
 *   the ArtistAffiliation junction, written by `moderatorProcedure` — so "artistic director"
 *   cannot be self-granted, which is the role-inflation vector worth closing first.
 *
 * `gurus` stays claimant-editable, as it already was, but note the residual vector: a
 * claimant can relabel a `workshop` guru as `primary` and so inflate their own lineage. The
 * per-row `source` is what makes that visible rather than preventing it.
 *
 * An edit proposing anything outside this set is not rejected — it simply goes to the
 * moderator queue like any other edit, which is where those changes belonged all along.
 */
export const CLAIMANT_EDITABLE_ARTIST_FIELDS = [
  'title',
  'gurus',
  'biography',
  'specialisations',
  'birthYear',
  'birthPlace',
  'website',
  'socialLinks',
  'activeYears',
  'instrument',
  'city',
  'practiceStartYear',
  'debutYear',
  'works',
  'arangetramYear',
  'arangetramGuruId',
  'arangetramVenueId',
] as const;

/** True when every proposed key is one a verified claimant may self-approve. */
export function isClaimantEditablePatch(proposedValues: Record<string, unknown>): boolean {
  const allowed = new Set<string>(CLAIMANT_EDITABLE_ARTIST_FIELDS);
  return Object.keys(proposedValues).every(key => allowed.has(key));
}
