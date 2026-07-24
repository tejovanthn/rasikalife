import {
  Artist,
  ArtistAward,
  ArtistMembership,
  ArtistPhoto,
  Auth,
  ConcertLogItem,
  EventArtist,
  EventSetlist,
  Image,
} from '@rasika/core';
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
      if (!query) return [];
      const limit = input.limit ?? 10;

      // Cheap exact hit on the byName GSI first. getArtistByName already
      // excludes soft-deleted rows and follows mergedIntoId to the surviving
      // record, so nothing further to filter here.
      const exact = await Artist.getArtistByName(query);

      // Broaden with the same fuzzy scorer dedup.ts uses to decide whether two
      // names refer to the same artist, rather than a second similarity
      // function — that module is the single source of truth for artist name
      // matching, with carefully-tuned threshold behaviour we don't want to
      // fork.
      //
      // listAllArtistsForMatching pages the *entire* artist table into memory
      // (see the scaling-limit note on that function in dedup.ts). Acceptable
      // for a moderator-only typeahead at today's row counts, not free — it
      // will need the same indexed-attribute fix dedup.ts describes if the
      // table grows enough for either call site to feel it.
      const candidates = await Artist.listAllArtistsForMatching();
      const ranked = candidates
        .filter(candidate => candidate.id !== exact?.id)
        .map(candidate => {
          const names = [candidate.name, ...(candidate.alternateNames ?? [])];
          const score = Math.max(...names.map(name => Artist.artistNameSimilarity(query, name)));
          return { candidate, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ candidate }) => candidate);

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
    .input(z.object({ id: z.string().min(1), data: Artist.UpdateArtistSchema }))
    .mutation(async ({ input }) => {
      const result = await Artist.updateArtist(input.id, input.data);
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

  listFeaturedPerformances: publicProcedure
    .input(z.object({ artistId: z.string().min(1), limit: z.number().min(1).max(50).optional() }))
    .query(({ input }) =>
      EventArtist.getFeaturedEventsByArtist(input.artistId, { limit: input.limit })
    ),

  listMembers: publicProcedure
    .input(z.object({ groupId: z.string().min(1) }))
    .query(({ input }) => ArtistMembership.getGroupMembers(input.groupId)),

  listGroups: publicProcedure
    .input(z.object({ memberId: z.string().min(1) }))
    .query(({ input }) => ArtistMembership.getMemberGroups(input.memberId)),

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

  getRepertoire: publicProcedure
    .input(z.object({ artistId: z.string().min(1) }))
    .query(async ({ input }) => {
      // Get events where this artist performed
      const { items: eventArtistLinks } = await EventArtist.getEventsByArtist(input.artistId, {
        limit: 50,
      });
      const eventIds = eventArtistLinks.map(ea => ea.eventId);

      if (eventIds.length === 0) {
        return { topCompositions: [], topRagas: [] };
      }

      // Get EventSetlist rows for all those events
      const setlistArrays = await Promise.all(
        eventIds.map(eventId => EventSetlist.getEventSetlist(eventId))
      );
      const allRows = setlistArrays.flat();

      // Count compositions
      const compositionCounts = new Map<string, { title: string; count: number }>();
      for (const row of allRows) {
        if (row.compositionId) {
          const entry = compositionCounts.get(row.compositionId);
          if (entry) {
            entry.count++;
          } else {
            compositionCounts.set(row.compositionId, { title: row.compositionTitle, count: 1 });
          }
        }
      }

      // Count ragas
      const ragaCounts = new Map<string, { name: string; count: number }>();
      for (const row of allRows) {
        if (row.ragaId) {
          const entry = ragaCounts.get(row.ragaId);
          if (entry) {
            entry.count++;
          } else {
            ragaCounts.set(row.ragaId, { name: row.ragaName ?? row.ragaId, count: 1 });
          }
        }
      }

      return {
        topCompositions: [...compositionCounts.entries()]
          .map(([id, { title, count }]) => ({ id, title, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        topRagas: [...ragaCounts.entries()]
          .map(([id, { name, count }]) => ({ id, name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      };
    }),
});
