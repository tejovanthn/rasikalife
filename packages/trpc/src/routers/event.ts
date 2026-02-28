import { Artist, Event, Festival, Organiser, Search, Venue } from '@rasika/core';
import { z } from 'zod';
import { triggerReindex } from '../reindex';
import { createTRPCRouter, editorProcedure, moderatorProcedure, publicProcedure } from '../trpc';

export const eventRouter = createTRPCRouter({
  // === QUERIES ===

  get: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const event = await Event.getEvent(input.id);
    if (!event || event.status !== 'approved') {
      throw new Error('Event not found');
    }
    return event;
  }),

  getDraft: editorProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const event = await Event.getEvent(input.id);
    if (!event) {
      throw new Error('Draft event not found');
    }
    return event;
  }),

  listUpcoming: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Event.listUpcomingEvents(input)),

  byFestival: publicProcedure
    .input(
      z.object({
        festivalId: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) => Event.listEventsByFestival(input.festivalId, input)),

  byVenue: publicProcedure
    .input(
      z.object({
        venueId: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) => Event.listEventsByVenue(input.venueId, input)),

  byOrganiser: publicProcedure
    .input(
      z.object({
        organiserId: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) => Event.listEventsByOrganiser(input.organiserId, input)),

  byArtist: publicProcedure
    .input(
      z.object({
        artistId: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) => Event.listEventsByArtist(input.artistId, input)),

  listByMonth: publicProcedure
    .input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(({ input }) => Event.listApprovedEventsByMonth(input.yearMonth)),

  byArtForm: publicProcedure
    .input(
      z.object({
        artForm: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(({ input }) => Event.listEventsByArtForm(input.artForm, input)),

  checkPosterHash: editorProcedure
    .input(z.object({ hash: z.string().min(1) }))
    .query(async ({ input }) => {
      const record = await Event.getPosterByHash(input.hash);
      if (!record) return { duplicate: false } as const;

      // Only consider as duplicate if at least one linked event is approved
      const approvedIds: string[] = [];
      for (const id of record.eventIds) {
        const event = await Event.getEvent(id);
        if (event?.status === 'approved') {
          approvedIds.push(id);
        }
      }
      if (approvedIds.length === 0) return { duplicate: false } as const;

      return {
        duplicate: true,
        posterUrl: record.posterUrl,
        festivalId: record.festivalId,
        eventIds: approvedIds,
      } as const;
    }),

  matchEntities: editorProcedure
    .input(
      z.object({
        artistNames: z.array(z.string()).default([]),
        venueNames: z.array(z.string()).default([]),
        organiserNames: z.array(z.string()).default([]),
      })
    )
    .query(async ({ input }) => {
      type Suggestion = { id: string; name: string; score: number };
      const artists: Record<string, Suggestion[]> = {};
      const venues: Record<string, Suggestion[]> = {};
      const organisers: Record<string, Suggestion[]> = {};

      // --- Artists: exact + search index fuzzy ---
      for (const name of input.artistNames) {
        const key = name.toLowerCase();
        const suggestions: Suggestion[] = [];
        const exact = await Artist.getArtistByName(name);
        if (exact) {
          suggestions.push({ id: exact.id, name: exact.name, score: 0 });
        }
        const fuzzy = await Search.search(name, { filters: ['name'], limit: 3 });
        for (const r of fuzzy.items.filter(item => item.type === 'artist')) {
          if (!suggestions.some(s => s.id === r.id)) {
            suggestions.push({ id: r.id, name: r.name, score: r.score });
          }
        }
        if (suggestions.length > 0) artists[key] = suggestions.slice(0, 3);
      }

      // --- Venues: exact + search index fuzzy ---
      for (const name of input.venueNames) {
        const key = name.toLowerCase();
        const suggestions: Suggestion[] = [];
        const exact = await Venue.getVenueByName(name);
        if (exact) {
          suggestions.push({ id: exact.id, name: exact.name, score: 0 });
        }
        const fuzzy = await Search.search(name, { filters: ['name'], limit: 3 });
        for (const r of fuzzy.items.filter(item => item.type === 'venue')) {
          if (!suggestions.some(s => s.id === r.id)) {
            suggestions.push({ id: r.id, name: r.name, score: r.score });
          }
        }
        if (suggestions.length > 0) venues[key] = suggestions.slice(0, 3);
      }

      // --- Organisers: exact + search index fuzzy ---
      for (const name of input.organiserNames) {
        const key = name.toLowerCase();
        const suggestions: Suggestion[] = [];
        const exact = await Organiser.getOrganiserByName(name);
        if (exact) {
          suggestions.push({ id: exact.id, name: exact.name, score: 0 });
        }
        const fuzzy = await Search.search(name, { filters: ['name'], limit: 3 });
        for (const r of fuzzy.items.filter(item => item.type === 'organiser')) {
          if (!suggestions.some(s => s.id === r.id)) {
            suggestions.push({ id: r.id, name: r.name, score: r.score });
          }
        }
        if (suggestions.length > 0) organisers[key] = suggestions.slice(0, 3);
      }

      return { artists, venues, organisers };
    }),

  // === MUTATIONS ===

  getUploadUrl: editorProcedure
    .input(z.object({ fileName: z.string(), contentType: z.string() }))
    .mutation(({ input }) => Event.getUploadUrl(input.fileName, input.contentType)),

  extractFromPoster: editorProcedure
    .input(
      z.object({
        posterUploadId: z.string(),
        posterUrl: z.string().url(),
        posterHash: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return Event.extractAndCreateDrafts(
        input.posterUploadId,
        input.posterUrl,
        ctx.user.id,
        input.posterHash
      );
    }),

  submitVerified: editorProcedure
    .input(
      z.object({
        festivalId: z.string().optional(),
        festivalData: Festival.CreateFestivalSchema.optional(),
        events: z.array(
          Event.CreateEventSchema.extend({
            id: z.string().min(1),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Update festival if provided
      if (input.festivalId && input.festivalData) {
        await Festival.updateFestival(input.festivalId, {
          ...input.festivalData,
        } as Festival.UpdateFestivalInput);
        await Festival.submitFestival(input.festivalId).catch(() => {});
      }

      // Auto-create venues/organisers/artists that don't have IDs
      const venueCache = new Map<string, string>();
      const organiserCache = new Map<string, string>();
      const artistCache = new Map<string, string>();

      const resolveVenue = async (name?: string, id?: string) => {
        if (id || !name) return { venueId: id, venueName: name };
        if (venueCache.has(name)) return { venueId: venueCache.get(name), venueName: name };
        const existing = await Venue.getVenueByName(name);
        if (existing) {
          venueCache.set(name, existing.id);
          return { venueId: existing.id, venueName: name };
        }
        const created = await Venue.createVenue({ name });
        venueCache.set(name, created.id);
        return { venueId: created.id, venueName: name };
      };

      const resolveOrganiser = async (name?: string, id?: string) => {
        if (id || !name) return { organiserId: id, organiserName: name };
        if (organiserCache.has(name))
          return { organiserId: organiserCache.get(name), organiserName: name };
        const existing = await Organiser.getOrganiserByName(name);
        if (existing) {
          organiserCache.set(name, existing.id);
          return { organiserId: existing.id, organiserName: name };
        }
        const created = await Organiser.createOrganiser({ name });
        organiserCache.set(name, created.id);
        return { organiserId: created.id, organiserName: name };
      };

      const resolveArtist = async (artist: { id?: string; name: string; title?: string }) => {
        if (artist.id) return artist.id;
        const key = artist.name.toLowerCase();
        const cached = artistCache.get(key);
        if (cached) return cached;
        const existing = await Artist.getArtistByName(artist.name);
        if (existing) {
          artistCache.set(key, existing.id);
          return existing.id;
        }
        const created = await Artist.createArtist({
          name: artist.name,
          title: artist.title,
          gurus: [],
        });
        artistCache.set(key, created.id);
        return created.id;
      };

      // Update each draft event with verified data and submit for review
      const results = [];
      for (const eventInput of input.events) {
        const { id, ...eventData } = eventInput;
        const venue = await resolveVenue(eventData.venueName, eventData.venueId);
        const organiser = await resolveOrganiser(eventData.organiserName, eventData.organiserId);

        // Resolve artist IDs
        const resolvedArtists = [];
        for (const artist of eventData.artists || []) {
          const artistId = await resolveArtist(artist);
          resolvedArtists.push({ ...artist, id: artistId });
        }

        const event = await Event.submitEvent(
          id,
          {
            ...eventData,
            festivalId: input.festivalId,
            ...venue,
            ...organiser,
            artists: resolvedArtists,
          },
          ctx.user.id
        );
        results.push(event);
      }
      triggerReindex();
      return results;
    }),

  // === MODERATOR PROCEDURES ===

  approveEvent: moderatorProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await Event.approveEvent(input.eventId, ctx.user.id);
      triggerReindex();
      return result;
    }),

  rejectEvent: moderatorProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        moderatorNote: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await Event.rejectEvent(input.eventId, ctx.user.id, input.moderatorNote);
      triggerReindex();
      return result;
    }),

  listSubmittedEvents: moderatorProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Event.listSubmittedEvents(input)),

  getForReview: moderatorProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const event = await Event.getEvent(input.id);
      if (!event) {
        throw new Error('Event not found');
      }
      return event;
    }),

  getMergeSuggestion: moderatorProcedure
    .input(z.object({ idA: z.string().min(1), idB: z.string().min(1) }))
    .query(async ({ input }) => {
      const [entityA, entityB, scoreA, scoreB] = await Promise.all([
        Event.getEvent(input.idA),
        Event.getEvent(input.idB),
        Event.getEventMergeScore(input.idA),
        Event.getEventMergeScore(input.idB),
      ]);
      return {
        entityA: entityA ? { id: entityA.id, name: entityA.title, score: scoreA } : null,
        entityB: entityB ? { id: entityB.id, name: entityB.title, score: scoreB } : null,
        suggestedCanonicalId: scoreA >= scoreB ? input.idA : input.idB,
      };
    }),

  listDraftEvents: moderatorProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          nextToken: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => Event.listDraftEvents(input)),

  forceSubmitDraft: moderatorProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await Event.forceSubmitEvent(input.eventId);
      triggerReindex();
      return result;
    }),

  deleteDraftEvent: moderatorProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await Event.softDeleteEvent(input.eventId);
      triggerReindex();
      return result;
    }),

  reExtractDraft: moderatorProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existing = await Event.getEvent(input.eventId);
      if (!existing || existing.status !== 'draft') throw new Error('Draft event not found');
      if (!existing.posterUrl) throw new Error('No poster URL on this draft');

      await Event.softDeleteEvent(input.eventId);

      const { eventIds } = await Event.extractAndCreateDrafts(
        existing.posterUploadId ?? existing.id,
        existing.posterUrl,
        existing.createdBy
      );
      return { eventIds };
    }),
});
