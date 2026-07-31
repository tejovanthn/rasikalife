import {
  Artist,
  ArtistAffiliation,
  ArtistAward,
  ArtistMedia,
  ArtistMembership,
  ArtistPhoto,
  Auth,
  ConcertLogItem,
  EventArtist,
  Image,
  Organiser,
} from '@rasika/core';
import { extractFromBiography } from '@rasika/core/domain/artist/bio-extract';
import { toProposals } from '@rasika/core/domain/artist/bio-proposals';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { triggerReindex } from '../reindex';
import { createTRPCRouter, editorProcedure, moderatorProcedure, publicProcedure } from '../trpc';

// Every membership must resolve to a real Artist row on each side, so the
// caller gives either an existing memberId or a name to resolve via
// findOrCreateArtist — never both, never neither. Two strict object variants
// (rather than a refined single object) push that "exactly one" rule into
// the schema: supplying both fields fails every branch of the union on the
// unrecognized key, and supplying neither fails every branch on the missing
// required key.
const addMemberBaseShape = {
  groupId: z.string().min(1),
  role: z.string().max(200).optional(),
  rank: z.number().int().min(1).optional(),
};

const AddMemberInputSchema = z.union([
  z.object({ ...addMemberBaseShape, memberId: z.string().min(1) }).strict(),
  z.object({ ...addMemberBaseShape, memberName: z.string().min(1).max(200) }).strict(),
]);

// An affiliation needs a resolved Organiser on the far side, for the same reason a membership
// needs a resolved Artist: the junction's key is the pair, and a blank organiserId would write
// a hot partition that then matches every lookup. So the caller gives an existing organiserId
// or a name to resolve — the same strict two-variant union, enforcing "exactly one".
//
// Resolving a *name* here is deliberate and is not the thing the extraction pipeline is
// forbidden from doing: a moderator typing an organisation into the wizard has made an
// explicit choice. Bulk extraction never reaches this procedure.
const addAffiliationBaseShape = {
  artistId: z.string().min(1),
  role: z.string().max(200).optional(),
  discipline: z.string().max(100).optional(),
  startYear: z.number().int().min(1800).max(2100).optional(),
  endYear: z.number().int().min(1800).max(2100).optional(),
  isCurrent: z.boolean().optional(),
};

const AddAffiliationInputSchema = z.union([
  z.object({ ...addAffiliationBaseShape, organiserId: z.string().min(1) }).strict(),
  z.object({ ...addAffiliationBaseShape, organisationName: z.string().min(1).max(200) }).strict(),
]);

// A create() against an existing key surfaces DynamoDB's ConditionalCheckFailedException,
// which ElectroDB wraps and re-throws. Walk the cause chain so we can map a lost race to
// a friendly CONFLICT rather than leaking a 500.
function isConditionalCheckFailure(err: unknown): boolean {
  for (let cause: unknown = err, hops = 0; cause && hops < 5; hops++) {
    const e = cause as { name?: string; code?: string; cause?: unknown };
    if (
      e.name === 'ConditionalCheckFailedException' ||
      e.code === 'ConditionalCheckFailedException'
    ) {
      return true;
    }
    cause = e.cause;
  }
  return false;
}

export const artistRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => Artist.getArtist(input.id)),

  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Artist.listArtists(input)),

  // Live DB search for the moderator find-or-create pickers (SearchSelect).
  // Unlike search.searchArtists (Fuse index in S3), this hits the table
  // directly, so an artist created a moment ago in one modal is findable in
  // the next one — the Fuse index only refreshes on a 5-minute throttle.
  // Moderator-only: it pages the whole artist table into memory per call.
  searchLive: moderatorProcedure
    .input(z.object({ query: z.string(), limit: z.number().int().min(1).max(50).optional() }))
    .query(async ({ input }) => {
      const query = input.query.trim();
      // Below two characters, skip the work entirely. Every call pages the whole
      // artist table into memory (see below), and a one-character query matches
      // almost everything while helping no one — the client debounces at 2 too.
      if (query.length < 2) return [];
      const limit = input.limit ?? 10;

      // Cheap exact hit on the byName GSI first. getArtistByName already
      // excludes soft-deleted rows and follows mergedIntoId to the surviving
      // record, so nothing further to filter here.
      const exact = await Artist.getArtistByName(query);

      // Broaden with the shared ranker in dedup.ts, which does prefix and substring
      // matching and keeps the fuzzy scorer for typo tolerance only. Scoring on similarity
      // alone put every unrelated artist at the differing-surname cap, so they tied and the
      // dropdown filled with whoever came back first — while a half-typed name ranked below
      // that noise.
      //
      // listAllArtistsForMatching pages the *entire* artist table into memory
      // (see the scaling-limit note on that function in dedup.ts). Acceptable
      // for a moderator-only typeahead at today's row counts, not free — it
      // will need the same indexed-attribute fix dedup.ts describes if the
      // table grows enough for either call site to feel it.
      const candidates = await Artist.listAllArtistsForMatching();
      const ranked = Artist.rankArtistSearchResults(
        query,
        candidates.filter(candidate => candidate.id !== exact?.id)
      );

      const results = exact ? [exact, ...ranked] : ranked;
      return results
        .slice(0, limit)
        .map(artist => ({ id: artist.id, name: artist.name, title: artist.title }));
    }),

  // The picker create-path: resolve a typed name to an artist, creating one only
  // when nothing matches. Routes through findOrCreateArtist — the shared dedup
  // helper — so the wizard's guru/member pickers cannot spawn a duplicate the
  // way a blind create would. Moderator-only, since it can create a record.
  resolveOrCreate: moderatorProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { artist, created } = await Artist.findOrCreateArtist(input.name);
      if (created) triggerReindex();
      return { id: artist.id, name: artist.name, title: artist.title, created };
    }),

  /**
   * Resolve a photographer's name to an Artist record, creating an unlisted one if needed.
   *
   * A photographer is a person, so they are an Artist rather than a parallel entity: that buys
   * find-or-create through the shared dedup helper and the byName GSI, both of which a new
   * entity would have needed building again.
   *
   * `unlisted` is set here rather than accepted from the caller, so this endpoint cannot be
   * used to hide a performer from the artist index.
   */
  resolvePhotographer: moderatorProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { artist, created } = await Artist.findOrCreateArtist(input.name, { unlisted: true });
      // No triggerReindex: an unlisted record is excluded from the corpus by listArtists, so
      // there is nothing new to index.
      return { id: artist.id, name: artist.name, created };
    }),

  create: editorProcedure.input(Artist.CreateArtistSchema).mutation(async ({ input }) => {
    const result = await Artist.createArtist(input);
    triggerReindex();
    return result;
  }),

  // moderatorProcedure, not editor: editing an existing artist directly is the
  // review-gated path, so editors go through the Edit draft flow instead. The
  // moderator wizard is this procedure's only caller; the edit-approval flow
  // uses the core updateArtist directly. Gating here makes editor-review-only a
  // real API boundary rather than a UI convention — and subsumes the old
  // isGroup-only moderator guard, since the whole mutation is now moderator.
  update: moderatorProcedure
    .input(
      z.object({
        id: z.string().min(1),
        data: Artist.UpdateArtistSchema,
        // Names the optional fields to empty. A value cannot say this: website is validated
        // with .url(), so '' would fail the schema before it reached the write.
        clearFields: z.array(z.enum(Artist.CLEARABLE_ARTIST_FIELDS)).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await Artist.updateArtist(input.id, input.data, input.clearFields);
      triggerReindex();
      return result;
    }),

  delete: moderatorProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await Artist.softDeleteArtist(input.id);
      triggerReindex();
      return result;
    }),

  getImageUploadUrl: editorProcedure
    .input(z.object({ fileName: z.string().min(1), contentType: z.string().min(1) }))
    .mutation(({ input }) => Image.getImageUploadUrl('artist', input.fileName, input.contentType)),

  getMergeSuggestion: moderatorProcedure
    .input(z.object({ idA: z.string().min(1), idB: z.string().min(1) }))
    .query(async ({ input }) => {
      const [entityA, entityB, scoreA, scoreB] = await Promise.all([
        Artist.getArtist(input.idA),
        Artist.getArtist(input.idB),
        Artist.getArtistMergeScore(input.idA),
        Artist.getArtistMergeScore(input.idB),
      ]);
      return {
        entityA: entityA ? { id: entityA.id, name: entityA.name, score: scoreA } : null,
        entityB: entityB ? { id: entityB.id, name: entityB.name, score: scoreB } : null,
        suggestedCanonicalId: scoreA >= scoreB ? input.idA : input.idB,
      };
    }),

  addAward: moderatorProcedure
    .input(ArtistAward.AddArtistAwardSchema)
    .mutation(async ({ input }) => {
      const artist = await Artist.getArtist(input.artistId);
      if (!artist) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Artist not found' });
      }
      // addArtistAward uses create(), which fails the conditional write on a
      // duplicate (artistId, awardId). Pre-check so re-adding the same award —
      // the only way to "edit" one today, since there's no award edit UI —
      // reports itself rather than surfacing a raw "conditional request failed".
      const existing = await ArtistAward.getArtistAwards(input.artistId);
      if (existing.some(a => a.awardId === input.awardId)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `${input.awardName} is already recorded for this artist`,
        });
      }
      const result = await ArtistAward.addArtistAward(input);
      triggerReindex();
      return result;
    }),

  removeAward: moderatorProcedure
    .input(z.object({ artistId: z.string().min(1), awardId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await ArtistAward.removeArtistAward(input.artistId, input.awardId);
      triggerReindex();
      return result;
    }),

  listAwards: publicProcedure
    .input(z.object({ artistId: z.string().min(1) }))
    .query(({ input }) => ArtistAward.getArtistAwards(input.artistId)),

  addMember: moderatorProcedure.input(AddMemberInputSchema).mutation(async ({ input }) => {
    const group = await Artist.getArtist(input.groupId);
    if (!group) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Group artist not found' });
    }
    // getArtist returns a merged-away tombstone (it only nulls a plain soft-delete),
    // so guard against writing an edge onto a record no profile renders. Point the
    // caller at the surviving artist instead.
    if (group.mergedIntoId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'This group has been merged into another record; add members to the surviving artist',
      });
    }
    // Without this, a member could be attached to an individual, and the
    // profile's Members block — which only renders for isGroup records — would
    // hide an edge that still exists and still gets rewritten on every merge.
    if (!group.isGroup) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Members can only be added to an artist marked as a group',
      });
    }

    let memberId: string;
    let memberName: string;
    if ('memberId' in input) {
      const member = await Artist.getArtist(input.memberId);
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member artist not found' });
      }
      if (member.mergedIntoId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'This member has been merged into another record; add the surviving artist instead',
        });
      }
      memberId = member.id;
      memberName = member.name;
    } else {
      const { artist } = await Artist.findOrCreateArtist(input.memberName);
      memberId = artist.id;
      memberName = artist.name;
    }

    if (input.groupId === memberId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'An artist cannot be its own member',
      });
    }

    // addArtistMembership uses create(), which fails the conditional write on a
    // duplicate key. Check first so re-adding an existing member reports itself
    // rather than surfacing an ElectroDB write failure as a 500.
    const existing = await ArtistMembership.getGroupMembers(input.groupId);
    if (existing.some(m => m.memberId === memberId)) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `${memberName} is already a member of ${group.name}`,
      });
    }

    try {
      const result = await ArtistMembership.addArtistMembership({
        groupId: input.groupId,
        groupName: group.name,
        memberId,
        memberName,
        role: input.role,
        rank: input.rank,
      });
      triggerReindex();
      return result;
    } catch (err) {
      // Two concurrent adds of the same member both clear the pre-check above; the
      // conditional write is the real backstop. Map its failure to the same friendly
      // CONFLICT rather than letting it surface as a 500.
      if (isConditionalCheckFailure(err)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `${memberName} is already a member of ${group.name}`,
        });
      }
      throw err;
    }
  }),

  removeMember: moderatorProcedure
    .input(z.object({ groupId: z.string().min(1), memberId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await ArtistMembership.removeArtistMembership(input.groupId, input.memberId);
      triggerReindex();
    }),

  setFeaturedPerformance: moderatorProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        artistId: z.string().min(1),
        featured: z.boolean(),
        featureRank: z.number().int().min(1).optional(),
      })
    )
    .mutation(({ input }) =>
      EventArtist.setEventArtistFeatured(
        input.eventId,
        input.artistId,
        input.featured,
        input.featureRank
      )
    ),

  // Institutional roles — founder, artistic director, faculty (§ Affiliations). Writes are
  // moderator-only, which is what stops "artistic director" being self-granted through the
  // claim flow: unlike gurus or works, an affiliation is not on the artist record at all, so
  // it never reaches CLAIMANT_EDITABLE_ARTIST_FIELDS.
  addAffiliation: moderatorProcedure
    .input(AddAffiliationInputSchema)
    .mutation(async ({ input }) => {
      const artist = await Artist.getArtist(input.artistId);
      if (!artist) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Artist not found' });
      }
      // getArtist returns a merged-away tombstone, so guard against writing an edge onto a
      // record no profile renders.
      if (artist.mergedIntoId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'This artist has been merged into another record; add affiliations to the surviving artist',
        });
      }

      let organiserId: string;
      let organisationName: string;
      if ('organiserId' in input) {
        const organiser = await Organiser.getOrganiser(input.organiserId);
        if (!organiser) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Organisation not found' });
        }
        if (organiser.mergedIntoId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'This organisation has been merged into another record; use the surviving organisation',
          });
        }
        organiserId = organiser.id;
        organisationName = organiser.name;
      } else {
        // Exact-name lookup then create. There is no fuzzy organiser matcher to mirror
        // findArtistMatch, so "IIM Bangalore" and "Indian Institute of Management Bangalore"
        // will land as two records until someone merges them — which is a moderator's job
        // and exactly what cascadeOrganiserMerge now handles for affiliation rows.
        const existing = await Organiser.getOrganiserByName(input.organisationName);
        const organiser =
          existing ?? (await Organiser.createOrganiser({ name: input.organisationName }));
        organiserId = organiser.id;
        organisationName = organiser.name;
      }

      // No pre-check for an existing pair, and no CONFLICT: addArtistAffiliation upserts, so
      // re-adding the same pair is how a moderator corrects a role or closes a date range.
      const result = await ArtistAffiliation.addArtistAffiliation({
        artistId: input.artistId,
        artistName: artist.name,
        organiserId,
        organisationName,
        role: input.role,
        discipline: input.discipline,
        startYear: input.startYear,
        endYear: input.endYear,
        isCurrent: input.isCurrent,
        // Server-assigned, never taken from the caller. A row with no source is
        // indistinguishable from an unmigrated legacy one, and provenance is the thing that
        // keeps this a reference work once claimants start filling their own profiles.
        source: 'sabha-listing',
      });
      triggerReindex();
      return result;
    }),

  removeAffiliation: moderatorProcedure
    .input(z.object({ artistId: z.string().min(1), organiserId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await ArtistAffiliation.removeArtistAffiliation(input.artistId, input.organiserId);
      triggerReindex();
    }),

  listAffiliations: publicProcedure
    .input(z.object({ artistId: z.string().min(1) }))
    .query(({ input }) => ArtistAffiliation.getArtistAffiliations(input.artistId)),

  /**
   * Reads a biography and proposes structured fields for it. Writes nothing.
   *
   * The single-artist counterpart to `pnpm cli extract-artist-bios`, which produces a CSV for a
   * corpus. Both go through the same `extractFromBiography` + `toProposals`, so the classifier,
   * the refusals and the match thresholds cannot diverge between the two.
   *
   * `biography` comes from the caller rather than the stored record on purpose: a moderator
   * pasting a long bio into the wizard wants the fields extracted from what is on screen, not
   * from what was saved last week.
   *
   * The reply is a proposal list. Nothing here touches the artist — the wizard drops these into
   * its form and the moderator publishes, which is what keeps an unknown precision rate safe:
   * every proposal is seen in context by the person best placed to reject it.
   */
  extractFromBio: moderatorProcedure
    .input(
      z.object({
        artistId: z.string().min(1),
        // Matches the biography field's own cap in CreateArtistSchema.
        biography: z.string().min(1).max(10000),
      })
    )
    .mutation(async ({ input }) => {
      const artist = await Artist.getArtist(input.artistId);
      if (!artist) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Artist not found' });
      }

      const extraction = await extractFromBiography(input.biography);
      // One full sweep of the artist corpus per call, which is the documented cost of matching
      // (see listAllArtistsForMatching). Acceptable here because this is a moderator pressing a
      // button, not a request path — but it is the reason this is a mutation and not a query,
      // so nothing caches or refetches it.
      const candidates = await Artist.listAllArtistsForMatching();
      return toProposals({ id: artist.id, name: artist.name }, extraction, candidates);
    }),

  listMembers: publicProcedure
    .input(z.object({ groupId: z.string().min(1) }))
    .query(({ input }) => ArtistMembership.getGroupMembers(input.groupId)),

  listGroups: publicProcedure
    .input(z.object({ memberId: z.string().min(1) }))
    .query(({ input }) => ArtistMembership.getMemberGroups(input.memberId)),

  // Press and media coverage (§ Publications & Media). Writes are moderator-only, matching
  // photos and awards; the list is public because the profile renders it to everyone.
  addMedia: moderatorProcedure
    .input(ArtistMedia.AddArtistMediaSchema.omit({ createdBy: true }))
    .mutation(async ({ ctx, input }) => {
      const artist = await Artist.getArtist(input.artistId);
      if (!artist) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Artist not found' });
      }
      // No triggerReindex, for the reason addPhoto gives: the search document is built from
      // name and alternateNames, so coverage cannot change it.
      return ArtistMedia.addArtistMedia({ ...input, createdBy: ctx.user.id });
    }),

  updateMedia: moderatorProcedure
    .input(
      z.object({
        artistId: z.string().min(1),
        id: z.string().min(1),
        patch: ArtistMedia.UpdateArtistMediaSchema,
      })
    )
    .mutation(({ input }) => ArtistMedia.updateArtistMedia(input.artistId, input.id, input.patch)),

  deleteMedia: moderatorProcedure
    .input(z.object({ artistId: z.string().min(1), id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await ArtistMedia.deleteArtistMedia(input.artistId, input.id);
    }),

  listMedia: publicProcedure
    .input(z.object({ artistId: z.string().min(1) }))
    .query(({ input }) => ArtistMedia.listArtistMedia(input.artistId)),

  addPhoto: moderatorProcedure
    .input(ArtistPhoto.AddArtistPhotoSchema.omit({ createdBy: true }))
    .mutation(async ({ ctx, input }) => {
      const artist = await Artist.getArtist(input.artistId);
      if (!artist) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Artist not found' });
      }
      // No triggerReindex: the search document is built from artist.name and
      // alternateNames only, so a photo change cannot alter it — and firing it would
      // hold the 5-minute reindex throttle, delaying a real rename that lands behind it.
      return ArtistPhoto.addArtistPhoto({ ...input, createdBy: ctx.user.id });
    }),

  updatePhoto: moderatorProcedure
    .input(
      z.object({
        artistId: z.string().min(1),
        id: z.string().min(1),
        patch: ArtistPhoto.UpdateArtistPhotoSchema,
      })
    )
    .mutation(async ({ input }) => {
      return ArtistPhoto.updateArtistPhoto(input.artistId, input.id, input.patch);
    }),

  deletePhoto: moderatorProcedure
    .input(z.object({ artistId: z.string().min(1), id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await ArtistPhoto.deleteArtistPhoto(input.artistId, input.id);
    }),

  listPhotos: publicProcedure
    .input(
      z.object({
        artistId: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) =>
      ArtistPhoto.listArtistPhotos(input.artistId, {
        limit: input.limit,
        nextToken: input.nextToken,
      })
    ),
});
